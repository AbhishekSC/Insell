import { logger } from "../../utils/logger.js";

export async function processFanoutJob(job) {
  const { name, data } = job;

  switch (name) {
    case "offer-accepted": {
      const { offerId, postId, declinedOfferBuyerIds, buyerId, sellerId, streamChannelData } = data;
      const NotificationService = (await import("../../services/NotificationService.js")).default;

      if (declinedOfferBuyerIds?.length) {
        await Promise.allSettled(
          declinedOfferBuyerIds.map((buyerId) =>
            NotificationService.send({
              recipientId: buyerId,
              actorId: sellerId,
              type: "offer_declined",
              message: "Your offer was declined",
              propertyPostId: postId,
              offerId,
            })
          )
        );
      }

      if (streamChannelData) {
        try {
          const { sendSystemMessageToDirectChannel } = await import("../../services/stream.service.js");
          await sendSystemMessageToDirectChannel(
            streamChannelData.userId1,
            streamChannelData.userId2,
            streamChannelData.message
          );
        } catch (err) {
          logger.warn(`[Fanout] Stream Chat message failed for offer ${offerId}: ${err?.message}`);
        }
      }

      if (buyerId && sellerId) {
        const User = (await import("../../models/User.model.js")).default;
        await Promise.allSettled([
          User.findByIdAndUpdate(buyerId, { $addToSet: { friends: sellerId } }),
          User.findByIdAndUpdate(sellerId, { $addToSet: { friends: buyerId } }),
        ]);
      }

      logger.info(`[Fanout] Processed offer-accepted for ${offerId}`);
      return { offerId };
    }

    case "close-active-offers": {
      const { postId, acceptedOfferId } = data;
      const Offer = (await import("../../models/Offer.model.js")).default;
      const NotificationService = (await import("../../services/NotificationService.js")).default;

      const activeOffers = await Offer.find({
        propertyPost: postId,
        _id: { $ne: acceptedOfferId },
        status: { $in: ["pending", "countered"] },
      }).lean();

      if (activeOffers.length) {
        await Offer.updateMany(
          { _id: { $in: activeOffers.map((o) => o._id) } },
          { $set: { status: "closed" } }
        );

        await Promise.allSettled(
          activeOffers.map((offer) =>
            NotificationService.send({
              recipientId: offer.buyer,
              type: "offer_closed",
              message: "This property is no longer available",
              propertyPostId: postId,
              offerId: offer._id,
            })
          )
        );
      }

      logger.info(`[Fanout] Closed ${activeOffers.length} active offers for post ${postId}`);
      return { closed: activeOffers.length };
    }

    case "price-drop-alerts": {
      const { postId, oldPrice } = data;
      const PropertyPost = (await import("../../models/PropertyPost.model.js")).default;
      const { notifyTriggeredAlerts } = await import("../../modules/price-alert/priceAlert.app.service.js");
      const { notifyPriceChange } = await import("../../controllers/propertyPost.controller.js");

      const post = await PropertyPost.findById(postId).lean();
      if (!post) return { skipped: true };

      const alertedUserIds = await notifyTriggeredAlerts(post, oldPrice);
      await notifyPriceChange(post, oldPrice, new Set((alertedUserIds || []).map(String)));

      logger.info(`[Fanout] Price drop alerts sent for post ${postId}`);
      return { postId };
    }

    case "bulk-notify": {
      const { recipientIds, notification } = data;
      const NotificationService = (await import("../../services/NotificationService.js")).default;

      await Promise.allSettled(
        recipientIds.map((recipientId) =>
          NotificationService.send({ ...notification, recipientId })
        )
      );

      logger.info(`[Fanout] Bulk notified ${recipientIds.length} recipients`);
      return { notified: recipientIds.length };
    }

    case "deal-nudge": {
      const { dealIds } = data;
      const Deal = (await import("../../models/Deal.model.js")).default;
      const NotificationService = (await import("../../services/NotificationService.js")).default;

      const deals = await Deal.find({ _id: { $in: dealIds } }).lean();

      await Promise.allSettled(
        deals.flatMap((deal) =>
          [deal.buyer, deal.owner].map((recipientId) =>
            NotificationService.send({
              recipientId,
              type: "deal_nudge",
              message: "Your deal needs attention",
              dealId: deal._id,
            })
          )
        )
      );

      await Deal.updateMany(
        { _id: { $in: dealIds } },
        { $set: { lastNudgedAt: new Date() } }
      );

      logger.info(`[Fanout] Nudged ${deals.length} stalled deals`);
      return { nudged: deals.length };
    }

    case "broadcast": {
      const { recipientIds, notification, realtimeEvent } = data;
      const Notification = (await import("../../models/Notification.model.js")).default;

      const CHUNK = 1000;
      const docs = recipientIds.map((recipientId) => ({
        recipient: recipientId,
        actor: notification.actor,
        type: notification.type,
        message: notification.message,
        image: notification.image || undefined,
        createdAt: notification.createdAt || new Date(),
        updatedAt: notification.updatedAt || new Date(),
      }));

      for (let i = 0; i < docs.length; i += CHUNK) {
        await Notification.insertMany(docs.slice(i, i + CHUNK), { ordered: false });
      }

      if (realtimeEvent) {
        const { pushRealtimeNotification } = await import("../../services/stream.service.js");
        const REALTIME_BATCH = 50;
        for (let i = 0; i < recipientIds.length; i += REALTIME_BATCH) {
          await Promise.allSettled(
            recipientIds.slice(i, i + REALTIME_BATCH).map((uid) =>
              pushRealtimeNotification(uid, realtimeEvent)
            )
          );
        }
      }

      logger.info(`[Fanout] Broadcast to ${recipientIds.length} recipients`);
      return { notified: recipientIds.length };
    }

    default:
      logger.warn(`Unknown fanout job: ${name}`);
  }
}

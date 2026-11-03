import { DEAL_STAGES } from "../../models/Deal.model.js";

export function serializeDeal(deal) {
  const stages = DEAL_STAGES[deal.mode] || DEAL_STAGES.BUY;
  const done = new Set(deal.completedStages || []);
  const keys = stages.map((s) => s.key);
  const label = (k) => stages.find((s) => s.key === k)?.label || k;
  const nextStage = deal.status === "ACTIVE" ? keys.find((k) => !done.has(k)) || null : null;
  return {
    ...(deal.toObject ? deal.toObject() : deal),
    stages: stages.map((s) => ({ ...s, done: done.has(s.key) })),
    nextStage,
    pendingStageLabel: deal.pendingStage ? label(deal.pendingStage.key) : null,
  };
}

export function toMyDealDTO(d) {
  return {
    ...d,
    stages: (DEAL_STAGES[d.mode] || DEAL_STAGES.BUY).map((s) => ({
      ...s,
      done: (d.completedStages || []).includes(s.key),
    })),
  };
}

export function toAdminDealDTO(d) {
  return {
    _id: d._id,
    postId: d.post?._id,
    title: d.post?.title || "—",
    buyer: { id: d.buyer?._id || null, name: d.buyer?.fullName || "—" },
    owner: { id: d.owner?._id || null, name: d.owner?.fullName || "—" },
    status: d.status,
    currentStage: d.currentStage,
    mode: d.mode,
    agreedPrice: d.agreedPrice,
    disputed: d.disputed,
    openReports: (d.reports || []).filter((r) => !r.resolved).length,
    progress: `${(d.completedStages || []).length}`,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export function toAttentionDealDTO(d) {
  return {
    _id: d._id,
    postId: d.post?._id,
    title: d.post?.title || "—",
    buyer: { id: d.buyer?._id || null, name: d.buyer?.fullName || "—" },
    owner: { id: d.owner?._id || null, name: d.owner?.fullName || "—" },
    status: d.status,
    currentStage: d.currentStage,
    disputed: d.disputed,
    openReports: (d.reports || []).filter((r) => !r.resolved).map((r) => ({ by: r.by, reason: r.reason, at: r.at })),
    agreedPrice: d.agreedPrice,
    updatedAt: d.updatedAt,
  };
}

export function toDealSummaryDTO(deal, stages, verificationToken) {
  const verifiedDocsCount = (deal.attachments || []).filter((a) => a.verifiedBy).length;
  const totalDocsCount = (deal.attachments || []).length;
  const paidAmount = deal.paymentAmount || deal.paymentDetails?.amount || 0;
  const balancePayable = Math.max(0, (deal.agreedPrice || 0) - paidAmount);

  return {
    dealId: deal._id,
    statementNumber: `NMS-DEAL-${String(deal._id).slice(-8).toUpperCase()}`,
    generatedAt: new Date(),
    status: deal.status,
    mode: deal.mode,
    agreedPrice: deal.agreedPrice,
    verificationToken,
    post: deal.post,
    closedAt: deal.completedAt || deal.updatedAt,
    breakdown: {
      agreedPrice: deal.agreedPrice,
      tokenAdvancePaid: paidAmount,
      balancePayable,
      paymentDetails: {
        paymentMode: deal.paymentDetails?.paymentMode || "NEFT",
        transactionRef: deal.paymentDetails?.transactionRef || "",
        bankName: deal.paymentDetails?.bankName || "",
        paidAt: deal.paymentDetails?.paidAt || null,
      },
    },
    closingChecklist: stages.map((s) => ({
      key: s.key,
      label: s.label,
      status: s.completed ? "COMPLETED" : "PENDING",
      completedAt: s.completed ? deal.updatedAt : null,
    })),
    legalDocuments: (deal.attachments || []).map((a) => ({
      id: a._id,
      name: a.name,
      category: a.category || "OTHER",
      stage: a.stage,
      verified: Boolean(a.verifiedBy),
      verifiedBy: a.verifiedBy?.fullName || null,
      verifiedAt: a.verifiedAt || null,
    })),
    completedStagesCount: deal.completedStages?.length || 0,
    totalStagesCount: stages.length,
    property: {
      id: deal.post?._id,
      title: deal.post?.title || "Property",
      address: deal.post?.address || `${deal.post?.locality || ""}, ${deal.post?.city || ""}`.trim(),
      city: deal.post?.city,
      listingType: deal.post?.listingType,
      coverImage: deal.post?.mediaUrls?.[0] || null,
    },
    parties: {
      buyer: {
        id: deal.buyer?._id,
        name: deal.buyer?.fullName || "Buyer",
        email: deal.buyer?.email,
        isVerified: deal.buyer?.isVerified || false,
      },
      owner: {
        id: deal.owner?._id,
        name: deal.owner?.fullName || "Owner",
        email: deal.owner?.email,
        isVerified: deal.owner?.isVerified || false,
      },
    },
    payment: {
      agreedPrice: deal.agreedPrice,
      paidAmount: paidAmount || null,
      paymentMode: deal.paymentDetails?.paymentMode || "NEFT",
      transactionRef: deal.paymentDetails?.transactionRef || "",
      bankName: deal.paymentDetails?.bankName || "",
      paidAt: deal.paymentDetails?.paidAt || null,
      confirmedBy: deal.paymentConfirmedBy?.fullName || null,
    },
    milestones: stages,
    documents: {
      total: totalDocsCount,
      verified: verifiedDocsCount,
      list: (deal.attachments || []).map((a) => ({
        id: a._id,
        name: a.name,
        category: a.category || "OTHER",
        stage: a.stage,
        verified: Boolean(a.verifiedBy),
        verifiedBy: a.verifiedBy?.fullName || null,
        verifiedAt: a.verifiedAt || null,
      })),
    },
    timeline: (deal.history || []).map((h) => ({
      action: h.action,
      stage: h.stage,
      message: h.message,
      at: h.at,
    })),
  };
}

export function toPublicVerificationDTO(deal, stages, token, isTamperFree) {
  const verifiedDocs = (deal.attachments || []).filter((a) => a.verifiedBy);
  const geoVerifiedDocs = (deal.attachments || []).filter((a) => a.geoVerified);

  return {
    verified: isTamperFree,
    statementNumber: `NMS-DEAL-${String(deal._id).slice(-8).toUpperCase()}`,
    verificationToken: token,
    tamperCheckStatus: isTamperFree ? "VERIFIED_AUTHENTIC" : "SIGNATURE_MISMATCH",
    verifiedAt: new Date(),
    deal: {
      id: deal._id,
      status: deal.status,
      mode: deal.mode,
      agreedPrice: deal.agreedPrice,
      completedStagesCount: deal.completedStages?.length || 0,
      totalStagesCount: stages.length,
      closedAt: deal.completedAt || deal.updatedAt,
    },
    property: {
      id: deal.post?._id,
      title: deal.post?.title || "Property",
      address: deal.post?.address || `${deal.post?.locality || ""}, ${deal.post?.city || ""}`.trim(),
      city: deal.post?.city,
      listingType: deal.post?.listingType,
      coverImage: deal.post?.mediaUrls?.[0] || null,
    },
    parties: {
      buyer: { name: deal.buyer?.fullName || "Buyer", isVerified: Boolean(deal.buyer?.isVerified) },
      owner: { name: deal.owner?.fullName || "Owner", isVerified: Boolean(deal.owner?.isVerified) },
    },
    payment: {
      agreedPrice: deal.agreedPrice,
      paidAmount: deal.paymentAmount || deal.paymentDetails?.amount || 0,
      paymentMode: deal.paymentDetails?.paymentMode || "NEFT",
      transactionRef: deal.paymentDetails?.transactionRef || "",
      bankName: deal.paymentDetails?.bankName || "",
      paidAt: deal.paymentDetails?.paidAt || null,
    },
    checklist: stages.map((s) => ({ key: s.key, label: s.label, completed: s.completed })),
    verifiedDocumentsCount: verifiedDocs.length,
    geoVerifiedCount: geoVerifiedDocs.length,
  };
}

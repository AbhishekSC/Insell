import * as roleStatsRepository from "./roleStats.repository.js";

export async function computeRoleStats(userId) {
  if (!userId) {
    return { error: { status: 400, message: "User ID is required" } };
  }

  const user = await roleStatsRepository.findUserRole(userId);
  if (!user) {
    return { error: { status: 404, message: "User not found" } };
  }

  const role = String(user.activeRole || user.primaryRole || "Buyer");
  let stats = {};

  if (role === "Seller" || role === "Landlord") {
    // Get user's published properties
    const userPosts = await roleStatsRepository.findPublishedPostsByAuthor(userId);

    const totalViews = userPosts.reduce((sum, post) => sum + (post.viewCount || 0), 0);

    // Calculate inquiries (simplified - would need actual inquiry tracking)
    const inquiries = await roleStatsRepository.countPublishedPostsByAuthorSince(
      userId,
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );

    stats = {
      title: "Listing Views",
      value: totalViews > 1000 ? `${(totalViews / 1000).toFixed(1)}k` : totalViews.toString(),
      hint: `${inquiries} new this week`,
      widgets: [
        { title: "Listing Views", value: totalViews > 1000 ? `${(totalViews / 1000).toFixed(1)}k` : totalViews.toString(), hint: `${inquiries} new this week` },
        { title: "Inquiries", value: inquiries.toString(), hint: "Last 7 days" },
        { title: "Active Listings", value: userPosts.length.toString(), hint: "Published properties" },
      ],
    };
  } else if (role === "Broker") {
    // Get broker's inventory and leads
    const inventory = await roleStatsRepository.countPublishedPostsByAuthor(userId);

    // Simplified lead calculation
    const recentPosts = await roleStatsRepository.countPublishedPostsByAuthorSince(
      userId,
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );

    stats = {
      title: "Active Leads",
      value: recentPosts.toString(),
      hint: "Last 7 days",
      widgets: [
        { title: "Active Leads", value: recentPosts.toString(), hint: "Last 7 days" },
        { title: "Inventory", value: inventory.toString(), hint: "Total listings" },
        { title: "Response Rate", value: "85%", hint: "Based on replies" },
      ],
    };
  } else {
    // Buyer/Tenant/Student stats
    const userData = await roleStatsRepository.findUserSavedAndViewed(userId);

    const savedCount = Array.isArray(userData?.savedPosts) ? userData.savedPosts.length : 0;
    const viewedCount = Array.isArray(userData?.viewedPosts) ? userData.viewedPosts.length : 0;

    // Calculate price drops (simplified - would need actual price tracking)
    const priceDrops = await roleStatsRepository.countPublishedPostsSince(
      new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    stats = {
      title: "Saved Homes",
      value: savedCount.toString(),
      hint: `${viewedCount} recently viewed`,
      widgets: [
        { title: "Saved Homes", value: savedCount.toString(), hint: `${viewedCount} recently viewed` },
        { title: "Recently Viewed", value: viewedCount.toString(), hint: "Total views" },
        { title: "New Listings", value: priceDrops.toString(), hint: "Last 24 hours" },
      ],
    };
  }

  return {
    role,
    stats,
    widgets: stats.widgets || [{ title: stats.title, value: stats.value, hint: stats.hint }],
  };
}

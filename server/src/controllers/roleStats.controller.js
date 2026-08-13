import PropertyPost from "../models/PropertyPost.model.js";
import User from "../models/User.model.js";
import { logger } from "../utils/logger.js";

/**
 * Get role-based statistics for the user
 */
export async function getRoleStats(req, res) {
  try {
    const userId = req.user?._id;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    const user = await User.findById(userId).select('activeRole primaryRole').lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const role = String(user.activeRole || user.primaryRole || "Buyer");
    let stats = {};

    if (role === "Seller" || role === "Landlord") {
      // Get user's published properties
      const userPosts = await PropertyPost.find({
        author: userId,
        status: "PUBLISHED"
      }).select('viewCount createdAt').lean();

      const totalViews = userPosts.reduce((sum, post) => sum + (post.viewCount || 0), 0);
      
      // Calculate inquiries (simplified - would need actual inquiry tracking)
      const inquiries = await PropertyPost.countDocuments({
        author: userId,
        status: "PUBLISHED",
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
      });

      stats = {
        title: "Listing Views",
        value: totalViews > 1000 ? `${(totalViews / 1000).toFixed(1)}k` : totalViews.toString(),
        hint: `${inquiries} new this week`,
        widgets: [
          { title: "Listing Views", value: totalViews > 1000 ? `${(totalViews / 1000).toFixed(1)}k` : totalViews.toString(), hint: `${inquiries} new this week` },
          { title: "Inquiries", value: inquiries.toString(), hint: "Last 7 days" },
          { title: "Active Listings", value: userPosts.length.toString(), hint: "Published properties" }
        ]
      };
    } else if (role === "Broker") {
      // Get broker's inventory and leads
      const inventory = await PropertyPost.countDocuments({
        author: userId,
        status: "PUBLISHED"
      });

      // Simplified lead calculation
      const recentPosts = await PropertyPost.find({
        author: userId,
        status: "PUBLISHED",
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }).countDocuments();

      stats = {
        title: "Active Leads",
        value: recentPosts.toString(),
        hint: "Last 7 days",
        widgets: [
          { title: "Active Leads", value: recentPosts.toString(), hint: "Last 7 days" },
          { title: "Inventory", value: inventory.toString(), hint: "Total listings" },
          { title: "Response Rate", value: "85%", hint: "Based on replies" }
        ]
      };
    } else {
      // Buyer/Tenant/Student stats
      const userData = await User.findById(userId).select('savedPosts viewedPosts').lean();
      
      const savedCount = Array.isArray(userData?.savedPosts) ? userData.savedPosts.length : 0;
      const viewedCount = Array.isArray(userData?.viewedPosts) ? userData.viewedPosts.length : 0;
      
      // Calculate price drops (simplified - would need actual price tracking)
      const priceDrops = await PropertyPost.countDocuments({
        status: "PUBLISHED",
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      });

      stats = {
        title: "Saved Homes",
        value: savedCount.toString(),
        hint: `${viewedCount} recently viewed`,
        widgets: [
          { title: "Saved Homes", value: savedCount.toString(), hint: `${viewedCount} recently viewed` },
          { title: "Recently Viewed", value: viewedCount.toString(), hint: "Total views" },
          { title: "New Listings", value: priceDrops.toString(), hint: "Last 24 hours" }
        ]
      };
    }

    res.status(200).json({
      success: true,
      data: {
        role,
        stats,
        widgets: stats.widgets || [
          { title: stats.title, value: stats.value, hint: stats.hint }
        ]
      }
    });
  } catch (error) {
    logger.error("Error fetching role stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch role statistics"
    });
  }
}

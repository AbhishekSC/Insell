import PropertyPost from "../models/PropertyPost.model.js";
import User from "../models/User.model.js";
import { logger } from "../utils/logger.js";

/**
 * Search autocomplete endpoint
 * Returns suggestions for cities, localities, and property types
 */
export async function getSearchSuggestions(req, res) {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(200).json({
        success: true,
        data: {
          suggestions: [],
          categories: []
        }
      });
    }

    const searchRegex = new RegExp(query, 'i');

    // Get location suggestions from published properties
    const locationSuggestions = await PropertyPost.aggregate([
      {
        $match: {
          status: "PUBLISHED",
          visibility: "PUBLIC",
          $or: [
            { city: searchRegex },
            { location: searchRegex }
          ]
        }
      },
      {
        $group: {
          _id: { $ifNull: ["$city", "$location"] },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 5
      },
      {
        $project: {
          _id: 0,
          type: "location",
          value: "$_id",
          count: 1
        }
      }
    ]);

    // Get property type suggestions
    const typeSuggestions = await PropertyPost.aggregate([
      {
        $match: {
          status: "PUBLISHED",
          visibility: "PUBLIC",
          propertyType: searchRegex
        }
      },
      {
        $group: {
          _id: "$propertyType",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 3
      },
      {
        $project: {
          _id: 0,
          type: "propertyType",
          value: "$_id",
          count: 1
        }
      }
    ]);

    // Get builder/author suggestions
    const authorSuggestions = await PropertyPost.aggregate([
      {
        $match: {
          status: "PUBLISHED",
          visibility: "PUBLIC"
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "author",
          foreignField: "_id",
          as: "authorData"
        }
      },
      {
        $unwind: "$authorData"
      },
      {
        $match: {
          "authorData.fullName": searchRegex
        }
      },
      {
        $group: {
          _id: "$author",
          fullName: { $first: "$authorData.fullName" },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 3
      },
      {
        $project: {
          _id: 0,
          type: "author",
          value: "$fullName",
          authorId: { $toString: "$_id" },
          count: 1
        }
      }
    ]);

    const suggestions = [
      ...locationSuggestions,
      ...typeSuggestions,
      ...authorSuggestions
    ];

    const categories = [
      { type: "location", label: "Locations", count: locationSuggestions.length },
      { type: "propertyType", label: "Property Types", count: typeSuggestions.length },
      { type: "author", label: "Builders", count: authorSuggestions.length }
    ].filter(cat => cat.count > 0);

    res.status(200).json({
      success: true,
      data: {
        suggestions,
        categories
      }
    });
  } catch (error) {
    logger.error("Error getting search suggestions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get search suggestions"
    });
  }
}

/**
 * Save search query to user's search history
 */
export async function saveSearchHistory(req, res) {
  try {
    const userId = req.user?._id;
    const { query, resultCount = 0 } = req.body;

    if (!userId || !query) {
      return res.status(400).json({
        success: false,
        message: "User ID and query are required"
      });
    }

    // Add to search history (keep last 20 searches)
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Remove duplicate query if exists
    user.searchHistory = user.searchHistory.filter(
      item => item.query.toLowerCase() !== query.toLowerCase()
    );

    // Add new search to beginning
    user.searchHistory.unshift({
      query: query.trim(),
      searchedAt: new Date(),
      resultCount
    });

    // Keep only last 20 searches
    user.searchHistory = user.searchHistory.slice(0, 20);

    await user.save();

    res.status(200).json({
      success: true,
      message: "Search history saved"
    });
  } catch (error) {
    logger.error("Error saving search history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save search history"
    });
  }
}

/**
 * Get user's search history
 */
export async function getSearchHistory(req, res) {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    const user = await User.findById(userId).select('searchHistory').lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      data: {
        searchHistory: user.searchHistory || []
      }
    });
  } catch (error) {
    logger.error("Error getting search history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get search history"
    });
  }
}

/**
 * Clear user's search history
 */
export async function clearSearchHistory(req, res) {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    await User.findByIdAndUpdate(userId, { searchHistory: [] });

    res.status(200).json({
      success: true,
      message: "Search history cleared"
    });
  } catch (error) {
    logger.error("Error clearing search history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear search history"
    });
  }
}

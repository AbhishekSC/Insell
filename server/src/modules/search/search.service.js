import redisClient from "../../config/redisClient.config.js";
import { logger } from "../../utils/logger.js";
import {
  executeNaturalSearch,
  parseNaturalQuery,
} from "../../services/NaturalLanguageSearchService.js";
import * as searchRepository from "./search.repository.js";

export async function getSearchSuggestions(query) {
  if (!query || query.length < 2) {
    return { suggestions: [], categories: [] };
  }

  const cacheKey = `search:suggest:${query.toLowerCase().trim()}`;
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {}

  const searchRegex = new RegExp(query, 'i');
  const publishedMatch = { status: "PUBLISHED", visibility: "PUBLIC" };

  const [locationSuggestions, typeSuggestions, authorSuggestions] = await Promise.all([
    searchRepository.aggregateLocationSuggestions(publishedMatch, searchRegex),
    searchRepository.aggregateTypeSuggestions(publishedMatch, searchRegex),
    searchRepository.findAuthorSuggestions(searchRegex),
  ]);

  const suggestions = [
    ...locationSuggestions,
    ...typeSuggestions,
    ...authorSuggestions,
  ];

  const categories = [
    { type: "location", label: "Locations", count: locationSuggestions.length },
    { type: "propertyType", label: "Property Types", count: typeSuggestions.length },
    { type: "author", label: "Builders", count: authorSuggestions.length },
  ].filter(cat => cat.count > 0);

  const responseData = { suggestions, categories };
  redisClient.set(cacheKey, JSON.stringify(responseData), "EX", 300).catch(() => {});

  return responseData;
}

export async function saveSearchHistory({ userId, query, resultCount = 0 }) {
  // Add to search history (keep last 20 searches)
  const user = await searchRepository.findUserById(userId);
  if (!user) {
    return { error: { status: 404, message: "User not found" } };
  }

  // Remove duplicate query if exists
  user.searchHistory = user.searchHistory.filter(
    item => item.query.toLowerCase() !== query.toLowerCase()
  );

  // Add new search to beginning
  user.searchHistory.unshift({
    query: query.trim(),
    searchedAt: new Date(),
    resultCount,
  });

  // Keep only last 20 searches
  user.searchHistory = user.searchHistory.slice(0, 20);

  await user.save();
}

export async function getSearchHistory(userId) {
  const user = await searchRepository.findUserSearchHistory(userId);
  if (!user) {
    return { error: { status: 404, message: "User not found" } };
  }

  return { searchHistory: user.searchHistory || [] };
}

export async function clearSearchHistory(userId) {
  await searchRepository.clearUserSearchHistory(userId);
}

export async function naturalLanguageSearch({ query, currentUserId, page, limit }) {
  if (!query) {
    return {
      query: "",
      parsed: {},
      posts: [],
      total: 0,
      pagination: { page, limit, total: 0, totalPages: 0 },
    };
  }

  return executeNaturalSearch({ query, currentUserId, page, limit });
}

export function parseQueryOnly(query) {
  return parseNaturalQuery(query);
}

export function toPostCardDTO(post, currentUserId) {
  const likedBy = Array.isArray(post.likedBy) ? post.likedBy.map(String) : [];
  const savedBy = Array.isArray(post.savedBy) ? post.savedBy.map(String) : [];
  return {
    ...post,
    likesCount: post.likesCount ?? likedBy.length,
    savesCount: post.savesCount ?? savedBy.length,
    isLikedByMe: post.isLikedByMe ?? (currentUserId ? likedBy.includes(String(currentUserId)) : false),
    isSavedByMe: post.isSavedByMe ?? (currentUserId ? savedBy.includes(String(currentUserId)) : false),
  };
}

export function toPostDetailDTO(post, extras = {}) {
  return {
    ...post,
    ...extras,
  };
}

export function toMyPostDTO(post) {
  const media = Array.isArray(post.mediaUrls)
    ? post.mediaUrls.map((url) => ({ url }))
    : [];
  return {
    ...post,
    media,
    photos: post.mediaUrls || [],
  };
}

export function toAnalyticsDTO(property) {
  return {
    viewCount: property.viewCount || 0,
    shareCount: property.shareCount || 0,
    commentCount: property.commentCount || 0,
    chatCount: property.chatCount || 0,
    engagementScore: property.engagementScore || 0,
    likesCount: property.likedBy?.length || 0,
    savesCount: property.savedBy?.length || 0,
    createdAt: property.createdAt,
    publishedAt: property.publishedAt,
  };
}

export function toLikerDTO(user, connectionStatus) {
  return {
    id: String(user._id),
    fullName: user.fullName || "Member",
    avatar: user.profilePic || null,
    isVerified: Boolean(user.isVerified),
    isOwnerVerified: Boolean(user.isOwnerVerified),
    city: user.city || "",
    connectionStatus,
  };
}

export function toComparisonDTO(property) {
  return {
    id: property.id || property._id,
    title: property.title,
    price: property.price,
    propertyType: property.propertyType,
    listingType: property.listingType,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    areaSqft: property.areaSqft,
    city: property.city,
    locality: property.locality,
    latitude: property.latitude,
    longitude: property.longitude,
    mediaUrls: property.mediaUrls,
    author: property.author,
    viewCount: property.viewCount || 0,
    likesCount: property.likedBy?.length || 0,
    savesCount: property.savedBy?.length || 0,
    commentCount: property.commentCount || 0,
    shareCount: property.shareCount || 0,
    publishedAt: property.publishedAt,
    comparisonScore: property.comparisonScore,
    isBest: property.isBest || false,
    furnished: property.furnished,
    parking: property.parking,
    facing: property.facing,
    floorNumber: property.floorNumber,
    totalFloors: property.totalFloors,
    ageOfProperty: property.ageOfProperty,
    possessionStatus: property.possessionStatus,
    amenities: property.postMeta?.amenities || [],
  };
}

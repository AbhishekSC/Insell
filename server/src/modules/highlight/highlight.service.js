import * as highlightRepository from "./highlight.repository.js";

// Same rule as the rest of the app's friends-only content (e.g. the friends
// list itself, private stories): only the owner or a confirmed friend can
// see it. Highlights are built from a user's own stories, which follow the
// same visibility model, so they shouldn't be more open than the stories
// that make them up.
export async function canViewHighlights(ownerId, viewerId) {
  if (String(ownerId) === String(viewerId)) return true;
  const owner = await highlightRepository.findUserFriends(ownerId);
  return (owner?.friends || []).some((friendId) => String(friendId) === String(viewerId));
}

// Only your own story can become a highlight, and only while it's still
// within its normal 24h life — no general "archive" of every past story in
// this app, so once a story has actually expired there's nothing left to
// highlight it from.
//
// Checked against feedExpiresAt, NOT expiresAt: feedExpiresAt is a stable
// copy of the original 24h mark that nothing else touches, so this check
// can't race with anything. expiresAt, by contrast, gets unset the moment
// this function runs (below) purely to stop TTL deletion — checking THAT
// field here was the original bug (a story mid highlight-creation could
// read as "expired" before its own flow finished). See Story.model.js.
export async function claimStoryForHighlight(storyId, userId) {
  const story = await highlightRepository.findStoryByIdAndAuthor(storyId, userId);
  if (!story) return null;
  if (story.feedExpiresAt && story.feedExpiresAt <= new Date()) return null;

  // Unset rather than null/far-future date — MongoDB's TTL monitor skips
  // documents that don't have the indexed field at all, so this is what
  // makes the story permanent. Also acts as a defensive fallback in case
  // the client's earlier pin call somehow didn't land.
  if (story.expiresAt) {
    await highlightRepository.unsetStoryExpiry(story._id);
  }
  return story;
}

export async function createHighlight(userId, title, storyId) {
  const story = await claimStoryForHighlight(storyId, userId);
  if (!story) {
    return { error: { status: 400, message: "That story is unavailable or has already expired" } };
  }

  const highlight = await highlightRepository.createHighlight({
    owner: userId,
    title: title.slice(0, 30),
    coverImage: story.mediaUrl,
    stories: [story._id],
  });

  return { highlight };
}

export async function addStoryToHighlight(userId, highlightId, storyId) {
  const highlight = await highlightRepository.findHighlightByIdAndOwner(highlightId, userId);
  if (!highlight) {
    return { error: { status: 404, message: "Highlight not found" } };
  }

  const story = await claimStoryForHighlight(storyId, userId);
  if (!story) {
    return { error: { status: 400, message: "That story is unavailable or has already expired" } };
  }

  if (!highlight.stories.some((existingId) => String(existingId) === String(story._id))) {
    highlight.stories.push(story._id);
    await highlight.save();
  }

  return { highlight };
}

export async function removeStoryFromHighlight(userId, highlightId, storyId) {
  const highlight = await highlightRepository.findHighlightByIdAndOwner(highlightId, userId);
  if (!highlight) {
    return { error: { status: 404, message: "Highlight not found" } };
  }

  highlight.stories = highlight.stories.filter((existingId) => String(existingId) !== String(storyId));
  await highlight.save();

  return { highlight };
}

export async function getUserHighlights(userId, viewerId) {
  const canView = await canViewHighlights(userId, viewerId);
  if (!canView) {
    return { error: { status: 403, message: "Only friends can view this user's highlights" } };
  }

  const highlights = (await highlightRepository.findUserHighlights(userId)) || [];

  const summarized = highlights.map((h) => ({
    _id: h._id,
    title: h.title,
    coverImage: h.coverImage,
    storyCount: h.stories.length,
    createdAt: h.createdAt,
  }));

  return { highlights: summarized };
}

export async function getHighlightById(highlightId, viewerId) {
  const highlight = await highlightRepository.findHighlightByIdPopulated(highlightId);

  if (!highlight) {
    return { error: { status: 404, message: "Highlight not found" } };
  }

  const canView = await canViewHighlights(highlight.owner, viewerId);
  if (!canView) {
    return { error: { status: 403, message: "Only friends can view this user's highlights" } };
  }

  return { highlight };
}

export async function updateHighlight(userId, highlightId, body) {
  const highlight = await highlightRepository.findHighlightByIdAndOwner(highlightId, userId);
  if (!highlight) {
    return { error: { status: 404, message: "Highlight not found" } };
  }

  if (body?.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) {
      return { error: { status: 400, message: "Highlight title cannot be empty" } };
    }
    highlight.title = title.slice(0, 30);
  }
  if (body?.coverImage !== undefined) {
    highlight.coverImage = String(body.coverImage).trim();
  }

  await highlight.save();
  return { highlight };
}

export async function deleteHighlight(userId, highlightId) {
  const result = await highlightRepository.deleteHighlightByIdAndOwner(highlightId, userId);
  if (result.deletedCount === 0) {
    return { error: { status: 404, message: "Highlight not found" } };
  }

  return { success: true };
}

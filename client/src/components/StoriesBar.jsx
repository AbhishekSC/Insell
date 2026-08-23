import { useState, useEffect } from "react";
import { Plus, X, ChevronLeft, ChevronRight, Eye, Heart, MessageCircle, Share2, MapPin, Building2, IndianRupee, Clock, BookmarkPlus, Check, Loader2, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";
import toast from "react-hot-toast";
import UserListModal from "./UserListModal";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import { resolveMediaUrl } from "../lib/media";

const STORY_CATEGORIES = [
  { label: "Premium Projects", category: "premium", color: "from-amber-400 to-orange-500" },
  { label: "Luxury Homes", category: "luxury", color: "from-purple-400 to-pink-500" },
  { label: "New Launches", category: "new", color: "from-emerald-400 to-teal-500" },
  { label: "Verified Brokers", category: "verified", color: "from-blue-400 to-indigo-500" },
  { label: "Price Drops", category: "price-drop", color: "from-rose-400 to-red-500" },
  { label: "Commercial", category: "commercial", color: "from-slate-400 to-gray-500" },
  { label: "Investment", category: "investment", color: "from-violet-400 to-purple-500" },
  { label: "Trending", category: "trending", color: "from-cyan-400 to-blue-500" },
];

export default function StoriesBar() {
  const [activeStory, setActiveStory] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const queryClient = useQueryClient();
  const authData = queryClient.getQueryData(["authUser"]);
  const authUser = authData?.data?.user || authData?.data || null;

  // Fetch active stories
  const { data: storiesData, isLoading } = useQuery({
    queryKey: ["stories"],
    queryFn: async () => {
      const response = await axiosInstance.get("/stories");
      return response.data?.data?.stories || [];
    },
    refetchInterval: 8000, // Poll frequently so new stories from other users show up without a manual reload
    refetchOnWindowFocus: true,
  });

  // Create story mutation
  const { mutate: createStory, isPending: creating } = useMutation({
    mutationFn: async (storyData) => {
      const response = await axiosInstance.post("/stories", storyData);
      return response.data?.data?.story;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stories"] });
      toast.success("Story created successfully");
      setIsCreating(false);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to create story");
    },
  });

  // Upload media mutation
  const { mutate: uploadMedia, isPending: uploading } = useMutation({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append("media", file);
      const response = await axiosInstance.post("/stories/upload-media", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data?.data;
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to upload media");
    },
  });

  const stories = storiesData || [];

  // Group stories by author
  const storiesByAuthor = stories.reduce((acc, story) => {
    const authorId = story.author?._id;
    if (!acc[authorId]) {
      acc[authorId] = {
        author: story.author,
        stories: [],
      };
    }
    acc[authorId].stories.push(story);
    return acc;
  }, {});

  const authorStoriesArray = Object.values(storiesByAuthor);

  const handleStoryClick = (authorStories, index = 0) => {
    setActiveStory({ stories: authorStories, currentIndex: index });
    setCurrentStoryIndex(index);
  };

  const handleNextStory = () => {
    if (!activeStory) return;
    const nextIndex = currentStoryIndex + 1;
    if (nextIndex < activeStory.stories.length) {
      setCurrentStoryIndex(nextIndex);
    } else {
      // Move to next author
      const currentAuthorIndex = authorStoriesArray.findIndex(
        (a) => a.author._id === activeStory.stories[0].author._id
      );
      const nextAuthorIndex = currentAuthorIndex + 1;
      if (nextAuthorIndex < authorStoriesArray.length) {
        handleStoryClick(authorStoriesArray[nextAuthorIndex].stories, 0);
      } else {
        setActiveStory(null);
      }
    }
  };

  const handlePreviousStory = () => {
    if (!activeStory) return;
    const prevIndex = currentStoryIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStoryIndex(prevIndex);
    } else {
      setActiveStory(null);
    }
  };

  const handleCreateStory = async (file, caption, visibility) => {
    if (uploading) return;

    uploadMedia(file, {
      onSuccess: (mediaData) => {
        createStory({
          mediaUrl: mediaData.mediaUrl,
          mediaType: mediaData.mediaType,
          caption,
          visibility,
        });
      },
    });
  };

  return (
    <>
      {/* Stories Bar */}
      <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {/* Create Story Button - Always show */}
        <button
          type="button"
          className="flex min-w-[4.5rem] flex-col items-center gap-1"
          onClick={() => setIsCreating(true)}
        >
          <div className="relative flex size-16 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-indigo-300 bg-indigo-50 transition hover:border-indigo-400 hover:bg-indigo-100">
            <Plus className="size-6 text-indigo-600" />
          </div>
          <span className="text-[11px] font-semibold text-slate-700">Add Story</span>
        </button>

        {/* Only show stories if they exist */}
        {!isLoading && stories.length > 0 && (
          <>
            {/* All User Stories - Grouped by author */}
            {authorStoriesArray.map((authorStory) => (
              <button
                key={authorStory.author._id}
                type="button"
                className="flex min-w-[4.5rem] flex-col items-center gap-1 relative"
                onClick={() => handleStoryClick(authorStory.stories)}
              >
                <span className="block size-16 overflow-hidden rounded-full p-[2px] bg-gradient-to-br from-indigo-500 via-violet-500 to-pink-500">
                  <img
                    src={authorStory.author.profilePic || "https://placehold.co/100x100?text=User"}
                    alt={authorStory.author.fullName}
                    className="size-full rounded-full object-cover"
                  />
                </span>
                <span className="text-[11px] font-semibold text-slate-700 line-clamp-1 w-full text-center">
                  {authorStory.author.fullName?.split(" ")[0]}
                </span>
              </button>
            ))}
          </>
        )}

        {isLoading && (
          <div className="flex min-w-[4.5rem] flex-col items-center gap-1">
            <div className="size-16 animate-pulse rounded-full bg-slate-200" />
            <span className="text-[11px] text-slate-400">Loading...</span>
          </div>
        )}
      </div>

      {/* Story Viewer Modal */}
      {activeStory && (
        <StoryViewer
          story={activeStory.stories[currentStoryIndex]}
          currentIndex={currentStoryIndex}
          totalStories={activeStory.stories.length}
          authUser={authUser}
          onNext={handleNextStory}
          onPrevious={handlePreviousStory}
          onClose={() => setActiveStory(null)}
        />
      )}

      {/* Create Story Modal */}
      {isCreating && (
        <CreateStoryModal
          onClose={() => setIsCreating(false)}
          onCreate={handleCreateStory}
          isPending={creating || uploading}
        />
      )}
    </>
  );
}

export function StoryViewer({
  story,
  currentIndex,
  totalStories,
  authUser,
  onNext,
  onPrevious,
  onClose,
  highlightId,
  onRemovedFromHighlight,
}) {
  const [progress, setProgress] = useState(0);
  const [showLikes, setShowLikes] = useState(false);
  const [showSaveToHighlight, setShowSaveToHighlight] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const queryClient = useQueryClient();

  const isOwnStory = authUser?._id && story.author?._id && String(authUser._id) === String(story.author._id);
  const isLiked = Boolean(
    authUser?._id && story.likedBy?.some((id) => String(id?._id || id) === String(authUser._id))
  );

  const { mutate: toggleLike, isPending: isLiking } = useMutation({
    mutationFn: async () => {
      const response = await axiosInstance.post(`/stories/${story._id}/like`);
      return response.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stories"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update like");
    },
  });

  // Only relevant when viewing a story inside a Highlight (highlightId set) —
  // removes it from that highlight only, the underlying story itself stays
  // permanent (same as Instagram: no "undo" back into the 24h feed).
  const { mutate: removeFromHighlight, isPending: isRemoving } = useMutation({
    mutationFn: async () => {
      await axiosInstance.delete(`/highlights/${highlightId}/stories/${story._id}`);
    },
    onSuccess: () => {
      toast.success("Removed from highlight");
      setShowRemoveConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["highlights", story.author?._id] });
      queryClient.invalidateQueries({ queryKey: ["highlight", highlightId] });
      onRemovedFromHighlight?.();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to remove from highlight");
    },
  });

  const { data: likesData, isLoading: isLoadingLikes } = useQuery({
    queryKey: ["storyLikes", story._id],
    enabled: showLikes,
    retry: false,
    queryFn: async () => {
      const response = await axiosInstance.get(`/stories/${story._id}/likes`);
      return response.data?.data?.likes || [];
    },
  });

  // Auto-advance after 5 seconds — paused while the likes list or the save-to-
  // highlight modal is open, so those flows can't get yanked out from under you
  useEffect(() => {
    setProgress(0);
  }, [story]);

  useEffect(() => {
    if (showLikes || showSaveToHighlight || showRemoveConfirm || isRemoving) {
      return undefined;
    }

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          onNext();
          return 0;
        }
        return prev + 2; // 2% every 100ms = 5 seconds total
      });
    }, 100);

    return () => clearInterval(interval);
  }, [story, onNext, showLikes, showSaveToHighlight, showRemoveConfirm, isRemoving]);

  const isVideo = story.mediaType === "video";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      {/* Progress Bar */}
      <div className="absolute top-4 left-4 right-4 flex gap-1 z-10">
        {Array.from({ length: totalStories }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${i === currentIndex ? "bg-white" : "bg-white/30"}`}
          >
            {i === currentIndex && (
              <div
                className="h-full rounded-full bg-white transition-all"
                style={{ width: `${progress}%` }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Close Button */}
      <button
        type="button"
        className="absolute top-6 right-4 text-white hover:text-slate-300 z-20"
        onClick={onClose}
      >
        <X className="size-6" />
      </button>

      {/* Navigation */}
      <button
        type="button"
        className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-slate-300 z-20"
        onClick={onPrevious}
      >
        <ChevronLeft className="size-8" />
      </button>
      <button
        type="button"
        className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-slate-300 z-20"
        onClick={onNext}
      >
        <ChevronRight className="size-8" />
      </button>

      {/* Story Content */}
      <div className="relative h-full w-full max-w-lg overflow-hidden">
        {isVideo ? (
          <video
            src={resolveMediaUrl(story.mediaUrl)}
            className="h-full w-full object-contain"
            autoPlay
            controls
          />
        ) : (
          <img
            src={resolveMediaUrl(story.mediaUrl)}
            alt="Story"
            className="h-full w-full object-contain"
          />
        )}

        {/* Story Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30">
          {/* Header */}
          <div className="absolute top-6 left-4 flex items-center gap-3">
            <img
              src={story.author?.profilePic || "https://placehold.co/50x50?text=User"}
              alt={story.author?.fullName}
              className="size-10 rounded-full border-2 border-white object-cover"
            />
            <div>
              <p className="text-sm font-semibold text-white">
                {story.author?.fullName}
                {story.author?.isVerified && (
                  <span className="ml-1 text-emerald-400">✓</span>
                )}
              </p>
              <p className="text-xs text-slate-300">
                {story.author?.activeRole || story.author?.primaryRole} • {relativeTime(story.createdAt)}
              </p>
            </div>
          </div>

          {/* Caption */}
          {story.caption && (
            <div className="absolute bottom-20 left-4 right-4">
              <p className="text-sm text-white">{story.caption}</p>
            </div>
          )}

          {/* Property Link */}
          {story.propertyId && (
            <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-white/10 backdrop-blur p-3">
              <div className="flex items-center gap-3">
                <Building2 className="size-5 text-white" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white line-clamp-1">
                    {story.propertyId.title}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span className="flex items-center gap-1">
                      <IndianRupee className="size-3" />
                      {formatMoney(story.propertyId.price)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3" />
                      {story.propertyId.city}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Engagement */}
          <div className="absolute bottom-4 right-4 flex items-center gap-4 text-white">
            <div className="flex items-center gap-1">
              <Eye className="size-4" />
              <span className="text-xs">{story.viewCount}</span>
            </div>
            {isOwnStory && highlightId ? (
              <button
                type="button"
                onClick={() => setShowRemoveConfirm(true)}
                disabled={isRemoving}
                className="flex items-center gap-1 transition-opacity hover:opacity-75 disabled:opacity-60"
                title="Remove from Highlight"
              >
                {isRemoving ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              </button>
            ) : null}
            {/* expiresAt is unset the moment a story is claimed into any
                highlight (see claimStoryForHighlight) — reuse that as the
                "already highlighted" signal instead of a separate lookup. */}
            {isOwnStory && !highlightId && story.expiresAt ? (
              <button
                type="button"
                onClick={() => setShowSaveToHighlight(true)}
                className="flex items-center gap-1 transition-opacity hover:opacity-75"
                title="Save to Highlight"
              >
                <BookmarkPlus className="size-4" />
              </button>
            ) : null}
            {isOwnStory ? (
              <button
                type="button"
                onClick={() => setShowLikes(true)}
                className="flex items-center gap-1 transition-opacity hover:opacity-75"
              >
                <Heart className="size-4" />
                <span className="text-xs underline underline-offset-2">
                  {story.likedBy?.length || 0} {story.likedBy?.length === 1 ? "like" : "likes"}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => toggleLike()}
                disabled={isLiking}
                aria-label={isLiked ? "Unlike story" : "Like story"}
                className="flex items-center gap-1 transition-transform active:scale-90 disabled:opacity-60"
              >
                <Heart className={`size-4 ${isLiked ? "fill-red-500 text-red-500" : ""}`} />
                <span className="text-xs">{story.likedBy?.length || 0}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {isOwnStory ? (
        <UserListModal
          isOpen={showLikes}
          onClose={() => setShowLikes(false)}
          title="Likes"
          users={likesData}
          isLoading={isLoadingLikes}
          emptyMessage="No likes yet."
        />
      ) : null}

      {isOwnStory && showSaveToHighlight ? (
        <SaveToHighlightModal
          storyId={story._id}
          authorId={story.author?._id}
          onClose={() => setShowSaveToHighlight(false)}
        />
      ) : null}

      {isOwnStory && highlightId && showRemoveConfirm ? (
        <ConfirmDeleteModal
          title="Remove from highlight?"
          description="This story will be removed from this highlight. It won't affect any other highlights it's saved in."
          confirmLabel="Remove"
          pendingLabel="Removing..."
          isPending={isRemoving}
          onConfirm={() => removeFromHighlight()}
          onClose={() => setShowRemoveConfirm(false)}
        />
      ) : null}
    </div>
  );
}

// Lets the story's own author add it to an existing Highlight, or create a
// new one named after it — same entry point Instagram exposes from an open
// story via the "..." menu.
function SaveToHighlightModal({ storyId, authorId, onClose }) {
  const [mode, setMode] = useState("pick"); // "pick" | "create"
  const [newTitle, setNewTitle] = useState("");
  const [savedHighlightId, setSavedHighlightId] = useState(null);
  const queryClient = useQueryClient();

  const { data: highlights, isLoading } = useQuery({
    queryKey: ["highlights", authorId],
    enabled: Boolean(authorId),
    queryFn: async () => {
      const response = await axiosInstance.get(`/highlights/user/${authorId}`);
      return response.data?.data?.highlights || [];
    },
  });

  const { mutate: addToExisting, isPending: isAdding } = useMutation({
    mutationFn: async (highlightId) => {
      await axiosInstance.post(`/highlights/${highlightId}/stories`, { storyId });
      return highlightId;
    },
    onSuccess: (highlightId) => {
      setSavedHighlightId(highlightId);
      queryClient.invalidateQueries({ queryKey: ["highlights", authorId] });
      // Refetch the feed too — the story's expiresAt just got unset server-side,
      // which is what hides the "Save to Highlight" button once it's saved.
      queryClient.invalidateQueries({ queryKey: ["stories"] });
      toast.success("Saved to highlight");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to save to highlight");
    },
  });

  const { mutate: createNew, isPending: isCreating } = useMutation({
    mutationFn: async () => {
      const response = await axiosInstance.post("/highlights", { title: newTitle.trim(), storyId });
      return response.data?.data?.highlight;
    },
    onSuccess: (highlight) => {
      setSavedHighlightId(highlight._id);
      queryClient.invalidateQueries({ queryKey: ["highlights", authorId] });
      queryClient.invalidateQueries({ queryKey: ["stories"] });
      toast.success("Highlight created");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to create highlight");
    },
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Save to Highlight</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="size-5" />
          </button>
        </div>

        {mode === "pick" ? (
          <>
            {isLoading ? (
              <p className="py-6 text-center text-sm text-slate-500">Loading your highlights...</p>
            ) : (
              <div className="max-h-60 space-y-1.5 overflow-y-auto">
                {(highlights || []).map((highlight) => {
                  const isSaved = savedHighlightId === highlight._id;
                  return (
                    <button
                      key={highlight._id}
                      type="button"
                      disabled={isAdding || isSaved}
                      onClick={() => addToExisting(highlight._id)}
                      className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-slate-50 disabled:opacity-70"
                    >
                      <div className="size-11 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                        {highlight.coverImage && (
                          <img src={highlight.coverImage} alt={highlight.title} className="h-full w-full object-cover" />
                        )}
                      </div>
                      <span className="flex-1 truncate text-sm font-medium text-slate-800">{highlight.title}</span>
                      {isSaved && <Check className="size-4 text-emerald-600" />}
                    </button>
                  );
                })}
                {(highlights || []).length === 0 && (
                  <p className="py-6 text-center text-sm text-slate-500">You don't have any highlights yet.</p>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => setMode("create")}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
            >
              <Plus className="size-4" />
              New Highlight
            </button>
          </>
        ) : (
          <>
            <input
              type="text"
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              maxLength={30}
              placeholder="Highlight name"
              className="input input-bordered w-full"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setMode("pick")}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!newTitle.trim() || isCreating}
                onClick={() => createNew()}
                className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
              >
                {isCreating ? <Loader2 className="mx-auto size-4 animate-spin" /> : "Create"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CreateStoryModal({ onClose, onCreate, isPending }) {
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please select an image or video");
      return;
    }
    onCreate(file, caption, visibility);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-md max-h-[calc(100dvh-2rem)] flex-col rounded-2xl bg-white shadow-xl overflow-hidden">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Create Story</h2>
          <button
            type="button"
            className="p-1 hover:bg-slate-100 rounded-full transition"
            onClick={onClose}
          >
            <X className="size-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-5">
          {/* File Upload */}
          <div className="relative">
            <input
              type="file"
              accept="image/*,video/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
              id="story-file"
            />
            <label
              htmlFor="story-file"
              className="flex aspect-[9/16] max-h-64 sm:max-h-80 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50 transition-all"
            >
              {file ? (
                <div className="relative h-full w-full">
                  {file.type.startsWith("video") ? (
                    <video
                      src={previewUrl}
                      className="h-full w-full object-cover rounded-xl"
                    />
                  ) : (
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="h-full w-full object-cover rounded-xl"
                    />
                  )}
                  <button
                    type="button"
                    className="absolute top-2 right-2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition"
                    onClick={(e) => {
                      e.preventDefault();
                      setFile(null);
                    }}
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <div className="text-center p-6">
                  <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-indigo-100">
                    <Plus className="size-7 text-indigo-600" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">Add photo or video</p>
                  <p className="text-xs text-slate-500 mt-1">Max 30 seconds for videos</p>
                </div>
              )}
            </label>
          </div>

          {/* Caption */}
          <div>
            <textarea
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none transition resize-none text-sm"
              placeholder="Write a caption..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={500}
              rows={3}
            />
            <p className="text-xs text-slate-400 mt-1 text-right">{caption.length}/500</p>
          </div>

          {/* Visibility */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Who can see this story?</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className={`flex items-center gap-2 p-3 rounded-xl border-2 transition ${
                  visibility === "public"
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-slate-200 bg-slate-50 hover:border-slate-300"
                }`}
                onClick={() => setVisibility("public")}
              >
                <div className="flex size-8 items-center justify-center rounded-full bg-indigo-100">
                  <span className="text-lg">🌍</span>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-slate-800">Public</p>
                  <p className="text-xs text-slate-500">Everyone</p>
                </div>
              </button>
              <button
                type="button"
                className={`flex items-center gap-2 p-3 rounded-xl border-2 transition ${
                  visibility === "private"
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-slate-200 bg-slate-50 hover:border-slate-300"
                }`}
                onClick={() => setVisibility("private")}
              >
                <div className="flex size-8 items-center justify-center rounded-full bg-indigo-100">
                  <span className="text-lg">👥</span>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-slate-800">Private</p>
                  <p className="text-xs text-slate-500">Followers only</p>
                </div>
              </button>
            </div>
          </div>
        </div>

          {/* Actions */}
          <div className="shrink-0 flex gap-3 p-6 pt-4 border-t border-slate-100">
            <button
              type="button"
              className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isPending || !file}
            >
              {isPending ? "Sharing..." : "Share Story"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function relativeTime(dateString) {
  if (!dateString) return "Just now";
  const time = new Date(dateString).getTime();
  const delta = Date.now() - time;
  const hours = Math.floor(delta / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatMoney(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "Price on request";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

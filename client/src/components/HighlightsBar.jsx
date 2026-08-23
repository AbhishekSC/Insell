import { useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";
import toast from "react-hot-toast";
import { StoryViewer } from "./StoriesBar";
import { resolveMediaUrl } from "../lib/media";

// Instagram-style permanent story collections on a profile. Tapping a
// circle opens the same StoryViewer used for live 24h stories, just fed
// this highlight's own (permanent) story list instead.
export default function HighlightsBar({ userId, isOwnProfile, authUser }) {
  const queryClient = useQueryClient();
  const [viewingHighlightId, setViewingHighlightId] = useState(null);
  const [storyIndex, setStoryIndex] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: highlights, isLoading } = useQuery({
    queryKey: ["highlights", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await axiosInstance.get(`/highlights/user/${userId}`);
      return response.data?.data?.highlights || [];
    },
  });

  const { data: viewingHighlight } = useQuery({
    queryKey: ["highlight", viewingHighlightId],
    enabled: Boolean(viewingHighlightId),
    queryFn: async () => {
      const response = await axiosInstance.get(`/highlights/${viewingHighlightId}`);
      return response.data?.data?.highlight;
    },
  });

  const openHighlight = (highlightId) => {
    setViewingHighlightId(highlightId);
    setStoryIndex(0);
  };

  const handleNext = () => {
    if (!viewingHighlight) return;
    if (storyIndex + 1 < viewingHighlight.stories.length) {
      setStoryIndex((prev) => prev + 1);
    } else {
      setViewingHighlightId(null);
    }
  };

  const handlePrevious = () => {
    if (storyIndex - 1 >= 0) {
      setStoryIndex((prev) => prev - 1);
    } else {
      setViewingHighlightId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto py-1">
        {[1, 2, 3].map((item) => (
          <div key={item} className="flex shrink-0 flex-col items-center gap-1.5">
            <div className="size-16 animate-pulse rounded-full bg-slate-100" />
            <div className="h-2.5 w-10 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
    );
  }

  if (!isOwnProfile && (highlights || []).length === 0) {
    return null;
  }

  return (
    <>
      <div className="flex gap-4 overflow-x-auto py-1">
        {isOwnProfile && (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex shrink-0 flex-col items-center gap-1.5"
          >
            <div className="grid size-16 place-items-center rounded-full border-2 border-dashed border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-500">
              <Plus className="size-6" />
            </div>
            <span className="max-w-16 truncate text-xs text-slate-600">New</span>
          </button>
        )}

        {(highlights || []).map((highlight) => (
          <button
            key={highlight._id}
            type="button"
            onClick={() => openHighlight(highlight._id)}
            className="flex shrink-0 flex-col items-center gap-1.5"
          >
            <div className="size-16 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-indigo-600 p-[2px]">
              <div className="size-full rounded-full bg-white p-[2px]">
                <div className="size-full overflow-hidden rounded-full bg-slate-100">
                  {highlight.coverImage && (
                    <img src={resolveMediaUrl(highlight.coverImage)} alt={highlight.title} className="h-full w-full object-cover" />
                  )}
                </div>
              </div>
            </div>
            <span className="max-w-16 truncate text-xs text-slate-600">{highlight.title}</span>
          </button>
        ))}
      </div>

      {viewingHighlightId && viewingHighlight?.stories?.length > 0 && (
        <StoryViewer
          story={viewingHighlight.stories[storyIndex]}
          currentIndex={storyIndex}
          totalStories={viewingHighlight.stories.length}
          authUser={authUser}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onClose={() => setViewingHighlightId(null)}
          highlightId={viewingHighlightId}
          onRemovedFromHighlight={() => setViewingHighlightId(null)}
        />
      )}

      {showCreateModal && (
        <CreateHighlightModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => queryClient.invalidateQueries({ queryKey: ["highlights", userId] })}
        />
      )}
    </>
  );
}

// Picks one of your currently-active (not-yet-expired) stories to seed a
// new highlight — there's no general "story archive" in this app, so a
// highlight can only be built from stories that haven't expired yet.
function CreateHighlightModal({ onClose, onCreated }) {
  const [selectedStoryId, setSelectedStoryId] = useState(null);
  const [title, setTitle] = useState("");

  const { data: myStories, isLoading } = useQuery({
    queryKey: ["myActiveStories"],
    queryFn: async () => {
      const response = await axiosInstance.get("/stories/my");
      return response.data?.data?.activeStories || [];
    },
  });

  const { mutate: createHighlight, isPending } = useMutation({
    mutationFn: async () => {
      const response = await axiosInstance.post("/highlights", { title: title.trim(), storyId: selectedStoryId });
      return response.data?.data?.highlight;
    },
    onSuccess: () => {
      toast.success("Highlight created");
      onCreated();
      onClose();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to create highlight");
    },
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">New Highlight</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="size-5" />
          </button>
        </div>

        {isLoading ? (
          <p className="py-6 text-center text-sm text-slate-500">Loading your stories...</p>
        ) : (myStories || []).length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            You need an active story to start a highlight — post one first.
          </p>
        ) : (
          <>
            <p className="mb-2 text-xs font-medium text-slate-500">Pick a story</p>
            <div className="grid grid-cols-4 gap-2">
              {myStories.map((story) => (
                <button
                  key={story._id}
                  type="button"
                  onClick={() => setSelectedStoryId(story._id)}
                  className={`relative aspect-square overflow-hidden rounded-lg border-2 ${
                    selectedStoryId === story._id ? "border-indigo-600" : "border-transparent"
                  }`}
                >
                  {story.mediaType === "video" ? (
                    <video src={resolveMediaUrl(story.mediaUrl)} className="h-full w-full object-cover" muted />
                  ) : (
                    <img src={resolveMediaUrl(story.mediaUrl)} alt="" className="h-full w-full object-cover" />
                  )}
                  <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 py-0.5 text-[10px] font-medium leading-none text-white">
                    {formatBadgeDate(story.createdAt)}
                  </span>
                </button>
              ))}
            </div>

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={30}
              placeholder="Highlight name"
              className="input input-bordered mt-4 w-full"
            />

            <button
              type="button"
              disabled={!selectedStoryId || !title.trim() || isPending}
              onClick={() => createHighlight()}
              className="mt-4 w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {isPending ? <Loader2 className="mx-auto size-4 animate-spin" /> : "Create"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// "7 Jul" / "30 Aug" style — day + short month, no year (stories never live
// long enough for the year to matter).
function formatBadgeDate(dateString) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

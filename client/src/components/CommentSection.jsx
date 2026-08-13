import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, X, Send, RefreshCw } from "lucide-react";
import axiosInstance from "../lib/axios";
import toast from "react-hot-toast";
import CommentItem from "./CommentItem";
import CommentSkeleton from "./CommentSkeleton";

// Track reply view for personalization
const trackReplyView = async (commentId, postId) => {
  try {
    await axiosInstance.post(`/comments/${commentId}/view-replies`, { postId });
  } catch (error) {
    // Silently fail - this is just for analytics
    console.error('Failed to track reply view:', error);
  }
};

function formatRelativeTime(dateString) {
  if (!dateString) return "Just now";
  const time = new Date(dateString).getTime();
  if (!Number.isFinite(time)) return "Just now";
  const delta = Date.now() - time;
  const seconds = Math.floor(delta / 1000);
  const minutes = Math.floor(delta / (1000 * 60));
  const hours = Math.floor(delta / (1000 * 60 * 60));
  const days = Math.floor(delta / (1000 * 60 * 60 * 24));

  if (seconds < 60) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString();
}

export default function CommentSection({ post, onClose }) {
  const [newComment, setNewComment] = useState("");
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data: commentsData, isLoading: isLoadingComments, error, refetch } = useQuery({
    queryKey: ["postComments", post._id, page],
    queryFn: async () => {
      const response = await axiosInstance.get(`/comments/posts/${post._id}/comments?page=${page}`);
      return response.data?.data || { comments: [], pagination: {} };
    },
    enabled: Boolean(post._id),
  });

  const comments = commentsData?.comments || [];

  const { mutate: createComment, isPending: isCreatingComment } = useMutation({
    mutationFn: async ({ content, parentCommentId }) => {
      const response = await axiosInstance.post(`/comments/posts/${post._id}/comments`, { content, parentCommentId });
      return response.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["postComments", post._id] });
      queryClient.invalidateQueries({ queryKey: ["propertyFeed"] });
      setNewComment("");
      setActiveReplyId(null);
      toast.success("Comment added");
    },
    onError: () => {
      toast.error("Failed to add comment");
    },
  });

  const { mutate: toggleLikeComment } = useMutation({
    mutationFn: async (commentId) => {
      const response = await axiosInstance.post(`/comments/${commentId}/like`);
      return response.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["postComments", post._id] });
      queryClient.invalidateQueries({ queryKey: ["commentReplies", activeReplyId] });
    },
    onError: (error) => {
      console.error("Error liking comment:", error);
      toast.error("Failed to like comment");
    },
  });

  const handleSubmitComment = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    createComment({ content: newComment.trim() });
  };

  const handleReply = () => {
    // This will be called after a reply is successfully posted
    // We could trigger additional logic here if needed
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="size-5 text-slate-600" />
            <h3 className="text-lg font-semibold text-slate-900">Comments</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {comments.length}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-circle btn-ghost size-8 text-slate-500 hover:bg-slate-100"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Comments List */}
        <div className="max-h-96 overflow-y-auto p-4">
          {isLoadingComments ? (
            <div className="space-y-4">
              <CommentSkeleton />
              <CommentSkeleton />
              <CommentSkeleton />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm font-medium text-red-500">Failed to load comments</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-2 text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                <RefreshCw className="size-4" />
                Retry
              </button>
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageCircle className="size-12 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-700">No comments yet</p>
              <p className="mt-1 text-sm text-slate-500">Be the first to comment on this post</p>
            </div>
          ) : (
            <div className="space-y-4 w-full">
              {comments.map((comment) => (
                <CommentItem
                  key={comment._id}
                  comment={comment}
                  postId={post._id}
                  depth={0}
                  onLike={toggleLikeComment}
                  onReply={handleReply}
                  activeReplyId={activeReplyId}
                  onSetActiveReply={setActiveReplyId}
                  trackReplyView={trackReplyView}
                />
              ))}
              
              {/* Load More Button */}
              {commentsData?.pagination && page < commentsData.pagination.totalPages && (
                <button
                  type="button"
                  onClick={() => setPage(p => p + 1)}
                  className="w-full py-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Load More Comments
                </button>
              )}
            </div>
          )}
        </div>

        {/* Comment Input */}
        <div className="border-t border-slate-200 p-4">
          <form onSubmit={handleSubmitComment} className="flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              disabled={isCreatingComment}
            />
            <button
              type="submit"
              className="btn btn-circle btn-ghost size-10 shrink-0 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
              disabled={!newComment.trim() || isCreatingComment}
            >
              <Send className="size-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

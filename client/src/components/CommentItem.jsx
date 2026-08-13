import { useState, memo } from "react";
import { Heart, MessageSquareReply } from "lucide-react";
import UserAvatar from "./UserAvatar";
import ReplyInput from "./ReplyInput";
import ReplyList from "./ReplyList";
import { useQueryClient } from "@tanstack/react-query";

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

function CommentItem({ 
  comment, 
  postId, 
  depth = 0,
  onLike, 
  onReply,
  activeReplyId,
  onSetActiveReply,
  trackReplyView
}) {
  const [showReplies, setShowReplies] = useState(false);
  const [repliesLoaded, setRepliesLoaded] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const queryClient = useQueryClient();
  const maxDepth = 5; // Maximum indentation depth

  const handleReplyClick = () => {
    onSetActiveReply(comment._id);
  };

  const handleLikeClick = () => {
    if (isLiking) return;
    setIsLiking(true);

    // Call the actual API without optimistic update
    onLike(comment._id).then(() => {
      setIsLiking(false);
    }).catch(() => {
      setIsLiking(false);
    });
  };

  const handleToggleReplies = () => {
    if (!showReplies && !repliesLoaded) {
      setRepliesLoaded(true);
      // Track view replies engagement for personalization
      trackReplyView?.(comment._id, comment.post);
    }
    setShowReplies(!showReplies);
  };

  // Calculate indentation - cap at 2 levels for visual indentation
  const visualMaxDepth = 2;
  const visualIndentation = depth > 0 ? Math.min(depth, visualMaxDepth) * 24 : 0;
  const showConnector = depth > 0;

  // Generate connector lines for each nesting level
  const renderConnectors = () => {
    const connectors = [];
    for (let i = 1; i <= Math.min(depth, visualMaxDepth); i++) {
      const leftPos = (i - 1) * 24;
      connectors.push(
        <div
          key={i}
          className="absolute w-px bg-slate-200"
          style={{
            left: `${leftPos}px`,
            top: '32px',
            bottom: '0',
            opacity: i === depth ? 1 : 0.5,
          }}
        />
      );
    }
    return connectors;
  };

  return (
    <div className="relative">
      {/* Connector lines for nested comments */}
      {showConnector && renderConnectors()}
      
      <div style={{ marginLeft: `${visualIndentation}px` }} className="flex gap-3">
        <UserAvatar
          user={comment.author}
          className="size-8 shrink-0"
          userId={comment.author?._id}
        />
        <div className="flex-1 min-w-0">
          <div className="rounded-2xl bg-slate-50 px-4 py-2 min-w-0">
            <p className="text-xs font-semibold text-slate-900 truncate">
              {comment.author?.fullName || "User"}
            </p>
            <p className="mt-1 text-sm text-slate-700 break-words">
              {comment.content}
            </p>
          </div>
          <div className="mt-1 flex items-center gap-4 px-2">
            <span className="text-[10px] text-slate-500 shrink-0">
              {formatRelativeTime(comment.createdAt)}
            </span>
            <button
              type="button"
              onClick={handleLikeClick}
              className={`flex items-center gap-1 text-[10px] hover:text-slate-700 transition-colors shrink-0 ${
                comment.likedBy?.length > 0 ? "text-red-500" : "text-slate-500"
              }`}
            >
              <Heart className={`size-3 ${comment.likedBy?.length > 0 ? "fill-current" : ""}`} />
              {comment.likesCount || 0}
            </button>
            <button
              type="button"
              onClick={handleReplyClick}
              className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 transition-colors shrink-0"
            >
              <MessageSquareReply className="size-3" />
              Reply
            </button>
          </div>

          {/* Inline Reply Input */}
          {activeReplyId === comment._id && (
            <ReplyInput
              postId={postId}
              parentCommentId={comment._id}
              onCancel={() => onSetActiveReply(null)}
              onReply={onReply}
            />
          )}

          {/* Replies Section - Available for all comments */}
          {comment.repliesCount > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={handleToggleReplies}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
              >
                {showReplies ? `Hide ${comment.repliesCount} replies` : `View ${comment.repliesCount} replies`}
              </button>
              
              {showReplies && repliesLoaded && (
                <div className="overflow-hidden transition-all duration-300 ease-in-out" style={{
                  maxHeight: showReplies ? '2000px' : '0px',
                  opacity: showReplies ? '1' : '0'
                }}>
                  <ReplyList
                    parentCommentId={comment._id}
                    postId={postId}
                    depth={depth + 1}
                    onLike={onLike}
                    onReply={onReply}
                    activeReplyId={activeReplyId}
                    onSetActiveReply={onSetActiveReply}
                    trackReplyView={trackReplyView}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(CommentItem);

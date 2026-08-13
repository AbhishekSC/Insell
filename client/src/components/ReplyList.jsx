import { useQuery } from "@tanstack/react-query";
import { memo } from "react";
import axiosInstance from "../lib/axios";
import CommentItem from "./CommentItem";
import CommentSkeleton from "./CommentSkeleton";
import { RefreshCw } from "lucide-react";

function ReplyList({ 
  parentCommentId, 
  postId, 
  depth = 0,
  onLike, 
  onReply,
  activeReplyId,
  onSetActiveReply,
  trackReplyView
}) {
  const { data: repliesData, isLoading: isLoadingReplies, error, refetch } = useQuery({
    queryKey: ["commentReplies", parentCommentId],
    queryFn: async () => {
      const response = await axiosInstance.get(`/comments/${parentCommentId}/replies`);
      return response.data?.data || { replies: [] };
    },
    enabled: true,
    refetchOnWindowFocus: false,
    staleTime: 0, // Always refetch when data changes
  });

  const replies = repliesData?.replies || [];

  if (isLoadingReplies) {
    return (
      <div className="space-y-3 mt-3">
        <CommentSkeleton />
        <CommentSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-3 flex items-center gap-2 text-red-500">
        <span className="text-xs">Failed to load replies</span>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-xs flex items-center gap-1 hover:text-red-600"
        >
          <RefreshCw className="size-3" />
          Retry
        </button>
      </div>
    );
  }

  if (replies.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mt-3 w-full">
      {replies.map((reply) => (
        <CommentItem
          key={reply._id}
          comment={reply}
          postId={postId}
          depth={depth}
          onLike={onLike}
          onReply={onReply}
          activeReplyId={activeReplyId}
          onSetActiveReply={onSetActiveReply}
          trackReplyView={trackReplyView}
        />
      ))}
    </div>
  );
}

export default memo(ReplyList);

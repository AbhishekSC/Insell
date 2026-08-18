import { useState, useRef, useEffect } from "react";
import { Send, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";
import toast from "react-hot-toast";

export default function ReplyInput({ postId, parentCommentId, onCancel, onReply }) {
  const [replyText, setReplyText] = useState("");
  const inputRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const { mutate: createReply, isPending: isCreatingReply } = useMutation({
    mutationFn: async (content) => {
      const response = await axiosInstance.post(`/comments/posts/${postId}/comments`, {
        content,
        parentCommentId,
      });
      return response.data?.data;
    },
    onSuccess: () => {
      // Invalidate queries to fetch fresh data from server
      queryClient.invalidateQueries({ queryKey: ["commentReplies", parentCommentId] });
      queryClient.invalidateQueries({ queryKey: ["postComments", postId] });
      
      setReplyText("");
      onCancel();
      toast.success("Reply added");
      onReply?.();
    },
    onError: () => {
      toast.error("Failed to add reply");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    createReply(replyText.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mt-2">
      <input
        ref={inputRef}
        type="text"
        value={replyText}
        onChange={(e) => setReplyText(e.target.value)}
        placeholder="Write a reply..."
        className="flex-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        disabled={isCreatingReply}
      />
      <button
        type="button"
        onClick={onCancel}
        className="btn btn-circle btn-ghost size-8 shrink-0 text-slate-500 hover:bg-slate-100"
        disabled={isCreatingReply}
      >
        <X className="size-4" />
      </button>
      <button
        type="submit"
        className="btn btn-circle btn-ghost size-8 shrink-0 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
        disabled={!replyText.trim() || isCreatingReply}
      >
        <Send className="size-4" />
      </button>
    </form>
  );
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";

export function usePgReviews(pgId, opts = {}) {
  return useQuery({
    queryKey: ["pgReviews", pgId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/pg-reviews/${pgId}`);
      return res.data?.data;
    },
    enabled: Boolean(pgId),
    ...opts,
  });
}

export function usePgReviewSummary(pgId, opts = {}) {
  return useQuery({
    queryKey: ["pgReviewSummary", pgId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/pg-reviews/${pgId}/summary`);
      return res.data?.data;
    },
    enabled: Boolean(pgId),
    ...opts,
  });
}

export function useCreatePgReview(pgId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      const res = await axiosInstance.post(`/pg-reviews/${pgId}`, body);
      return res.data?.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pgReviews", pgId] });
      qc.invalidateQueries({ queryKey: ["pgReviewSummary", pgId] });
    },
  });
}

export function useMarkReviewHelpful() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reviewId) => {
      const res = await axiosInstance.post(`/pg-reviews/${reviewId}/helpful`);
      return res.data?.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pgReviews"] });
    },
  });
}

export function useDeletePgReview(pgId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reviewId) => {
      const res = await axiosInstance.delete(`/pg-reviews/${reviewId}`);
      return res.data?.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pgReviews", pgId] });
      qc.invalidateQueries({ queryKey: ["pgReviewSummary", pgId] });
    },
  });
}

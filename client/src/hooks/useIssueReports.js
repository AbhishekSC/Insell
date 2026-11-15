import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";

export function useMyIssues(opts = {}) {
  return useQuery({
    queryKey: ["myIssues"],
    queryFn: async () => {
      const res = await axiosInstance.get("/issues/mine");
      return res.data?.data;
    },
    ...opts,
  });
}

export function usePgIssues(pgId, opts = {}) {
  return useQuery({
    queryKey: ["pgIssues", pgId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/issues/pg/${pgId}`);
      return res.data?.data;
    },
    enabled: Boolean(pgId),
    ...opts,
  });
}

export function usePgIssueStats(pgId, opts = {}) {
  return useQuery({
    queryKey: ["pgIssueStats", pgId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/issues/pg/${pgId}/stats`);
      return res.data?.data;
    },
    enabled: Boolean(pgId),
    ...opts,
  });
}

export function useCreateIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      const res = await axiosInstance.post("/issues", body);
      return res.data?.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["myIssues"] });
      qc.invalidateQueries({ queryKey: ["pgIssues"] });
    },
  });
}

export function useUpdateIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ issueId, ...body }) => {
      const res = await axiosInstance.patch(`/issues/${issueId}`, body);
      return res.data?.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["myIssues"] });
      qc.invalidateQueries({ queryKey: ["pgIssues"] });
      qc.invalidateQueries({ queryKey: ["pgIssueStats"] });
    },
  });
}

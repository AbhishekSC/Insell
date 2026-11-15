import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";

export function useMyBills(opts = {}) {
  return useQuery({
    queryKey: ["myBills"],
    queryFn: async () => {
      const res = await axiosInstance.get("/pg-bills/mine");
      return res.data?.data;
    },
    ...opts,
  });
}

export function useBillDetail(billId, opts = {}) {
  return useQuery({
    queryKey: ["bill", billId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/pg-bills/${billId}`);
      return res.data?.data;
    },
    enabled: Boolean(billId),
    ...opts,
  });
}

export function useCreateBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      const res = await axiosInstance.post("/pg-bills", body);
      return res.data?.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["myBills"] });
      qc.invalidateQueries({ queryKey: ["pgBillSummary"] });
    },
  });
}

export function useMarkBillPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (billId) => {
      const res = await axiosInstance.patch(`/pg-bills/${billId}/pay`);
      return res.data?.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["myBills"] });
      qc.invalidateQueries({ queryKey: ["bill"] });
      qc.invalidateQueries({ queryKey: ["pgBillSummary"] });
    },
  });
}

export function useBillComparison(pgId, { month, year } = {}, opts = {}) {
  return useQuery({
    queryKey: ["billComparison", pgId, month, year],
    queryFn: async () => {
      const params = {};
      if (month) params.month = month;
      if (year) params.year = year;
      const res = await axiosInstance.get(`/pg-bills/pg/${pgId}/comparison`, { params });
      return res.data?.data;
    },
    enabled: Boolean(pgId),
    ...opts,
  });
}

export function usePgBillSummary(pgId, { month, year } = {}, opts = {}) {
  return useQuery({
    queryKey: ["pgBillSummary", pgId, month, year],
    queryFn: async () => {
      const params = {};
      if (month) params.month = month;
      if (year) params.year = year;
      const res = await axiosInstance.get(`/pg-bills/pg/${pgId}/summary`, { params });
      return res.data?.data;
    },
    enabled: Boolean(pgId),
    ...opts,
  });
}

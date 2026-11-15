import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";

export function useGenerateReceipt() {
  return useMutation({
    mutationFn: async (body) => {
      const res = await axiosInstance.post("/rental-tools/receipt", body, { responseType: "blob" });
      return res.data;
    },
  });
}

export function useRentHistory(opts = {}) {
  return useQuery({
    queryKey: ["rentHistory"],
    queryFn: async () => {
      const res = await axiosInstance.get("/rental-tools/rent-history");
      return res.data?.data;
    },
    ...opts,
  });
}

export function useSaveRentPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      const res = await axiosInstance.post("/rental-tools/rent-history", body);
      return res.data?.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rentHistory"] });
    },
  });
}

export function useDownloadReceipt() {
  return useMutation({
    mutationFn: async (paymentId) => {
      const res = await axiosInstance.get(`/rental-tools/rent-history/${paymentId}/receipt`, { responseType: "blob" });
      return res.data;
    },
  });
}

export function useMyAgreements(opts = {}) {
  return useQuery({
    queryKey: ["myAgreements"],
    queryFn: async () => {
      const res = await axiosInstance.get("/rental-tools/agreements");
      return res.data?.data;
    },
    ...opts,
  });
}

export function useCreateAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      const res = await axiosInstance.post("/rental-tools/agreement", body);
      return res.data?.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["myAgreements"] });
    },
  });
}

export function useDownloadAgreement() {
  return useMutation({
    mutationFn: async (agreementId) => {
      const res = await axiosInstance.get(`/rental-tools/agreement/${agreementId}/pdf`, { responseType: "blob" });
      return res.data;
    },
  });
}

export function useMyConditionReports(opts = {}) {
  return useQuery({
    queryKey: ["myConditionReports"],
    queryFn: async () => {
      const res = await axiosInstance.get("/rental-tools/condition-reports");
      return res.data?.data;
    },
    ...opts,
  });
}

export function useCreateConditionReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      const res = await axiosInstance.post("/rental-tools/condition-report", body);
      return res.data?.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["myConditionReports"] });
    },
  });
}

export function useDownloadConditionReport() {
  return useMutation({
    mutationFn: async (reportId) => {
      const res = await axiosInstance.get(`/rental-tools/condition-report/${reportId}/pdf`, { responseType: "blob" });
      return res.data;
    },
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";

// ── Booking Request Flow ──────────────────────────────────────────────

export function useRequestBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      const res = await axiosInstance.post("/pg-residency/booking-request", body);
      return res.data?.data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["bookingStatus", variables.pgId] });
      qc.invalidateQueries({ queryKey: ["myResidencies"] });
    },
  });
}

export function useBookingStatus(pgId, opts = {}) {
  return useQuery({
    queryKey: ["bookingStatus", pgId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/pg-residency/booking-status/${pgId}`);
      return res.data?.data?.booking || null;
    },
    enabled: Boolean(pgId),
    ...opts,
  });
}

export function useBookingRequests(pgId, opts = {}) {
  return useQuery({
    queryKey: ["bookingRequests", pgId],
    queryFn: async () => {
      const params = pgId ? { pgId } : {};
      const res = await axiosInstance.get("/pg-residency/booking-requests", { params });
      return res.data?.data?.requests || [];
    },
    ...opts,
  });
}

export function useApproveBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ residencyId, ...body }) => {
      const res = await axiosInstance.patch(`/pg-residency/${residencyId}/approve`, body);
      return res.data?.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookingRequests"] });
      qc.invalidateQueries({ queryKey: ["pgResidents"] });
      qc.invalidateQueries({ queryKey: ["pgDashboard"] });
    },
  });
}

export function useRejectBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ residencyId, ...body }) => {
      const res = await axiosInstance.patch(`/pg-residency/${residencyId}/reject`, body);
      return res.data?.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookingRequests"] });
    },
  });
}

export function useCancelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (residencyId) => {
      const res = await axiosInstance.patch(`/pg-residency/${residencyId}/cancel`);
      return res.data?.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookingStatus"] });
      qc.invalidateQueries({ queryKey: ["myBookings"] });
      qc.invalidateQueries({ queryKey: ["bookingRequests"] });
    },
  });
}

export function useAllBookingRequests(pgId, opts = {}) {
  return useQuery({
    queryKey: ["allBookingRequests", pgId],
    queryFn: async () => {
      const params = pgId ? { pgId } : {};
      const res = await axiosInstance.get("/pg-residency/booking-requests/all", { params });
      return res.data?.data?.requests || [];
    },
    ...opts,
  });
}

export function useMyBookings(opts = {}) {
  return useQuery({
    queryKey: ["myBookings"],
    queryFn: async () => {
      const res = await axiosInstance.get("/pg-residency/my-bookings");
      return res.data?.data?.bookings || [];
    },
    ...opts,
  });
}

// ── Existing Hooks ────────────────────────────────────────────────────

export function useMyResidencies(opts = {}) {
  return useQuery({
    queryKey: ["myResidencies"],
    queryFn: async () => {
      const res = await axiosInstance.get("/pg-residency/mine");
      return res.data?.data;
    },
    ...opts,
  });
}

export function useResidencyDetail(residencyId, opts = {}) {
  return useQuery({
    queryKey: ["residency", residencyId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/pg-residency/${residencyId}`);
      return res.data?.data;
    },
    enabled: Boolean(residencyId),
    ...opts,
  });
}

export function usePgResidents(pgId, { status } = {}, opts = {}) {
  return useQuery({
    queryKey: ["pgResidents", pgId, status],
    queryFn: async () => {
      const params = status ? { status } : {};
      const res = await axiosInstance.get(`/pg-residency/pg/${pgId}/residents`, { params });
      return res.data?.data;
    },
    enabled: Boolean(pgId),
    ...opts,
  });
}

export function usePendingDeposits(pgId, opts = {}) {
  return useQuery({
    queryKey: ["pendingDeposits", pgId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/pg-residency/pg/${pgId}/pending-deposits`);
      return res.data?.data;
    },
    enabled: Boolean(pgId),
    ...opts,
  });
}

export function useRegisterMoveIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      const res = await axiosInstance.post("/pg-residency/move-in", body);
      return res.data?.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["myResidencies"] });
    },
  });
}

export function useRegisterMoveOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ residencyId, ...body }) => {
      const res = await axiosInstance.patch(`/pg-residency/${residencyId}/move-out`, body);
      return res.data?.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["myResidencies"] });
      qc.invalidateQueries({ queryKey: ["residency"] });
    },
  });
}

export function useRecordDepositRefund() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ residencyId, ...body }) => {
      const res = await axiosInstance.patch(`/pg-residency/${residencyId}/deposit-refund`, body);
      return res.data?.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["myResidencies"] });
      qc.invalidateQueries({ queryKey: ["residency"] });
      qc.invalidateQueries({ queryKey: ["pendingDeposits"] });
    },
  });
}

export function useGenerateFormalNotice() {
  return useMutation({
    mutationFn: async (residencyId) => {
      const res = await axiosInstance.get(`/pg-residency/${residencyId}/formal-notice`);
      return res.data?.data;
    },
  });
}

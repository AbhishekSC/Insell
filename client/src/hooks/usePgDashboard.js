import { useQuery } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";

export function usePgDashboard({ pgId, month, year } = {}, opts = {}) {
  return useQuery({
    queryKey: ["pgDashboard", pgId, month, year],
    queryFn: async () => {
      const params = {};
      if (pgId) params.pgId = pgId;
      if (month) params.month = month;
      if (year) params.year = year;
      const res = await axiosInstance.get("/pg-dashboard", { params });
      return res.data?.data;
    },
    ...opts,
  });
}

export function usePgOverview(opts = {}) {
  return useQuery({
    queryKey: ["pgOverview"],
    queryFn: async () => {
      const res = await axiosInstance.get("/pg-dashboard/overview");
      return res.data?.data;
    },
    ...opts,
  });
}

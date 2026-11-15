import { useQuery } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";

export function useSafetyOverview({ lat, lng, locality, city, district, state }, opts = {}) {
  return useQuery({
    queryKey: ["safetyOverview", lat, lng, district],
    queryFn: async () => {
      const res = await axiosInstance.get("/neighbourhood-safety/overview", {
        params: { lat, lng, locality, city, district, state },
      });
      return res.data?.data;
    },
    enabled: Boolean(lat && lng),
    staleTime: 15 * 60 * 1000,
    ...opts,
  });
}

export function useDistrictSafety(district, state, opts = {}) {
  return useQuery({
    queryKey: ["districtSafety", district, state],
    queryFn: async () => {
      const res = await axiosInstance.get("/neighbourhood-safety/district", {
        params: { district, state },
      });
      return res.data?.data;
    },
    enabled: Boolean(district),
    staleTime: 30 * 60 * 1000,
    ...opts,
  });
}

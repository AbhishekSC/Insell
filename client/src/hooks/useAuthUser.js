import { useQuery } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";

export function useAuthUser(options = {}) {
  return useQuery({
    queryKey: ["authUser"],
    queryFn: async () => {
      const res = await axiosInstance.get("/auth/verify", { skipErrorToast: true });
      return res.data;
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
    ...options,
  });
}

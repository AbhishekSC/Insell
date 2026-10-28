import { useQuery } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";

export function useFriends(options = {}) {
  return useQuery({
    queryKey: ["friends"],
    queryFn: async () => {
      const res = await axiosInstance.get("/users/friends");
      return res.data?.data?.friends || [];
    },
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

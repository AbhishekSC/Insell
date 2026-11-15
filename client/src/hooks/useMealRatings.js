import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";

export function useRateMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      const res = await axiosInstance.post("/meal-ratings", body);
      return res.data?.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["mealDaily", vars.pgId] });
      qc.invalidateQueries({ queryKey: ["mealScore", vars.pgId] });
    },
  });
}

export function useDailyMealRatings(pgId, date, opts = {}) {
  return useQuery({
    queryKey: ["mealDaily", pgId, date],
    queryFn: async () => {
      const params = date ? { date } : {};
      const res = await axiosInstance.get(`/meal-ratings/${pgId}/daily`, { params });
      return res.data?.data;
    },
    enabled: Boolean(pgId),
    ...opts,
  });
}

export function useMonthlyMealRatings(pgId, { month, year } = {}, opts = {}) {
  return useQuery({
    queryKey: ["mealMonthly", pgId, month, year],
    queryFn: async () => {
      const params = {};
      if (month) params.month = month;
      if (year) params.year = year;
      const res = await axiosInstance.get(`/meal-ratings/${pgId}/monthly`, { params });
      return res.data?.data;
    },
    enabled: Boolean(pgId),
    ...opts,
  });
}

export function useFoodScore(pgId, opts = {}) {
  return useQuery({
    queryKey: ["mealScore", pgId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/meal-ratings/${pgId}/score`);
      return res.data?.data;
    },
    enabled: Boolean(pgId),
    ...opts,
  });
}

export function useMealTrend(pgId, opts = {}) {
  return useQuery({
    queryKey: ["mealTrend", pgId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/meal-ratings/${pgId}/trend`);
      return res.data?.data;
    },
    enabled: Boolean(pgId),
    ...opts,
  });
}

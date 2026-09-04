import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";

// Progressive onboarding: the server decides the *next* question to ask (or
// none); the client decides *when* to show it — after the user has looked at a
// few listings this session, so it lands when they're engaged, not at the door.

const SHOW_AFTER_VIEWS = 4;
const VIEW_KEY = "nms:sessionPropertyViews";

let sessionViews = 0;
try {
  sessionViews = Number(sessionStorage.getItem(VIEW_KEY) || 0);
} catch {
  /* private mode */
}

export function notePropertyView() {
  sessionViews += 1;
  try {
    sessionStorage.setItem(VIEW_KEY, String(sessionViews));
  } catch {
    /* ignore */
  }
}

export function usePreferencePrompt() {
  const queryClient = useQueryClient();

  const { data: prompt = null } = useQuery({
    queryKey: ["preferencePrompt"],
    queryFn: async () => {
      const res = await axiosInstance.get("/users/preference-prompt", { skipErrorToast: true });
      return res.data?.data?.prompt || null;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const { mutate, isPending } = useMutation({
    mutationFn: async ({ key, value, skip }) => {
      const res = await axiosInstance.post(
        "/users/preference-prompt",
        { key, value, skip },
        { skipErrorToast: Boolean(skip) }
      );
      return res.data?.data?.user;
    },
    onSuccess: (user, vars) => {
      if (user) {
        queryClient.setQueryData(["authUser"], (prev) => {
          const prevUser = prev?.data?.user || prev?.data || {};
          return { status: "success", data: { user: { ...prevUser, ...user } } };
        });
      }
      queryClient.invalidateQueries({ queryKey: ["preferencePrompt"] });
      if (!vars?.skip) {
        queryClient.invalidateQueries({ queryKey: ["personalizedRecommendations"] });
        queryClient.invalidateQueries({ queryKey: ["propertyFeed"] });
        toast.success("Thanks — your feed just got sharper");
      }
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Couldn't save that"),
  });

  const ready = Boolean(prompt) && sessionViews >= SHOW_AFTER_VIEWS;

  return {
    prompt: ready ? prompt : null,
    submitting: isPending,
    answer: (value) => prompt && mutate({ key: prompt.key, value }),
    skip: () => prompt && mutate({ key: prompt.key, skip: true }),
  };
}

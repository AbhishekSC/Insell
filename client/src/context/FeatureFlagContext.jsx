import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";

const FeatureFlagContext = createContext({});

export function FeatureFlagProvider({ children }) {
  const { data: authData } = useQuery({
    queryKey: ["authUser"],
    staleTime: 1000 * 60 * 5,
  });

  const user = authData?.data?.user || authData?.data || null;

  const { data: flags = {} } = useQuery({
    queryKey: ["myFeatureFlags", user?._id],
    queryFn: async () => {
      const response = await axiosInstance.get("/feature-flags/my-flags");
      return response.data?.data?.flags || {};
    },
    enabled: Boolean(user),
    staleTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: true,
  });

  return (
    <FeatureFlagContext.Provider value={flags}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

/**
 * Hook to check if a feature flag is enabled for the current logged-in user.
 * @param {string} flagKey
 * @param {boolean} [defaultValue=false]
 * @returns {boolean}
 */
export function useFeatureFlag(flagKey, defaultValue = false) {
  const flags = useContext(FeatureFlagContext);
  if (!flagKey || typeof flags !== "object") return defaultValue;
  return flags[flagKey] !== undefined ? Boolean(flags[flagKey]) : defaultValue;
}

export default FeatureFlagContext;

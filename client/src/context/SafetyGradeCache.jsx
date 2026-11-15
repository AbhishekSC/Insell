import { createContext, useContext, useRef, useCallback } from "react";
import axiosInstance from "../lib/axios";

const SafetyGradeCacheContext = createContext(null);

export function SafetyGradeCacheProvider({ children }) {
  const cache = useRef(new Map());
  const pending = useRef(new Map());

  const getGrade = useCallback(async (district) => {
    if (!district) return null;
    const key = district.toLowerCase().trim();

    if (cache.current.has(key)) return cache.current.get(key);

    if (pending.current.has(key)) return pending.current.get(key);

    const promise = axiosInstance
      .get("/neighbourhood-safety/district", { params: { district } })
      .then((res) => {
        const data = res.data?.data;
        const result = data?.found
          ? { grade: data.safetyGrade.grade, label: data.safetyGrade.label, total: data.latestCrimes.total, trend: data.trend }
          : null;
        cache.current.set(key, result);
        pending.current.delete(key);
        return result;
      })
      .catch(() => {
        cache.current.set(key, null);
        pending.current.delete(key);
        return null;
      });

    pending.current.set(key, promise);
    return promise;
  }, []);

  return (
    <SafetyGradeCacheContext.Provider value={getGrade}>
      {children}
    </SafetyGradeCacheContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSafetyGradeCache() {
  return useContext(SafetyGradeCacheContext);
}

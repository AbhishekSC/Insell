import { createContext, useContext, useState, useCallback } from "react";

const PgCompareContext = createContext(null);

const MAX_COMPARE = 3;

export function PgCompareProvider({ children }) {
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);

  const add = useCallback((post) => {
    setItems((prev) => {
      if (prev.length >= MAX_COMPARE || prev.some((p) => p._id === post._id)) return prev;
      return [...prev, post];
    });
  }, []);

  const remove = useCallback((id) => {
    setItems((prev) => prev.filter((p) => p._id !== id));
  }, []);

  const has = useCallback((id) => items.some((p) => p._id === id), [items]);

  const clear = useCallback(() => setItems([]), []);

  return (
    <PgCompareContext.Provider value={{ items, add, remove, has, clear, showModal, setShowModal }}>
      {children}
    </PgCompareContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePgCompare() {
  const ctx = useContext(PgCompareContext);
  if (!ctx) throw new Error("usePgCompare must be used within PgCompareProvider");
  return ctx;
}

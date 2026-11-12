import { useEffect, useState } from "react";

/** false during SSR and until the client has hydrated. Gate buttons on it so an early click isn't dropped. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

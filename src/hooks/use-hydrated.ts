import { useEffect, useState } from "react";

/**
 * Returns true only after the component has hydrated on the client.
 * Use to defer client-only content and avoid SSR/CSR hydration mismatches
 * on `ssr: false` routes (which stream `<Suspense fallback={null}>` on the
 * server but immediately render the real component on the client).
 */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}

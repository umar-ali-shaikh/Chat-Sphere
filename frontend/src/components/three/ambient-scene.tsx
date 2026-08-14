import { Suspense, lazy, useEffect, useState } from "react";

const Scene = lazy(() => import("./scene"));

/**
 * Client-only WebGL backdrop. Skipped entirely for users who prefer
 * reduced motion or on SSR, so the page never blocks on the GPU.
 */
export function AmbientScene({
  withOrb = true,
  className = "",
}: {
  withOrb?: boolean;
  className?: string;
}) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) setEnabled(true);
  }, []);

  if (!enabled) return null;

  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 ${className}`}>
      <Suspense fallback={null}>
        <Scene withOrb={withOrb} />
      </Suspense>
    </div>
  );
}
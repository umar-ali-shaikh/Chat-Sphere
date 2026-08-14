import { Suspense, lazy, useEffect, useRef, useState } from "react";

const Scene = lazy(() => import("./scene"));

const MAX_CONTEXT_LOSS_RETRIES = 3;

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
  const [instanceKey, setInstanceKey] = useState(0);
  const lossCount = useRef(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) setEnabled(true);
  }, []);

  if (!enabled) return null;

  const handleContextLost = () => {
    lossCount.current += 1;
    if (lossCount.current > MAX_CONTEXT_LOSS_RETRIES) {
      // GPU keeps dropping the context — stop retrying and just drop the
      // decorative backdrop rather than flicker forever.
      setEnabled(false);
      return;
    }
    // Bumping the key unmounts the dead canvas and mounts a brand new one,
    // which gets a fresh WebGL context instead of relying on the browser
    // to repair the old one (r3f doesn't re-upload GPU resources on its own).
    setInstanceKey((key) => key + 1);
  };

  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 ${className}`}>
      <Suspense fallback={null}>
        <Scene key={instanceKey} withOrb={withOrb} onContextLost={handleContextLost} />
      </Suspense>
    </div>
  );
}
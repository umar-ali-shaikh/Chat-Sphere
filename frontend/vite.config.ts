// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    optimizeDeps: {
      // `three` is only ever reached via the lazy `import("./scene")` in
      // ambient-scene.tsx, so Vite's initial dep scan (which only follows
      // static imports) never sees it. Without this, the first time the
      // browser triggers that dynamic import, Vite 8's rolldown-based
      // optimizer has to discover and bundle `three` mid-flight, which hits
      // a known deadlock (vitejs/vite#22934) and hangs the page forever.
      include: ["three"],
      // @tanstack/start-server-core is server-only, but the client dep scan
      // still reaches it through @tanstack/react-start's client entry. Its
      // createStartHandler.js uses virtual specifiers (#tanstack-router-entry,
      // #tanstack-start-entry) that only the SSR-environment plugin can
      // resolve, so bundling it for the client hard-fails — and on Vite 8
      // that failure doesn't surface as an error, it just hangs the request
      // forever (see TanStack/router#7614). It's never used in the browser,
      // so it's safe to exclude outright.
      exclude: ["@tanstack/start-server-core"],
    },
  },
});

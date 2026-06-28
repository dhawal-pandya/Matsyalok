import { defineConfig } from "vite";

// Static, framework-free build (D1/D2). Deploys to a shareable URL.
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    sourcemap: true,
  },
});

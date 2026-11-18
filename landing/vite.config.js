import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// base "./" so the built page works from any folder (e.g. getalveo.app/landing/ for a preview).
export default defineConfig({ base: "./", plugins: [react()], build: { outDir: "dist", chunkSizeWarningLimit: 2500 } });

import { defineConfig } from "vite";
import fs from "fs";
import path from "path";

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    https: {
      key: fs.readFileSync(path.resolve(__dirname, "localhost+2-key.pem")),
      cert: fs.readFileSync(path.resolve(__dirname, "localhost+2.pem")),
    },
    proxy: {
      '/osrm': {
        target: 'https://router.project-osrm.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/osrm/, ''),
      }
    }
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },

  optimizeDeps: {
    include: ["browser-image-compression"],
  },
});
import { defineConfig } from "vite";
import path from "path";

// 🔒 FIX: Suppression des certificats SSL locaux commités dans le repo.
// En production (Vercel/Netlify/Firebase), le HTTPS est géré par l'hébergeur.
// En dev local, utiliser `vite` sans HTTPS suffit pour tester les APIs de géoloc
// (Chrome accepte le GPS sur localhost HTTP nativement).

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    // Proxy OSRM pour éviter les problèmes CORS en dev
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

  // 🔒 FIX: Suppression de browser-image-compression (jamais utilisé dans le projet)
  optimizeDeps: {},
});

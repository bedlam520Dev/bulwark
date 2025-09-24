import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "path"
import { buildApiPlugin } from "./.remix/plugins/vite-plugin-build-api"

export default defineConfig({
  server: {
    host: true,
    open: true,
    middlewareMode: false,
  },
  plugins: [
    react(),
    tailwindcss(),
    buildApiPlugin(),
    {
      name: 'setup-detection-middleware-bypass',
      configureServer(server) {
        server.middlewares.use('/.remix/.setup_required', (_req, res, _next) => {
          // Always return false for setup required (bypass check)
          res.writeHead(204, {
            'X-Setup-Required': 'false',
            'Content-Type': 'text/plain'
          });
          res.end();
        });
      },
    },
  ],
  build: {
    outDir: "dist",
    assetsDir: "assets",
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      external: ["phaser"],
      output: {
        globals: {
          phaser: "Phaser",
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  publicDir: "public",
  optimizeDeps: {
    exclude: ["phaser"],
  },
})
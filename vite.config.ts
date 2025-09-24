import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "path"
import fs from "fs"
import os from "os"
import { buildApiPlugin } from "./.remix/plugins/vite-plugin-build-api"

// Read multiplayer setting from package.json
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'))
const isMultiplayer = packageJson.multiplayer === true

export default defineConfig({
  define: {
    // This will be replaced at build time with the actual boolean value
    'GAME_MULTIPLAYER_MODE': JSON.stringify(isMultiplayer),
  },
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
      name: 'setup-detection-middleware',
      configureServer(server) {
        // Serve .remix/assets as static files
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith('/.remix/assets/')) {
            const filePath = path.join(process.cwd(), req.url);
            if (fs.existsSync(filePath)) {
              const ext = path.extname(filePath).toLowerCase();
              const contentType = ext === '.png' ? 'image/png' : 
                                ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                                ext === '.svg' ? 'image/svg+xml' : 
                                'application/octet-stream';
              res.setHeader('Content-Type', contentType);
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          }
          next();
        });

        server.middlewares.use('/.remix/.setup_required', (_req, res, _next) => {
          // Check if .remix/.setup_required file actually exists
          const setupRequiredPath = path.join(process.cwd(), '.remix', '.setup_required');
          const fileExists = fs.existsSync(setupRequiredPath);
          
          // Return 204 status with header indicating setup requirement
          res.writeHead(204, {
            'X-Setup-Required': fileExists.toString(),
            'Content-Type': 'text/plain'
          });
          res.end();
        });

        // Add middleware to serve package manager info
        server.middlewares.use('/.remix/package-manager', (_req, res) => {
          // Detect package manager
          const userAgent = process.env.npm_config_user_agent || '';
          const execPath = process.env.npm_execpath || '';
          
          let packageManager = 'npm';
          
          // Check more specific package managers first (pnpm, yarn, bun) before npm
          if (userAgent.includes('pnpm') || execPath.includes('pnpm')) {
            packageManager = 'pnpm';
          } else if (userAgent.includes('yarn') || execPath.includes('yarn')) {
            packageManager = 'yarn';
          } else if (userAgent.includes('bun') || execPath.includes('bun')) {
            packageManager = 'bun';
          } else if (userAgent.includes('npm') && !userAgent.includes('pnpm')) {
            packageManager = 'npm';
          } else if (fs.existsSync('pnpm-lock.yaml')) {
            packageManager = 'pnpm';
          } else if (fs.existsSync('yarn.lock')) {
            packageManager = 'yarn';
          } else if (fs.existsSync('bun.lockb')) {
            packageManager = 'bun';
          }
          
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ packageManager }));
        });

        // Add middleware to execute get-ip.js script and return result
        server.middlewares.use('/.remix/get-ip', (_req, res) => {
          const { execSync } = require('child_process');
          try {
            const result = execSync('node scripts/get-ip.js 3000', { encoding: 'utf8', cwd: process.cwd() });
            res.setHeader('Content-Type', 'text/plain');
            res.end(result.trim());
          } catch (error) {
            console.error('Error executing get-ip.js:', error);
            res.statusCode = 500;
            res.end('Error executing get-ip.js');
          }
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

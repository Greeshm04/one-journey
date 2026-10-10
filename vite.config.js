import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequestHandler } from './server/index.js';

// Try loading .env in Node 20.6+
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {
    // Ignore if not present
  }
}

// Vite plugin providing /api/chat and /api/chat/status during `npm run dev`
function aiBackendPlugin() {
  const handler = createRequestHandler();
  return {
    name: 'ai-backend-middleware',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url.startsWith('/api/')) {
          handler(req, res);
        } else {
          next();
        }
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url.startsWith('/api/')) {
          handler(req, res);
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), aiBackendPlugin()],
  server: {
    port: 5173,
    host: true,
  },
});

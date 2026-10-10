/**
 * server/index.js
 *
 * Standalone Node.js HTTP server for One Journey AI chat backend integration.
 * Provides /api/chat, /api/chat/status, and serves static build assets if available.
 */

import http from 'http';
import { handleChatRequest, getServiceStatus } from './chatService.js';

// Load .env file if available in Node 20.6+
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {
    // Ignore if .env doesn't exist
  }
}

const PORT = process.env.PORT || 3001;

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export function createRequestHandler() {
  return async function requestHandler(req, res) {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if ((url.pathname === '/api/chat/status' || url.pathname === '/api/watsonx/status' || url.pathname === '/api/status') && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(getServiceStatus()));
      return;
    }

    if (url.pathname === '/api/chat' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });

      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const result = await handleChatRequest(parsed);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err) {
          console.error('[API /api/chat Error]:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
        }
      });
      return;
    }

    if (url.pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  };
}

// If run directly via node server/index.js
const server = http.createServer(createRequestHandler());

const isMainModule = process.argv[1] && (process.argv[1].endsWith('server/index.js') || process.argv[1].endsWith('server.js'));

if (isMainModule) {
  server.listen(PORT, () => {
    console.log(`[One Journey Backend] Server running at http://localhost:${PORT}`);
    console.log(`[AI Status] Configured: ${getServiceStatus().configured ? 'YES (Live API)' : 'NO (Local Transit Engine)'}`);
  });
}

export default server;

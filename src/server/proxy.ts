import { WebSocketServer } from 'ws';
import { createServer, type Server } from 'http';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { handleWsConnection } from './ws-handler.js';
import { editQueue } from './edit-queue.js';

let httpServer: Server | null = null;

export async function startProxy(
  targetPort: number,
  proxyPort: number,
  projectRoot: string
): Promise<void> {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const overlayPath = join(__dirname, '..', 'overlay.js');

  const fontsDir = join(__dirname, '..', 'fonts');

  const MIME: Record<string, string> = {
    '.css': 'text/css',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
    '.svg': 'image/svg+xml',
  };

  httpServer = createServer(async (req, res) => {
    // Serve overlay JS
    if (req.url === '/__layrr__/overlay.js') {
      try {
        const js = readFileSync(overlayPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(js);
      } catch {
        res.writeHead(500);
        res.end('// overlay not built');
      }
      return;
    }

    // Edit status REST fallback
    if (req.url === '/__layrr__/edit-status') {
      const result = editQueue.lastResult;
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(result || { success: null }));
      return;
    }

    // Serve font assets
    if (req.url?.startsWith('/__layrr__/fonts/')) {
      const fileName = req.url.replace('/__layrr__/fonts/', '');
      const filePath = join(fontsDir, fileName);
      const ext = '.' + fileName.split('.').pop();
      try {
        const data = readFileSync(filePath);
        res.writeHead(200, {
          'Content-Type': MIME[ext] || 'application/octet-stream',
          'Cache-Control': 'public, max-age=31536000',
        });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
      return;
    }

    // Proxy everything else to dev server
    const targetUrl = `http://localhost:${targetPort}${req.url}`;

    try {
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (key !== 'host' && value) {
          headers[key] = Array.isArray(value) ? value[0] : value;
        }
      }

      const body = req.method !== 'GET' && req.method !== 'HEAD'
        ? await new Promise<string>((resolve) => {
            const chunks: Buffer[] = [];
            req.on('data', (c: Buffer) => chunks.push(c));
            req.on('end', () => resolve(Buffer.concat(chunks).toString()));
          })
        : undefined;

      const resp = await fetch(targetUrl, {
        method: req.method,
        headers,
        body,
      });

      const contentType = resp.headers.get('content-type') || '';

      if (contentType.includes('text/html')) {
        let html = await resp.text();
        const overlayScript = `
          <script>window.__LAYRR_WS_PORT__ = ${proxyPort};</script>
          <script src="/__layrr__/overlay.js"></script>
        `;
        html = html.replace('</body>', `${overlayScript}</body>`);

        const respHeaders: Record<string, string> = {};
        resp.headers.forEach((value, key) => {
          if (key !== 'content-length' && key !== 'content-encoding') {
            respHeaders[key] = value;
          }
        });
        respHeaders['content-type'] = 'text/html; charset=utf-8';

        res.writeHead(resp.status, respHeaders);
        res.end(html);
      } else {
        const body = Buffer.from(await resp.arrayBuffer());
        const respHeaders: Record<string, string> = {};
        resp.headers.forEach((value, key) => { respHeaders[key] = value; });

        res.writeHead(resp.status, respHeaders);
        res.end(body);
      }
    } catch (err: any) {
      res.writeHead(502);
      res.end(`Proxy error: ${err.message}`);
    }
  });

  // WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/__layrr__/ws' });
  wss.on('connection', (ws) => handleWsConnection(ws, projectRoot));

  return new Promise((resolve) => {
    httpServer!.listen(proxyPort, () => resolve());
  });
}

export function stopProxy() {
  if (httpServer) {
    httpServer.close();
    httpServer = null;
  }
}

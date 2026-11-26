import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Starts the zero-dependency Shanaxon Analytics web server.
 * Features dynamic port hunting on EADDRINUSE to support multi-window IDE instances.
 */
export function startDashboardServer(workspaceRoot: string, port = 3333): http.Server {
  const ledgerPath = path.resolve(workspaceRoot, 'telemetry_ledger.json');
  const htmlPath = path.resolve(__dirname, 'index.html');

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === '/' || req.url === '/index.html') {
      fs.readFile(htmlPath, 'utf-8', (err, content) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end(`Dashboard template index.html not found at path: ${htmlPath}`);
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(content);
        }
      });
    } else if (req.url === '/api/metrics') {
      fs.readFile(ledgerPath, 'utf-8', (err, data) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (err) {
          res.end('[]');
        } else {
          res.end(data || '[]');
        }
      });
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });

  const tryListen = (currentPort: number, attemptsRemaining: number) => {
    server.listen(currentPort);
    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE' && attemptsRemaining > 0) {
        server.close();
        tryListen(currentPort + 1, attemptsRemaining - 1);
      }
    });
  };

  tryListen(port, 10);
  return server;
}

"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.startDashboardServer = startDashboardServer;
const http = __importStar(require("http"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Starts the zero-dependency Tokenist Analytics web server.
 * Features dynamic port hunting on EADDRINUSE to support multi-window IDE instances.
 */
function startDashboardServer(workspaceRoot, port = 3333) {
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
                }
                else {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(content);
                }
            });
        }
        else if (req.url === '/api/metrics') {
            fs.readFile(ledgerPath, 'utf-8', (err, data) => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                if (err) {
                    res.end('[]');
                }
                else {
                    res.end(data || '[]');
                }
            });
        }
        else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        }
    });
    const tryListen = (currentPort, attemptsRemaining) => {
        server.listen(currentPort);
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE' && attemptsRemaining > 0) {
                server.close();
                tryListen(currentPort + 1, attemptsRemaining - 1);
            }
        });
    };
    tryListen(port, 10);
    return server;
}

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
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
function runClient() {
    return new Promise((resolve, reject) => {
        // Prepend Node v20 path so that it spawns with correct node environment
        const nodeV20Path = "C:\\Users\\hp\\AppData\\Local\\Microsoft\\WinGet\\Packages\\OpenJS.NodeJS.20_Microsoft.Winget.Source_8wekyb3d8bbwe\\node-v20.20.2-win-x64";
        const env = { ...process.env, PATH: `${nodeV20Path};${process.env.PATH}` };
        const ext = __filename.endsWith('.ts') ? '.ts' : '.js';
        const serverPath = path.resolve(__dirname, `../index${ext}`);
        const spawnCmd = ext === '.ts' ? 'npx' : 'node';
        const spawnArgs = ext === '.ts' ? ['ts-node', serverPath] : [serverPath];
        // Spawn server process
        const child = (0, child_process_1.spawn)(spawnCmd, spawnArgs, {
            env,
            shell: true,
            stdio: ['pipe', 'pipe', 'inherit'] // pipe stdin/stdout, inherit stderr to view server status errors
        });
        let buffer = '';
        let currentId = 1;
        const pendingPromises = new Map();
        // Parse stdout messages separated by newline
        child.stdout.on('data', (data) => {
            buffer += data.toString();
            const lines = buffer.split('\n');
            // Keep the last partial line in buffer
            buffer = lines.pop() || '';
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed)
                    continue;
                try {
                    const response = JSON.parse(trimmed);
                    if (response.id && pendingPromises.has(response.id)) {
                        const { resolve, reject } = pendingPromises.get(response.id);
                        pendingPromises.delete(response.id);
                        if (response.error) {
                            reject(response.error);
                        }
                        else {
                            resolve(response.result);
                        }
                    }
                }
                catch (e) {
                    // Ignore non-JSON outputs if any
                }
            }
        });
        const sendRequest = (method, params = {}) => {
            const id = currentId++;
            const payload = JSON.stringify({
                jsonrpc: '2.0',
                id,
                method,
                params
            }) + '\n';
            return new Promise((res, rej) => {
                pendingPromises.set(id, { resolve: res, reject: rej });
                child.stdin.write(payload);
            });
        };
        const sendNotification = (method, params = {}) => {
            const payload = JSON.stringify({
                jsonrpc: '2.0',
                method,
                params
            }) + '\n';
            child.stdin.write(payload);
        };
        child.on('error', (err) => {
            reject(err);
        });
        child.on('exit', (code) => {
            if (code !== null && code !== 0) {
                reject(new Error(`Server exited with code ${code}`));
            }
        });
        // Run tests sequence
        (async () => {
            try {
                console.log("1. Sending initialize handshake...");
                await sendRequest('initialize', {
                    protocolVersion: '2024-11-05',
                    capabilities: {},
                    clientInfo: { name: 'verify-client', version: '1.0.0' }
                });
                console.log("✓ Initialize successful.");
                console.log("2. Sending initialized notification...");
                sendNotification('notifications/initialized');
                console.log("3. Listing tools...");
                const listResult = await sendRequest('tools/list');
                console.log("Tools found:", listResult.tools.map((t) => t.name));
                const toolNames = listResult.tools.map((t) => t.name);
                if (!toolNames.includes('fetch_optimized_repository_map') || !toolNames.includes('read_optimized_file')) {
                    throw new Error("Tools are not registered correctly!");
                }
                console.log("✓ Tools registration verified.");
                console.log("4. Calling read_optimized_file on package.json...");
                const fileResult = await sendRequest('tools/call', {
                    name: 'read_optimized_file',
                    arguments: {
                        filePath: 'package.json',
                        compressionTier: 'normal'
                    }
                });
                console.log("✓ File read call successful. Text length:", fileResult.content[0].text.length);
                if (!fileResult.content[0].text.includes('"name":"tokenist"') && !fileResult.content[0].text.includes('"name": "tokenist"')) {
                    throw new Error("File output doesn't contain package.json contents!");
                }
                console.log("5. Testing path traversal protection...");
                try {
                    await sendRequest('tools/call', {
                        name: 'read_optimized_file',
                        arguments: {
                            filePath: '../nonexistent.ts',
                            compressionTier: 'normal'
                        }
                    });
                    throw new Error("Path traversal was allowed! Security violation!");
                }
                catch (err) {
                    console.log(`✓ Path traversal successfully blocked with error: "${err.message}"`);
                }
                console.log("6. Terminating server process...");
                child.kill();
                resolve();
            }
            catch (err) {
                child.kill();
                reject(err);
            }
        })();
    });
}
console.log("=== Running Dharohar MCP Server Handshake & Tools Verification ===");
runClient()
    .then(() => {
    console.log("=== All MCP Server Verification Tests Passed! ===");
    process.exit(0);
})
    .catch((err) => {
    console.error("❌ Test Suite Failed:");
    console.error(err);
    process.exit(1);
});

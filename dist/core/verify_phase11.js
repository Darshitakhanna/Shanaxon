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
const path = __importStar(require("path"));
const fs_1 = require("fs");
const http = __importStar(require("http"));
const child_process_1 = require("child_process");
const server_1 = require("../dashboard/server");
const webhookReporter_1 = require("../telemetry/webhookReporter");
const configLoader_1 = require("./configLoader");
function runCommand(cmd) {
    return new Promise((resolve, reject) => {
        (0, child_process_1.exec)(cmd, (err, stdout, stderr) => {
            if (err)
                reject(err);
            else
                resolve({ stdout, stderr });
        });
    });
}
function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode || 0, body }));
        }).on('error', reject);
    });
}
async function runTests() {
    console.log("=== Running Phase 11: Enterprise Features & Team Collaboration Verification ===");
    const workspaceRoot = process.cwd();
    // 1. Verify Shared Cache Config Strategy overrides
    console.log("\n1. Testing Shared Cache Config overrides...");
    process.env.TOKENIST_CACHE_STRATEGY = 'shared';
    process.env.TOKENIST_CACHE_PATH = '/mnt/shared/cache_test.json';
    try {
        const config = await (0, configLoader_1.loadConfig)(workspaceRoot);
        console.log(`Loaded cacheStrategy: ${config.cacheStrategy}`);
        console.log(`Loaded cachePath: ${config.cachePath}`);
        if (config.cacheStrategy !== 'shared' || config.cachePath !== '/mnt/shared/cache_test.json') {
            throw new Error("Shared cache configuration mapping failed!");
        }
    }
    finally {
        delete process.env.TOKENIST_CACHE_STRATEGY;
        delete process.env.TOKENIST_CACHE_PATH;
        await (0, configLoader_1.loadConfig)(workspaceRoot);
    }
    console.log("✓ Shared cache config overrides verification passed.");
    // 2. Verify Audit Log Exporter
    console.log("\n2. Testing Audit Log Export CLI command...");
    const testLedgerPath = path.resolve(workspaceRoot, 'telemetry_ledger.json');
    const tempCsvPath = path.resolve(workspaceRoot, 'dist/audit_logs_test.csv');
    // Ensure mock ledger exists for testing
    const hasLedger = await fs_1.promises.stat(testLedgerPath).then(() => true).catch(() => false);
    if (!hasLedger) {
        const mockLedger = [
            {
                timestamp: new Date().toISOString(),
                filePath: 'src/server.ts',
                rawTokens: 1500,
                compressedTokens: 300,
                tier: 'aggressive',
                savingsPct: 80.00,
                latencyMs: 15
            }
        ];
        await fs_1.promises.writeFile(testLedgerPath, JSON.stringify(mockLedger, null, 2), 'utf-8');
    }
    // Compile CLI script and run export command
    await runCommand(`npx ts-node src/cli/export.ts --format csv --out dist/audit_logs_test.csv`);
    const csvExists = await fs_1.promises.stat(tempCsvPath).then(() => true).catch(() => false);
    if (!csvExists) {
        throw new Error("Export CLI failed to create CSV audit logs file!");
    }
    const csvContent = await fs_1.promises.readFile(tempCsvPath, 'utf-8');
    console.log(`CSV Output preview:\n${csvContent}`);
    if (!csvContent.includes("Timestamp,FilePath,RawTokens,CompressedTokens,Tier,SavingsPct,LatencyMs")) {
        throw new Error("CSV output lacks expected headers!");
    }
    // Cleanup temp files
    await fs_1.promises.unlink(tempCsvPath).catch(() => { });
    console.log("✓ Audit log export verification passed.");
    // 3. Verify Team Analytics Web Dashboard Server
    console.log("\n3. Testing Local HTTP Dashboard Server...");
    const server = (0, server_1.startDashboardServer)(workspaceRoot, 3333);
    try {
        const homeResponse = await fetchUrl('http://localhost:3333/');
        console.log(`Dashboard main endpoint response status: ${homeResponse.status}`);
        console.log(`Dashboard body content length: ${homeResponse.body.length}`);
        console.log(`Dashboard body sample:\n${homeResponse.body.slice(0, 200)}`);
        if (homeResponse.status !== 200 || !homeResponse.body.includes('Tokenist Analytics Dashboard')) {
            throw new Error("Local dashboard server failed to serve template!");
        }
        const apiResponse = await fetchUrl('http://localhost:3333/api/metrics');
        console.log(`Dashboard metrics endpoint status: ${apiResponse.status}`);
        if (apiResponse.status !== 200) {
            throw new Error("Local dashboard server metrics API endpoint failed!");
        }
    }
    finally {
        server.close();
    }
    console.log("✓ Local HTTP Dashboard verification passed.");
    // 4. Verify Slack/Teams Webhook Reporter
    console.log("\n4. Testing Webhook integration...");
    let receivedPayload = '';
    const mockWebhookServer = http.createServer((req, res) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            receivedPayload = body;
            res.writeHead(200);
            res.end('ok');
        });
    });
    mockWebhookServer.listen(3334);
    try {
        const content = "⚡ Tokenist Weekly Report — Your team saved 1.2M tokens this week!";
        const slackSuccess = await (0, webhookReporter_1.sendWebhookReport)('http://localhost:3334/webhook', content, 'slack');
        console.log(`Slack Webhook send response: ${slackSuccess}`);
        console.log(`Slack Webhook received payload: ${receivedPayload}`);
        if (!slackSuccess || !receivedPayload.includes('1.2M tokens')) {
            throw new Error("Slack webhook delivery failed or invalid envelope payload!");
        }
        const teamsSuccess = await (0, webhookReporter_1.sendWebhookReport)('http://localhost:3334/webhook', content, 'teams');
        console.log(`Teams Webhook send response: ${teamsSuccess}`);
        console.log(`Teams Webhook received payload: ${receivedPayload}`);
        if (!teamsSuccess || !receivedPayload.includes('AdaptiveCard')) {
            throw new Error("Teams webhook delivery failed or invalid adaptive card envelope payload!");
        }
    }
    finally {
        mockWebhookServer.close();
    }
    console.log("✓ Webhook integration verification passed.");
    console.log("\n=== All Phase 11 Tests Passed successfully! ===");
}
runTests().catch((err) => {
    console.error("❌ Phase 11 Test Suite Failed:");
    console.error(err);
    process.exit(1);
});

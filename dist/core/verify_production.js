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
const configLoader_1 = require("./configLoader");
const cache_1 = require("./cache");
const workspaceIndexer_1 = require("./workspaceIndexer");
const metricsCollector_1 = require("../telemetry/metricsCollector");
const embeddingRanker_1 = require("./embeddingRanker");
const SAMPLE_CONFIG = `{
  "defaultTier": "aggressive",
  "maxTokenBudget": 5000,
  "showInlineSummary": true,
  "enableSemanticRanking": false,
  "cachePath": ".tokenist/cache_test.json",
  "telemetryRotationLimit": 4
}`;
async function runTests() {
    console.log("=== Running Production Hardening & DX Verification ===");
    const workspaceRoot = process.cwd();
    const configPath = path.resolve(workspaceRoot, '.tokenist.json');
    const tempCachePath = path.resolve(workspaceRoot, '.tokenist/cache_test.json');
    // Write temporary config file
    await fs_1.promises.writeFile(configPath, SAMPLE_CONFIG, 'utf-8');
    try {
        // 1. Verify Configuration Loading
        console.log("\n1. Testing config Loader...");
        const config = await (0, configLoader_1.loadConfig)(workspaceRoot);
        console.log(`Loaded config defaultTier: ${config.defaultTier}`);
        console.log(`Loaded config maxTokenBudget: ${config.maxTokenBudget}`);
        console.log(`Loaded config telemetryRotationLimit: ${config.telemetryRotationLimit}`);
        if (config.defaultTier !== 'aggressive' || config.maxTokenBudget !== 5000 || config.telemetryRotationLimit !== 4) {
            throw new Error("Configuration loader did not validate/merge correctly!");
        }
        console.log("✓ Configuration loader verification passed.");
        // 2. Verify Disk-Persistent Cache
        console.log("\n2. Testing Disk-Persistent Cache...");
        // Cleanup old test caches
        await fs_1.promises.unlink(tempCachePath).catch(() => { });
        const cache = new cache_1.AstCache(10, tempCachePath);
        const dummyFile = path.resolve(workspaceRoot, 'package.json');
        const stat = await fs_1.promises.stat(dummyFile);
        const normal = "normalContent";
        const medium = "mediumContent";
        const aggressive = "aggressiveContent";
        // Set cache entry
        await cache.set(dummyFile, { normal, medium, aggressive });
        // Flush to disk immediately
        await cache.flushToDisk();
        // Verify file exists
        const cacheFileExists = await fs_1.promises.stat(tempCachePath).then(s => s.isFile()).catch(() => false);
        if (!cacheFileExists) {
            throw new Error("Disk cache file was not created!");
        }
        // Load from disk on a new instance
        const cache2 = new cache_1.AstCache(10, tempCachePath);
        await cache2.loadFromDisk();
        const cachedVal = await cache2.get(dummyFile, 'aggressive');
        console.log(`Retrieved aggressive cached tier after reload: "${cachedVal}"`);
        if (cachedVal !== aggressive) {
            throw new Error("Disk cache load verification failed!");
        }
        console.log("✓ Disk cache loading and flushing verification passed.");
        // 3. Verify Parallel Indexer
        console.log("\n3. Testing Parallel Indexer...");
        const indexer = new workspaceIndexer_1.WorkspaceIndexer(workspaceRoot);
        const files = await indexer.indexWorkspace('src/core');
        console.log(`Parallel indexer matches count: ${files.length} files`);
        if (files.length === 0) {
            throw new Error("Parallel indexer returned empty search results!");
        }
        // Verify sorted order
        const isSorted = files.every((f, idx) => idx === 0 || f.localeCompare(files[idx - 1]) >= 0);
        if (!isSorted) {
            throw new Error("Parallel indexer did not sort output files list!");
        }
        console.log("✓ Parallel indexer performance & sort verification passed.");
        // 4. Verify Lazy-Load Embedding Ranker
        console.log("\n4. Testing Lazy-Load Embedding Ranker...");
        const ranker = new embeddingRanker_1.EmbeddingRanker();
        // Verify ranker is not initialized at startup
        if (ranker.isInitialized) {
            throw new Error("Embedding ranker was initialized prematurely!");
        }
        console.log("Calling getEmbedding to trigger lazy loading...");
        const vec = await ranker.getEmbedding("test query");
        if (!ranker.isInitialized) {
            throw new Error("Embedding ranker failed to initialize lazily!");
        }
        console.log(`✓ Embedding ranker lazy loaded successfully. Vector dimensions: ${vec.length}`);
        // 5. Verify Telemetry Rotation & Archive
        console.log("\n5. Testing Telemetry Rotation...");
        const tempLedger = path.resolve(workspaceRoot, 'telemetry_ledger_test.json');
        const collector = new metricsCollector_1.MetricsCollector(workspaceRoot);
        collector.ledgerPath = tempLedger;
        // Cleanup old files
        await fs_1.promises.unlink(tempLedger).catch(() => { });
        // Find all old archive files to clean up
        const parentDir = path.dirname(tempLedger);
        const oldFiles = await fs_1.promises.readdir(parentDir);
        for (const f of oldFiles) {
            if (f.startsWith('telemetry_ledger_archive_') && f.endsWith('.json')) {
                await fs_1.promises.unlink(path.join(parentDir, f)).catch(() => { });
            }
        }
        // Log 6 metrics (rotationLimit is 4)
        console.log("Logging 6 telemetry passes to trigger rotation limit of 4...");
        for (let i = 1; i <= 6; i++) {
            await collector.logMetrics(`file_${i}.ts`, "raw code text", "comp code", "aggressive", 10, 4);
        }
        const currentRecords = await collector.getRecords();
        console.log(`Active ledger record count after rotation: ${currentRecords.length}`);
        if (currentRecords.length > 4) {
            throw new Error("Telemetry metrics rotation failed to truncate active ledger!");
        }
        // Check if an archive file was created
        const newFiles = await fs_1.promises.readdir(parentDir);
        const archiveFile = newFiles.find(f => f.startsWith('telemetry_ledger_archive_') && f.endsWith('.json'));
        if (!archiveFile) {
            throw new Error("No telemetry archive file was created!");
        }
        console.log(`✓ Telemetry metrics rotation passed. Archive file created: "${archiveFile}"`);
        // Cleanup archive and ledger test files
        await fs_1.promises.unlink(path.join(parentDir, archiveFile)).catch(() => { });
        await fs_1.promises.unlink(tempLedger).catch(() => { });
    }
    finally {
        // Cleanup configuration and cache files
        await fs_1.promises.unlink(configPath).catch(() => { });
        await fs_1.promises.unlink(tempCachePath).catch(() => { });
    }
    console.log("\n=== All Production Hardening & DX Tests Passed! ===");
}
runTests().catch((err) => {
    console.error("❌ Production Test Suite Failed:");
    console.error(err);
    process.exit(1);
});

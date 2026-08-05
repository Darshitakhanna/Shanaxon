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
exports.sendWebhookReport = sendWebhookReport;
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const url_1 = require("url");
/**
 * Sends a telemetry savings summary report to a Slack or Teams Webhook.
 * Bypasses dependencies using native http/https nodes.
 */
async function sendWebhookReport(webhookUrl, content, platform = 'slack') {
    return new Promise((resolve) => {
        try {
            const url = new url_1.URL(webhookUrl);
            const payload = platform === 'slack'
                ? JSON.stringify({ text: content })
                : JSON.stringify({
                    type: "message",
                    attachments: [
                        {
                            contentType: "application/vnd.microsoft.card.adaptive",
                            content: {
                                type: "AdaptiveCard",
                                body: [
                                    {
                                        type: "TextBlock",
                                        text: content,
                                        wrap: true
                                    }
                                ],
                                $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
                                version: "1.2"
                            }
                        }
                    ]
                });
            const options = {
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname + url.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                }
            };
            const protocol = url.protocol === 'https:' ? https : http;
            const req = protocol.request(options, (res) => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(true);
                }
                else {
                    resolve(false);
                }
            });
            req.on('error', () => {
                resolve(false);
            });
            req.write(payload);
            req.end();
        }
        catch {
            resolve(false);
        }
    });
}

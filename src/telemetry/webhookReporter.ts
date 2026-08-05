import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

/**
 * Sends a telemetry savings summary report to a Slack or Teams Webhook.
 * Bypasses dependencies using native http/https nodes.
 */
export async function sendWebhookReport(
  webhookUrl: string,
  content: string,
  platform: 'slack' | 'teams' = 'slack'
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const url = new URL(webhookUrl);
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
        } else {
          resolve(false);
        }
      });

      req.on('error', () => {
        resolve(false);
      });

      req.write(payload);
      req.end();
    } catch {
      resolve(false);
    }
  });
}

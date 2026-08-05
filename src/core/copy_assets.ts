import * as fs from 'fs';
import * as path from 'path';

/**
 * Cross-platform script to copy static dashboard index.html to dist build layout.
 */
function copyAssets() {
  try {
    const srcHtml = path.resolve(__dirname, '../dashboard/index.html');
    const destDir = path.resolve(__dirname, '../../dist/dashboard');
    const destHtml = path.join(destDir, 'index.html');

    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(srcHtml, destHtml);
    console.log("✓ Dashboard index.html successfully copied to dist.");
  } catch (err) {
    console.error("Failed to copy static dashboard assets:", err);
    process.exit(1);
  }
}

copyAssets();

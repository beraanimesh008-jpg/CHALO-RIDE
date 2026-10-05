/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Hostinger LiteSpeed / Phusion Passenger Node.js Bootstrap File
// Compatible with both CommonJS require() loader and ESM import() runner
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const bundleFile = path.join(__dirname, 'server.bundle.js');
const tsFile = path.join(__dirname, 'server.ts');

// Function wrapper ensures ZERO top-level await, satisfying Node.js 22 require() loader
function start() {
  const targetPath = fs.existsSync(bundleFile) ? bundleFile : tsFile;
  const targetUrl = pathToFileURL(targetPath).href;
  console.log(`[Hostinger Boot] Launching backend from ${path.basename(targetPath)}...`);

  import(targetUrl).catch((err) => {
    console.error(`[Hostinger Boot] Fatal error while running ${path.basename(targetPath)}:`, err);
    process.exit(1);
  });
}

start();

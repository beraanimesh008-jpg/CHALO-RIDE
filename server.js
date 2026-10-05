/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Hostinger Node.js Application Startup File
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const bundleFile = path.join(__dirname, 'server.bundle.js');
const tsFile = path.join(__dirname, 'server.ts');

if (fs.existsSync(bundleFile)) {
  console.log('[Hostinger Boot] Starting production server from server.bundle.js...');
  await import('./server.bundle.js');
} else if (fs.existsSync(tsFile)) {
  console.log('[Hostinger Boot] server.bundle.js not found. Launching server.ts with tsx...');
  const child = spawn(process.execPath, ['--import', 'tsx', tsFile], {
    stdio: 'inherit',
    env: process.env,
    cwd: __dirname
  });

  child.on('exit', (code, signal) => {
    process.exit(code ?? (signal ? 1 : 0));
  });
} else {
  console.error('[Hostinger Boot] Fatal error: Neither server.bundle.js nor server.ts was found in application root.');
  process.exit(1);
}

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const metadataPath = path.resolve(__dirname, '../build-metadata.json');

function generateRandomId(length = 5) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function bump() {
  try {
    let metadata = { buildId: '00000' };
    
    // Generate new random dev ID
    const randomId = generateRandomId(5);
    metadata.buildId = `dev-${randomId}`;
    metadata.lastBump = new Date().toISOString();

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    // Sync with package.json version
    const pkgPath = path.resolve(__dirname, '../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    
    // Use a SemVer-compliant format for electron-builder (0.0.0-dev.xxxxx)
    // The UI will still use buildId (dev-xxxxx) from build-metadata.json
    pkg.version = `0.0.0-${metadata.buildId}`;
    
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    
    console.log(`\n[VERSION] Build ID generated: ${metadata.buildId}`);
    console.log(`[PACKAGE] package.json version synced to: ${pkg.version}\n`);
  } catch (err) {
    console.error('[ERROR] Failed to bump build version:', err);
    process.exit(1);
  }
}

bump();

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
    
    // 💎 Hybrid Versioning Restoration 💎
    // Satisfy electron-builder SemVer requirement with static 0.0.0
    pkg.version = '0.0.0';
    
    // Inject custom dev-xxxxx ID directly into naming templates
    const artifactName = `Material Suite-${metadata.buildId}.\${ext}`;
    if (pkg.build) {
        if (pkg.build.win) pkg.build.win.artifactName = artifactName;
        if (pkg.build.nsis) pkg.build.nsis.artifactName = artifactName;
        if (pkg.build.msi) pkg.build.msi.artifactName = artifactName;
    }
    
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    
    console.log(`\n[VERSION] Build ID generated: ${metadata.buildId}`);
    console.log(`[PACKAGE] Build metadata synced and artifact naming updated.\n`);
  } catch (err) {
    console.error('[ERROR] Failed to bump build version:', err);
    process.exit(1);
  }
}

bump();

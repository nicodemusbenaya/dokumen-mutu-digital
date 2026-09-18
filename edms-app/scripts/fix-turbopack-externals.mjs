/**
 * fix-turbopack-externals.mjs
 * 
 * Next.js 16 Turbopack bug workaround:
 * Turbopack renames external packages with hashed suffixes (e.g. mysql2-3d80281e5ed34ca6)
 * but doesn't create those directories in standalone/node_modules.
 * This script finds all hashed references and creates copies/symlinks pointing to the real packages.
 */

import { readFileSync, readdirSync, statSync, cpSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const chunksDir = join(projectRoot, '.next', 'standalone', '.next', 'server', 'chunks');
const standaloneNodeModules = join(projectRoot, '.next', 'standalone', 'node_modules');

// Get all real package names in standalone/node_modules
const realPackages = new Set(readdirSync(standaloneNodeModules));
console.log(`\n📦 Real packages in standalone/node_modules: ${realPackages.size}`);

// Scan all chunk files for hashed external module references
// Pattern: module name + dash + 16 hex chars
const hashPattern = /['"]([a-zA-Z0-9@/_.-]+-[a-f0-9]{16}(?:\/[a-zA-Z0-9/_.-]*)?)['"](?=\s*[,\)]|\s*\})/g;

const hashedPackages = new Map(); // hashedName -> realName

function scanFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    let match;
    while ((match = hashPattern.exec(content)) !== null) {
      const ref = match[1];
      // Extract base name (before first /)
      const baseName = ref.split('/')[0];
      // Check if it has a hash suffix (16 hex chars after last dash)
      const hashMatch = baseName.match(/^(.*)-([a-f0-9]{16})$/);
      if (hashMatch) {
        const realName = hashMatch[1];
        // Only if the real package actually exists in standalone/node_modules
        if (realPackages.has(realName)) {
          hashedPackages.set(baseName, realName);
        }
        // Handle scoped packages like @scope/package
        // e.g. @scope/package-hash -> @scope/package is also checked
      }
    }
  } catch (e) {
    // Ignore unreadable files
  }
}

function scanDir(dir) {
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.endsWith('.js')) {
          scanFile(fullPath);
        }
      } catch (e) {}
    }
  } catch (e) {}
}

console.log(`\n🔍 Scanning chunks in: ${chunksDir}`);
scanDir(chunksDir);

if (hashedPackages.size === 0) {
  console.log('✅ No hashed external packages found. Nothing to fix.');
  process.exit(0);
}

console.log(`\n⚠️  Found ${hashedPackages.size} hashed external package references:`);
for (const [hashed, real] of hashedPackages) {
  console.log(`   ${hashed} → ${real}`);
}

// Create copies of the real packages with hashed names
console.log(`\n🔧 Creating aliases in standalone/node_modules...`);
let created = 0;
let skipped = 0;

for (const [hashedName, realName] of hashedPackages) {
  const source = join(standaloneNodeModules, realName);
  const target = join(standaloneNodeModules, hashedName);
  
  if (existsSync(target)) {
    skipped++;
    continue;
  }
  
  try {
    mkdirSync(target, { recursive: true });
    // Copy the real package to the hashed name directory
    cpSync(source, target, { recursive: true });
    console.log(`   ✓ Created ${hashedName}/`);
    created++;
  } catch (e) {
    console.error(`   ✗ Failed to copy ${realName} → ${hashedName}: ${e.message}`);
  }
}

console.log(`\n✅ Done! Created: ${created}, Already existed: ${skipped}`);
console.log(`\n📦 Now repack the zip with:\n   node scripts/repack.mjs\n`);

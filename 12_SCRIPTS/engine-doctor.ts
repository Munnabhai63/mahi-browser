/**
 * MAHI Browser — Engine & Stealth Diagnostics Doctor
 * Inspects local engine resolution, stealth layer capability, and manifest discovery.
 */

import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  getProductionChromiumExecutablePath,
  resolveEngineManifest,
  hasNativeStealthEngine,
  getEnginesBaseDir,
} from '../02_BROWSER/managed-engine.js';
import { getCamoufoxExecutablePath, isCamoufoxInstalled } from '../02_BROWSER/detector.js';

export function runEngineDoctor(): {
  chromiumPath: string;
  hasManifest: boolean;
  isNative: boolean;
  stealthLayer: 'native' | 'js';
  searchPaths: string[];
  camoufoxPath: string | null;
} {
  const chromiumPath = getProductionChromiumExecutablePath();
  const manifest = resolveEngineManifest(chromiumPath);
  const isNative = hasNativeStealthEngine(chromiumPath);
  const stealthLayer = isNative ? 'native' : 'js';
  const camoufoxPath = getCamoufoxExecutablePath();

  const directDir = path.dirname(chromiumPath);
  const searchPaths: string[] = [
    path.join(directDir, 'mahi-engine.json'),
    path.join(path.dirname(directDir), 'mahi-engine.json'),
    path.join(path.dirname(path.dirname(directDir)), 'mahi-engine.json'),
    path.join(os.homedir(), '.mahi', 'cores'),
    path.join(os.homedir(), '.mahi', 'engines'),
  ];

  console.log('=======================================================');
  console.log('             MAHI BROWSER ENGINE DOCTOR');
  console.log('=======================================================');
  console.log(`Chromium Executable Path: ${chromiumPath}`);
  console.log(`Executable Exists:        ${fs.existsSync(chromiumPath)}`);
  console.log(`Mahi Engine Manifest:     ${manifest ? JSON.stringify(manifest) : 'null (none found)'}`);
  console.log(`Has Native Stealth Core:  ${isNative}`);
  console.log(`Active Stealth Layer:     ${stealthLayer}`);
  console.log(`Camoufox Installed:       ${isCamoufoxInstalled()} (${camoufoxPath || 'none'})`);
  console.log('Manifest Search Paths Tried:');
  for (const p of searchPaths) {
    console.log(`  - ${p} (exists: ${fs.existsSync(p)})`);
  }
  console.log('=======================================================');

  return {
    chromiumPath,
    hasManifest: manifest !== null,
    isNative,
    stealthLayer,
    searchPaths,
    camoufoxPath,
  };
}

if (process.argv[1] && process.argv[1].endsWith('engine-doctor.ts')) {
  runEngineDoctor();
  process.exit(0);
}

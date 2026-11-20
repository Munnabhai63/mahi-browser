#!/usr/bin/env node
/**
 * MAHI Platform V2 — Database Parity Audit Script
 * Compares record counts and user terms state side-by-side between SQLite and PostgreSQL.
 */

const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

function maskEmail(email) {
  if (!email || !email.includes('@')) return email || '';
  const [local, domain] = email.split('@');
  if (local.length <= 1) return `${local}***@${domain}`;
  return `${local[0]}***@${domain}`;
}

const sqlitePath = process.env.SQLITE_PATH || '/var/lib/mahibrowser/mahi_browser.sqlite';
const pgImage = process.env.PG_IMAGE || 'postgres:17-alpine';

function getPgUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL.trim().replace(/^["']|["']$/g, '').split('?')[0];
  }
  try {
    const raw = execSync('docker exec mahibrowser_gateway printenv DATABASE_URL', { encoding: 'utf-8' });
    return raw.trim().replace(/^["']|["']$/g, '').split('?')[0];
  } catch (err) {
    console.error('Failed to retrieve DATABASE_URL from container:', err.message);
    process.exit(1);
  }
}

const cleanPgUrl = getPgUrl();

function queryPg(sql) {
  try {
    return execSync(
      `docker run --rm -i -e DATABASE_URL="${cleanPgUrl}" ${pgImage} sh -c 'psql "$DATABASE_URL" -tA'`,
      { input: sql, encoding: 'utf-8' }
    ).trim();
  } catch (err) {
    return `ERROR: ${err.message.split('\n')[0]}`;
  }
}

function querySqlite(sql) {
  try {
    if (!fs.existsSync(sqlitePath)) {
      return 'N/A (file not found)';
    }
    return execSync(`sqlite3 "${sqlitePath}"`, { input: sql, encoding: 'utf-8' }).trim();
  } catch (err) {
    return `ERROR: ${err.message.split('\n')[0]}`;
  }
}

console.log('=====================================================================');
console.log('               MAHI BROWSER — DATABASE PARITY AUDIT                 ');
console.log('=====================================================================');

// 1. Counts
const sqliteAuthCount = querySqlite('SELECT count(*) FROM auth_users;');
const sqliteCommCount = querySqlite('SELECT count(*) FROM commercial_users;');
const sqliteSubCount = querySqlite('SELECT count(*) FROM commercial_subscriptions;');
const sqliteLicCount = querySqlite('SELECT count(*) FROM licenses;');

const pgAuthCount = queryPg('SELECT count(*) FROM auth_users;');
const pgSubCount = queryPg('SELECT count(*) FROM commercial_subscriptions;');

console.log(
  `${'Table Name'.padEnd(25)} | ${'SQLite (Local)'.padEnd(18)} | ${'PostgreSQL (Central)'.padEnd(20)}`
);
console.log('--------------------------+--------------------+---------------------');
console.log(
  `${'auth_users'.padEnd(25)} | ${sqliteAuthCount.padEnd(18)} | ${pgAuthCount.padEnd(20)}`
);
console.log(
  `${'commercial_users'.padEnd(25)} | ${sqliteCommCount.padEnd(18)} | ${'N/A (Centralized in auth_users)'.padEnd(20)}`
);
console.log(
  `${'commercial_subscriptions'.padEnd(25)} | ${sqliteSubCount.padEnd(18)} | ${pgSubCount.padEnd(20)}`
);
console.log(
  `${'licenses'.padEnd(25)} | ${sqliteLicCount.padEnd(18)} | ${'N/A'.padEnd(20)}`
);
console.log('=====================================================================');

// 2. Users and Terms Consent
console.log('\n--- SQLite Users & Terms Consent ---');
const sqliteUsersRaw = querySqlite(
  "SELECT email || '|' || coalesce(accepted_terms, 0) || '|' || coalesce(terms_version, 'NONE') FROM auth_users;"
);
if (!sqliteUsersRaw || sqliteUsersRaw.startsWith('ERROR')) {
  console.log('  (no users found in SQLite)');
} else {
  sqliteUsersRaw.split('\n').filter(Boolean).forEach((line) => {
    const parts = line.split('|');
    const email = parts[0] || '';
    const terms = parts[1] || '0';
    const ver = parts[2] || 'NONE';
    console.log(`  - User: ${maskEmail(email).padEnd(24)} | accepted_terms: ${terms} | terms_version: ${ver}`);
  });
}

console.log('\n--- PostgreSQL Users & Terms Consent ---');
const pgUsersRaw = queryPg(
  "SELECT email || '|' || coalesce(cast(accepted_terms as text), '0') || '|' || coalesce(terms_version, 'NONE') FROM auth_users order by created_at desc;"
);
if (!pgUsersRaw || pgUsersRaw.startsWith('ERROR')) {
  console.log('  (no users found in PostgreSQL or query failed)');
} else {
  pgUsersRaw.split('\n').filter(Boolean).forEach((line) => {
    const parts = line.split('|');
    const email = parts[0] || '';
    const terms = parts[1] || '0';
    const ver = parts[2] || 'NONE';
    console.log(`  - User: ${maskEmail(email).padEnd(24)} | accepted_terms: ${terms} | terms_version: ${ver}`);
  });
}
console.log('=====================================================================\n');

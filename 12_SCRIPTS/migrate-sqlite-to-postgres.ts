/**
 * MAHI Platform V2 — SQLite to PostgreSQL Migration CLI Tool
 * Migrates central cloud accounts, profiles, versions, workspaces, and licenses
 * from an existing SQLite database into central PostgreSQL via Prisma.
 *
 * Usage:
 *   npx tsx 12_SCRIPTS/migrate-sqlite-to-postgres.ts [--dry-run] [--sqlite-path=path/to/db.sqlite]
 */

import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';
import { getPrismaClient, disconnectPrisma } from '../06_DATABASE/prisma-client.js';

interface MigrationStats {
  table: string;
  sqliteCount: number;
  migratedCount: number;
  skippedCount: number;
  error?: string;
}

interface PrismaUpsertDelegate {
  upsert: (args: {
    where: Record<string, unknown>;
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }) => Promise<unknown>;
}

export async function migrateSqliteToPostgres(options?: {
  sqlitePath?: string;
  dryRun?: boolean;
  prismaOverride?: Record<string, unknown>;
}): Promise<{ success: boolean; stats: MigrationStats[]; error?: string }> {
  const isDryRun = options?.dryRun ?? process.argv.includes('--dry-run');
  const customSqliteArg = process.argv.find((a) => a.startsWith('--sqlite-path='));
  const sqlitePath = options?.sqlitePath || (customSqliteArg ? customSqliteArg.split('=')[1] : null) || path.join(process.cwd(), 'mahi_browser.sqlite');

  console.log('================================================================');
  console.log('  MAHI BROWSER — SQLITE TO POSTGRESQL CENTRAL MIGRATION TOOL');
  console.log('================================================================');
  console.log(`  Source SQLite:   ${sqlitePath}`);
  console.log(`  Mode:            ${isDryRun ? 'DRY RUN (No writes)' : 'LIVE PRODUCTION MIGRATION'}`);
  console.log('================================================================');

  if (!fs.existsSync(sqlitePath)) {
    return {
      success: false,
      stats: [],
      error: `Source SQLite file does not exist at: ${sqlitePath}`,
    };
  }

  const prisma = options?.prismaOverride || getPrismaClient();
  if (!prisma && !isDryRun) {
    return {
      success: false,
      stats: [],
      error: 'PostgreSQL is not configured. Set DATABASE_URL to a valid PostgreSQL connection string.',
    };
  }

  // Load SQLite database into sql.js
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(sqlitePath);
  const db = new SQL.Database(fileBuffer);

  const stats: MigrationStats[] = [];

  const readSqliteRows = (tableName: string): Record<string, unknown>[] => {
    try {
      const res = db.exec(`SELECT * FROM ${tableName}`);
      if (res.length === 0) return [];
      const columns = res[0].columns;
      return res[0].values.map((row: unknown[]) => {
        const obj: Record<string, unknown> = {};
        columns.forEach((col: string, idx: number) => {
          obj[col] = row[idx];
        });
        return obj;
      });
    } catch {
      return [];
    }
  };

  const tablesToMigrate = [
    'auth_users',
    'auth_sessions',
    'commercial_plans',
    'commercial_users',
    'commercial_subscriptions',
    'licenses',
    'license_devices',
    'cloud_profiles',
    'cloud_profile_versions',
    'team_workspaces',
    'team_workspace_members',
    'remote_api_keys',
    'proxy_providers',
    'support_tickets',
  ];

  for (const table of tablesToMigrate) {
    const rows = readSqliteRows(table);
    const stat: MigrationStats = {
      table,
      sqliteCount: rows.length,
      migratedCount: 0,
      skippedCount: 0,
    };

    if (rows.length === 0) {
      stats.push(stat);
      continue;
    }

    if (isDryRun || !prisma) {
      stat.migratedCount = rows.length;
      stats.push(stat);
      continue;
    }

    try {
      const modelCandidate = (prisma as unknown as Record<string, unknown>)[table];
      const model =
        typeof modelCandidate === 'object' &&
        modelCandidate !== null &&
        'upsert' in modelCandidate &&
        typeof (modelCandidate as { upsert?: unknown }).upsert === 'function'
          ? (modelCandidate as PrismaUpsertDelegate)
          : null;
      if (!model) {
        stat.skippedCount = rows.length;
        stat.error = `Prisma model for table ${table} not found`;
        stats.push(stat);
        continue;
      }

      for (const row of rows) {
        // Prepare row types matching schema
        const data = { ...row };
        if (data.storage_bytes !== undefined) data.storage_bytes = BigInt((data.storage_bytes as string | number | bigint) || 0);
        if (data.bonus_proxy_bytes !== undefined) data.bonus_proxy_bytes = BigInt((data.bonus_proxy_bytes as string | number | bigint) || 0);
        if (data.file_size !== undefined) data.file_size = BigInt((data.file_size as string | number | bigint) || 0);
        if (data.expected_size !== undefined) data.expected_size = BigInt((data.expected_size as string | number | bigint) || 0);
        if (data.created_at && typeof data.created_at === 'number') data.created_at = BigInt(data.created_at);
        if (data.expires_at && typeof data.expires_at === 'number') data.expires_at = BigInt(data.expires_at);

        const primaryKeyField = table === 'api_idempotency_records' ? null : (row.id !== undefined ? 'id' : (row.code !== undefined ? 'code' : (row.state !== undefined ? 'state' : null)));

        if (primaryKeyField && data[primaryKeyField]) {
          await model.upsert({
            where: { [primaryKeyField]: data[primaryKeyField] },
            create: data,
            update: data,
          });
          stat.migratedCount++;
        } else {
          stat.skippedCount++;
        }
      }
    } catch (err: unknown) {
      stat.error = err instanceof Error ? err.message : 'Migration error';
    }

    stats.push(stat);
  }

  db.close();

  console.log('\nMigration Summary:');
  console.table(stats);

  return {
    success: stats.every((s) => !s.error),
    stats,
  };
}

// Direct CLI Execution
if (process.argv[1]?.includes('migrate-sqlite-to-postgres')) {
  migrateSqliteToPostgres()
    .then(async (res) => {
      await disconnectPrisma();
      if (!res.success) {
        console.error('Migration finished with errors:', res.error);
        process.exit(1);
      }
      console.log('Migration completed successfully.');
      process.exit(0);
    })
    .catch(async (err) => {
      await disconnectPrisma();
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

import {
  backupDatabaseBeforeMigration,
  getDatabase,
  initSqlEngine,
} from './connection.js';
import { INITIAL_SCHEMA } from './schema/initial-schema.js';
import { applyMigrationsV14ToV25 } from './schema/migrations-v14-to-v25.js';
import { applyMigrationsV2ToV13 } from './schema/migrations-v2-to-v13.js';
import {
  addColumnIfNotExists,
  columnExists,
  getAppSchemaVersion,
  runMigration,
  stampAppSchemaVersion,
  tableExists,
} from './schema/schema-helpers.js';

export {
  INITIAL_SCHEMA,
  addColumnIfNotExists,
  columnExists,
  getAppSchemaVersion,
  runMigration,
  stampAppSchemaVersion,
  tableExists,
};

export async function initializeDatabase(): Promise<void> {
  await initSqlEngine();
  backupDatabaseBeforeMigration();
  const db = getDatabase();
  db.exec(INITIAL_SCHEMA);
  stampAppSchemaVersion(db, 1);

  const checkMigration = db.prepare('SELECT version FROM schema_migrations WHERE version = 1').get();
  if (!checkMigration) {
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (1, ?)').run(new Date().toISOString());
  }

  applyMigrationsV2ToV13(db);
  applyMigrationsV14ToV25(db);
}

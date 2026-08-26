/**
 * Standalone Central Server Background Service Runner (TypeScript)
 * Allows running the Web Admin & Super Admin server directly
 */

import { initializeDatabase } from '../06_DATABASE/schema.js';
import { createCentralApiServer } from '../07_BACKEND/server/app.js';

async function main() {
  console.log('Initializing MAHI Database...');
  await initializeDatabase();

  const server = createCentralApiServer();
  const PORT = 32123;

  server.listen(PORT, '127.0.0.1', () => {
    console.log('===================================================');
    console.log('  MAHI BROWSER V2 — CENTRAL SERVER RUNNING');
    console.log('===================================================');
    console.log(`  Web Admin Portal:    http://127.0.0.1:${PORT}/admin`);
    console.log(`  Secret Super Admin:  http://127.0.0.1:${PORT}/super-admin`);
    console.log(`  Health Check:        http://127.0.0.1:${PORT}/api/v2/health`);
    console.log('===================================================');
  });
}

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

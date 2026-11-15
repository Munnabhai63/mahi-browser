/**
 * Standalone Central Server Background Service Runner (TypeScript)
 * Allows running the Web Admin & Super Admin server directly.
 * Supports both standard HTTP server and high-performance Fastify Gateway.
 */

import { initializeDatabase } from '../06_DATABASE/schema.js';
import { createCentralApiServer } from '../07_BACKEND/server/app.js';
import { startFastifyCloudGateway } from '../07_BACKEND/server/cloud-gateway.js';

async function main() {
  console.log('Initializing MAHI Database...');
  await initializeDatabase();

  const useFastify = process.env.GATEWAY_ENGINE === 'fastify' || process.argv.includes('--fastify');
  const PORT = parseInt(process.env.PORT || '32123', 10);

  if (useFastify) {
    const { address } = await startFastifyCloudGateway({ port: PORT, host: '127.0.0.1' });
    console.log('===================================================');
    console.log('  MAHI BROWSER V2 — FASTIFY CLOUD GATEWAY RUNNING');
    console.log('===================================================');
    console.log(`  Listening:           ${address}`);
    console.log(`  Web Admin Portal:    http://127.0.0.1:${PORT}/admin`);
    console.log(`  Secret Super Admin:  http://127.0.0.1:${PORT}/super-admin`);
    console.log(`  Health Check:        http://127.0.0.1:${PORT}/api/v2/health`);
    console.log('===================================================');
    return;
  }

  const server = createCentralApiServer();
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

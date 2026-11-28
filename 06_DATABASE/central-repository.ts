/**
 * MAHI Platform V2 — Unified Central Data Access Layer
 * Seamlessly switches between PostgreSQL (Prisma) for Central Cloud Gateway
 * and SQLite for offline local desktop execution and testing.
 */

import { isPostgresConfigured } from './prisma-client.js';
import type { CentralRepository } from './central-repository-contract.js';
import { PostgresCentralRepository } from './postgres-central-repository.js';
import { SqliteCentralRepository } from './sqlite-central-repository.js';

export { isPostgresConfigured } from './prisma-client.js';
export * from './central-repository-types.js';
export type { CentralRepository } from './central-repository-contract.js';
export { PostgresCentralRepository } from './postgres-central-repository.js';
export { SqliteCentralRepository } from './sqlite-central-repository.js';

let testRepository: CentralRepository | null = null;

export function getCentralRepository(): CentralRepository {
  if (testRepository) {
    return testRepository;
  }
  if (isPostgresConfigured()) {
    return new PostgresCentralRepository();
  }
  return new SqliteCentralRepository();
}

export function setCentralRepositoryForTest(repo: CentralRepository | null): void {
  testRepository = repo;
}

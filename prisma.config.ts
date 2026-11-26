import { defineConfig } from 'prisma/config';

const datasourceUrl = (process.env.DIRECT_URL || process.env.DATABASE_URL || '').trim().replace(/^["']|["']$/g, '');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  ...(datasourceUrl ? { datasource: { url: datasourceUrl } } : {}),
});

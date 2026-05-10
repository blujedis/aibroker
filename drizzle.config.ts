/// <reference types="node" />

import { type Config, defineConfig } from 'drizzle-kit';

const config: Config = {
  schema: './src/lib/server/db/schema.postgres.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_CONNECTION_URL ?? 'postgresql://postgres:postgres@localhost:5432/aibroker'
  }
};

export default defineConfig(config);

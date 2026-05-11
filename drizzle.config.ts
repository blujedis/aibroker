/// <reference types="node" />

import { type Config, defineConfig } from 'drizzle-kit';
import {join} from 'path';

const cwd = process.cwd();

const config: Config = {
  schema: join(cwd, './src/lib/server/db/schema.postgres.ts'),
  out: join(cwd, './drizzle'),
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_CONNECTION_URL ?? 'postgresql://postgres:postgres@localhost:5432/aibroker'
  }
};

export default defineConfig(config);

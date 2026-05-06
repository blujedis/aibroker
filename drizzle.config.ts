/// <reference types="node" />

import { type Config, defineConfig } from 'drizzle-kit';

const config: Config = {
  schema: './src/lib/server/db/schema.postgres.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/aibroker'
  }
};

export default defineConfig(config);


// export default defineConfig({
// 	schema: './src/lib/providers/db/schema/index.ts',
// 	out: './src/lib/providers/db/migrations',
// 	dialect: 'postgresql',
// 	// dialect: 'sqlite',
// 	// dialect: 'turso',
// 	dbCredentials: {
// 		url: process.env.DATABASE_NEON_CONNECTION,
// 		// url: process.env.DATABASE_TURSO_URL,
// 		// authToken: process.env.DATABASE_TURSO_TOKEN,
// 	},
// 	verbose: true,
// 	strict: true
// });

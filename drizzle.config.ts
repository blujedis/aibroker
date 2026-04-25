/// <reference types="node" />

import { defineConfig, type Config } from 'drizzle-kit';

const config: Config = {
  schema: './src/lib/server/db/schema.ts',
  out: './drizzle',
  dialect: process.env.DATABASE_DIALECT as Config['dialect'] ?? 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'file:./data/aibroker.db'
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

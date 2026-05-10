// Set dummy env vars so module-level guards in server files don't throw
// during test collection when running without a real database (e.g. Docker builds).
process.env.DATABASE_CONNECTION_URL ??= 'postgresql://localhost/test_dummy';
process.env.MASTER_KEY_SECRET ??= 'test-master-key-for-vitest-only';

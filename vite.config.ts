import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

const suppressedTestStderrPatterns = [
  '[auth/session] Invalid SESSION_TTL value',
  '[auth/session] Invalid REFRESH_TOKEN_TTL value'
];

export default defineConfig(({ mode }) => {

  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(env.PORT || 4000);

  return {
    plugins: [tailwindcss(), sveltekit()],
    server: {
      port
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
      setupFiles: ['src/vitest.setup.ts'],
      onConsoleLog(log, type) {
        if (
          type === 'stderr' &&
          suppressedTestStderrPatterns.some((pattern) => log.includes(pattern))
        ) {
          return false;
        }
      }
    }

  };


});

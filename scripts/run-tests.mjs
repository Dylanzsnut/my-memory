import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { build } from 'esbuild';

mkdirSync('.test-dist', { recursive: true });

try {
  await build({
    entryPoints: ['tests/core.test.ts'],
    outfile: '.test-dist/core.test.mjs',
    bundle: true,
    packages: 'external',
    platform: 'node',
    format: 'esm',
    sourcemap: false,
    logLevel: 'silent',
    define: {
      'import.meta.env': '{}',
    },
  });

  execFileSync(process.execPath, ['--test', '.test-dist/core.test.mjs'], {
    stdio: 'inherit',
  });
} finally {
  rmSync('.test-dist', { recursive: true, force: true });
}

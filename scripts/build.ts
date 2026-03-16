import { execSync } from 'child_process';
import { buildSync } from 'esbuild';
import { cpSync, mkdirSync } from 'fs';

// Build overlay (browser bundle)
buildSync({
  entryPoints: ['overlay/overlay.ts'],
  bundle: true,
  format: 'iife',
  outfile: 'dist/overlay.js',
  target: 'es2020',
  minify: false,
});
console.log('Built dist/overlay.js');

// Build CLI + MCP server (TypeScript)
execSync('npx tsc', { stdio: 'inherit' });
console.log('Built dist/ (TypeScript)');

// Copy Phosphor font assets
mkdirSync('dist/phosphor', { recursive: true });
for (const file of ['style.css', 'Phosphor.woff2', 'Phosphor.woff']) {
  cpSync(`node_modules/@phosphor-icons/web/src/regular/${file}`, `dist/phosphor/${file}`);
}
console.log('Copied Phosphor fonts to dist/phosphor/');


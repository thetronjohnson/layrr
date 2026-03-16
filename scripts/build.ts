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

// Build CLI + server (TypeScript)
execSync('npx tsc', { stdio: 'inherit' });
console.log('Built dist/ (TypeScript)');

// Copy Lucide font assets
mkdirSync('dist/fonts', { recursive: true });
for (const file of ['lucide.css', 'lucide.woff2', 'lucide.woff']) {
  cpSync(`node_modules/lucide-static/font/${file}`, `dist/fonts/${file}`);
}
console.log('Copied Lucide fonts to dist/fonts/');

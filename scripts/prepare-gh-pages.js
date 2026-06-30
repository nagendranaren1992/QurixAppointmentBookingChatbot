/**
 * Post-build helper for GitHub Pages hosting.
 *
 * - Copies dist/index.html to dist/404.html so client-side routes and
 *   page refreshes don't return GitHub's 404 page.
 * - Creates dist/.nojekyll so GitHub Pages serves files/folders that
 *   start with `_` (Metro's web output uses _expo/).
 */

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const indexFile = path.join(distDir, 'index.html');
const notFoundFile = path.join(distDir, '404.html');
const nojekyllFile = path.join(distDir, '.nojekyll');

if (!fs.existsSync(distDir)) {
  console.error('[prepare-gh-pages] dist/ not found. Did the web export run?');
  process.exit(1);
}

if (!fs.existsSync(indexFile)) {
  console.error('[prepare-gh-pages] dist/index.html not found.');
  process.exit(1);
}

fs.copyFileSync(indexFile, notFoundFile);
fs.writeFileSync(nojekyllFile, '');

console.log('[prepare-gh-pages] Wrote dist/404.html and dist/.nojekyll');

/**
 * Post-build helper for GitHub Pages hosting.
 *
 * Steps:
 *   1. Copy dist/index.html to dist/404.html so client-side routes and
 *      page refreshes don't return GitHub's 404 page.
 *   2. Create dist/.nojekyll so GitHub Pages serves files/folders that
 *      start with `_` (Metro's web output uses _expo/).
 *   3. Flatten dist/assets/node_modules/@expo/vector-icons/.../Fonts/*
 *      into dist/assets/fonts/* and rewrite every reference to that
 *      path inside the emitted JS bundle.
 *
 *      Why step 3 (two-headed bug):
 *        a) Metro emits vector-icon TTFs under
 *           `dist/assets/node_modules/@expo/vector-icons/.../Fonts/`.
 *           The `gh-pages` npm package's `git add` step respects the
 *           repo's root .gitignore, which excludes `node_modules/`,
 *           so every font silently fails to publish and the live site
 *           renders icons as empty boxes.
 *        b) The full nested path is also long enough to exceed git's
 *           default Windows MAX_PATH limit (260 chars) once the
 *           gh-pages cache dir prefix is included, which makes
 *           `git add` fail with "Filename too long".
 *      Flattening to `assets/fonts/<file>.ttf` fixes both at once.
 */

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const indexFile = path.join(distDir, 'index.html');
const notFoundFile = path.join(distDir, '404.html');
const nojekyllFile = path.join(distDir, '.nojekyll');
const assetsDir = path.join(distDir, 'assets');
const oldVendorRoot = path.join(assetsDir, 'node_modules');
const oldFontsDir = path.join(
  oldVendorRoot,
  '@expo',
  'vector-icons',
  'build',
  'vendor',
  'react-native-vector-icons',
  'Fonts'
);
const newFontsDir = path.join(assetsDir, 'fonts');
// Metro stores the directory portion of an asset URL without a trailing
// slash — the filename is concatenated at runtime. So our search target
// must NOT have a trailing slash either. All known prior shapes are
// mapped to the new flat path; the second entry is a fallback for an
// interrupted previous-run state.
const oldFontsUrlPrefixes = [
  '/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts',
  '/assets/vendor/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts',
];
const newFontsUrlPrefix = '/assets/fonts';
const bundleDir = path.join(distDir, '_expo', 'static', 'js', 'web');

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

if (fs.existsSync(oldFontsDir)) {
  fs.mkdirSync(newFontsDir, { recursive: true });
  const fontFiles = fs.readdirSync(oldFontsDir);
  for (const f of fontFiles) {
    fs.copyFileSync(path.join(oldFontsDir, f), path.join(newFontsDir, f));
  }
  fs.rmSync(oldVendorRoot, { recursive: true, force: true });
  console.log(
    `[prepare-gh-pages] Moved ${fontFiles.length} font file(s) to assets/fonts/ and removed assets/node_modules/`
  );

  if (fs.existsSync(bundleDir)) {
    const jsFiles = fs
      .readdirSync(bundleDir)
      .filter((f) => f.endsWith('.js'));
    let patched = 0;
    let totalReplacements = 0;
    for (const f of jsFiles) {
      const full = path.join(bundleDir, f);
      const before = fs.readFileSync(full, 'utf8');
      let after = before;
      for (const oldPrefix of oldFontsUrlPrefixes) {
        const parts = after.split(oldPrefix);
        totalReplacements += parts.length - 1;
        after = parts.join(newFontsUrlPrefix);
      }
      if (before !== after) {
        fs.writeFileSync(full, after);
        patched += 1;
      }
    }
    console.log(
      `[prepare-gh-pages] Rewrote font URL prefix in ${patched} bundle file(s) (${totalReplacements} occurrences)`
    );
    if (totalReplacements === 0) {
      console.warn(
        '[prepare-gh-pages] WARNING: no font URL references found to rewrite. ' +
        'If icons are missing on the live site, clear dist/ and .expo/ and rebuild.'
      );
    }
  } else {
    console.warn('[prepare-gh-pages] _expo/static/js/web/ not found; skipped bundle rewrite.');
  }
} else {
  console.log('[prepare-gh-pages] Vector-icon fonts dir not present; nothing to flatten.');
}

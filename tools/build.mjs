// Builds one self-contained HTML file (CSS + all JS modules inlined), with no dependencies.
//   dist/habit-lab.html   full document: open it straight from disk, email it, or host it anywhere
//   dist/embed.html       same page without <html>/<head>/<body>, for hosts that supply the skeleton
// Usage: node tools/build.mjs
//
// The bundler is deliberately tiny: it supports exactly the module syntax this project uses
// (single-line `import … from './x.js'` and `export function/const/default/{…}`) and fails loudly on
// anything else, or on circular imports.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const modules = new Map(); // abs path -> {id, code, path}
const visiting = new Set();

function load(abs) {
  if (modules.has(abs)) return modules.get(abs).id;
  if (visiting.has(abs)) throw new Error(`Circular import involving ${relative(root, abs)}`);
  visiting.add(abs);
  const src = readFileSync(abs, 'utf8');
  const exportsList = [];
  const lines = src.split('\n').map((line) => {
    let m;
    if ((m = line.match(/^import\s+(.+?)\s+from\s+['"](.+?)['"];?\s*$/))) {
      const dep = load(resolve(dirname(abs), m[2]));
      const spec = m[1].trim();
      if (spec.startsWith('* as ')) return `const ${spec.slice(5)} = __req(${dep});`;
      if (spec.startsWith('{')) return `const ${spec.replace(/\s+as\s+/g, ': ')} = __req(${dep});`;
      if (/^[A-Za-z_$][\w$]*$/.test(spec)) return `const ${spec} = __req(${dep}).default;`;
      throw new Error(`Unsupported import in ${abs}: ${line}`);
    }
    if (/^import\s/.test(line)) throw new Error(`Unsupported import in ${abs}: ${line}`);
    if ((m = line.match(/^export\s+(async\s+)?function\s+([\w$]+)/))) {
      exportsList.push(m[2]);
      return line.replace(/^export\s+/, '');
    }
    if ((m = line.match(/^export\s+(const|let)\s+([\w$]+)/))) {
      exportsList.push(m[2]);
      return line.replace(/^export\s+/, '');
    }
    if (/^export\s+default\s+/.test(line)) return line.replace(/^export\s+default\s+/, '__m.default = ');
    if ((m = line.match(/^export\s+\{([^}]+)\};?\s*$/))) {
      exportsList.push(...m[1].split(',').map((x) => x.trim()).filter(Boolean));
      return '';
    }
    if (/^export\s/.test(line)) throw new Error(`Unsupported export in ${abs}: ${line}`);
    return line;
  });
  // Dependencies were registered first, so this module gets the next id.
  const id = modules.size;
  const code = `${lines.join('\n')}\nObject.assign(__m, { ${exportsList.join(', ')} });`;
  modules.set(abs, { id, code, path: relative(root, abs) });
  visiting.delete(abs);
  return id;
}

const entry = load(join(root, 'js/app.js'));
const defs = [...modules.values()].map((m) => `/* ${m.path} */ ${m.id}: function (__m, __req) {\n${m.code}\n}`).join(',\n');
const js = `(function () {
'use strict';
const __defs = {\n${defs}\n};
const __cache = {};
function __req(id) {
  if (__cache[id]) return __cache[id];
  const m = (__cache[id] = {});
  __defs[id](m, __req);
  return m;
}
__req(${entry});
})();`;

// Sanity check: the bundle must parse.
new Function(js);

// Inter (SIL OFL 1.1, fonts/Inter-OFL.txt), embedded so it works offline in the app and needs no network.
const interFont = readFileSync(join(root, 'fonts/inter-latin-wght.woff2')).toString('base64');
const css = `@font-face{font-family:'Inter';font-style:normal;font-weight:100 900;font-display:swap;src:url(data:font/woff2;base64,${interFont}) format('woff2')}\n` + readFileSync(join(root, 'css/styles.css'), 'utf8');
const icon = 'data:image/svg+xml,' + encodeURIComponent(readFileSync(join(root, 'icons/icon.svg'), 'utf8').trim());
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const safeJs = `window.HABITLAB_VERSION = ${JSON.stringify(version)};\n` + js.replace(/<\/script/gi, '<\\/script');
const headBits = `<title>Habit Lab</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Evidence-based adaptive habit coach for weight loss: meal plans, workouts and habits that adjust to your weekly check-ins.">
<meta name="theme-color" content="#1f7a5c">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="${icon}">
<style>${css}</style>`;
const bodyBits = `<div class="app"><nav class="sidebar" aria-label="Main"></nav><main id="main" tabindex="-1"><div class="empty">Loading…</div></main></div>
<nav class="bottomnav" aria-label="Main"></nav>
<div class="toast" role="status" aria-live="polite"></div>
<script>${safeJs}</script>`;

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/habit-lab.html'), `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${headBits}\n</head>\n<body>\n${bodyBits}\n</body>\n</html>\n`);
writeFileSync(join(root, 'dist/embed.html'), `${headBits}\n${bodyBits}\n`);
// www/ is what the Android app (Capacitor) packages.
mkdirSync(join(root, 'www/icons'), { recursive: true });
writeFileSync(join(root, 'www/index.html'), readFileSync(join(root, 'dist/habit-lab.html')));
// Web extras: installable (manifest) and offline (service worker).
writeFileSync(join(root, 'www/manifest.webmanifest'), readFileSync(join(root, 'manifest.webmanifest')));
writeFileSync(join(root, 'www/sw.js'), readFileSync(join(root, 'sw.js')));
for (const f of ['icon-192.png', 'icon-512.png', 'icon.svg']) writeFileSync(join(root, 'www/icons', f), readFileSync(join(root, 'icons', f)));
// Security headers for the web build (Vercel). The Content-Security-Policy allows exactly this build's
// inline script (by hash) and nothing else: no other scripts, no network, no plugins, no framing.
// Not applied inside the Android app, where Capacitor injects its own bridge script.
export const SCRIPT_HASH = 'sha256-' + createHash('sha256').update(safeJs).digest('base64');
const csp = [
  "default-src 'none'",
  `script-src '${SCRIPT_HASH}'`,
  "style-src 'unsafe-inline'",
  'font-src data:',
  "img-src 'self' data:",
  "manifest-src 'self'",
  "worker-src 'self'",
  "connect-src 'self' https://jwjabhcebwnzhfphsuwg.supabase.co", // shared calendar (js/share.js)
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join('; ');
const vercel = {
  $schema: 'https://openapi.vercel.sh/vercel.json',
  buildCommand: 'npm run build',
  outputDirectory: 'www',
  headers: [
    {
      source: '/(.*)',
      headers: [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      ],
    },
    { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
  ],
};
writeFileSync(join(root, 'vercel.json'), JSON.stringify(vercel, null, 2) + '\n');

console.log(`built dist/habit-lab.html: ${modules.size} modules, ${(js.length / 1024).toFixed(0)} KB of JS`);

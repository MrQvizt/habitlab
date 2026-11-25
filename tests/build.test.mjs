// The production build is deterministic and the committed vercel.json matches it. If the script
// hash in the Content-Security-Policy is stale, browsers would block the app on the live site,
// so this fails until `npm run build` is re-run and vercel.json committed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cspOf = (cfg) => cfg.headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value;

test('committed vercel.json CSP matches a fresh build', () => {
  const committed = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
  execFileSync(process.execPath, [join(root, 'tools/build.mjs')], { cwd: root, stdio: 'pipe' });
  const fresh = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
  assert.equal(cspOf(committed), cspOf(fresh), 'vercel.json is stale: run `npm run build` and commit vercel.json');
  // And the hash really is the hash of the inline script that ships
  const html = readFileSync(join(root, 'www/index.html'), 'utf8');
  const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const hash = 'sha256-' + createHash('sha256').update(script).digest('base64');
  assert.ok(cspOf(fresh).includes(`'${hash}'`), 'CSP hash does not match the shipped script');
  // One inline script only (anything else would be blocked)
  assert.equal(html.split('<script').length - 1, 1);
});

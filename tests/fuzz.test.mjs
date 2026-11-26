// Robustness: saved data from older versions, damaged backups or bugs must never crash the app.
// Randomly corrupts a realistic state (wrong types, nulls, huge/negative numbers, bad dates,
// missing sections) and checks that sanitise + every engine the screens use still run and return
// finite numbers. Deterministic seed, so a failure is reproducible.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoState } from '../js/demo.js';
import * as store from '../js/store.js';
import { rng } from '../js/engine/util.js';
import { weekBody, bodyCollection } from '../js/engine/body.js';
import { journey } from '../js/engine/journey.js';
import { alarmSpecs } from '../js/engine/alarms.js';
import { buildReminders } from '../js/engine/reminders.js';
import { morningMessages } from '../js/data/affirmations.js';

const JUNK = [null, undefined, -1, 0, 1e12, -1e12, NaN, '', 'abc', '2026-13-45', [], {}, [null], { a: 1 }, true, '<b>x</b>', 3.7];

function paths(obj, prefix = [], out = [], depth = 0) {
  if (depth > 4 || obj === null || typeof obj !== 'object') return out;
  for (const k of Object.keys(obj).slice(0, 40)) {
    out.push([...prefix, k]);
    paths(obj[k], [...prefix, k], out, depth + 1);
  }
  return out;
}

test('random corruption never crashes sanitise or the engines', () => {
  const base = demoState();
  const all = paths(base);
  const rand = rng('fuzz-1');
  const today = store.today();
  for (let round = 0; round < 150; round++) {
    const s = JSON.parse(JSON.stringify(base));
    const n = 1 + Math.floor(rand() * 8);
    for (let i = 0; i < n; i++) {
      const path = all[Math.floor(rand() * all.length)];
      let o = s;
      for (const k of path.slice(0, -1)) o = o?.[k];
      if (o && typeof o === 'object') {
        const v = JUNK[Math.floor(rand() * JUNK.length)];
        if (v === undefined) delete o[path.at(-1)];
        else o[path.at(-1)] = v;
      }
    }
    let clean;
    assert.doesNotThrow(() => (clean = store.sanitize(JSON.parse(JSON.stringify(s)))), `round ${round} sanitise`);
    if (!clean.profile) continue;
    assert.doesNotThrow(() => {
      const st = store.ensurePlan(store.ensureProgress(clean), today).state;
      const g = store.game(st);
      assert.ok(Number.isFinite(g.xp) && Number.isFinite(g.level) && Number.isFinite(g.streak), 'game numbers finite');
      store.targets(st);
      const w = weekBody(st, store.weekKey(today), { asOf: today });
      for (const o of w.organs) assert.ok(Number.isFinite(o.pct), 'ring finite');
      bodyCollection(st, today);
      const j = journey(st, { today, trendKg: store.trendWeight(st) });
      assert.ok(Number.isFinite(j.lost));
      alarmSpecs(st);
      buildReminders({ ...st, reminders: { ...st.reminders, enabled: true } }, new Date());
      morningMessages(st.affirm);
    }, `round ${round} engines`);
  }
});

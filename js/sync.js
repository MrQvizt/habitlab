// Merging two copies of your data — the one on this phone and the one in your account — so logging in
// never loses progress. The newer copy (by savedAt) wins where both have the same thing; anything only
// one copy has is kept. Day-by-day logs merge per day, lists of things with an id merge per item.

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isDateMap = (o) => isObj(o) && Object.keys(o).length > 0 && Object.keys(o).every((k) => ISO.test(k));
const keyOf = (arr) => {
  const sample = arr.find(isObj);
  if (!sample) return null;
  if (typeof sample.id === 'string' && arr.every((x) => isObj(x) && typeof x.id === 'string')) return 'id';
  if (typeof sample.date === 'string' && arr.every((x) => isObj(x) && typeof x.date === 'string')) return 'date';
  return null;
};

/** Merge `other` into `pref` (the copy that wins a tie). Neither input is changed. */
function mergeValue(pref, other) {
  if (pref === undefined || pref === null) return other === undefined ? pref : structuredClone(other);
  if (other === undefined || other === null) return structuredClone(pref);
  // Logs keyed by day (meals, habits, workouts, extras…): every day from both; a day both have → the newer copy's day.
  if ((isDateMap(pref) || Object.keys(pref).length === 0) && isDateMap(other)) return { ...structuredClone(other), ...structuredClone(pref) };
  if (isDateMap(pref) && isObj(other) && Object.keys(other).length === 0) return structuredClone(pref);
  if (isObj(pref) && isObj(other)) {
    const out = {};
    for (const k of new Set([...Object.keys(other), ...Object.keys(pref)])) out[k] = mergeValue(pref[k], other[k]);
    return out;
  }
  // Lists of things with an id (calendar events, habits…) or a date (weigh-ins, check-ins): union.
  if (Array.isArray(pref) && Array.isArray(other)) {
    const key = keyOf([...pref, ...other]);
    if (!key) return structuredClone(pref.length ? pref : other);
    const seen = new Set(pref.map((x) => x[key]));
    const merged = [...structuredClone(pref), ...structuredClone(other.filter((x) => !seen.has(x[key])))];
    return key === 'date' ? merged.sort((a, b) => a.date.localeCompare(b.date)) : merged;
  }
  return structuredClone(pref);
}

/** Has this copy got any real progress in it? */
export const hasProgress = (s) => !!s?.profile;
export const isDemo = (s) => !!s?.profile?.demo;

/**
 * The copy to keep after logging in.
 * - no account copy yet → this phone's
 * - nothing on this phone (or only demo data) → the account's
 * - both → merged, the newer one winning where they overlap
 */
export function mergeStates(local, cloud) {
  if (!hasProgress(cloud)) return local;
  if (!hasProgress(local) || isDemo(local)) return cloud;
  if (isDemo(cloud)) return local;
  const localNewer = (local.savedAt || 0) >= (cloud.savedAt || 0);
  const merged = localNewer ? mergeValue(local, cloud) : mergeValue(cloud, local);
  merged.savedAt = Math.max(local.savedAt || 0, cloud.savedAt || 0);
  return merged;
}

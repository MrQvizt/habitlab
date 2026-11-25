// Alarm sounds. Each melody is data: the same spec is played by the in-app preview (Web Audio) and by
// the native alarm (AlarmService.java synthesises it on the alarm stream), so what you hear when you
// choose is exactly what wakes you.
// Melodic sounds were linked to less morning grogginess than unmelodic ones (McFarlane et al. 2020),
// so most choices are melodic; a classic beep is offered for people who want it.
//
// Spec: { notes: [[freq Hz, beats, glideTo Hz?], …] (freq 0 = silence), beat: seconds per beat,
//         decay: amplitude decay per second, attack: seconds, partials: [[multiple, amplitude], …],
//         rest: seconds of silence after the pattern }

const N = { A3: 220, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, Fs5: 739.99, G5: 783.99, A5: 880, B5: 987.77, C6: 1046.5, Fs4: 369.99 };

export const MELODIES = {
  sunrise: {
    name: 'Sunrise', hint: 'A bright rising-and-falling melody', moods: ['wake'],
    beat: 0.34, decay: 6.5, attack: 0.012, partials: [[1, 1], [2, 0.35], [3, 0.12]], rest: 0.9,
    notes: [[N.C5, 1], [N.E5, 1], [N.G5, 1], [N.A5, 1], [N.C6, 1], [N.A5, 1], [N.G5, 1], [N.E5, 1]],
  },
  bells: {
    name: 'Morning bells', hint: 'Slow, ringing church-style bells', moods: ['wake', 'bed'],
    beat: 0.8, decay: 1.8, attack: 0.005, partials: [[1, 1], [2.76, 0.4], [5.4, 0.18]], rest: 1.2,
    notes: [[N.G5, 1], [N.E5, 1], [N.C5, 1], [N.G4, 1.5]],
  },
  marimba: {
    name: 'Marimba', hint: 'Light, bouncy wooden notes', moods: ['wake', 'meal'],
    beat: 0.2, decay: 11, attack: 0.004, partials: [[1, 1], [4, 0.28], [10, 0.05]], rest: 0.7,
    notes: [[N.D5, 1], [N.Fs5, 1], [N.A5, 1], [N.B5, 1], [N.A5, 1], [N.Fs5, 1], [N.D5, 1], [N.A4, 2]],
  },
  birdsong: {
    name: 'Birdsong', hint: 'Bright chirps, like a garden at dawn', moods: ['wake'],
    beat: 0.09, decay: 14, attack: 0.008, partials: [[1, 1], [2, 0.15]], rest: 1.1,
    notes: [[2400, 1, 3300], [0, 0.6], [2600, 1, 3500], [0, 0.6], [2800, 1, 3900], [0, 3], [3200, 1.5, 2400], [0, 0.8], [3000, 1.5, 2200]],
  },
  ocean: {
    name: 'Calm', hint: 'Low, warm and unhurried', moods: ['wind', 'bed', 'wake'],
    beat: 0.6, decay: 2.6, attack: 0.06, partials: [[1, 1], [2, 0.2]], rest: 1.6,
    notes: [[N.C4, 1], [N.G4, 1], [N.E4, 1], [N.G4, 1], [N.A3, 1], [N.E4, 1], [N.D4, 2]],
  },
  lullaby: {
    name: 'Lullaby', hint: 'Soft and slow — made for winding down', moods: ['wind', 'bed'],
    beat: 0.5, decay: 3.2, attack: 0.04, partials: [[1, 1], [3, 0.08]], rest: 1.8,
    notes: [[N.A4, 1], [N.Fs4, 1], [N.D4, 2], [N.A4, 1], [N.B4, 1], [N.A4, 2]],
  },
  chime: {
    name: 'Kitchen chime', hint: 'Two friendly notes — dinner’s ready', moods: ['meal'],
    beat: 0.45, decay: 3.5, attack: 0.006, partials: [[1, 1], [2.4, 0.25]], rest: 1.2,
    notes: [[N.E5, 1], [N.C5, 2]],
  },
  beep: {
    name: 'Classic beep', hint: 'Not melodic — wakes fast, can feel harsher', moods: ['wake'],
    beat: 0.13, decay: 0.5, attack: 0.002, partials: [[1, 1], [3, 0.33], [5, 0.2]], rest: 0.6,
    notes: [[1000, 1], [0, 0.8], [1000, 1], [0, 0.8], [1000, 1], [0, 0.8], [1000, 1]],
  },
};

/** Defaults: a melodic wake-up, calm sounds at night, a chime for meals. */
export const DEFAULT_SOUND = { wake: 'sunrise', wind: 'ocean', bed: 'lullaby', meals: 'chime' };

/** Which melodies to list first for an alarm kind. */
export function melodiesFor(kind) {
  const mood = kind === 'meals' ? 'meal' : kind;
  return Object.entries(MELODIES).sort(([, a], [, b]) => Number(b.moods.includes(mood)) - Number(a.moods.includes(mood)));
}

/** Label for a saved sound value: a melody id, 'device', or 'uri:<content uri>|<title>'. */
export function soundLabel(sound) {
  if (!sound) return MELODIES.sunrise.name;
  if (MELODIES[sound]) return MELODIES[sound].name;
  if (sound === 'device') return 'Phone’s alarm sound';
  if (sound.startsWith('uri:')) return sound.split('|')[1] || 'Sound from phone';
  return MELODIES.sunrise.name;
}

/** What the native alarm needs: either a melody spec or a ringtone. */
export function nativeSound(sound) {
  if (sound === 'device') return { sound: 'device' };
  if (sound?.startsWith('uri:')) return { sound: 'uri', uri: sound.slice(4).split('|')[0] };
  const m = MELODIES[sound] || MELODIES.sunrise;
  return { sound: 'melody', melody: { beat: m.beat, decay: m.decay, attack: m.attack, partials: m.partials, rest: m.rest, notes: m.notes } };
}

// ---------- In-app preview (Web Audio), mirroring the native synthesiser ----------
let ctx = null;
let playing = null;

export function stopPreview() {
  if (playing) {
    try {
      playing.gain.gain.cancelScheduledValues(0);
      playing.gain.gain.setValueAtTime(0, ctx.currentTime);
      playing.nodes.forEach((n) => n.stop());
    } catch (e) {
      /* already stopped */
    }
    playing = null;
  }
}

/** Play a melody twice (about 5–8 seconds). Returns false if audio isn't available. */
export function previewMelody(id, { passes = 2 } = {}) {
  const m = MELODIES[id];
  if (!m) return false;
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) {
    return false;
  }
  stopPreview();
  const out = ctx.createGain();
  out.gain.value = 0.22;
  out.connect(ctx.destination);
  const nodes = [];
  let t = ctx.currentTime + 0.05;
  for (let p = 0; p < passes; p++) {
    for (const [f, beats, to] of m.notes) {
      const len = m.beat * beats;
      if (f > 0) {
        for (const [mult, amp] of m.partials) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(f * mult, t);
          if (to) o.frequency.linearRampToValueAtTime(to * mult, t + len);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(amp, t + m.attack);
          g.gain.exponentialRampToValueAtTime(Math.max(0.0001, amp * Math.exp(-m.decay * len)), t + len);
          g.gain.linearRampToValueAtTime(0.0001, t + len + 0.01);
          o.connect(g).connect(out);
          o.start(t);
          o.stop(t + len + 0.02);
          nodes.push(o);
        }
      }
      t += len;
    }
    t += m.rest;
  }
  playing = { gain: out, nodes };
  return true;
}

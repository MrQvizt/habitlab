// Morning messages shown when the wake-up alarm rings and on the Good-morning screen.
// What the research says, and how it shapes these messages:
// - Values-based self-affirmation: reflecting on what matters to you activates the brain's
//   self-related and reward systems (medial prefrontal cortex, ventral striatum), more so when
//   thinking about the future (Cascio 2016). Affirmed, sedentary adults showed more vmPFC activity
//   to health messages and then became more active (Falk 2015). Meta-analysis: small but reliable
//   effects on health behaviour, d = 0.32 (Epton 2015). → "values" and "future" messages use the
//   values and reasons you choose.
// - Blunt positive self-statements ("I'm a lovable person") made people with low self-esteem feel
//   worse (Wood 2009). → messages are warm, specific and believable; second person, not mantras.
// - Self-compassion after setbacks increases motivation to improve (Breines & Chen 2012).
// - Appreciating what your body can do improves body image (Alleva 2015, Expand Your Horizon).
// - Compliments ("You look beautiful") are included because people asked for them; they can be
//   switched off, and you can add your own words.

export const VALUES = {
  family: { label: 'Family', phrase: 'the people you love' },
  health: { label: 'Health', phrase: 'feeling healthy and strong' },
  energy: { label: 'Energy', phrase: 'having energy for your day' },
  freedom: { label: 'Freedom', phrase: 'moving freely through life' },
  friends: { label: 'Friends', phrase: 'time with your friends' },
  adventure: { label: 'Adventure', phrase: 'new places and adventures' },
  creativity: { label: 'Creativity', phrase: 'making and creating things' },
  kindness: { label: 'Kindness', phrase: 'being kind to others' },
  learning: { label: 'Learning', phrase: 'learning and growing' },
  work: { label: 'Work', phrase: 'doing good work' },
  faith: { label: 'Faith', phrase: 'your faith' },
  independence: { label: 'Independence', phrase: 'standing on your own feet' },
  nature: { label: 'Nature', phrase: 'being out in nature' },
  confidence: { label: 'Confidence', phrase: 'feeling confident in yourself' },
};

export const MESSAGE_SETS = {
  values: {
    label: 'Your values',
    hint: 'Built from what matters to you — the type of affirmation studied in brain-imaging research.',
    lines: [
      '{Value} matters to you. Every healthy choice today is a quiet way of honouring it.',
      'Today you get to look after yourself for {phrase}. That’s a reason worth getting up for.',
      'You care about {phrase}. A good breakfast and a short walk are investments in exactly that.',
      'Think of one moment today where {phrase} will matter. Your habits are making room for it.',
    ],
  },
  future: {
    label: 'Your future self',
    hint: 'Picturing the future you’re building — future thinking strengthens the brain’s response to affirmation.',
    lines: [
      'A year from now you’ll be glad you started. Today is part of that story: {why}.',
      'Future you is cheering for the choices you make today. {Why}.',
      'Every small step today adds up to {why}. You don’t have to do it all — just today’s part.',
      'Imagine the version of you who keeps these habits for a year. You’re already becoming them.',
    ],
  },
  compassion: {
    label: 'Kindness to yourself',
    hint: 'Self-compassion after a setback increases motivation to improve.',
    lines: [
      'If yesterday didn’t go to plan, that’s okay. Be as kind to yourself today as you’d be to a friend.',
      'Progress, not perfection. You’re learning something new, and learning takes practice.',
      'You don’t need a perfect day. One good choice is enough to start.',
      'Whatever the scale says, you are more than a number. Today is a fresh start.',
    ],
  },
  worth: {
    label: 'You deserve it',
    hint: 'Reminders that looking after yourself is worth it.',
    lines: [
      'You deserve a healthy life.',
      'You are worth taking care of — today and every day.',
      'Your health matters, because you matter.',
      'You deserve to feel good in your body and proud of your day.',
    ],
  },
  body: {
    label: 'What your body does',
    hint: 'Appreciating what your body can do improves body image.',
    lines: [
      'Your body carried you through yesterday. Thank it with water, good food and a little movement.',
      'Your heart beat about 100,000 times yesterday without being asked. Let’s look after it today.',
      'Your legs can take you somewhere beautiful today. Even ten minutes counts.',
      'Your body is working for you right now. You’re giving it what it needs to get stronger.',
    ],
  },
  compliments: {
    label: 'Compliments',
    hint: 'Kind words, just because. Switch off if they don’t feel right for you.',
    lines: [
      'You look beautiful today.',
      'Good morning, beautiful. The world is better with you in it.',
      'You’re stronger than you think, and you look great doing it.',
      'Your smile is one of the best things about this morning.',
    ],
  },
};

export const DEFAULT_SETS = ['values', 'future', 'compassion', 'worth', 'body', 'compliments'];

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The rotation of morning messages: one category after another so consecutive mornings differ;
 * your own words and favourites appear more often.
 * @param affirm {values:[ids], why:string, sets:[ids], custom:[strings], favs:[strings]}
 */
export function morningMessages(affirm = {}) {
  const values = (affirm.values || []).filter((v) => VALUES[v]);
  const why = String(affirm.why || '').trim().replace(/[.!]+$/, '');
  const sets = (affirm.sets || DEFAULT_SETS).filter((s) => MESSAGE_SETS[s]);
  const lists = sets.map((id) => {
    const lines = [];
    for (const [i, line] of MESSAGE_SETS[id].lines.entries()) {
      if (line.includes('{why}') || line.includes('{Why}')) {
        if (!why) continue;
        lines.push(line.replace('{why}', why.charAt(0).toLowerCase() + why.slice(1)).replace('{Why}', cap(why)));
      } else if (/\{(value|Value|phrase)\}/.test(line)) {
        const v = values.length ? VALUES[values[i % values.length]] : { label: 'What you care about', phrase: 'what matters most to you' };
        lines.push(line.replace('{Value}', v.label).replace('{value}', v.label.toLowerCase()).replace('{phrase}', v.phrase));
      } else lines.push(line);
    }
    return lines;
  }).filter((l) => l.length);
  const custom = (affirm.custom || []).filter((s) => typeof s === 'string' && s.trim());
  const favs = (affirm.favs || []).filter((s) => typeof s === 'string' && s.trim());
  const out = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    for (const l of lists) if (l[i]) out.push(l[i]);
    if (custom.length) out.push(custom[i % custom.length]);
    if (favs.length) out.push(favs[i % favs.length]);
  }
  if (!out.length) out.push('Good morning. You deserve a healthy life.');
  return out;
}

/** The message for a given day — the same choice the native alarm makes (epoch day modulo list length). */
export function messageForDay(list, date = new Date()) {
  const epochDay = Math.floor(date.getTime() / 86400000);
  return list[Math.abs(epochDay) % list.length];
}

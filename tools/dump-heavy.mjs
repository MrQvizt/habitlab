// Writes the heavy dataset as JSON (for browser performance checks). Usage: node tools/dump-heavy.mjs out.json
import { writeFileSync } from 'node:fs';
import { heavyState } from './heavy-state.mjs';
writeFileSync(process.argv[2], JSON.stringify(heavyState(730)));

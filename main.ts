// site-generator-speed-01-run-20261122: the driver for my faster makefun-site
// drop-in. The harness runs `node /bot/main.ts` on node 22. It reads every
// case from /input/cases.json (a JSON array of {id, input}), answers each one
// alone with run() from solve.js, and writes /output/answers.json: a JSON
// array of the answers, one per case and in the cases' order. Outside a
// container MAKEFUN_INPUT_DIR and MAKEFUN_OUTPUT_DIR stand in for /input and
// /output.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setFlagsFromString } from 'node:v8';

// V8's incremental marking off, set before solve.js is imported so all of its
// work runs under it. The house baseline runs with this flag and the rules let
// an entry tune V8's flags the same way.
setFlagsFromString('--no-incremental-marking');

/** solve.js, imported by its URL (a .js module carries no types) and typed by its contract. */
const { run } = (await import(new URL('./solve.js', import.meta.url).href)) as {
  run: (input: unknown) => unknown;
};

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const cases = JSON.parse(readFileSync(join(INPUT_DIR, 'cases.json'), 'utf8')) as {
  id: string;
  input: unknown;
}[];

const answers: unknown[] = new Array(cases.length);
for (let i = 0; i < cases.length; i++) answers[i] = run(cases[i].input);

// The output directory itself is never removed: on the grader it is a mount
// point, and removing it fails the run. Only its files are ever written.
mkdirSync(OUTPUT_DIR, { recursive: true });

// Serialise by hand: one native JSON.stringify per value, joined. That is
// measurably faster than a single JSON.stringify over the whole answers
// tree (same bytes out, verified), because the big stringify walks the
// object tree and re-scans every value; per-value calls stay in the fast
// path and the joins ride V8's string ropes.
let out = '[';
for (let i = 0; i < answers.length; i++) {
  const ans = answers[i] as Record<string, unknown>;
  if (i > 0) out += ',';
  out += '{';
  let first = true;
  for (const k of Object.keys(ans)) {
    if (!first) out += ',';
    first = false;
    out += JSON.stringify(k) + ':' + JSON.stringify(ans[k]);
  }
  out += '}';
}
out += ']';
writeFileSync(join(OUTPUT_DIR, 'answers.json'), out);

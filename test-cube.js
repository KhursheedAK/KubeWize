// Self-verifying cube logic tests — no assumed "expected" strings.
// All identities are mathematically true regardless of indexing convention.
// Layout from ARCHITECTURE.md §5: U(0-8) R(9-17) F(18-26) D(27-35) L(36-44) B(45-53)

const Cube = require('./frontend/node_modules/cubejs');

const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

function applyMove(str, move) {
  const c = Cube.fromString(str);
  c.move(move);
  return c.asString();
}

function applySequence(str, moves) {
  if (!moves.length) return str;
  const c = Cube.fromString(str);
  c.move(moves.join(' '));
  return c.asString();
}

function invertMove(m) {
  if (m.endsWith("'")) return m.slice(0, -1);
  if (m.endsWith('2')) return m;
  return m + "'";
}

let passed = 0;
let failed = 0;

function check(name, result, expected) {
  if (result === expected) {
    console.log(`PASS  ${name}`);
    passed++;
  } else {
    console.log(`FAIL  ${name}`);
    console.log(`      actual:   ${result}`);
    console.log(`      expected: ${expected}`);
    failed++;
  }
}

const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];

// a) face×4 = identity  (covers U U' D D' L L' R R' B B' implicitly via symmetry)
for (const face of FACES) {
  check(`${face}×4 = identity`, applySequence(SOLVED, [face, face, face, face]), SOLVED);
}

// a) prime×4 = identity
for (const face of FACES) {
  const p = `${face}'`;
  check(`${p}×4 = identity`, applySequence(SOLVED, [p, p, p, p]), SOLVED);
}

// b) face then face' = identity
for (const face of FACES) {
  check(`${face} then ${face}' = identity`, applySequence(SOLVED, [face, `${face}'`]), SOLVED);
}

// b) face' then face = identity
for (const face of FACES) {
  check(`${face}' then ${face} = identity`, applySequence(SOLVED, [`${face}'`, face]), SOLVED);
}

// d) 20-move scramble + exact reverse = identity
const SCRAMBLE = ['R','U',"F'","D2","L","B'","R2","U'","F","D","L2","B","R","U2","F'","D","L'","B2","R'","U"];
const UNSCRAMBLE = [...SCRAMBLE].reverse().map(invertMove);
check(
  '20-move scramble + exact reverse = identity',
  applySequence(applySequence(SOLVED, SCRAMBLE), UNSCRAMBLE),
  SOLVED
);

// e) After F: B face (45-53) fully unaffected, F center (22) unaffected,
//    and no index outside the expected set changes.
//
// Expected changed indices for F move (from §5 layout):
//   F face non-center: 18,19,20,21,23,24,25,26  (corners+edges permute among themselves,
//                      all 'F' in solved → still 'F', so value stays but positions cycle)
//   U bottom row:      6, 7, 8
//   R left col:        9, 12, 15
//   D top row:         27, 28, 29
//   L right col:       38, 41, 44
//
// Indices that MUST NOT change:
//   B face: 45-53  (opposite face, completely unaffected)
//   F center: 22   (centers never move)
//   U rows 0-1: 0,1,2,3,4,5
//   R mid+right cols: 10,11,13,14,16,17
//   D rows 1-2: 30,31,32,33,34,35
//   L left+mid cols: 36,37,39,40,42,43

const afterF = applyMove(SOLVED, 'F');

// B face untouched
const bBad = [];
for (let i = 45; i <= 53; i++) {
  if (afterF[i] !== SOLVED[i]) bBad.push(i);
}
if (bBad.length === 0) {
  console.log('PASS  F: B face (45-53) unaffected');
  passed++;
} else {
  console.log(`FAIL  F: B face changed at ${bBad} — actual: ${bBad.map(i => afterF[i]).join('')}`);
  failed++;
}

// F center unaffected
if (afterF[22] === SOLVED[22]) {
  console.log('PASS  F: center (idx 22) unaffected');
  passed++;
} else {
  console.log(`FAIL  F: center (idx 22) changed: expected '${SOLVED[22]}' got '${afterF[22]}'`);
  failed++;
}

// No unexpected index changes
const F_EXPECTED_CHANGE = new Set([6,7,8, 9,12,15, 18,19,20,21,23,24,25,26, 27,28,29, 38,41,44]);
const unexpected = [];
for (let i = 0; i < 54; i++) {
  if (!F_EXPECTED_CHANGE.has(i) && afterF[i] !== SOLVED[i]) {
    unexpected.push(i);
  }
}
if (unexpected.length === 0) {
  console.log('PASS  F: no unexpected sticker changes');
  passed++;
} else {
  console.log(`FAIL  F: unexpected changes at indices ${unexpected}`);
  console.log(`      before: ${unexpected.map(i => `[${i}]=${SOLVED[i]}`).join(', ')}`);
  console.log(`      after:  ${unexpected.map(i => `[${i}]=${afterF[i]}`).join(', ')}`);
  failed++;
}

console.log(`\n${passed} passed, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);

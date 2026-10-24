const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const sandbox = { window: { HandClash: { config: { WIN: 10 } } } };
vm.createContext(sandbox);
for (const file of ['js/rules.js', 'data/states.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
}
const rules = sandbox.window.HandClash.rules;
const table = sandbox.window.HandClashData;
const plain = value => JSON.parse(JSON.stringify(value));

test('all 20,000 states preserve legal moves, child transitions, and probability recurrence', () => {
  assert.equal(Object.keys(table).length, 20000);
  for (const [key, entry] of Object.entries(table)) {
    const [turn, ...values] = key.split(/[:,]/).map(Number);
    const hands = { A: values.slice(0, 2), B: values.slice(2) };
    const side = turn === 0 ? 'A' : 'B';
    assert.equal(rules.stateKey(turn, hands), key);
    const moves = rules.legalMoves(hands, side);
    assert.deepEqual(plain(moves), plain(entry.childs.flatMap((child, i) => child ? [i] : [])));
    const winner = rules.winner(hands);
    if (winner) {
      assert.equal(entry.A_p, winner === 'A' ? 1 : 0);
      assert.equal(entry.B_p, winner === 'B' ? 1 : 0);
      continue;
    }
    for (const move of moves) {
      const original = JSON.stringify(hands);
      const next = rules.applyMove(hands, side, move);
      assert.equal(JSON.stringify(hands), original, 'applyMove must not mutate its input');
      assert.equal(rules.stateKey(1 - turn, next), entry.childs[move], `${key}, move ${move}`);
    }
    for (const player of ['A', 'B']) {
      const scores = moves.map(move => table[entry.childs[move]][`${player}_p`]);
      const expected = side === player ? Math.max(...scores) : scores.reduce((a, b) => a + b) / scores.length;
      assert.ok(Math.abs(entry[`${player}_p`] - expected) < 1e-12, key);
    }
    const best = rules.chooseMove(hands, side, 'best', table);
    const scores = moves.map(move => table[entry.childs[move]][`${side}_p`]);
    assert.equal(table[entry.childs[best]][`${side}_p`], Math.max(...scores));
  }
});

test('finished hands cannot attack or be targeted; values cap at ten', () => {
  const hands = { A: [10, 8], B: [3, 10] };
  assert.deepEqual(plain(rules.legalMoves(hands, 'A')), [2]);
  assert.throws(() => rules.applyMove(hands, 'A', 0), /非法/);
  assert.throws(() => rules.applyMove(hands, 'A', 3), /非法/);
  assert.deepEqual(plain(rules.applyMove(hands, 'A', 2)), { A: [10, 10], B: [3, 10] });
  assert.equal(rules.winner({ A: [10, 10], B: [10, 10] }), 'A');
});

test('random policy selects only legal moves; tied best scores keep move order', () => {
  const hands = { A: [1, 1], B: [1, 1] };
  assert.equal(rules.chooseMove(hands, 'A', 'random', table, () => 0), 0);
  assert.equal(rules.chooseMove(hands, 'A', 'random', table, () => 0.999), 3);
  assert.equal(rules.chooseMove(hands, 'A', 'best', table), 0);
  assert.equal(rules.chooseMove({ A: [10, 10], B: [1, 1] }, 'B', 'best', table), null);
});

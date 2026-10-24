const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const config = { NODE_W: 78, NODE_H: 48, H_GAP: 14, V_GAP: 48 };
const sandbox = { window: { HandClash: { config } } };
vm.createContext(sandbox);
for (const file of ['js/layout.js', 'data/states.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), sandbox);
}
const { buildVisibleGraph, layoutGraph, packRow } = sandbox.window.HandClash.layout;
const plain = value => JSON.parse(JSON.stringify(value));
const pitch = config.NODE_W + config.H_GAP;

function checkGeometry(graph, positions) {
  assert.equal(positions.size, graph.nodes.size);
  const rows = new Map();
  for (const { x, y } of positions.values()) {
    assert.ok(Number.isFinite(x) && Number.isFinite(y));
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push(x);
  }
  for (const row of rows.values()) {
    row.sort((a, b) => a - b);
    for (let i = 1; i < row.length; i++) assert.ok(row[i] - row[i - 1] >= pitch - 1e-8);
  }
  for (const { source, target } of graph.edges) {
    assert.ok(positions.get(target).y > positions.get(source).y, `${source} -> ${target}`);
  }
  if (graph.nodes.size) assert.deepEqual(plain(positions.get(graph.rootKey)), { x: 0, y: 0 });
}

test('four root children stay compact even when all descendants are expanded', () => {
  const table = { root: { childs: ['a', 'b', 'c', 'd'] } };
  for (const key of ['a', 'b', 'c', 'd']) {
    table[key] = { childs: Array.from({ length: 4 }, (_, i) => key + i) };
    for (const child of table[key].childs) table[child] = { childs: [] };
  }
  const shallow = layoutGraph(buildVisibleGraph(table, 'root', new Set(['root']), new Set()));
  const graph = buildVisibleGraph(table, 'root', new Set(Object.keys(table)), new Set());
  const deep = layoutGraph(graph);
  for (const key of ['root', 'a', 'b', 'c', 'd']) assert.deepEqual(plain(deep.get(key)), plain(shallow.get(key)));
  assert.equal(deep.get('d').x - deep.get('a').x, 3 * pitch);
  // The old leaf-slot algorithm placed these sibling centers 12 pitches apart.
  assert.equal(12 * pitch / (deep.get('d').x - deep.get('a').x), 4);
  checkGeometry(graph, deep);
});

test('shared states and duplicate actions occupy one slot; edges stay downward across unequal paths', () => {
  const table = {
    root: { childs: ['a', 'a', 'b'] }, a: { childs: ['shared'] },
    b: { childs: ['c'] }, c: { childs: ['shared'] }, shared: { childs: [] },
  };
  const graph = buildVisibleGraph(table, 'root', new Set(Object.keys(table)), new Set());
  assert.equal(graph.nodes.size, 5);
  assert.equal(graph.edges.length, 5);
  checkGeometry(graph, layoutGraph(graph));
  const hidden = buildVisibleGraph(table, 'root', new Set(Object.keys(table)), new Set(['a']));
  assert.equal(hidden.nodes.has('a'), false);
  assert.equal(hidden.nodes.has('shared'), true);
  checkGeometry(hidden, layoutGraph(hidden));
});

test('row packing respects minimum spacing and keeps already separated targets unchanged', () => {
  assert.deepEqual(plain(packRow([0, 0, 0, 0], pitch)), [-138, -46, 46, 138]);
  assert.deepEqual(plain(packRow([0, 200, 400], pitch)), [0, 200, 400]);
  assert.deepEqual(plain(packRow([0, 10, 500, 510], pitch)), [-41, 51, 459, 551]);
  assert.deepEqual(plain(packRow([], pitch)), []);
});

test('full reachable game graph is unique, deterministic, non-overlapping, and forward directed', () => {
  const table = sandbox.window.HandClashData;
  const graph = buildVisibleGraph(table, '0:1,1,1,1', new Set(Object.keys(table)), new Set());
  assert.ok(graph.nodes.size > 9000);
  const positions = layoutGraph(graph);
  checkGeometry(graph, positions);
  assert.deepEqual(plain([...layoutGraph(graph)]), plain([...positions]));
  console.log(`Checked ${graph.nodes.size} unique nodes and ${graph.edges.length} edges`);
});

test('empty graph is safe and accidental cycles fail explicitly', () => {
  assert.equal(layoutGraph(buildVisibleGraph({}, 'absent', new Set(), new Set())).size, 0);
  const table = { a: { childs: ['b'] }, b: { childs: ['a'] } };
  assert.throws(() => layoutGraph(buildVisibleGraph(table, 'a', new Set(['a', 'b']), new Set())), /循环/);
});

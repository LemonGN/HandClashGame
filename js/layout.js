// Compact layered layout for a DAG: descendants never push their ancestors apart.
(() => {
  'use strict';
  const HC = window.HandClash;

  function buildVisibleGraph(table, rootKey, expanded, hidden) {
    const nodes = new Map();
    const edges = [];
    if (!table[rootKey]) return { rootKey, nodes, edges };
    const queue = [rootKey];
    nodes.set(rootKey, { key: rootKey, entry: table[rootKey] });
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const key = queue[cursor];
      if (!expanded.has(key)) continue;
      const seen = new Set();
      table[key].childs.forEach((child, moveIdx) => {
        if (!child || !table[child] || hidden.has(child) || seen.has(child)) return;
        seen.add(child);
        edges.push({ source: key, target: child, moveIdx });
        if (!nodes.has(child)) {
          nodes.set(child, { key: child, entry: table[child] });
          queue.push(child);
        }
      });
    }
    return { rootKey, nodes, edges };
  }

  // Project desired positions onto the non-overlap constraints. Subtracting the
  // minimum pitch turns x[i+1] >= x[i] + pitch into a monotonic sequence.
  // Merge adjacent violating blocks to minimize total squared displacement.
  function packRow(targets, pitch) {
    const blocks = [];
    for (let i = 0; i < targets.length; i++) {
      blocks.push({ start: i, end: i, sum: targets[i] - i * pitch, count: 1 });
      while (blocks.length > 1) {
        const right = blocks[blocks.length - 1];
        const left = blocks[blocks.length - 2];
        if (left.sum / left.count <= right.sum / right.count) break;
        blocks.pop();
        left.end = right.end;
        left.sum += right.sum;
        left.count += right.count;
      }
    }
    const positions = [];
    for (const block of blocks) {
      for (let i = block.start; i <= block.end; i++) {
        positions[i] = block.sum / block.count + i * pitch;
      }
    }
    return positions;
  }

  function layoutGraph(graph, config = HC.config) {
    const { nodes, edges } = graph;
    const parents = new Map();
    const children = new Map();
    const remaining = new Map();
    const ranks = new Map();
    for (const key of nodes.keys()) {
      parents.set(key, []);
      children.set(key, []);
      remaining.set(key, 0);
      ranks.set(key, 0);
    }
    for (const { source, target } of edges) {
      children.get(source).push(target);
      parents.get(target).push(source);
      remaining.set(target, remaining.get(target) + 1);
    }

    // Longest-path ranks guarantee that every edge points to a lower row, even
    // when a shared position is reachable by paths of different lengths.
    const queue = [...nodes.keys()].filter(key => remaining.get(key) === 0);
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const key = queue[cursor];
      for (const child of children.get(key)) {
        ranks.set(child, Math.max(ranks.get(child), ranks.get(key) + 1));
        remaining.set(child, remaining.get(child) - 1);
        if (remaining.get(child) === 0) queue.push(child);
      }
    }
    if (queue.length !== nodes.size) throw new Error('状态图包含循环，无法进行分层布局');

    const rows = [];
    for (const key of nodes.keys()) {
      const rank = ranks.get(key);
      (rows[rank] ??= []).push(key);
    }
    const positions = new Map();
    for (let rank = 0; rank < rows.length; rank++) {
      const row = (rows[rank] || []).map((key, order) => {
        const incoming = parents.get(key);
        const target = incoming.length
          ? incoming.reduce((sum, parent) => sum + positions.get(parent).x, 0) / incoming.length
          : 0;
        return { key, target, order };
      });
      row.sort((a, b) => a.target - b.target || a.order - b.order);
      const xs = packRow(row.map(node => node.target), config.NODE_W + config.H_GAP);
      row.forEach((node, i) => positions.set(node.key, {
        x: xs[i], y: rank * (config.NODE_H + config.V_GAP),
      }));
    }
    return positions;
  }

  HC.layout = Object.freeze({ buildVisibleGraph, layoutGraph, packRow });
})();

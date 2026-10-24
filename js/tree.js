// SVG state graph rendering and interactions. Geometry lives in layout.js.
(() => {
  'use strict';
  const HC = window.HandClash;
  const { state } = HC;
  const { GAME, VIZ, ROOT_KEY } = state;
  const { NODE_W, NODE_H, TRANSITION_MS } = HC.config;
  const { el } = HC.dom;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function clearVizElements() {
    VIZ.nodeEls.forEach(g => g.remove());
    VIZ.nodeEls.clear();
    el.edgeLayer.innerHTML = '';
  }

  function drawTree(animate = true) {
    if (!state.table) return;
    const graph = HC.layout.buildVisibleGraph(state.table, VIZ.rootKey, VIZ.expanded, VIZ.hidden);
    if (!graph.nodes.size) return;
    const positions = HC.layout.layoutGraph(graph);
    VIZ.nodePos = positions;

    const visibleKeys = graph.nodes;

    // 移除不再可见的节点
    for (const [key, g] of VIZ.nodeEls) {
      if (!visibleKeys.has(key)) {
        g.remove();
        VIZ.nodeEls.delete(key);
      }
    }

    // 需要动画: 先隐藏连线
    if (animate) {
      el.edgeLayer.classList.add('hidden');
    }

    // 更新/创建节点元素
    for (const item of graph.nodes.values()) updateNode(item, positions, animate);

    // 连线
    rebuildEdges(graph.edges, positions);

    // 动画结束 -> 显示连线
    if (animate) {
      clearTimeout(VIZ._edgeTimer);
      VIZ._edgeTimer = setTimeout(() => {
        el.edgeLayer.classList.remove('hidden');
      }, TRANSITION_MS + 20);
    } else {
      el.edgeLayer.classList.remove('hidden');
    }
  }

  function updateNode(item, positions, animate) {
    const p = positions.get(item.key);
    if (!p) return;

    let g = VIZ.nodeEls.get(item.key);
    const isNew = !g;

    if (isNew) {
      g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', 'node-g');
      g.dataset.state = item.key;
      g.style.transform = `translate(${p.x}px, ${p.y}px)`;
      el.nodeLayer.appendChild(g);
      VIZ.nodeEls.set(item.key, g);

      if (animate) {
        g.style.opacity = '0';
        requestAnimationFrame(() => {
          g.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
          g.style.opacity = '1';
        });
      }
    } else {
      g.style.transform = `translate(${p.x}px, ${p.y}px)`;
    }

    renderNodeContent(g, item);
  }

  function renderNodeContent(g, item) {
    const isCurrent = (item.key === currentKey());
    const onPath = VIZ.pathKeys.includes(item.key);
    const entry = item.entry;
    const hasChild = entry.childs.some(ck => ck && state.table[ck]);
    const selfExpanded = VIZ.expanded.has(item.key);

    const parts = item.key.split(/[: ,]/);
    const turn = parts[0];

    // 节点体：内部统一包裹，便于弹出动画与整体缩放
    let body = g.querySelector('.node-body');
    if (!body) {
      body = document.createElementNS(SVG_NS, 'g');
      body.setAttribute('class', 'node-body');
      g.appendChild(body);
    }

    // --- 矩形 ---
    let rect = body.querySelector('.node-rect');
    if (!rect) {
      rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('width', NODE_W);
      rect.setAttribute('height', NODE_H);
      body.appendChild(rect);
      rect.addEventListener('click', () => onNodeClick(item.key));
    }
    let cls = 'node-rect turn-' + (turn === '0' ? 'a' : 'b');
    if (isCurrent) cls += ' current';
    if (onPath) cls += ' on-path';
    if (hasChild) cls += ' expandable';
    rect.setAttribute('class', cls);

    // --- 文本 ---
    // 玩家永远显示在下方（第 2 行），对方在上方（第 1 行）
    const humanIsA = GAME.humanSide === 'A';
    const lineA = `A:${parts[1]},${parts[2]} (${fmt(entry.A_p)})`;
    const lineB = `B:${parts[3]},${parts[4]} (${fmt(entry.B_p)})`;
    const turnLine = `轮:${turn === '0' ? 'A' : 'B'}${hasChild ? (selfExpanded ? '' : ' ▸') : ''}`;
    const lines = humanIsA
      ? [lineB, lineA, turnLine]
      : [lineA, lineB, turnLine];

    body.querySelectorAll('.node-text').forEach(t => t.remove());
    lines.forEach((txt, i) => {
      const t = document.createElementNS(SVG_NS, 'text');
      t.setAttribute('x', 5);
      t.setAttribute('y', 14 + i * 13);
      let c = 'node-text';
      if (i === 2) {
        c += ' small';
        c += (turn === '0' ? ' turn-a' : ' turn-b');
      } else {
        const lineIsA = (i === 0) ? !humanIsA : humanIsA;
        c += lineIsA ? ' turn-a' : ' turn-b';
        if (i === 1) c += ' is-me';
      }
      t.setAttribute('class', c);
      t.textContent = txt;
      body.appendChild(t);
    });

    // --- 当前行动方的胜率条 ---
    const prob = turn === '0' ? entry.A_p : entry.B_p;
    const barW = Math.max(0, (NODE_W - 10) * (typeof prob === 'number' ? prob : 0));
    let track = body.querySelector('.prob-track');
    if (!track) {
      track = document.createElementNS(SVG_NS, 'rect');
      track.setAttribute('class', 'prob-track');
      track.setAttribute('x', 5);
      track.setAttribute('y', 43);
      track.setAttribute('width', NODE_W - 10);
      track.setAttribute('height', 3);
      track.setAttribute('rx', 1.5);
      body.appendChild(track);
    }
    let bar = body.querySelector('.prob-bar');
    if (!bar) {
      bar = document.createElementNS(SVG_NS, 'rect');
      bar.setAttribute('x', 5);
      bar.setAttribute('y', 43);
      bar.setAttribute('height', 3);
      bar.setAttribute('rx', 1.5);
      body.appendChild(bar);
    }
    bar.setAttribute('class', 'prob-bar ' + (turn === '0' ? 'turn-a' : 'turn-b'));
    bar.setAttribute('width', barW);

    // --- 选择按钮：仅当本节点是"当前节点的一代子节点"且轮到人类时显示 ---
    const moveIdx = state.table[currentKey()]?.childs.indexOf(item.key) ?? -1;
    const showSelectBtn = HC.game.isHumanTurnForBoard() && VIZ.expanded.has(currentKey()) && moveIdx >= 0;
    let pill = body.querySelector('.select-pill');
    body.querySelectorAll('.select-btn').forEach(b => b.remove());
    if (showSelectBtn) {
      if (!pill) {
        pill = document.createElementNS(SVG_NS, 'rect');
        pill.setAttribute('class', 'select-pill');
        pill.setAttribute('x', -6);
        pill.setAttribute('y', -20);
        pill.setAttribute('width', 47);
        pill.setAttribute('height', 17);
        body.appendChild(pill);
      }
      const btn = document.createElementNS(SVG_NS, 'text');
      btn.setAttribute('class', 'select-btn');
      btn.setAttribute('x', 0);
      btn.setAttribute('y', -6);
      btn.textContent = '▶ 选择';
      btn.style.cursor = 'pointer';
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        HC.game.onSelectChildByButton(item.key, moveIdx);
      });
      body.appendChild(btn);
    } else if (pill) {
      pill.remove();
    }
  }

  /* ===================== 节点点击 ===================== */
  function onNodeClick(key) {
    const entry = state.table[key];
    if (!entry) return;
    const legalChildKeys = [...new Set(entry.childs.filter(ck => ck && state.table[ck]))];
    if (legalChildKeys.length === 0) return;   // 无合法子节点：不操作

    const selfExpanded = VIZ.expanded.has(key);

    // ---------- 情况 A：显示的未展开节点 ----------
    if (!selfExpanded) {
      // 所有合法子节点 → 显示，保持未展开（不加入 expanded）
      legalChildKeys.forEach(ck => VIZ.hidden.delete(ck));
      VIZ.expanded.add(key);   // 当前节点 → 展开
      drawTree(true);
      return;
    }

    // ---------- 情况 B/C/D：显示的展开节点 ----------
    const shownChildKeys  = legalChildKeys.filter(ck => !VIZ.hidden.has(ck));
    const hiddenChildKeys = legalChildKeys.filter(ck =>  VIZ.hidden.has(ck));

    const shownExpanded  = shownChildKeys.filter(ck =>  VIZ.expanded.has(ck));
    const shownCollapsed = shownChildKeys.filter(ck => !VIZ.expanded.has(ck));

    // 情况 B：所有显示子节点都是未展开
    if (shownExpanded.length === 0 && shownChildKeys.length > 0) {
      shownChildKeys.forEach(ck => VIZ.hidden.add(ck));
      VIZ.expanded.delete(key);   // 当前节点 → 未展开
      drawTree(true);
      return;
    }

    // 情况 C：所有显示子节点都是展开
    if (shownCollapsed.length === 0 && shownChildKeys.length > 0) {
      if (hiddenChildKeys.length > 0) {
        hiddenChildKeys.forEach(ck => VIZ.hidden.delete(ck)); // 保持未展开
      }
      drawTree(true);
      return;
    }

    // 情况 D：显示子节点中同时存在展开与未展开
    if (shownExpanded.length > 0 && shownCollapsed.length > 0) {
      shownCollapsed.forEach(ck => VIZ.hidden.add(ck));
      // 当前节点保持展开（不动 VIZ.expanded）
      drawTree(true);
      return;
    }

    // 兜底：显示子节点为空（理论上不达）
    legalChildKeys.forEach(ck => VIZ.hidden.add(ck));
    VIZ.expanded.delete(key);
    drawTree(true);
  }
  function rebuildEdges(edges, positions) {
    el.edgeLayer.innerHTML = '';

    for (const { source, target } of edges) {
      const p1 = positions.get(source);
      const p2 = positions.get(target);
      if (p1 && p2) {
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', p1.x + NODE_W / 2);
        line.setAttribute('y1', p1.y + NODE_H);
        line.setAttribute('x2', p2.x + NODE_W / 2);
        line.setAttribute('y2', p2.y);
        line.setAttribute('class', 'edge');
        if (isEdgeOnPath(source, target)) {
          line.classList.add('on-path');
          line.setAttribute('marker-end', 'url(#arrowPath)');
        }
        el.edgeLayer.appendChild(line);
      }
    }
  }

  function isEdgeOnPath(k1, k2) {
    for (let i = 0; i < VIZ.pathKeys.length - 1; i++) {
      if (VIZ.pathKeys[i] === k1 && VIZ.pathKeys[i + 1] === k2) return true;
    }
    return false;
  }

  function fmt(x) {
    if (x === null || x === undefined) return '--';
    return Number(x).toFixed(2);
  }

  function currentKey() {
    if (VIZ.pathKeys.length === 0) return ROOT_KEY;
    return VIZ.pathKeys[VIZ.pathKeys.length - 1];
  }

  HC.tree = Object.freeze({ drawTree, clearVizElements, currentKey });
})();

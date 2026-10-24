// Shared configuration, application state, and DOM references.
// Classic scripts keep file:// use working without a server or a bundler.
(() => {
  'use strict';
  const config = Object.freeze({ WIN: 10, NODE_W: 78, NODE_H: 48,
    H_GAP: 14, V_GAP: 48, TRANSITION_MS: 400 });
  const ROOT_KEY = '0:1,1,1,1';
  const GAME = {
    hands: { A: [1, 1], B: [1, 1] },
    current: 'A',
    selecting: false,
    selectedAtk: null,
    running: false,
    gameOver: false,
    humanSide: 'A',
    aiStrategy: 'best',
    aiActing: false,
    editable: false,
  };

  // SVG tree expansion, layout, and viewport state.
  const VIZ = {
    expanded: new Set(),
    hidden: new Set(),
    pathKeys: [],
    nodePos: new Map(),
    rootKey: ROOT_KEY,
    viewX: 40,
    viewY: 20,
    scale: 1,
    minScale: 0.1,
    maxScale: 3,
    nodeEls: new Map(),
    _edgeTimer: null,
    _viewTimer: null,
  };

  const el = {
    sideGroup: document.getElementById('sideGroup'),
    strategyGroup: document.getElementById('strategyGroup'),
    btnMain: document.getElementById('btnMain'),
    btnBack: document.getElementById('btnBack'),
    status: document.getElementById('status'),
    divider: document.getElementById('divider'),
    topArea: document.getElementById('topArea'),
    vizArea: document.getElementById('vizArea'),
    vizSvg: document.getElementById('vizSvg'),
    vizRoot: document.getElementById('vizRoot'),
    edgeLayer: document.getElementById('edgeLayer'),
    nodeLayer: document.getElementById('nodeLayer'),
    btnFit: document.getElementById('btnFit'),
    btnZoomIn: document.getElementById('btnZoomIn'),
    btnZoomOut: document.getElementById('btnZoomOut'),
    btnResetView: document.getElementById('btnResetView'),
    zoomInfo: document.getElementById('zoomInfo'),
    loading: document.getElementById('loading'),
    roleOpp1: document.getElementById('roleOpp1'),
    roleOpp2: document.getElementById('roleOpp2'),
    roleMe1: document.getElementById('roleMe1'),
    roleMe2: document.getElementById('roleMe2'),
  };

  function handEl(which, idx) { return document.getElementById(which + '_' + idx); }
  function imgEl(which, idx) { return document.getElementById('img' + cap(which) + '_' + idx); }
  function numEl(which, idx) { return document.getElementById('num' + cap(which) + '_' + idx); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  window.HandClash = {
    config,
    state: { GAME, VIZ, ROOT_KEY, table: null, history: [], session: 0 },
    dom: { el, handEl, imgEl, numEl },
  };
})();

// Stores snapshots only at human decision points; undo also cancels pending animation.
(() => {
  'use strict';
  const HC = window.HandClash;
  const { state } = HC;
  const { GAME, VIZ, history } = state;
  const { el } = HC.dom;

  function snapshot() {
    return {
      hands: { A: [...GAME.hands.A], B: [...GAME.hands.B] },
      current: GAME.current, humanSide: GAME.humanSide, aiStrategy: GAME.aiStrategy,
      rootKey: VIZ.rootKey, pathKeys: [...VIZ.pathKeys],
      expanded: new Set(VIZ.expanded), hidden: new Set(VIZ.hidden),
      viewX: VIZ.viewX, viewY: VIZ.viewY, scale: VIZ.scale,
    };
  }

  function atLastDecision() {
    const last = history[history.length - 1];
    return last && !GAME.aiActing && !GAME.gameOver &&
      HC.rules.stateKey(GAME.current === 'A' ? 0 : 1, GAME.hands) ===
      HC.rules.stateKey(last.current === 'A' ? 0 : 1, last.hands);
  }

  function canUndo() {
    return history.length > 0 && (!atLastDecision() || history.length > 1);
  }

  function updateBackButton() {
    el.btnBack.style.display = canUndo() ? '' : 'none';
  }

  function recordDecision() {
    history.push(snapshot());
    updateBackButton();
  }

  function clear() {
    history.length = 0;
    updateBackButton();
  }

  function undo() {
    if (!canUndo()) return;
    if (atLastDecision()) history.pop();
    const saved = history[history.length - 1];
    HC.game.cancelPending();
    Object.assign(GAME, { hands: { A: [...saved.hands.A], B: [...saved.hands.B] },
      current: saved.current, humanSide: saved.humanSide, aiStrategy: saved.aiStrategy,
      running: true, gameOver: false, editable: false, selecting: true, selectedAtk: null });
    Object.assign(VIZ, { rootKey: saved.rootKey, pathKeys: [...saved.pathKeys],
      expanded: new Set(saved.expanded), hidden: new Set(saved.hidden),
      viewX: saved.viewX, viewY: saved.viewY, scale: saved.scale });
    // Settings may have changed on the finished-game screen.
    for (const button of el.sideGroup.children) {
      button.classList.toggle('selected', button.dataset.side === GAME.humanSide);
    }
    for (const button of el.strategyGroup.children) {
      button.classList.toggle('selected', button.dataset.strat === GAME.aiStrategy);
    }
    HC.view.applyViewTransform();
    HC.view.updateZoomInfo();
    HC.tree.drawTree(false);
    HC.board.renderBoard();
    el.status.textContent = `已回退到上一次你的决策（${GAME.humanSide}）：点击自己的一只手`;
    el.btnMain.disabled = false;
    el.btnMain.textContent = '重新开始';
    updateBackButton();
  }

  HC.history = Object.freeze({ recordDecision, clear, undo, updateBackButton });
})();

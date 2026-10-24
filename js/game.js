// Owns turn progression and cancellation. Board clicks and tree choices use the same move path.
(() => {
  'use strict';
  const HC = window.HandClash;
  const { state, rules } = HC;
  const { GAME, VIZ, ROOT_KEY } = state;
  const { el, handEl } = HC.dom;
  const { WIN, NODE_W } = HC.config;
  let aiTimer = null;

  function cancelPending() {
    state.session++;
    clearTimeout(aiTimer);
    aiTimer = null;
    clearTimeout(VIZ._edgeTimer);
    clearTimeout(VIZ._viewTimer);
    el.vizRoot.style.transition = '';
    GAME.aiActing = false;
    for (const which of ['me', 'opp']) {
      for (let i = 0; i < 2; i++) {
        handEl(which, i).classList.remove('clickable', 'sim-atk', 'sim-def', 'ai-atk', 'ai-def');
      }
    }
  }

  function isHumanTurnForBoard() {
    return GAME.running && !GAME.gameOver && !GAME.aiActing && GAME.current === GAME.humanSide;
  }

  function renderPosition(animate = false) {
    HC.board.renderBoard();
    HC.tree.drawTree(animate);
    HC.view.centerOnNode(HC.tree.currentKey(), animate);
    HC.history.updateBackButton();
  }

  function resetTree(rootKey) {
    VIZ.rootKey = rootKey;
    VIZ.expanded.clear();
    VIZ.hidden.clear();
    VIZ.pathKeys = [rootKey];
    VIZ.scale = 1;
    VIZ.viewX = el.vizArea.clientWidth / 2 - NODE_W / 2;
    VIZ.viewY = 20;
    HC.tree.clearVizElements();
    HC.view.applyViewTransform();
    HC.view.updateZoomInfo();
  }

  function onHandClickEdit(which, index) {
    if (!GAME.editable) return;
    const side = which === 'me' ? GAME.humanSide : rules.otherSide(GAME.humanSide);
    GAME.hands[side][index] = GAME.hands[side][index] % WIN + 1;
    resetTree(rules.stateKey(0, GAME.hands));
    renderPosition();
  }

  function startHumanTurn() {
    GAME.selecting = true;
    GAME.selectedAtk = null;
    HC.history.recordDecision();
    el.status.textContent = `你的回合（${GAME.humanSide}）：点击自己的一只手`;
    renderPosition();
  }

  function endGame(winningSide) {
    GAME.editable = false;
    GAME.selecting = false;
    GAME.selectedAtk = null;
    GAME.aiActing = false;
    GAME.gameOver = true;
    GAME.running = false;
    el.status.textContent = winningSide === GAME.humanSide ? '🎉 你获胜！' : '💻 电脑获胜！';
    el.btnMain.textContent = '重新开始';
    renderPosition();
  }

  function scheduleAiTurn() {
    const session = state.session;
    el.status.textContent = `${GAME.current} 回合（电脑思考中...）`;
    aiTimer = setTimeout(() => {
      aiTimer = null;
      if (session === state.session) aiTurn();
    }, 500);
  }

  function commitMove(move) {
    GAME.hands = rules.applyMove(GAME.hands, GAME.current, move);
    GAME.selectedAtk = null;
    GAME.selecting = false;
    GAME.aiActing = false;
    const winningSide = rules.winner(GAME.hands);
    GAME.current = rules.otherSide(GAME.current);
    const previous = HC.tree.currentKey();
    const next = rules.stateKey(GAME.current === 'A' ? 0 : 1, GAME.hands);
    VIZ.pathKeys.push(next);
    VIZ.expanded.add(previous);
    VIZ.expanded.add(next);
    VIZ.hidden.delete(previous);
    VIZ.hidden.delete(next);
    renderPosition(true);
    if (winningSide) endGame(winningSide);
    else if (GAME.current === GAME.humanSide) startHumanTurn();
    else scheduleAiTurn();
  }

  function onMeHandClick(index) {
    if (!isHumanTurnForBoard() || !GAME.selecting || GAME.hands[GAME.humanSide][index] >= WIN) return;
    GAME.selectedAtk = index;
    el.status.textContent = `你选择了手${index + 1}，请点击对方的手`;
    HC.board.renderBoard();
  }

  function onOppHandClick(index) {
    if (!isHumanTurnForBoard()) return;
    if (GAME.selectedAtk === null) {
      el.status.textContent = '请先点击自己的一只手';
      return;
    }
    const move = 2 * GAME.selectedAtk + index;
    if (rules.legalMoves(GAME.hands, GAME.current).includes(move)) commitMove(move);
  }

  async function onSelectChildByButton(childKey, move) {
    if (!isHumanTurnForBoard()) return;
    const entry = state.table[HC.tree.currentKey()];
    if (entry?.childs[move] !== childKey || !rules.legalMoves(GAME.hands, GAME.current).includes(move)) return;
    const session = state.session;
    const side = GAME.current;
    GAME.aiActing = true;
    GAME.selecting = false;
    GAME.selectedAtk = null;
    el.status.textContent = `你用手${Math.floor(move / 2) + 1}碰对方手${move % 2 + 1}...`;
    HC.history.updateBackButton();
    await HC.board.playHumanSelectAnimation(side, Math.floor(move / 2), rules.otherSide(side), move % 2);
    if (session !== state.session || !GAME.running) return;
    commitMove(move);
  }

  async function aiTurn() {
    if (!GAME.running || GAME.gameOver || GAME.current === GAME.humanSide || GAME.aiActing) return;
    const session = state.session;
    const side = GAME.current;
    const opponent = rules.otherSide(side);
    const move = rules.chooseMove(GAME.hands, side, GAME.aiStrategy, state.table);
    if (move === null) return;
    GAME.aiActing = true;
    GAME.selecting = false;
    GAME.selectedAtk = null;
    const attack = Math.floor(move / 2);
    const target = move % 2;
    const nextValue = Math.min(WIN, GAME.hands[side][attack] + GAME.hands[opponent][target]);
    el.status.textContent = `${side} 用手${attack + 1}碰 ${opponent} 的手${target + 1} → ${side} 变为 ${nextValue}`;
    HC.board.renderBoard();
    await HC.board.playAiMoveAnimation(side, attack, opponent, target);
    if (session !== state.session || !GAME.running) return;
    commitMove(move);
  }

  function startGame() {
    if (!state.table || GAME.running) return;
    const root = rules.stateKey(0, GAME.hands);
    if (!state.table[root]) {
      el.status.textContent = `❌ 数据表缺少开局局面 ${root}`;
      return;
    }
    cancelPending();
    HC.history.clear();
    Object.assign(GAME, { current: 'A', editable: false, selecting: false,
      selectedAtk: null, running: true, gameOver: false });
    resetTree(root);
    el.btnMain.textContent = '重新开始';
    renderPosition();
    const winningSide = rules.winner(GAME.hands);
    if (winningSide) endGame(winningSide);
    else if (GAME.humanSide === 'A') startHumanTurn();
    else scheduleAiTurn();
  }

  function resetToIdle() {
    cancelPending();
    HC.history.clear();
    Object.assign(GAME, { hands: { A: [1, 1], B: [1, 1] }, current: 'A',
      selecting: false, selectedAtk: null, running: false, gameOver: false, editable: true });
    resetTree(ROOT_KEY);
    renderPosition();
    el.status.textContent = '点击手牌可调整初始点数，然后点击开始游戏';
    el.btnMain.disabled = !state.table;
    el.btnMain.textContent = '开始游戏';
  }

  HC.game = Object.freeze({ cancelPending, isHumanTurnForBoard, onHandClickEdit,
    onMeHandClick, onOppHandClick, onSelectChildByButton, startGame, resetToIdle });
})();

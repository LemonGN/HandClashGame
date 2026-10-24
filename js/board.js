// Board module. Cross-module calls go through HandClash.
(() => {
  'use strict';
  const HC = window.HandClash;
  const { state } = HC;
  const { GAME } = state;
  const { WIN } = HC.config;
  const { el, handEl, imgEl, numEl } = HC.dom;

  function handPic(value) {
    return `./hand_pic/hand${value}.jpg`;
  }

  function setHand(which, index, value) {
    imgEl(which, index).src = handPic(value);
    imgEl(which, index).alt = `${value} 点手牌`;
    const badge = numEl(which, index);
    if (badge.dataset.val !== String(value)) {
      // 数值变化时重新触发弹跳动效
      badge.classList.remove('pop');
      void badge.getBoundingClientRect();
      badge.classList.add('pop');
      badge.dataset.val = String(value);
    }
    badge.textContent = value;
    handEl(which, index).classList.toggle('done', value >= WIN);
    handEl(which, index).classList.remove('clickable');
  }

  function getMeOppHands() {
    const me = GAME.humanSide;
    const opp = me === 'A' ? 'B' : 'A';
    return { me: GAME.hands[me], opp: GAME.hands[opp], meSide: me, oppSide: opp };
  }

  function renderBoard() {
    const { me, opp, meSide, oppSide } = getMeOppHands();

    el.roleOpp1.textContent = `${oppSide} 手1`;
    el.roleOpp2.textContent = `${oppSide} 手2`;
    el.roleMe1.textContent = `${meSide} 手1 (你)`;
    el.roleMe2.textContent = `${meSide} 手2 (你)`;

    for (let i = 0; i < 2; i++) setHand('opp', i, opp[i]);
    for (let i = 0; i < 2; i++) setHand('me', i, me[i]);
    // 编辑初始手牌阶段：四只手都可点，统一加蓝框提示（并去掉"满"红框）
    if (GAME.editable) {
      for (const w of ['me', 'opp']) {
        for (let i = 0; i < 2; i++) {
          const h = handEl(w, i);
          h.classList.remove('done');
          h.classList.add('clickable');
        }
      }
      return;   // 编辑态不继续走对局高亮逻辑
    }
    if (GAME.running && !GAME.gameOver && GAME.current === GAME.humanSide && GAME.selecting) {
      if (GAME.selectedAtk === null) {
        for (let i = 0; i < 2; i++) {
          if (me[i] < WIN) handEl('me', i).classList.add('clickable');
        }
      } else {
        for (let i = 0; i < 2; i++) {
          if (opp[i] < WIN) handEl('opp', i).classList.add('clickable');
        }
      }
    }
  }
  function highlightHand(which, idx, cls, duration) {
    const session = state.session;
    return new Promise(resolve => {
      const h = handEl(which, idx);
      if (!h) { resolve(); return; }
      h.classList.add(cls);
      setTimeout(() => {
        if (session === state.session) h.classList.remove(cls);
        // 留一点间隔让两个高亮不粘连
        setTimeout(resolve, 60);
      }, duration);
    });
  }

  async function playHumanSelectAnimation(atkSide, atkIdx, defSide, defIdx) {
    const meSide = GAME.humanSide;
    const atkWhich = (atkSide === meSide) ? 'me' : 'opp';
    const defWhich = (defSide === meSide) ? 'me' : 'opp';

    // 先清掉引导点击的两个蓝色高光（clickable），以及可能残留的模拟类
    //   等同于电脑动画开始时"手上没有高亮"的状态
    for (const w of ['me', 'opp']) {
      for (const i of [0, 1]) {
        const h = handEl(w, i);
        if (h) h.classList.remove('clickable', 'sim-atk', 'sim-def');
      }
    }

    // 复用电脑动画的 highlightHand，行为（时长420ms + 60ms间隔）完全一致
    const session = state.session;
    await highlightHand(atkWhich, atkIdx, 'sim-atk', 420);
    if (session !== state.session) return;
    await highlightHand(defWhich, defIdx, 'sim-def', 420);
  }
  // 依次高亮 进攻手 → 防守手，然后执行动作
  async function playAiMoveAnimation(aiSide, aiIdx, oppSide, defIdx) {
    // 计算 ai 的手在我方视角下是 me 还是 opp
    const meSide = GAME.humanSide;
    const aiWhich = (aiSide === meSide) ? 'me' : 'opp';
    const oppWhich = (oppSide === meSide) ? 'me' : 'opp';

    const session = state.session;
    await highlightHand(aiWhich, aiIdx, 'ai-atk', 420);
    if (session !== state.session) return;
    await highlightHand(oppWhich, defIdx, 'ai-atk', 420);
  }

  HC.board = Object.freeze({ getMeOppHands, renderBoard, playHumanSelectAnimation, playAiMoveAnimation });
})();

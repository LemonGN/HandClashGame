// Settings, hand input, board divider, and help dialog.
(() => {
  'use strict';
  const HC = window.HandClash;
  const { GAME } = HC.state;
  const { el, handEl } = HC.dom;

  function bindSettings() {
    el.sideGroup.addEventListener('click', event => {
      const button = event.target.closest('.opt-btn');
      if (!button || GAME.running) return;
      for (const option of el.sideGroup.children) option.classList.toggle('selected', option === button);
      GAME.humanSide = button.dataset.side;
      HC.board.renderBoard();
      HC.tree.drawTree(false);
      HC.view.centerOnNode(HC.tree.currentKey(), false);
    });
    el.strategyGroup.addEventListener('click', event => {
      const button = event.target.closest('.opt-btn');
      if (!button || GAME.running) return;
      for (const option of el.strategyGroup.children) option.classList.toggle('selected', option === button);
      GAME.aiStrategy = button.dataset.strat;
    });
  }

  function bindHandInput() {
    for (const which of ['me', 'opp']) {
      for (let index = 0; index < 2; index++) {
        handEl(which, index).addEventListener('click', () => {
          if (GAME.editable) HC.game.onHandClickEdit(which, index);
          else if (which === 'me') HC.game.onMeHandClick(index);
          else HC.game.onOppHandClick(index);
        });
      }
    }
  }

  function bindDivider() {
    let dragging = false;
    function resize(clientY) {
      const height = Math.max(200, Math.min(window.innerHeight - 120, clientY));
      el.topArea.style.height = height + 'px';
      el.topArea.style.flex = '0 0 auto';
    }
    el.divider.addEventListener('mousedown', () => { dragging = true; });
    window.addEventListener('mousemove', event => { if (dragging) resize(event.clientY); });
    window.addEventListener('mouseup', () => { dragging = false; });
    el.divider.addEventListener('touchstart', () => { dragging = true; }, { passive: true });
    window.addEventListener('touchmove', event => {
      if (dragging && event.touches.length) resize(event.touches[0].clientY);
    }, { passive: true });
    window.addEventListener('touchend', () => { dragging = false; });
  }

  function bindHelp() {
    const mask = document.getElementById('helpMask');
    const close = () => mask.classList.remove('show');
    document.getElementById('btnHelp').addEventListener('click', () => mask.classList.add('show'));
    document.getElementById('helpClose').addEventListener('click', close);
    mask.addEventListener('click', event => { if (event.target === mask) close(); });
    window.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  }

  function bindControls() {
    bindSettings();
    bindHandInput();
    bindDivider();
    bindHelp();
    el.btnMain.addEventListener('click', () => {
      if (GAME.running || GAME.gameOver) HC.game.resetToIdle();
      else HC.game.startGame();
    });
    el.btnBack.addEventListener('click', () => HC.history.undo());
  }

  HC.controls = Object.freeze({ bindControls });
})();

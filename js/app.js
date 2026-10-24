// Single application entry point. All modules have loaded before initialization.
(() => {
  'use strict';
  const HC = window.HandClash;
  const { el } = HC.dom;
  try {
    if (!window.HandClashData?.[HC.state.ROOT_KEY]) throw new Error('局面数据缺失');
    HC.state.table = window.HandClashData;
    delete window.HandClashData;
    HC.view.bindViewControls();
    HC.controls.bindControls();
    el.loading.style.display = 'none';
    HC.game.resetToIdle();
  } catch (error) {
    console.error(error);
    el.loading.textContent = '❌ 无法加载局面数据，请确认 data/states.js 存在且完整';
    el.status.textContent = '❌ 加载失败（查看控制台）';
    el.btnMain.disabled = true;
  }
})();

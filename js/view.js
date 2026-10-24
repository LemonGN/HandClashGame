// View module. Cross-module calls go through HandClash.
(() => {
  'use strict';
  const HC = window.HandClash;
  const { VIZ } = HC.state;
  const { NODE_W, NODE_H, TRANSITION_MS } = HC.config;
  const { el } = HC.dom;

  function applyViewTransform() {
    el.vizRoot.setAttribute('transform',
      `translate(${VIZ.viewX}, ${VIZ.viewY}) scale(${VIZ.scale})`);
  }

  /* ===================== 平滑居中 ===================== */
  function centerOnNode(key, animate = true) {
    const pos = VIZ.nodePos.get(key);
    if (!pos) return;

    const areaW = el.vizArea.clientWidth;
    const areaH = el.vizArea.clientHeight;

    // 节点中心在"内容坐标系"中的位置
    const nodeCx = pos.x + NODE_W / 2;
    const nodeCy = pos.y + NODE_H / 2;

    // 希望节点中心落在视口中心 => 解出 viewX / viewY（scale 不变）
    const targetViewX = areaW / 2 - nodeCx * VIZ.scale;
    const targetViewY = areaH / 2 - nodeCy * VIZ.scale;

    if (!animate) {
      el.vizRoot.style.transition = 'none';
      VIZ.viewX = targetViewX;
      VIZ.viewY = targetViewY;
      applyViewTransform();
      void el.vizRoot.getBoundingClientRect(); // 强制回流
      el.vizRoot.style.transition = '';
      return;
    }

    el.vizRoot.style.transition = 'transform 0.4s ease';
    VIZ.viewX = targetViewX;
    VIZ.viewY = targetViewY;
    applyViewTransform();

    clearTimeout(VIZ._viewTimer);
    VIZ._viewTimer = setTimeout(() => {
      el.vizRoot.style.transition = '';
    }, TRANSITION_MS + 50);
  }

  function updateZoomInfo() {
    el.zoomInfo.textContent = Math.round(VIZ.scale * 100) + '%';
  }

  /* ===================== 拖动 ===================== */
  function bindViewControls() {
    let dragState = null;
    el.vizSvg.addEventListener('mousedown', (e) => {
      if (e.target.closest('.node-rect')) return;
      el.vizRoot.style.transition = 'none';        // 打断居中动画
      dragState = { x: e.clientX, y: e.clientY, vx: VIZ.viewX, vy: VIZ.viewY };
      el.vizSvg.classList.add('dragging');
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragState) return;
      VIZ.viewX = dragState.vx + (e.clientX - dragState.x);
      VIZ.viewY = dragState.vy + (e.clientY - dragState.y);
      applyViewTransform();
    });
    window.addEventListener('mouseup', () => {
      dragState = null;
      el.vizSvg.classList.remove('dragging');
    });

    /* ===================== 缩放 ===================== */
    el.vizSvg.addEventListener('wheel', (e) => {
      e.preventDefault();
      el.vizRoot.style.transition = 'none';        // 打断居中动画
      const rect = el.vizSvg.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const newScale = Math.max(VIZ.minScale, Math.min(VIZ.maxScale, VIZ.scale * factor));
      const realFactor = newScale / VIZ.scale;

      VIZ.viewX = mx - (mx - VIZ.viewX) * realFactor;
      VIZ.viewY = my - (my - VIZ.viewY) * realFactor;
      VIZ.scale = newScale;

      applyViewTransform();
      updateZoomInfo();
    }, { passive: false });

    let pinchState = null;
    el.vizSvg.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        const [t1, t2] = e.touches;
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        pinchState = {
          dist,
          scale: VIZ.scale,
          viewX: VIZ.viewX,
          viewY: VIZ.viewY,
          cx: (t1.clientX + t2.clientX) / 2,
          cy: (t1.clientY + t2.clientY) / 2,
        };
        dragState = null;
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        dragState = { x: t.clientX, y: t.clientY, vx: VIZ.viewX, vy: VIZ.viewY };
      }
    }, { passive: true });

    el.vizSvg.addEventListener('touchmove', (e) => {
      el.vizRoot.style.transition = 'none';        // 打断居中动画
      if (e.touches.length === 2 && pinchState) {
        e.preventDefault();
        const [t1, t2] = e.touches;
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const factor = dist / pinchState.dist;
        const newScale = Math.max(VIZ.minScale, Math.min(VIZ.maxScale, pinchState.scale * factor));
        const realFactor = newScale / pinchState.scale;

        const rect = el.vizSvg.getBoundingClientRect();
        const cx = pinchState.cx - rect.left;
        const cy = pinchState.cy - rect.top;

        VIZ.viewX = cx - (cx - pinchState.viewX) * realFactor;
        VIZ.viewY = cy - (cy - pinchState.viewY) * realFactor;
        VIZ.scale = newScale;

        applyViewTransform();
        updateZoomInfo();
      } else if (e.touches.length === 1 && dragState) {
        const t = e.touches[0];
        VIZ.viewX = dragState.vx + (t.clientX - dragState.x);
        VIZ.viewY = dragState.vy + (t.clientY - dragState.y);
        applyViewTransform();
        e.preventDefault();
      }
    }, { passive: false });

    el.vizSvg.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) pinchState = null;
      if (e.touches.length === 0) dragState = null;
    });

    /* ===================== 缩放按钮 ===================== */
    function zoomBy(factor) {
      el.vizRoot.style.transition = 'none';        // 打断居中动画
      const rect = el.vizArea.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const newScale = Math.max(VIZ.minScale, Math.min(VIZ.maxScale, VIZ.scale * factor));
      const realFactor = newScale / VIZ.scale;

      VIZ.viewX = cx - (cx - VIZ.viewX) * realFactor;
      VIZ.viewY = cy - (cy - VIZ.viewY) * realFactor;
      VIZ.scale = newScale;

      applyViewTransform();
      updateZoomInfo();
    }
    el.btnZoomIn.addEventListener('click', () => zoomBy(1.2));
    el.btnZoomOut.addEventListener('click', () => zoomBy(1 / 1.2));

    el.btnResetView.addEventListener('click', () => {
      el.vizRoot.style.transition = 'none';        // 打断居中动画
      VIZ.viewX = 40;
      VIZ.viewY = 20;
      VIZ.scale = 1;
      applyViewTransform();
      updateZoomInfo();
    });

    /* ===================== 适应屏幕 ===================== */
    el.btnFit.addEventListener('click', () => {
      if (VIZ.nodePos.size === 0) return;
      el.vizRoot.style.transition = 'none';        // 打断居中动画

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const { x, y } of VIZ.nodePos.values()) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + NODE_W);
        maxY = Math.max(maxY, y + NODE_H);
      }
      const treeW = maxX - minX;
      const treeH = maxY - minY;
      const areaW = el.vizArea.clientWidth;
      const areaH = el.vizArea.clientHeight;

      const pad = 30;
      const scale = Math.min(
        (areaW - pad * 2) / treeW,
        (areaH - pad * 2) / treeH,
        1.5
      );
      VIZ.scale = Math.max(VIZ.minScale, scale);

      VIZ.viewX = pad - minX * VIZ.scale + (areaW - pad * 2 - treeW * VIZ.scale) / 2;
      VIZ.viewY = pad - minY * VIZ.scale;

      applyViewTransform();
      updateZoomInfo();
    });

  }
  HC.view = Object.freeze({ bindViewControls, applyViewTransform, updateZoomInfo, centerOnNode });
})();

/* ============================================================
   Вставка рекламных блоков в элементы с data-ad-slot.
   Если реклама выключена — показывается нейтральная заглушка.
   ============================================================ */
(function () {
  'use strict';

  const config = window.AD_CONFIG || {};

  function renderSlot(element) {
    const name = element.dataset.adSlot;
    const id = config.slots && config.slots[name];

    if (!config.enabled || !config.client || !id) {
      element.dataset.placeholder = 'Рекламное место · ' + name;
      return;
    }

    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.dataset.adClient = config.client;
    ins.dataset.adSlot = id;
    ins.dataset.adFormat = 'auto';
    ins.dataset.fullWidthResponsive = 'true';

    element.textContent = '';
    element.appendChild(ins);
    element.classList.add('ad-live');

    (window.adsbygoogle = window.adsbygoogle || []).push({});
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-ad-slot]'), renderSlot);
})();

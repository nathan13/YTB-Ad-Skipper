console.log('✅ [Page] YouTube Auto Skip Ads injected');
(function() {
  function simulateClick(elem) {
    ['mousedown', 'mouseup', 'click'].forEach(type => {
      const e = new MouseEvent(type, { view: window, bubbles: true, cancelable: true });
      elem.dispatchEvent(e);
    });
  }

  function skipAd() {
    const btn = document.querySelector('button.ytp-skip-ad-button');
    if (btn && btn.offsetParent !== null) {
      console.log('🔁 [Page] Skip encontrado — simulando clique');
      simulateClick(btn);
    }
  }

  new MutationObserver(skipAd).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(skipAd, 500);
})();

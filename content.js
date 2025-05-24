(function() {
  let skipInProgress = false;

  function skipAd() {
    if (skipInProgress) return;

    const btn = document.querySelector('button.ytp-skip-ad-button');
    if (btn && btn.offsetParent !== null) {
      const rect = btn.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      console.log(`🔁 [CS] Skip encontrado em (${x.toFixed(0)}, ${y.toFixed(0)})`);

      chrome.runtime.sendMessage({ action: 'skipAd', x, y });

      skipInProgress = true;
      setTimeout(() => {
        skipInProgress = false;
      }, 10000);
    }
  }

  new MutationObserver(skipAd).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(skipAd, 500);
})();

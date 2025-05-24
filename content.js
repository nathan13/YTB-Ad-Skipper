(function() {
  let skipInProgress = false;

  function skipAd() {
    chrome.storage.local.get('enabled', ({ enabled = true }) => {
      // Stop if the extension is disabled via popup
      if (!enabled) {
        // Optionally, could add a log here if needed for debugging disabled state
        // console.log('[CS] Extension disabled, skipping ad check.');
        return;
      }

      // Existing logic starts here, now inside the storage callback
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
        }, 10000); // Cooldown period
      }
    });
  }

  // These will continue to call the modified skipAd function
  new MutationObserver(skipAd).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(skipAd, 500);
})();

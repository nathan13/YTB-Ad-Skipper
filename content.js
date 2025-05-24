(function() {
  let skipInProgress = false;
  let adReportedAsStarted = false; // Flag for the new ad detection

  // Function to check for ad module and report if new ad starts
  function checkForAdModule() {
    // More robust selector: check for common ad container or class on player
    const adModule = document.querySelector(
      '.ytp-ad-player-overlay-instream-info, .video-ads.ytp-ad-module, #movie_player.ad-interrupting, #movie_player.ad-showing'
    );
    
    // Check if the ad module exists and is actually visible in the layout
    const isAdVisible = adModule && adModule.offsetParent !== null;

    if (isAdVisible) {
      if (!adReportedAsStarted) {
        chrome.storage.local.get('enabled', ({ enabled = true }) => {
          if (enabled) {
            console.log('[CS] Ad playback detected (ad module visible), sending message to background.');
            chrome.runtime.sendMessage({ action: 'adPlaybackStarted' });
            adReportedAsStarted = true;
          } else {
            // console.log('[CS] Ad playback detected, but extension is disabled.');
          }
        });
      }
    } else {
      // If ad module is not found or not visible, reset the flag
      if (adReportedAsStarted) {
        // console.log('[CS] Ad module no longer detected/visible, resetting flag.');
        adReportedAsStarted = false;
      }
    }
  }

  // Existing function to find and click the skip button
  function skipAd() {
    chrome.storage.local.get('enabled', ({ enabled = true }) => {
      if (!enabled) {
        // console.log('[CS] Extension disabled, skipAd check aborted.');
        return;
      }
      if (skipInProgress) {
        // console.log('[CS] Skip in progress, skipAd check aborted.');
        return;
      }

      const btn = document.querySelector('button.ytp-skip-ad-button');
      if (btn && btn.offsetParent !== null) { // Check if button exists and is visible
        const rect = btn.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        console.log(`🔁 [CS] Skip button found at (${x.toFixed(0)}, ${y.toFixed(0)})`);
        chrome.runtime.sendMessage({ action: 'skipAd', x, y });
        skipInProgress = true;
        setTimeout(() => {
          skipInProgress = false;
          // console.log('[CS] SkipInProgress flag reset.');
        }, 10000); // Cooldown period
      }
    });
  }

  // Observer for the "Skip Ad" button (existing)
  const skipAdObserver = new MutationObserver(skipAd);
  skipAdObserver.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(skipAd, 500); // Fallback interval for skip button

  // New Observer for ad module detection
  const adModuleObserver = new MutationObserver(checkForAdModule);
  adModuleObserver.observe(document.documentElement, {
    childList: true, // For when ad elements are added/removed
    subtree: true,   // To catch changes in descendants
    attributes: true, // For changes in attributes like 'class' or 'style' (hidden)
    attributeFilter: ['class', 'style', 'hidden'] // Be more specific on attributes to watch
  });
  // Also call checkForAdModule periodically as a fallback or for initial check
  setInterval(checkForAdModule, 750); // Interval for ad module presence check

})();

(function() {
  let skipInProgress = false;
  let adReportedAsStarted = false; // Flag for the new ad detection

  // Function to check for ad module and report if new ad starts
  function checkForAdModule() {
    // Context invalidation check - initial
    if (!chrome.runtime?.id) {
      // console.log('[CS] Context invalidated at checkForAdModule start (initial check). Observers/intervals should stop if extension is updated/disabled.');
      return;
    }

    const adModule = document.querySelector(
      '.ytp-ad-player-overlay-instream-info, .video-ads.ytp-ad-module, #movie_player.ad-interrupting, #movie_player.ad-showing'
    );
    
    const isAdVisible = adModule && adModule.offsetParent !== null;

    if (isAdVisible) {
      if (!adReportedAsStarted) {
        // Context invalidation check - before async operation
        if (!chrome.runtime?.id) {
          console.log('[CS] Context invalidated, checkForAdModule aborted before storage.get for ad start.');
          return;
        }
        chrome.storage.local.get('enabled', ({ enabled = true }) => {
          if (!chrome.runtime?.id) {
            console.log('[CS] Context invalidated after storage.get in checkForAdModule for ad start.');
            return;
          }
          if (enabled) {
            console.log('[CS] Ad playback detected (ad module visible), sending message to background.');
            if (chrome.runtime?.id) { // Check right before sending
              chrome.runtime.sendMessage({ action: 'adPlaybackStarted' });
              adReportedAsStarted = true;
            } else {
              console.log('[CS] Context invalidated just before sending adPlaybackStarted message.');
            }
          } else {
            // console.log('[CS] Ad playback detected (ad module visible), but extension is disabled.');
          }
        });
      }
    } else {
      // Ad module is not visible or not found
      if (adReportedAsStarted) {
        // This block executes when an ad was previously reported as started, and now no ad module is visible.
        // Context invalidation check - before async operation for ad end
        if (!chrome.runtime?.id) {
          console.log('[CS] Context invalidated before storage.get for ad end. Resetting adReportedAsStarted.');
          adReportedAsStarted = false; // Reset state even if context is lost
          return;
        }
        chrome.storage.local.get('enabled', ({ enabled = true }) => {
          // Check context again inside the async callback
          if (!chrome.runtime?.id) {
            console.log('[CS] Context invalidated after storage.get for ad end. Resetting adReportedAsStarted.');
            adReportedAsStarted = false; // Reset state even if context is lost
            return;
          }
          if (enabled) {
            console.log('[CS] Ad playback ended (ad module no longer visible), sending message to background.');
            // Check context one last time before sending the message
            if (chrome.runtime?.id) {
              chrome.runtime.sendMessage({ action: 'adPlaybackEnded' });
            } else {
              console.log('[CS] Context invalidated just before sending adPlaybackEnded message.');
            }
          } else {
            // console.log('[CS] Ad playback ended (ad module no longer visible), but extension is disabled.');
          }
          // Crucially, reset adReportedAsStarted to false *after* handling the ad end logic.
          // This happens regardless of whether the message was sent (e.g. if disabled or context lost just before send).
          adReportedAsStarted = false; 
        });
      }
      // If adReportedAsStarted was already false, nothing to do here.
    }
  }

  // Existing function to find and click the skip button
  function skipAd() {
    // Context invalidation check - initial
    if (!chrome.runtime?.id) {
      // console.log('[CS] Context invalidated at skipAd start (initial check).');
      return;
    }

    chrome.storage.local.get('enabled', ({ enabled = true }) => {
      if (!chrome.runtime?.id) {
        console.log('[CS] Context invalidated after storage.get in skipAd.');
        return;
      }
      if (!enabled) {
        // console.log('[CS] Extension disabled, skipAd check aborted.');
        return;
      }
      if (skipInProgress) {
        // console.log('[CS] Skip in progress, skipAd check aborted.');
        return;
      }

      const btn = document.querySelector('button.ytp-skip-ad-button');
      if (btn && btn.offsetParent !== null) { 
        const rect = btn.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        console.log(`🔁 [CS] Skip button found at (${x.toFixed(0)}, ${y.toFixed(0)})`);
        if (chrome.runtime?.id) { // Check right before sending
          chrome.runtime.sendMessage({ action: 'skipAd', x, y });
          skipInProgress = true;
          setTimeout(() => {
            skipInProgress = false;
            // console.log('[CS] SkipInProgress flag reset.');
          }, 10000); 
        } else {
          console.log('[CS] Context invalidated just before sending skipAd message.');
        }
      }
    });
  }

  // Initial check to ensure context is valid before setting up observers/intervals
  if (!chrome.runtime?.id) {
    console.warn('[CS] Extension context invalidated at script start. Not setting up observers or intervals.');
  } else {
    // console.log('[CS] Extension context valid. Setting up observers and intervals.');
    const skipAdObserver = new MutationObserver(skipAd);
    skipAdObserver.observe(document.documentElement, { childList: true, subtree: true });
    setInterval(skipAd, 500); 

    const adModuleObserver = new MutationObserver(checkForAdModule);
    adModuleObserver.observe(document.documentElement, {
      childList: true, 
      subtree: true,   
      attributes: true, 
      attributeFilter: ['class', 'style', 'hidden'] 
    });
    setInterval(checkForAdModule, 750);
  }

})();

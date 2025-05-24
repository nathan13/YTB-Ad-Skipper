const SCRIPT_ID = 'skip-ads-cs';
let attachedTabs = {}; // Stores tabId: 'pending' or true if debugger is attached/attempting

async function unregisterScript() {
  try {
    await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  } catch (e) { /* Ignore errors, e.g., if script was not registered */ }
}

async function registerScript() {
  try {
    await chrome.scripting.registerContentScripts([{
      id: SCRIPT_ID,
      js: ['content.js'],
      matches: ['*://www.youtube.com/*'],
      runAt: 'document_idle',
      allFrames: false
    }]);
  } catch (err) {
    console.error('[BG] Error registering content script:', err);
  }
}

function attachDebugger(tabId) {
  if (attachedTabs[tabId]) { // Covers 'pending' and true
    // console.log(`[BG] Debugger already attached or pending for tab ${tabId}.`);
    return;
  }
  attachedTabs[tabId] = 'pending'; // Mark as attempting to attach
  chrome.debugger.attach({ tabId }, '1.3', () => {
    if (chrome.runtime.lastError) {
      console.error(`[BG] Debugger attach error for tab ${tabId}: ${chrome.runtime.lastError.message}`);
      delete attachedTabs[tabId]; // Clear flag on error
      return;
    }
    attachedTabs[tabId] = true; // Confirmed attachment
    console.log(`[BG] ✅ Debugger successfully attached to tab ${tabId}.`);
  });
}

function detachDebugger(tabId) {
  // Ensure we only try to detach if it was confirmed as attached.
  if (attachedTabs[tabId] !== true) { 
    // console.log(`[BG] Debugger not confirmed as active for tab ${tabId} (state: ${attachedTabs[tabId]}), no detach needed.`);
    return;
  }
  chrome.debugger.detach({ tabId }, () => {
    if (chrome.runtime.lastError) {
      console.error(`[BG] Debugger detach error for tab ${tabId}: ${chrome.runtime.lastError.message}`);
      // State remains 'true' as detach failed; manual intervention or re-evaluation might be needed.
    } else {
      delete attachedTabs[tabId];
      console.log(`[BG] ✅ Debugger successfully detached from tab ${tabId}.`);
    }
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!sender.tab || !sender.tab.id) {
    console.warn('[BG] Message received without sender.tab.id:', msg);
    return false; 
  }
  const tabId = sender.tab.id;

  if (msg.action === 'adPlaybackStarted') {
    chrome.storage.local.get('enabled', ({ enabled = true }) => {
      if (enabled) {
        if (!attachedTabs[tabId]) { 
          console.log(`[BG] 'adPlaybackStarted' received for tab ${tabId}. Attaching debugger.`);
          attachDebugger(tabId);
        } else {
          // console.log(`[BG] 'adPlaybackStarted' for tab ${tabId}, debugger already ${attachedTabs[tabId]}.`);
        }
      } else {
        // console.log(`[BG] Extension disabled, 'adPlaybackStarted' for tab ${tabId} ignored.`);
      }
    });
    return false; // Synchronous handling for this message type
  } 
  
  else if (msg.action === 'skipAd') {
    chrome.storage.local.get('enabled', ({ enabled = true }) => {
      if (!enabled) {
        // console.log(`[BG] Extension disabled, 'skipAd' for tab ${tabId} ignored.`);
        return;
      }

      const { x, y } = msg;
      if (typeof x !== 'number' || typeof y !== 'number') {
        console.error(`[BG] Invalid coordinates for 'skipAd' on tab ${tabId}:`, msg);
        return;
      }

      // ** Crucial Change: Only proceed if debugger is confirmed to be active (state === true) **
      if (attachedTabs[tabId] !== true) {
        console.warn(`[BG] Received 'skipAd' for tab ${tabId}, but debugger is not confirmed active (state: ${attachedTabs[tabId]}). Click will NOT be attempted.`);
        return; 
      }
      
      console.log(`[BG] Attempting skip ad click at (${x}, ${y}) for tab ${tabId} (debugger active).`);
      chrome.debugger.sendCommand(
        { tabId }, 'Input.dispatchMouseEvent',
        { type: 'mousePressed', x, y, button: 'left', clickCount: 1 },
        () => {
          if (chrome.runtime.lastError) {
            console.error(`[BG] Mouse press error for tab ${tabId}: ${chrome.runtime.lastError.message}`);
            // Consider if detach is appropriate even on error, depending on error type.
            // For now, only detach on full success.
            return;
          }
          chrome.debugger.sendCommand(
            { tabId }, 'Input.dispatchMouseEvent',
            { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 },
            () => {
              if (chrome.runtime.lastError) {
                console.error(`[BG] Mouse release error for tab ${tabId}: ${chrome.runtime.lastError.message}`);
                return;
              }
              console.log(`[BG] ✅ Click sent for skip ad button on tab ${tabId}. Detaching debugger.`);
              detachDebugger(tabId); 
            }
          );
        }
      );
    });
    return true; // Crucial: Indicates that sendResponse will be used asynchronously
  }
  
  return false; // Default for any other unhandled messages
});

chrome.debugger.onDetach.addListener((source, reason) => {
  const tabId = source.tabId;
  if (tabId && attachedTabs[tabId]) {
    delete attachedTabs[tabId];
    console.log(`[BG] Debugger detached from tab ${tabId} (reason: ${reason}). State cleaned.`);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // This listener is currently not performing any actions related to debugger attachment.
  // It can be removed if no other tab update logic is needed.
});

// Bootstrap: register the content script
(async () => {
  await unregisterScript();
  await registerScript();
})();

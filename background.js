const SCRIPT_ID = 'skip-ads-cs';
let attachedTabs = {};

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
    console.error('Erro ao registrar content-script:', err);
  }
}

function attachDebugger(tabId) {
  // Check if already attached or in process of attaching to prevent re-entry issues
  if (attachedTabs[tabId]) {
    // If already true (attached), no need to do anything.
    // If it's a promise, it means attachment is in progress (less relevant here as not returning promise).
    return;
  }
  // Mark as in process/attached.
  // If attach fails, it will be unset in the callback.
  attachedTabs[tabId] = true; 
  chrome.debugger.attach({ tabId }, '1.3', () => {
    if (chrome.runtime.lastError) {
      console.error(`Debugger attach error: ${chrome.runtime.lastError.message}`);
      delete attachedTabs[tabId]; // Clear flag on error to allow retry
      return;
    }
    console.log(`✅ Debugger attached to tab ${tabId}`);
  });
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action !== 'skipAd' || !sender.tab) return false; // Return false for synchronous path

  chrome.storage.local.get('enabled', ({ enabled = true }) => {
    if (!enabled) {
      // console.log('[BG] Extension disabled, skipAd message ignored.');
      return;
    }

    const tabId = sender.tab.id;
    const { x, y } = msg;

    attachDebugger(tabId);

    // It's generally better to ensure the debugger is attached before sending commands.
    // A more robust solution might involve a queue or checking attachment status
    // if attachDebugger itself were fully async and returned a promise.
    // For this structure, we proceed, hoping attachDebugger completes quickly or was proactive.
    chrome.debugger.sendCommand(
      { tabId },
      'Input.dispatchMouseEvent',
      { type: 'mousePressed', x, y, button: 'left', clickCount: 1 },
      () => {
        if (chrome.runtime.lastError) {
          console.error(`Mouse press error: ${chrome.runtime.lastError.message} for tab ${tabId}`);
          return;
        }
        chrome.debugger.sendCommand(
          { tabId },
          'Input.dispatchMouseEvent',
          { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 },
          () => {
            if (chrome.runtime.lastError) {
              console.error(`Mouse release error: ${chrome.runtime.lastError.message} for tab ${tabId}`);
              return;
            }
            console.log(`✅ Click enviado no botão Skip no tab ${tabId}`);
          }
        );
      }
    );
  });
  return true; // Crucial for indicating asynchronous response
});

// Ativa debugger sempre que abrir ou atualizar uma aba do YouTube
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Ensure the tab has a URL and the update is relevant (e.g. status is complete or URL changed)
  if (changeInfo.status === 'complete' || changeInfo.url) {
    if (tab.url && tab.url.includes('youtube.com/watch')) {
      chrome.storage.local.get('enabled', ({ enabled = true }) => {
        if (!enabled) {
          // console.log('[BG] Extension disabled, debugger not attached on tab update.');
          return;
        }
        attachDebugger(tabId);
      });
    }
  }
});

// Bootstrap: registra o content script
(async () => {
  await unregisterScript();
  await registerScript();
})();

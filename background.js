const SCRIPT_ID = 'skip-ads-cs';
let attachedTabs = {};

async function unregisterScript() {
  try {
    await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  } catch (e) { }
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
  if (!attachedTabs[tabId]) {
    chrome.debugger.attach({ tabId }, '1.3', () => {
      attachedTabs[tabId] = true;
      console.log(`✅ Debugger attached to tab ${tabId}`);
    });
  }
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action !== 'skipAd' || !sender.tab) return;
  const tabId = sender.tab.id;
  const { x, y } = msg;

  attachDebugger(tabId);

  chrome.debugger.sendCommand(
    { tabId },
    'Input.dispatchMouseEvent',
    { type: 'mousePressed', x, y, button: 'left', clickCount: 1 },
    () => {
      chrome.debugger.sendCommand(
        { tabId },
        'Input.dispatchMouseEvent',
        { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 },
        () => {
          console.log(`✅ Click enviado no botão Skip no tab ${tabId}`);
          // NÃO fecha mais o debugger
        }
      );
    }
  );
});

// Ativa debugger sempre que abrir ou atualizar uma aba do YouTube
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && tab.url.includes('youtube.com/watch')) {
    attachDebugger(tabId);
  }
});

// Bootstrap: registra o content script
(async () => {
  await unregisterScript();
  await registerScript();
})();

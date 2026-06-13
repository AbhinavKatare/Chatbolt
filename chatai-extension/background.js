let socket = null;
let tenantId = null;

// Load tenant ID from local storage and try to connect
chrome.storage.local.get(['tenantId'], (result) => {
  if (result.tenantId) {
    tenantId = result.tenantId;
    connectWebSocket();
  }
});

// Listen to runtime messages (e.g. from content.js or popup.js)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHATBOLT_TENANT_ID') {
    if (message.tenantId !== tenantId) {
      tenantId = message.tenantId;
      chrome.storage.local.set({ tenantId });
      connectWebSocket();
    }
  } else if (message.type === 'GET_STATUS') {
    sendResponse({ 
      connected: socket && socket.readyState === WebSocket.OPEN,
      tenantId
    });
  }
  return true;
});

function connectWebSocket() {
  if (socket) {
    try { socket.close(); } catch(e) {}
  }

  if (!tenantId) return;

  const wsUrl = `ws://localhost:4000/socket.io/?EIO=4&transport=websocket&tenantId=${tenantId}`;
  console.log('[Chatbolt Extension] Connecting to', wsUrl);
  socket = new WebSocket(wsUrl);

  let pingInterval = null;

  socket.onopen = () => {
    console.log('[Chatbolt Extension] WebSocket open. Joining namespace /browser-agent...');
    // Connect to namespace /browser-agent
    socket.send('40/browser-agent,');
    
    // Set up heartbeat
    pingInterval = setInterval(() => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send('2'); // Ping
      }
    }, 20000);
  };

  socket.onmessage = (event) => {
    const data = event.data;
    if (typeof data !== 'string') return;

    // Handle Engine.IO Ping/Pong response
    if (data === '3') {
      return; // Pong received
    }

    // Socket.IO message
    if (data.startsWith('40/browser-agent,')) {
      console.log('[Chatbolt Extension] Connected to /browser-agent namespace.');
      chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', connected: true });
    } 
    else if (data.startsWith('42/browser-agent,')) {
      // Parse event name and payload
      const jsonStr = data.substring(17);
      try {
        const [eventName, payload] = JSON.parse(jsonStr);
        if (eventName === 'browser:command') {
          handleBrowserCommand(payload);
        }
      } catch (e) {
        console.error('[Chatbolt Extension] Error parsing event:', e);
      }
    }
  };

  socket.onclose = () => {
    console.log('[Chatbolt Extension] WebSocket closed. Reconnecting in 5s...');
    chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', connected: false });
    if (pingInterval) clearInterval(pingInterval);
    setTimeout(connectWebSocket, 5000);
  };

  socket.onerror = (err) => {
    console.error('[Chatbolt Extension] WebSocket error:', err);
  };
}

async function handleBrowserCommand(command) {
  const { commandId, action } = command;
  console.log('[Chatbolt Extension] Received command:', command);

  // Helper to respond
  const sendResult = (success, data = null, error = null) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      const response = { commandId, success, data, error };
      socket.send(`42/browser-agent,["browser:result",${JSON.stringify(response)}]`);
    }
  };

  // If command is navigate, click, fill/type, extract:
  // We need to execute on active tab
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const activeTab = tabs[0];
    
    if (action === 'navigate') {
      if (!command.url) {
        return sendResult(false, null, 'No URL provided');
      }
      
      const targetUrl = command.url;
      if (activeTab) {
        chrome.tabs.update(activeTab.id, { url: targetUrl }, (tab) => {
          // Wait for load to complete
          const listener = (tabId, info) => {
            if (tabId === activeTab.id && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              // Send active status and screenshot
              setTimeout(() => {
                sendResult(true);
              }, 500);
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
        });
      } else {
        chrome.tabs.create({ url: targetUrl }, (newTab) => {
          const listener = (tabId, info) => {
            if (tabId === newTab.id && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              setTimeout(() => {
                sendResult(true);
              }, 500);
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
        });
      }
    } 
    else if (action === 'screenshot') {
      try {
        chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
          if (chrome.runtime.lastError) {
            sendResult(false, null, chrome.runtime.lastError.message);
          } else if (!dataUrl) {
            sendResult(false, null, 'Failed to capture screenshot data URL');
          } else {
            const base64 = dataUrl.split(',')[1];
            sendResult(true, { screenshot: base64 });
          }
        });
      } catch (err) {
        sendResult(false, null, err.message);
      }
    } 
    else if (['click', 'fill', 'type', 'extract'].includes(action)) {
      if (!activeTab) {
        return sendResult(false, null, 'No active tab found');
      }
      
      // Send message to content script
      chrome.tabs.sendMessage(activeTab.id, command, (response) => {
        if (chrome.runtime.lastError) {
          sendResult(false, null, chrome.runtime.lastError.message);
        } else if (!response) {
          sendResult(false, null, 'No response received from active tab content script');
        } else {
          sendResult(response.success, response.data, response.error);
        }
      });
    } 
    else {
      sendResult(false, null, `Unsupported action: ${action}`);
    }
  });
}

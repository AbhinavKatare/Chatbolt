// Listen to messages from background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extract') {
    try {
      const result = parseDOM();
      sendResponse({ success: true, data: result });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  } 
  else if (message.action === 'click') {
    try {
      const el = document.querySelector(`[data-chatbolt-id="${message.selector}"]`);
      if (!el) {
        throw new Error(`Element with id ${message.selector} not found`);
      }
      // Trigger user-like focus and click
      if (el instanceof HTMLAnchorElement || el instanceof HTMLButtonElement || el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.focus();
      }
      el.click();
      sendResponse({ success: true });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  } 
  else if (message.action === 'fill' || message.action === 'type') {
    try {
      const el = document.querySelector(`[data-chatbolt-id="${message.selector}"]`);
      if (!el) {
        throw new Error(`Element with id ${message.selector} not found`);
      }
      el.focus();
      el.value = message.text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      sendResponse({ success: true });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  }
  return true; // keep channel open for async response
});

// The parseDOM function, exactly matching backend browser.tool.ts parseDOM evaluation
function parseDOM() {
  const interactiveTags = ['A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'];
  const elements = document.querySelectorAll('*');
  let counter = 1;
  const interactiveElements = [];

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      style.opacity !== '0'
    );
  }

  elements.forEach((el) => {
    // Clean old attributes if any
    el.removeAttribute('data-chatbolt-id');

    const tagName = el.tagName;
    const isInteractive =
      interactiveTags.includes(tagName) ||
      el.getAttribute('role') === 'button' ||
      el.getAttribute('onclick') !== null ||
      el.style.cursor === 'pointer';

    if (isInteractive && isVisible(el)) {
      const id = counter++;
      el.setAttribute('data-chatbolt-id', String(id));

      const elementInfo = {
        id,
        tagName,
        text: (el.textContent || '').trim().substring(0, 100),
        placeholder: el.getAttribute('placeholder') || '',
        value: el.value || '',
        type: el.getAttribute('type') || '',
        href: el.getAttribute('href') || ''
      };
      interactiveElements.push(elementInfo);
    }
  });

  function cleanTree(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || '').trim().replace(/\s+/g, ' ');
      return text ? text : '';
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node;
    const tagName = el.tagName.toLowerCase();

    if (['script', 'style', 'head', 'noscript', 'meta', 'link', 'svg', 'path'].includes(tagName)) {
      return '';
    }

    const cbId = el.getAttribute('data-chatbolt-id');
    let childrenStr = '';
    el.childNodes.forEach((child) => {
      childrenStr += cleanTree(child);
    });

    childrenStr = childrenStr.trim();

    if (cbId) {
      const placeholder = el.getAttribute('placeholder') ? ' placeholder="' + el.getAttribute('placeholder') + '"' : '';
      const type = el.getAttribute('type') ? ' type="' + el.getAttribute('type') + '"' : '';
      const href = el.getAttribute('href') ? ' href="' + el.getAttribute('href') + '"' : '';
      const val = el.value ? ' value="' + el.value + '"' : '';

      return '\n[' + tagName + ' id=' + cbId + type + placeholder + href + val + '] ' + (childrenStr || (el.textContent || '').trim().substring(0, 60)) + ' [/' + tagName + ']';
    }

    if (childrenStr) {
      if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th'].includes(tagName)) {
        return '\n<' + tagName + '>' + childrenStr + '</' + tagName + '>';
      }
      return childrenStr;
    }

    return '';
  }

  const compressedDOM = cleanTree(document.body).replace(/\n\s*\n+/g, '\n');
  return { 
    title: document.title, 
    url: window.location.href, 
    compressedDOM, 
    interactiveElements 
  };
}

// If loaded on Chatbolt origin, grab tenantId and relay it
if (window.location.origin === 'http://localhost:3000') {
  function checkAndSendTenant() {
    try {
      const tenantStr = localStorage.getItem('chatai_tenant');
      if (tenantStr) {
        const tenant = JSON.parse(tenantStr);
        if (tenant && tenant.id) {
          chrome.runtime.sendMessage({ type: 'CHATBOLT_TENANT_ID', tenantId: tenant.id });
        }
      }
    } catch (e) {
      // Ignore cross-origin context issues
    }
  }

  checkAndSendTenant();
  setInterval(checkAndSendTenant, 3000);
}

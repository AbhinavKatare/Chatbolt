import { Router, Request, Response } from 'express'
import { queryOne } from '../db'
import { Agent } from '../types'

const router = Router()

// GET /widget.js  — the script businesses paste on their site
router.get('/widget.js', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript')
  res.setHeader('Cache-Control', 'public, max-age=3600')

  const baseUrl = process.env.WIDGET_BASE_URL || 'https://your-api.com'

  res.send(`
(function() {
  var script = document.currentScript || (function() {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  var AGENT_ID = script.getAttribute('data-agent-id');
  var PRIMARY_COLOR = script.getAttribute('data-color') || '#B8FF00';
  var BASE_URL = '${baseUrl}';

  if (!AGENT_ID) { console.error('ChatAI: data-agent-id is required'); return; }

  var SESSION_KEY = 'chatai_session_' + AGENT_ID;
  var sessionId = localStorage.getItem(SESSION_KEY) || 'sess_' + Math.random().toString(36).slice(2);
  localStorage.setItem(SESSION_KEY, sessionId);

  var history = [];
  var isOpen = false;

  // ── Styles ──────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = \`
    #chatai-btn {
      position: fixed; bottom: 24px; right: 24px;
      width: 56px; height: 56px; border-radius: 50%;
      background: \` + PRIMARY_COLOR + \`; border: none;
      cursor: pointer; z-index: 999998;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      font-size: 22px;
    }
    #chatai-btn:hover { transform: scale(1.08); box-shadow: 0 12px 32px rgba(0,0,0,0.3); }
    #chatai-frame {
      position: fixed; bottom: 96px; right: 24px;
      width: 380px; height: 580px;
      border: none; border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.25);
      z-index: 999997; display: none;
      overflow: hidden;
      animation: chatai-slide-in 0.25s ease;
    }
    @keyframes chatai-slide-in {
      from { opacity: 0; transform: translateY(16px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @media (max-width: 480px) {
      #chatai-frame { width: calc(100vw - 16px); height: 70vh; right: 8px; bottom: 88px; }
    }
  \`;
  document.head.appendChild(style);

  // ── Toggle button ─────────────────────────────────────────
  var btn = document.createElement('button');
  btn.id = 'chatai-btn';
  btn.innerHTML = '\\uD83D\\uDCAC';
  btn.setAttribute('aria-label', 'Open chat');
  document.body.appendChild(btn);

  // ── iframe ────────────────────────────────────────────────
  var iframe = document.createElement('iframe');
  iframe.id = 'chatai-frame';
  iframe.src = BASE_URL + '/widget/' + AGENT_ID + '?session=' + sessionId + '&color=' + encodeURIComponent(PRIMARY_COLOR);
  iframe.title = 'Chat support';
  document.body.appendChild(iframe);

  btn.addEventListener('click', function() {
    isOpen = !isOpen;
    iframe.style.display = isOpen ? 'block' : 'none';
    btn.innerHTML = isOpen ? '\\u2715' : '\\uD83D\\uDCAC';
  });
})();
`)
})

// GET /widget/:agentId  — the chat UI inside the iframe
router.get('/widget/:agentId', async (req: Request, res: Response) => {
  const agent = await queryOne<Agent>(
    'SELECT * FROM agents WHERE id = $1 AND is_active = true',
    [req.params.agentId]
  )

  if (!agent) {
    return res.status(404).send('<p>Agent not found</p>')
  }

  const wc = agent.widget_config as any
  const color = req.query.color as string || wc?.primaryColor || '#B8FF00'
  const sessionId = req.query.session as string || 'anon'
  const baseUrl = process.env.WIDGET_BASE_URL || ''
  const welcome = wc?.welcomeMessage || 'Hi! How can I help you today?'

  res.setHeader('Content-Type', 'text/html')
  res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chat</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f0f; color: #fff; height: 100vh; display: flex; flex-direction: column; }
  #header { padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; gap: 10px; background: #111; }
  #header .dot { width: 8px; height: 8px; border-radius: 50%; background: ${color}; }
  #header .title { font-weight: 600; font-size: 14px; }
  #header .sub { font-size: 11px; color: #666; }
  #messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
  #messages::-webkit-scrollbar { width: 4px; }
  #messages::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
  .msg { max-width: 82%; display: flex; flex-direction: column; gap: 4px; }
  .msg.user { align-self: flex-end; }
  .msg.bot { align-self: flex-start; }
  .bubble { padding: 10px 14px; border-radius: 18px; font-size: 13px; line-height: 1.5; }
  .msg.user .bubble { background: ${color}; color: #0a0a0a; border-radius: 18px 18px 4px 18px; }
  .msg.bot .bubble { background: rgba(255,255,255,0.07); color: #ddd; border-radius: 18px 18px 18px 4px; }
  .msg .time { font-size: 10px; color: #444; padding: 0 4px; }
  .typing span { display: inline-block; width: 6px; height: 6px; background: #555; border-radius: 50%; animation: blink 1.2s infinite; }
  .typing span:nth-child(2) { animation-delay: 0.2s; }
  .typing span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes blink { 0%,80%,100% { opacity: 0.2; } 40% { opacity: 1; } }
  #input-row { padding: 12px; border-top: 1px solid rgba(255,255,255,0.06); display: flex; gap: 8px; background: #111; }
  #input { flex: 1; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 10px 14px; color: #fff; font-size: 13px; outline: none; resize: none; height: 40px; max-height: 100px; }
  #input:focus { border-color: ${color}44; }
  #send { width: 40px; height: 40px; border-radius: 10px; background: ${color}; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: opacity 0.15s; }
  #send:disabled { opacity: 0.4; cursor: not-allowed; }
  #send svg { width: 16px; height: 16px; }
  .escalate-banner { background: rgba(255,180,0,0.1); border: 1px solid rgba(255,180,0,0.25); border-radius: 10px; padding: 10px 14px; font-size: 12px; color: #ffb400; }
</style>
</head>
<body>
<div id="header">
  <div class="dot"></div>
  <div>
    <div class="title">${agent.name}</div>
    <div class="sub">Online · Replies instantly</div>
  </div>
</div>
<div id="messages">
  <div class="msg bot">
    <div class="bubble">${welcome}</div>
    <div class="time">now</div>
  </div>
</div>
<div id="input-row">
  <textarea id="input" placeholder="Type a message…" rows="1"></textarea>
  <button id="send">
    <svg viewBox="0 0 16 16" fill="none">
      <path d="M2 8l12-6-5 6 5 6-12-6z" fill="#0a0a0a"/>
    </svg>
  </button>
</div>
<script>
var AGENT_ID = '${agent.id}';
var SESSION_ID = '${sessionId}';
var BASE_URL = '${baseUrl}';
var history = [];
var sending = false;

var messagesEl = document.getElementById('messages');
var inputEl = document.getElementById('input');
var sendBtn = document.getElementById('send');

function time() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function addMessage(role, content) {
  var div = document.createElement('div');
  div.className = 'msg ' + (role === 'user' ? 'user' : 'bot');
  div.innerHTML = '<div class="bubble">' + content.replace(/\\n/g, '<br>') + '</div><div class="time">' + time() + '</div>';
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

function addTyping() {
  var div = document.createElement('div');
  div.className = 'msg bot';
  div.id = 'typing';
  div.innerHTML = '<div class="bubble typing"><span></span><span></span><span></span></div>';
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function removeTyping() {
  var t = document.getElementById('typing');
  if (t) t.remove();
}

async function send() {
  var msg = inputEl.value.trim();
  if (!msg || sending) return;
  sending = true;
  sendBtn.disabled = true;
  inputEl.value = '';
  inputEl.style.height = '40px';

  addMessage('user', msg);
  addTyping();

  history.push({ role: 'user', content: msg });

  try {
    var response = await fetch(BASE_URL + '/chat/' + AGENT_ID + '/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': '' },
      body: JSON.stringify({ message: msg, session_id: SESSION_ID, history: history.slice(-10) })
    });

    removeTyping();

    var botDiv = addMessage('bot', '');
    var bubble = botDiv.querySelector('.bubble');
    var fullText = '';

    var reader = response.body.getReader();
    var decoder = new TextDecoder();

    while (true) {
      var result = await reader.read();
      if (result.done) break;
      var lines = decoder.decode(result.value).split('\\n');
      for (var line of lines) {
        if (!line.startsWith('data: ')) continue;
        var data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;
        try {
          var parsed = JSON.parse(data);
          if (parsed.type === 'delta') {
            fullText += parsed.delta;
            bubble.textContent = fullText;
            messagesEl.scrollTop = messagesEl.scrollHeight;
          } else if (parsed.type === 'done') {
            history.push({ role: 'assistant', content: fullText });
          } else if (parsed.type === 'sources' && parsed.escalate) {
            var banner = document.createElement('div');
            banner.className = 'escalate-banner';
            banner.textContent = '⚠️ Connecting you with a human agent…';
            messagesEl.appendChild(banner);
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }
        } catch(e) {}
      }
    }
  } catch(err) {
    removeTyping();
    addMessage('bot', 'Sorry, something went wrong. Please try again.');
  }

  sending = false;
  sendBtn.disabled = false;
  inputEl.focus();
}

sendBtn.addEventListener('click', send);
inputEl.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
});
inputEl.addEventListener('input', function() {
  this.style.height = '40px';
  this.style.height = Math.min(this.scrollHeight, 100) + 'px';
});
</script>
</body>
</html>`)
})

export default router

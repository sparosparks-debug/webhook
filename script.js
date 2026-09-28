/**
 * ChatGPT Style UI - n8n AI Assistant
 * Complete Client-Side Controller
 */

// Configuration Constants
const STORAGE_KEYS = {
  CHATS: 'chatgpt_n8n_chats_v1',
  ACTIVE_ID: 'chatgpt_n8n_active_chat_id',
  SETTINGS: 'chatgpt_n8n_settings_v1',
  THEME: 'chatgpt_n8n_theme'
};

const DEFAULT_CONFIG = {
  webhookUrl: 'https://velshabha.app.n8n.cloud/webhook/chat',
  payloadKey: 'chatInput',
  connectionMode: 'auto' // 'auto' | 'direct' | 'proxy'
};

// Application State
const state = {
  chats: [],
  currentChatId: null,
  isGenerating: false,
  abortController: null,
  currentUtterance: null,
  speechRecognition: null,
  isRecordingVoice: false,
  config: { ...DEFAULT_CONFIG }
};

// DOM Elements
const DOM = {
  body: document.body,
  sidebar: document.getElementById('sidebar'),
  sidebarOverlay: document.getElementById('sidebarOverlay'),
  sidebarOpenBtn: document.getElementById('sidebarOpenBtn'),
  sidebarCloseBtn: document.getElementById('sidebarCloseBtn'),
  newChatBtn: document.getElementById('newChatBtn'),
  mobileNewChatBtn: document.getElementById('mobileNewChatBtn'),
  searchChatInput: document.getElementById('searchChatInput'),
  chatHistoryList: document.getElementById('chatHistoryList'),
  connectionStatusPill: document.getElementById('connectionStatusPill'),
  openSettingsBtn: document.getElementById('openSettingsBtn'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  themeToggleLabel: document.getElementById('themeToggleLabel'),
  clearChatBtn: document.getElementById('clearChatBtn'),
  exportChatBtn: document.getElementById('exportChatBtn'),
  chatContainer: document.getElementById('chatContainer'),
  welcomeScreen: document.getElementById('welcomeScreen'),
  messagesList: document.getElementById('messagesList'),
  scrollBottomBtn: document.getElementById('scrollBottomBtn'),
  chatForm: document.getElementById('chatForm'),
  messageInput: document.getElementById('messageInput'),
  sendBtn: document.getElementById('sendBtn'),
  micBtn: document.getElementById('micBtn'),
  attachBtn: document.getElementById('attachBtn'),
  settingsModal: document.getElementById('settingsModal'),
  closeSettingsBtn: document.getElementById('closeSettingsBtn'),
  webhookUrlInput: document.getElementById('webhookUrlInput'),
  payloadKeyInput: document.getElementById('payloadKeyInput'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  resetDefaultsBtn: document.getElementById('resetDefaultsBtn'),
  testWebhookBtn: document.getElementById('testWebhookBtn'),
  testSpinner: document.getElementById('testSpinner'),
  testBtnLabel: document.getElementById('testBtnLabel'),
  testResultMsg: document.getElementById('testResultMsg'),
  toastContainer: document.getElementById('toastContainer')
};

// Initialize Marked Options
if (window.marked) {
  marked.setOptions({
    gfm: true,
    breaks: true,
    headerIds: false,
    mangle: false
  });
}

/* ===================================================================
   INITIALIZATION
   =================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  initTheme();
  loadChats();
  setupEventListeners();
  setupVoiceRecognition();
  autoResizeTextarea();
  checkInitialConnection();
});

/* ===================================================================
   SETTINGS & CONFIGURATION
   =================================================================== */
function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (saved) {
      state.config = { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn('Failed to parse settings from storage:', e);
  }

  DOM.webhookUrlInput.value = state.config.webhookUrl;
  DOM.payloadKeyInput.value = state.config.payloadKey;
  
  const radio = document.querySelector(`input[name="connectionMode"][value="${state.config.connectionMode}"]`);
  if (radio) radio.checked = true;
}

function saveSettings() {
  const url = DOM.webhookUrlInput.value.trim();
  const key = DOM.payloadKeyInput.value.trim() || 'chatInput';
  const modeElem = document.querySelector('input[name="connectionMode"]:checked');
  const mode = modeElem ? modeElem.value : 'auto';

  if (!url) {
    showToast('Please provide a valid webhook URL', 'error');
    return;
  }

  state.config = {
    webhookUrl: url,
    payloadKey: key,
    connectionMode: mode
  };

  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(state.config));
  closeSettings();
  showToast('Settings saved successfully');
  checkInitialConnection();
}

function resetSettings() {
  state.config = { ...DEFAULT_CONFIG };
  DOM.webhookUrlInput.value = DEFAULT_CONFIG.webhookUrl;
  DOM.payloadKeyInput.value = DEFAULT_CONFIG.payloadKey;
  const radio = document.querySelector(`input[name="connectionMode"][value="${DEFAULT_CONFIG.connectionMode}"]`);
  if (radio) radio.checked = true;
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(state.config));
  showToast('Reset to default settings');
}

function openSettings() {
  DOM.webhookUrlInput.value = state.config.webhookUrl;
  DOM.payloadKeyInput.value = state.config.payloadKey;
  DOM.testResultMsg.textContent = '';
  DOM.testResultMsg.className = 'test-result';
  DOM.settingsModal.classList.add('open');
}

function closeSettings() {
  DOM.settingsModal.classList.remove('open');
}

/* ===================================================================
   THEME TOGGLING (DARK / LIGHT)
   =================================================================== */
function initTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
  applyTheme(savedTheme);
}

function toggleTheme() {
  const current = DOM.body.classList.contains('light-theme') ? 'light' : 'dark';
  const newTheme = current === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
}

function applyTheme(theme) {
  if (theme === 'light') {
    DOM.body.classList.remove('dark-theme');
    DOM.body.classList.add('light-theme');
    DOM.themeToggleLabel.textContent = 'Dark mode';
    const hljsTheme = document.getElementById('hljs-theme');
    if (hljsTheme) hljsTheme.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';
  } else {
    DOM.body.classList.remove('light-theme');
    DOM.body.classList.add('dark-theme');
    DOM.themeToggleLabel.textContent = 'Light mode';
    const hljsTheme = document.getElementById('hljs-theme');
    if (hljsTheme) hljsTheme.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css';
  }
  localStorage.setItem(STORAGE_KEYS.THEME, theme);
}

/* ===================================================================
   CHAT STORAGE & SESSIONS
   =================================================================== */
function loadChats() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.CHATS);
    state.chats = saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error('Error loading chats:', e);
    state.chats = [];
  }

  const savedActiveId = localStorage.getItem(STORAGE_KEYS.ACTIVE_ID);
  if (savedActiveId && state.chats.some(c => c.id === savedActiveId)) {
    state.currentChatId = savedActiveId;
  } else if (state.chats.length > 0) {
    state.currentChatId = state.chats[0].id;
  } else {
    createNewChat(false);
  }

  renderChatHistory();
  renderCurrentChat();
}

function saveChats() {
  localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(state.chats));
  if (state.currentChatId) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, state.currentChatId);
  }
}

function createNewChat(shouldRender = true) {
  if (state.isGenerating) stopGeneration();

  const newChat = {
    id: 'chat_' + Date.now(),
    title: 'New chat',
    createdAt: Date.now(),
    messages: []
  };

  state.chats.unshift(newChat);
  state.currentChatId = newChat.id;
  saveChats();

  if (shouldRender) {
    renderChatHistory();
    renderCurrentChat();
    DOM.messageInput.focus();
  }

  // Auto close sidebar on mobile if open
  closeSidebar();
}

function getCurrentChat() {
  return state.chats.find(c => c.id === state.currentChatId);
}

function deleteChat(id, e) {
  if (e) e.stopPropagation();
  
  state.chats = state.chats.filter(c => c.id !== id);
  if (state.currentChatId === id) {
    state.currentChatId = state.chats.length > 0 ? state.chats[0].id : null;
  }
  
  if (!state.currentChatId) {
    createNewChat(false);
  }
  
  saveChats();
  renderChatHistory();
  renderCurrentChat();
  showToast('Chat deleted');
}

function renameChat(id, e) {
  if (e) e.stopPropagation();
  const chat = state.chats.find(c => c.id === id);
  if (!chat) return;

  const currentTitle = chat.title;
  const newTitle = prompt('Rename chat conversation:', currentTitle);
  if (newTitle && newTitle.trim() && newTitle.trim() !== currentTitle) {
    chat.title = newTitle.trim();
    saveChats();
    renderChatHistory();
  }
}

function clearCurrentChat() {
  const chat = getCurrentChat();
  if (!chat || chat.messages.length === 0) return;

  if (confirm('Are you sure you want to clear the messages in this chat?')) {
    chat.messages = [];
    saveChats();
    renderCurrentChat();
    showToast('Chat conversation cleared');
  }
}

/* ===================================================================
   EXPORT CHAT FUNCTIONALITY
   =================================================================== */
function exportCurrentChat() {
  const chat = getCurrentChat();
  if (!chat || chat.messages.length === 0) {
    showToast('No messages to export', 'error');
    return;
  }

  // Format as clean markdown
  let md = `# ${chat.title}\n*Exported on ${new Date().toLocaleString()}*\n\n---\n\n`;
  chat.messages.forEach(msg => {
    const role = msg.role === 'user' ? '🧑 User' : '🤖 n8n AI Assistant';
    md += `### ${role}\n\n${msg.content}\n\n---\n\n`;
  });

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${chat.title.toLowerCase().replace(/[^a-z0-9]/gi, '_')}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('Chat exported as Markdown');
}

/* ===================================================================
   RENDERING UI
   =================================================================== */
function renderChatHistory(filterText = '') {
  DOM.chatHistoryList.innerHTML = '';

  const filtered = state.chats.filter(c => 
    !filterText || c.title.toLowerCase().includes(filterText.toLowerCase())
  );

  if (filtered.length === 0) {
    DOM.chatHistoryList.innerHTML = `
      <div style="padding: 16px; font-size: 13px; color: var(--text-muted); text-align: center;">
        No conversations found
      </div>
    `;
    return;
  }

  // Group chats by date
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const sevenDaysAgo = today - (7 * 86400000);

  const groups = {
    today: [],
    yesterday: [],
    previous7Days: [],
    older: []
  };

  filtered.forEach(chat => {
    const created = chat.createdAt || 0;
    if (created >= today) groups.today.push(chat);
    else if (created >= yesterday) groups.yesterday.push(chat);
    else if (created >= sevenDaysAgo) groups.previous7Days.push(chat);
    else groups.older.push(chat);
  });

  const groupLabels = [
    { key: 'today', title: 'Today' },
    { key: 'yesterday', title: 'Yesterday' },
    { key: 'previous7Days', title: 'Previous 7 Days' },
    { key: 'older', title: 'Older' }
  ];

  groupLabels.forEach(({ key, title }) => {
    if (groups[key].length > 0) {
      const groupEl = document.createElement('div');
      groupEl.className = 'history-group';
      
      const titleEl = document.createElement('div');
      titleEl.className = 'history-group-title';
      titleEl.textContent = title;
      groupEl.appendChild(titleEl);

      const itemsEl = document.createElement('div');
      itemsEl.className = 'chat-history-items';

      groups[key].forEach(chat => {
        const item = document.createElement('div');
        item.className = `chat-item ${chat.id === state.currentChatId ? 'active' : ''}`;
        item.onclick = () => switchChat(chat.id);

        item.innerHTML = `
          <div class="chat-item-title" title="${escapeHtml(chat.title)}">${escapeHtml(chat.title)}</div>
          <div class="chat-item-actions">
            <button class="chat-action-btn edit-btn" title="Rename" onclick="renameChat('${chat.id}', event)">
              <svg class="icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
            </button>
            <button class="chat-action-btn delete-btn" title="Delete" onclick="deleteChat('${chat.id}', event)">
              <svg class="icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        `;
        itemsEl.appendChild(item);
      });

      groupEl.appendChild(itemsEl);
      DOM.chatHistoryList.appendChild(groupEl);
    }
  });
}

function switchChat(chatId) {
  if (state.currentChatId === chatId) return;
  if (state.isGenerating) stopGeneration();

  state.currentChatId = chatId;
  saveChats();
  renderChatHistory();
  renderCurrentChat();
  closeSidebar();
}

function renderCurrentChat() {
  const chat = getCurrentChat();
  DOM.messagesList.innerHTML = '';

  if (!chat || chat.messages.length === 0) {
    DOM.welcomeScreen.style.display = 'flex';
    DOM.messagesList.style.display = 'none';
  } else {
    DOM.welcomeScreen.style.display = 'none';
    DOM.messagesList.style.display = 'flex';
    chat.messages.forEach((msg, idx) => {
      appendMessageToDOM(msg.role, msg.content, idx);
    });
  }

  scrollToBottom();
}

/* ===================================================================
   MESSAGE ELEMENT CREATION & MARKDOWN PARSING
   =================================================================== */
function appendMessageToDOM(role, content, index) {
  const row = document.createElement('div');
  row.className = `message-row ${role}`;
  row.id = `msg-${index}`;

  if (role === 'user') {
    row.innerHTML = `
      <div class="message-bubble">${escapeHtml(content)}</div>
    `;
  } else {
    const rawParsed = parseMarkdown(content);
    row.innerHTML = `
      <div class="bot-avatar">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.28 9.94a5.99 5.99 0 0 0-.52-4.93 6.07 6.07 0 0 0-6.61-2.9 6.02 6.02 0 0 0-4.63-2.07c-2.82 0-5.22 1.95-5.83 4.67a6.04 6.04 0 0 0-4.14 2.99 6.06 6.06 0 0 0 .74 7.22 6.01 6.01 0 0 0 .52 4.93 6.07 6.07 0 0 0 6.61 2.9 6.03 6.03 0 0 0 4.63 2.07c2.82 0 5.22-1.95 5.83-4.67a6.04 6.04 0 0 0 4.14-2.99 6.06 6.06 0 0 0-.74-7.22zm-8.8 11.02a4.52 4.52 0 0 1-3.04-1.18l.15-.08 5.03-2.9a.78.78 0 0 0 .39-.68v-7.1l2.13 1.23a.1.1 0 0 1 .05.08v5.82a4.54 4.54 0 0 1-4.71 4.81zm-9.04-4.2a4.52 4.52 0 0 1-.5-3.22l.15.09 5.03 2.9a.78.78 0 0 0 .78 0l6.15-3.55v2.46a.1.1 0 0 1-.04.09l-5.04 2.91a4.54 4.54 0 0 1-6.53-1.68zm-1.5-9.35a4.52 4.52 0 0 1 2.54-2.04v5.98a.78.78 0 0 0 .39.68l6.15 3.55-2.13 1.23a.1.1 0 0 1-.1 0l-5.04-2.91a4.54 4.54 0 0 1-1.81-6.49zm14.88 4.79l-6.15-3.55 2.13-1.23a.1.1 0 0 1 .1 0l5.04 2.91a4.54 4.54 0 0 1 1.81 6.49 4.52 4.52 0 0 1-2.54 2.04v-5.98a.78.78 0 0 0-.39-.68zm3.5-3.32a4.52 4.52 0 0 1 .5 3.22l-.15-.09-5.03-2.9a.78.78 0 0 0-.78 0l-6.15 3.55V9.45a.1.1 0 0 1 .04-.09l5.04-2.91a4.54 4.54 0 0 1 6.53 1.68zM8.9 12.87l2.6-1.5 2.6 1.5v3l-2.6 1.5-2.6-1.5v-3z"/>
        </svg>
      </div>
      <div class="message-content-wrapper">
        <div class="message-text">${rawParsed}</div>
        <div class="message-actions-bar">
          <button class="msg-action-btn copy-msg-btn" title="Copy text" data-idx="${index}">
            <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
          <button class="msg-action-btn speak-msg-btn" title="Read aloud" data-idx="${index}">
            <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            </svg>
          </button>
          <button class="msg-action-btn thumbs-up-btn" title="Good response">
            <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
            </svg>
          </button>
          <button class="msg-action-btn regenerate-btn" title="Regenerate response" data-idx="${index}">
            <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="1 4 1 10 7 10"></polyline>
              <polyline points="23 20 23 14 17 14"></polyline>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
            </svg>
          </button>
        </div>
      </div>
    `;

    // Enhance code blocks and syntax
    enhanceCodeBlocks(row);
    attachMessageRowEvents(row, content);
  }

  DOM.messagesList.appendChild(row);
  return row;
}

function parseMarkdown(text) {
  if (!text) return '';
  let html = '';
  if (window.marked) {
    html = marked.parse(text);
  } else {
    html = escapeHtml(text).replace(/\n/g, '<br>');
  }

  if (window.DOMPurify) {
    html = DOMPurify.sanitize(html, {
      ADD_TAGS: ['iframe'],
      ADD_ATTR: ['target']
    });
  }
  return html;
}

function enhanceCodeBlocks(container) {
  const preBlocks = container.querySelectorAll('pre');
  preBlocks.forEach(pre => {
    // Check if code block container already added
    if (pre.parentElement.classList.contains('code-block-container')) return;

    const code = pre.querySelector('code');
    let lang = 'code';
    if (code) {
      const match = code.className.match(/language-([a-z0-9_-]+)/i);
      if (match) lang = match[1];

      // Syntax highlight
      if (window.hljs) {
        hljs.highlightElement(code);
      }
    }

    // Wrap with ChatGPT style header bar
    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-container';

    const header = document.createElement('div');
    header.className = 'code-header';
    header.innerHTML = `
      <span class="code-lang">${lang}</span>
      <button class="copy-code-btn" type="button">
        <svg class="icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span>Copy code</span>
      </button>
    `;

    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(header);
    wrapper.appendChild(pre);

    const copyBtn = header.querySelector('.copy-code-btn');
    copyBtn.addEventListener('click', () => {
      const textToCopy = code ? code.innerText : pre.innerText;
      copyToClipboard(textToCopy);
      copyBtn.innerHTML = `
        <svg class="icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Copied!</span>
      `;
      setTimeout(() => {
        copyBtn.innerHTML = `
          <svg class="icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Copy code</span>
        `;
      }, 2000);
    });
  });
}

function attachMessageRowEvents(row, rawContent) {
  const copyBtn = row.querySelector('.copy-msg-btn');
  if (copyBtn) {
    copyBtn.onclick = () => {
      copyToClipboard(rawContent);
      showToast('Response copied to clipboard');
    };
  }

  const speakBtn = row.querySelector('.speak-msg-btn');
  if (speakBtn) {
    speakBtn.onclick = () => toggleSpeech(rawContent, speakBtn);
  }

  const thumbsBtn = row.querySelector('.thumbs-up-btn');
  if (thumbsBtn) {
    thumbsBtn.onclick = () => {
      thumbsBtn.classList.toggle('active');
      showToast(thumbsBtn.classList.contains('active') ? 'Feedback recorded!' : 'Feedback removed');
    };
  }

  const regenBtn = row.querySelector('.regenerate-btn');
  if (regenBtn) {
    regenBtn.onclick = () => regenerateLastPrompt();
  }
}

/* ===================================================================
   WEBHOOK COMMUNICATION (N8N INTEGRATION)
   =================================================================== */
async function sendMessage(text) {
  const trimmed = text.trim();
  if (!trimmed || state.isGenerating) return;

  const chat = getCurrentChat();
  if (!chat) return;

  // Add User Message
  chat.messages.push({
    role: 'user',
    content: trimmed,
    timestamp: Date.now()
  });

  // If first user message, generate title from prompt
  if (chat.messages.length === 1 || chat.title === 'New chat') {
    chat.title = trimmed.length > 32 ? trimmed.substring(0, 32) + '...' : trimmed;
  }

  saveChats();
  renderChatHistory();

  // Update UI
  DOM.welcomeScreen.style.display = 'none';
  DOM.messagesList.style.display = 'flex';
  appendMessageToDOM('user', trimmed, chat.messages.length - 1);
  DOM.messageInput.value = '';
  autoResizeTextarea();
  scrollToBottom();

  // Create Bot Placeholder with Thinking Pulse
  const botMsgIndex = chat.messages.length;
  const botRow = document.createElement('div');
  botRow.className = 'message-row assistant';
  botRow.id = `msg-${botMsgIndex}`;
  botRow.innerHTML = `
    <div class="bot-avatar">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.28 9.94a5.99 5.99 0 0 0-.52-4.93 6.07 6.07 0 0 0-6.61-2.9 6.02 6.02 0 0 0-4.63-2.07c-2.82 0-5.22 1.95-5.83 4.67a6.04 6.04 0 0 0-4.14 2.99 6.06 6.06 0 0 0 .74 7.22 6.01 6.01 0 0 0 .52 4.93 6.07 6.07 0 0 0 6.61 2.9 6.03 6.03 0 0 0 4.63 2.07c2.82 0 5.22-1.95 5.83-4.67a6.04 6.04 0 0 0 4.14-2.99 6.06 6.06 0 0 0-.74-7.22zm-8.8 11.02a4.52 4.52 0 0 1-3.04-1.18l.15-.08 5.03-2.9a.78.78 0 0 0 .39-.68v-7.1l2.13 1.23a.1.1 0 0 1 .05.08v5.82a4.54 4.54 0 0 1-4.71 4.81zm-9.04-4.2a4.52 4.52 0 0 1-.5-3.22l.15.09 5.03 2.9a.78.78 0 0 0 .78 0l6.15-3.55v2.46a.1.1 0 0 1-.04.09l-5.04 2.91a4.54 4.54 0 0 1-6.53-1.68zm-1.5-9.35a4.52 4.52 0 0 1 2.54-2.04v5.98a.78.78 0 0 0 .39.68l6.15 3.55-2.13 1.23a.1.1 0 0 1-.1 0l-5.04-2.91a4.54 4.54 0 0 1-1.81-6.49zm14.88 4.79l-6.15-3.55 2.13-1.23a.1.1 0 0 1 .1 0l5.04 2.91a4.54 4.54 0 0 1 1.81 6.49 4.52 4.52 0 0 1-2.54 2.04v-5.98a.78.78 0 0 0-.39-.68zm3.5-3.32a4.52 4.52 0 0 1 .5 3.22l-.15-.09-5.03-2.9a.78.78 0 0 0-.78 0l-6.15 3.55V9.45a.1.1 0 0 1 .04-.09l5.04-2.91a4.54 4.54 0 0 1 6.53 1.68zM8.9 12.87l2.6-1.5 2.6 1.5v3l-2.6 1.5-2.6-1.5v-3z"/>
      </svg>
    </div>
    <div class="message-content-wrapper">
      <div class="message-text">
        <div class="thinking-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>
  `;
  DOM.messagesList.appendChild(botRow);
  scrollToBottom();

  // Set Generating state
  setGenerating(true);
  state.abortController = new AbortController();

  try {
    const rawReply = await callWebhookEndpoint(trimmed, state.abortController.signal);
    
    // Check if generation was aborted
    if (!state.isGenerating) return;

    // Save Bot Reply
    chat.messages.push({
      role: 'assistant',
      content: rawReply,
      timestamp: Date.now()
    });
    saveChats();

    // Stream / Typewriter output for authentic ChatGPT feel
    await streamAssistantResponse(botRow, rawReply, botMsgIndex);

  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('Request was cancelled by user');
      botRow.remove();
    } else {
      console.error('Webhook error:', err);
      displayErrorMessage(botRow, err, trimmed);
    }
  } finally {
    setGenerating(false);
    state.abortController = null;
  }
}

async function callWebhookEndpoint(promptText, signal) {
  const payload = {
    [state.config.payloadKey || 'chatInput']: promptText
  };

  const isLocalOrigin = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  let targetUrl = state.config.webhookUrl;

  // Determine endpoint based on connectionMode
  if (state.config.connectionMode === 'proxy' || (state.config.connectionMode === 'auto' && isLocalOrigin && window.location.pathname !== '/index.html' && window.location.port)) {
    // Try proxy route first if running via server.js
    targetUrl = '/api/chat';
  }

  let response;
  try {
    response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*'
      },
      body: JSON.stringify(payload),
      signal
    });
  } catch (networkErr) {
    // If auto mode and direct fetch failed (likely CORS), try local proxy if available
    if (state.config.connectionMode === 'auto' && targetUrl !== '/api/chat') {
      try {
        console.warn('Direct fetch failed. Retrying through local proxy /api/chat...');
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal
        });
      } catch (proxyErr) {
        throw networkErr; // Throw original error
      }
    } else {
      throw networkErr;
    }
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Webhook returned HTTP ${response.status}: ${errorText || response.statusText}`);
  }

  const rawContentType = response.headers.get('content-type') || '';
  const responseText = await response.text();

  // Intelligent parser for n8n formats
  return parseN8nResponse(responseText, rawContentType);
}

function parseN8nResponse(rawText, contentType) {
  if (!rawText) return 'No response received from workflow.';

  // Attempt JSON parsing if content looks like JSON
  if (contentType.includes('application/json') || rawText.trim().startsWith('{') || rawText.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(rawText);

      // 1. Direct string keys often produced by n8n LLM chains
      if (typeof parsed === 'string') return parsed;
      if (typeof parsed.text === 'string') return parsed.text;
      if (typeof parsed.output === 'string') return parsed.output;
      if (typeof parsed.response === 'string') return parsed.response;
      if (typeof parsed.message === 'string') return parsed.message;
      if (typeof parsed.content === 'string') return parsed.content;
      if (typeof parsed.data === 'string') return parsed.data;

      // 2. If it's an array of items [{ text: "..." }]
      if (Array.isArray(parsed) && parsed.length > 0) {
        const first = parsed[0];
        if (typeof first === 'string') return first;
        if (first.text) return first.text;
        if (first.output) return first.output;
        if (first.response) return first.response;
        if (first.message) return first.message;
        return JSON.stringify(first, null, 2);
      }

      // 3. Fallback: formatted JSON string
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      // If JSON parse fails, return the raw text as markdown
      return rawText;
    }
  }

  // Plain markdown / text response
  return rawText;
}

/* ===================================================================
   STREAMING & TYPEWRITER EFFECT
   =================================================================== */
async function streamAssistantResponse(botRow, fullText, msgIndex) {
  const contentWrapper = botRow.querySelector('.message-content-wrapper');
  const textContainer = botRow.querySelector('.message-text');

  // Clear thinking indicator
  textContainer.innerHTML = '';

  // Stream in small word chunks for smooth typing effect
  const words = fullText.split(/(\s+)/);
  let currentBuffer = '';

  // Speed calculation: max 2.5 seconds total stream duration
  const delayMs = Math.max(8, Math.min(25, 2000 / words.length));

  for (let i = 0; i < words.length; i++) {
    if (!state.isGenerating) break; // Check if stopped
    currentBuffer += words[i];

    // Every 4 words or on punctuation, re-render markdown
    if (i % 4 === 0 || i === words.length - 1) {
      textContainer.innerHTML = parseMarkdown(currentBuffer);
      enhanceCodeBlocks(botRow);
      scrollToBottom();
    }

    await sleep(delayMs);
  }

  // Final complete render with actions bar
  textContainer.innerHTML = parseMarkdown(fullText);
  enhanceCodeBlocks(botRow);

  const actionsBar = document.createElement('div');
  actionsBar.className = 'message-actions-bar';
  actionsBar.innerHTML = `
    <button class="msg-action-btn copy-msg-btn" title="Copy text" data-idx="${msgIndex}">
      <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    </button>
    <button class="msg-action-btn speak-msg-btn" title="Read aloud" data-idx="${msgIndex}">
      <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
      </svg>
    </button>
    <button class="msg-action-btn thumbs-up-btn" title="Good response">
      <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
      </svg>
    </button>
    <button class="msg-action-btn regenerate-btn" title="Regenerate response" data-idx="${msgIndex}">
      <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="1 4 1 10 7 10"></polyline>
        <polyline points="23 20 23 14 17 14"></polyline>
        <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
      </svg>
    </button>
  `;

  contentWrapper.appendChild(actionsBar);
  attachMessageRowEvents(botRow, fullText);
  scrollToBottom();
}

/* ===================================================================
   ERROR DISPLAY & RETRY
   =================================================================== */
function displayErrorMessage(botRow, error, retryPrompt) {
  const contentWrapper = botRow.querySelector('.message-content-wrapper');
  
  const isCorsOrNetwork = error.message.includes('Failed to fetch') || error.message.includes('NetworkError');

  contentWrapper.innerHTML = `
    <div class="error-card">
      <div class="error-header">
        <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span>Error Connecting to n8n Webhook</span>
      </div>
      <p>${escapeHtml(error.message)}</p>
      ${isCorsOrNetwork ? `
        <p style="font-size:12px; color: var(--text-secondary); margin-top:2px;">
          <strong>Tip:</strong> If you are opening index.html directly from your file system, browser CORS blocks webhooks. 
          Run <code>node server.js</code> in terminal or add <code>Access-Control-Allow-Origin: *</code> to the n8n "Respond to Webhook" node.
        </p>
      ` : ''}
      <div class="error-actions">
        <button class="error-retry-btn" id="retryLastBtn">Try Again</button>
        <button class="error-hint-btn" onclick="openSettings()">Webhook Settings</button>
      </div>
    </div>
  `;

  const retryBtn = contentWrapper.querySelector('#retryLastBtn');
  if (retryBtn) {
    retryBtn.onclick = () => {
      botRow.remove();
      sendMessage(retryPrompt);
    };
  }
}

function regenerateLastPrompt() {
  const chat = getCurrentChat();
  if (!chat || chat.messages.length === 0) return;

  // Find the last user message
  let lastUserMsg = null;
  for (let i = chat.messages.length - 1; i >= 0; i--) {
    if (chat.messages[i].role === 'user') {
      lastUserMsg = chat.messages[i].content;
      break;
    }
  }

  if (lastUserMsg) {
    sendMessage(lastUserMsg);
  }
}

function stopGeneration() {
  if (state.abortController) {
    state.abortController.abort();
  }
  setGenerating(false);
  showToast('Generation stopped');
}

function setGenerating(isGen) {
  state.isGenerating = isGen;
  if (isGen) {
    DOM.sendBtn.classList.add('generating');
    DOM.sendBtn.disabled = false;
    DOM.sendBtn.title = 'Stop generation';
  } else {
    DOM.sendBtn.classList.remove('generating');
    DOM.sendBtn.title = 'Send message';
    DOM.sendBtn.disabled = !DOM.messageInput.value.trim();
  }
}

/* ===================================================================
   CONNECTION HEALTH CHECK & TESTING
   =================================================================== */
async function checkInitialConnection() {
  DOM.connectionStatusPill.className = 'connection-status-pill connecting';
  DOM.connectionStatusPill.querySelector('.status-label').textContent = 'Connecting...';

  try {
    const start = performance.now();
    // Test with OPTIONS or small POST
    const res = await fetch(state.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [state.config.payloadKey]: 'ping_healthcheck' })
    });

    const elapsed = Math.round(performance.now() - start);
    if (res.ok) {
      DOM.connectionStatusPill.className = 'connection-status-pill connected';
      DOM.connectionStatusPill.querySelector('.status-label').textContent = `n8n Online (${elapsed}ms)`;
    } else {
      DOM.connectionStatusPill.className = 'connection-status-pill error';
      DOM.connectionStatusPill.querySelector('.status-label').textContent = `n8n Error ${res.status}`;
    }
  } catch (e) {
    // Check if local proxy is active
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      try {
        const proxyCheck = await fetch('/api/health');
        if (proxyCheck.ok) {
          DOM.connectionStatusPill.className = 'connection-status-pill connected';
          DOM.connectionStatusPill.querySelector('.status-label').textContent = 'Proxy Active';
          return;
        }
      } catch (ignore) {}
    }
    DOM.connectionStatusPill.className = 'connection-status-pill error';
    DOM.connectionStatusPill.querySelector('.status-label').textContent = 'Disconnected';
  }
}

async function testConnectionInModal() {
  DOM.testSpinner.classList.add('active');
  DOM.testBtnLabel.textContent = 'Testing...';
  DOM.testResultMsg.textContent = '';
  DOM.testResultMsg.className = 'test-result';

  const testUrl = DOM.webhookUrlInput.value.trim();
  const testKey = DOM.payloadKeyInput.value.trim() || 'chatInput';

  const startTime = Date.now();
  try {
    const res = await fetch(testUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [testKey]: 'Test ping connection from Web UI' })
    });

    const duration = Date.now() - startTime;
    if (res.ok) {
      DOM.testResultMsg.className = 'test-result success';
      DOM.testResultMsg.textContent = `✓ Success! Connected in ${duration}ms`;
    } else {
      DOM.testResultMsg.className = 'test-result error';
      DOM.testResultMsg.textContent = `✗ HTTP Error ${res.status}: ${res.statusText}`;
    }
  } catch (err) {
    DOM.testResultMsg.className = 'test-result error';
    if (err.message.includes('Failed to fetch')) {
      DOM.testResultMsg.textContent = `✗ CORS or Network Error. Check browser console or use server.js.`;
    } else {
      DOM.testResultMsg.textContent = `✗ Failed: ${err.message}`;
    }
  } finally {
    DOM.testSpinner.classList.remove('active');
    DOM.testBtnLabel.textContent = 'Test Connection';
  }
}

/* ===================================================================
   VOICE INPUT (SPEECH-TO-TEXT) & AUDIO (TEXT-TO-SPEECH)
   =================================================================== */
function setupVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    DOM.micBtn.style.display = 'none';
    return;
  }

  state.speechRecognition = new SpeechRecognition();
  state.speechRecognition.continuous = false;
  state.speechRecognition.interimResults = true;
  state.speechRecognition.lang = 'en-US';

  state.speechRecognition.onstart = () => {
    state.isRecordingVoice = true;
    DOM.micBtn.classList.add('recording');
    showToast('Listening... Speak now');
  };

  state.speechRecognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    DOM.messageInput.value = transcript;
    autoResizeTextarea();
    DOM.sendBtn.disabled = !transcript.trim();
  };

  state.speechRecognition.onerror = (event) => {
    console.warn('Speech recognition error:', event.error);
    stopVoiceRecognition();
    showToast(`Speech error: ${event.error}`, 'error');
  };

  state.speechRecognition.onend = () => {
    stopVoiceRecognition();
  };
}

function toggleVoiceRecognition() {
  if (!state.speechRecognition) {
    showToast('Speech recognition not supported in this browser', 'error');
    return;
  }

  if (state.isRecordingVoice) {
    state.speechRecognition.stop();
    stopVoiceRecognition();
  } else {
    try {
      state.speechRecognition.start();
    } catch (e) {
      console.error(e);
    }
  }
}

function stopVoiceRecognition() {
  state.isRecordingVoice = false;
  DOM.micBtn.classList.remove('recording');
}

function toggleSpeech(text, btnElement) {
  if (!('speechSynthesis' in window)) {
    showToast('Speech synthesis not supported', 'error');
    return;
  }

  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    btnElement.classList.remove('active');
    return;
  }

  // Remove markdown symbols for clear speech
  const cleanText = text
    .replace(/[#*`_~\[\]()>-]/g, '')
    .replace(/<[^>]*>?/gm, '');

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  btnElement.classList.add('active');

  utterance.onend = () => {
    btnElement.classList.remove('active');
  };

  utterance.onerror = () => {
    btnElement.classList.remove('active');
  };

  window.speechSynthesis.speak(utterance);
}

/* ===================================================================
   EVENT LISTENERS
   =================================================================== */
function setupEventListeners() {
  // Sidebar Open / Close
  DOM.sidebarOpenBtn.addEventListener('click', toggleSidebar);
  DOM.sidebarCloseBtn.addEventListener('click', closeSidebar);
  DOM.sidebarOverlay.addEventListener('click', closeSidebar);

  // New Chat
  DOM.newChatBtn.addEventListener('click', () => createNewChat(true));
  DOM.mobileNewChatBtn.addEventListener('click', () => createNewChat(true));

  // Search Conversations
  DOM.searchChatInput.addEventListener('input', (e) => {
    renderChatHistory(e.target.value);
  });

  // Top Nav Actions
  DOM.clearChatBtn.addEventListener('click', clearCurrentChat);
  DOM.exportChatBtn.addEventListener('click', exportCurrentChat);

  // Theme Toggle
  DOM.themeToggleBtn.addEventListener('click', toggleTheme);

  // Settings Modal
  DOM.openSettingsBtn.addEventListener('click', openSettings);
  DOM.closeSettingsBtn.addEventListener('click', closeSettings);
  DOM.settingsModal.addEventListener('click', (e) => {
    if (e.target === DOM.settingsModal) closeSettings();
  });
  DOM.saveSettingsBtn.addEventListener('click', saveSettings);
  DOM.resetDefaultsBtn.addEventListener('click', resetSettings);
  DOM.testWebhookBtn.addEventListener('click', testConnectionInModal);

  // Form Submit & Stop Generation
  DOM.chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (state.isGenerating) {
      stopGeneration();
    } else {
      sendMessage(DOM.messageInput.value);
    }
  });

  // Textarea input auto-grow and keyboard shortcuts
  DOM.messageInput.addEventListener('input', () => {
    autoResizeTextarea();
    DOM.sendBtn.disabled = !DOM.messageInput.value.trim() && !state.isGenerating;
  });

  DOM.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!DOM.sendBtn.disabled && !state.isGenerating) {
        sendMessage(DOM.messageInput.value);
      }
    }
  });

  // Mic Button
  DOM.micBtn.addEventListener('click', toggleVoiceRecognition);

  // Attachment button (preview tooltip)
  DOM.attachBtn.addEventListener('click', () => {
    showToast('File attachment support ready for multi-modal n8n workflows!');
  });

  // Welcome prompt card clicks
  document.querySelectorAll('.prompt-card').forEach(card => {
    card.addEventListener('click', () => {
      const promptText = card.getAttribute('data-prompt');
      if (promptText) {
        DOM.messageInput.value = promptText;
        sendMessage(promptText);
      }
    });
  });

  // Scroll to bottom button
  DOM.chatContainer.addEventListener('scroll', handleChatScroll);
  DOM.scrollBottomBtn.addEventListener('click', () => {
    scrollToBottom(true);
  });
}

function toggleSidebar() {
  if (window.innerWidth <= 768) {
    DOM.sidebar.classList.toggle('mobile-open');
    DOM.sidebarOverlay.classList.toggle('active');
  } else {
    DOM.sidebar.classList.toggle('collapsed');
  }
}

function closeSidebar() {
  DOM.sidebar.classList.remove('mobile-open');
  DOM.sidebarOverlay.classList.remove('active');
}

function autoResizeTextarea() {
  const ta = DOM.messageInput;
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
}

function handleChatScroll() {
  const container = DOM.chatContainer;
  const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
  if (!isNearBottom && container.scrollTop > 200) {
    DOM.scrollBottomBtn.classList.add('visible');
  } else {
    DOM.scrollBottomBtn.classList.remove('visible');
  }
}

function scrollToBottom(smooth = false) {
  DOM.chatContainer.scrollTo({
    top: DOM.chatContainer.scrollHeight,
    behavior: smooth ? 'smooth' : 'auto'
  });
}

/* ===================================================================
   HELPERS & UTILITIES
   =================================================================== */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeHtml(string) {
  const div = document.createElement('div');
  div.innerText = string;
  return div.innerHTML;
}

function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text);
  } else {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Fallback copy error:', err);
    }
    document.body.removeChild(textArea);
  }
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-msg">${escapeHtml(message)}</span>
  `;
  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

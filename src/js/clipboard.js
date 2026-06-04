/* ═══════════════════════════════════════════════════════════════
   Clipboard Manager — Visual history of OS clipboard items.
   Entries are persisted to clipboard.db across sessions.
   ═══════════════════════════════════════════════════════════════ */

const ClipboardMgr = {
  history: [],
  maxItems: 50,
  initialized: false,

  async init() {
    if (this.initialized) return;
    this.initialized = true;

    // Load persisted clipboard entries from DB
    await this.loadHistory();

    // Listen for new clipboard entries from main process
    window.electronAPI.onClipboardEntry((entry) => {
      this.addEntry(entry);
    });
  },

  async loadHistory() {
    try {
      const entries = await window.electronAPI.getAllClipboardEntries();
      this.history = entries || [];
      this.updateBadge();
      this.render();
    } catch (e) {
      console.error('Failed to load clipboard history:', e);
      this.history = [];
      this.render();
    }
  },

  async addEntry(entry) {
    // Deduplicate — skip if same as most recent
    if (this.history.length > 0 && this.history[0].content === entry.content) return;

    // Save to DB
    try {
      const doc = await window.electronAPI.createClipboardEntry({
        type: entry.type,
        content: entry.content,
        timestamp: entry.timestamp || new Date().toISOString(),
      });
      this.history.unshift(doc);
    } catch (e) {
      console.error('Failed to save clipboard entry:', e);
      // Still add to in-memory list so it shows up this session
      this.history.unshift(entry);
    }

    // Enforce max items — trim oldest from DB
    while (this.history.length > this.maxItems) {
      const removed = this.history.pop();
      if (removed && removed._id) {
        window.electronAPI.deleteClipboardEntry(removed._id).catch(() => {});
      }
    }

    // Re-render if clipboard view is active
    if (App.currentView === 'clipboard') {
      this.render();
    }

    // Update badge count
    this.updateBadge();
  },

  render() {
    const grid = document.getElementById('clipboard-grid');
    const empty = document.getElementById('clipboard-empty');

    grid.innerHTML = '';

    if (this.history.length === 0) {
      empty.classList.add('visible');
      grid.style.display = 'none';
      return;
    }

    empty.classList.remove('visible');
    grid.style.display = '';

    this.history.forEach((item, i) => {
      grid.appendChild(this.createCard(item, i));
    });
  },

  createCard(item, index) {
    const card = document.createElement('div');
    card.className = 'clip-card';
    card.style.animationDelay = `${index * 0.03}s`;

    // Time
    const time = document.createElement('div');
    time.className = 'clip-card-time';
    time.textContent = this.formatTime(item.timestamp);
    card.appendChild(time);

    // Content
    if (item.type === 'image') {
      const img = document.createElement('img');
      img.className = 'clip-card-img';
      img.src = item.content;
      card.appendChild(img);
    } else {
      const text = document.createElement('div');
      text.className = 'clip-card-text';
      text.textContent = item.content.substring(0, 300);
      if (item.content.length > 300) text.textContent += '…';
      card.appendChild(text);
    }

    // Actions
    const actions = document.createElement('div');
    actions.className = 'clip-card-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'clip-btn';
    copyBtn.textContent = '📋 Copy';
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (item.type === 'image') {
        store.copyImageToClipboard(item.content);
      } else {
        navigator.clipboard.writeText(item.content);
      }
      this.showToast('Copied!');
    });
    actions.appendChild(copyBtn);

    const archiveBtn = document.createElement('button');
    archiveBtn.className = 'clip-btn clip-btn-accent';
    archiveBtn.textContent = '📦 Archive';
    archiveBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await store.createArchive({
        title: item.type === 'image' ? 'Clipboard Image' : item.content.substring(0, 50),
        content: item.type === 'text' ? item.content : '',
        images: item.type === 'image' ? [item.content] : [],
        tags: ['clipboard'],
      });
      this.showToast('Saved to Archives!');
    });
    actions.appendChild(archiveBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'clip-btn clip-btn-muted';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      // Remove from DB
      if (item._id) {
        await window.electronAPI.deleteClipboardEntry(item._id).catch(() => {});
      }
      this.history.splice(index, 1);
      this.render();
      this.updateBadge();
    });
    actions.appendChild(delBtn);

    card.appendChild(actions);
    return card;
  },

  async clearAll() {
    // Clear from DB
    try {
      await window.electronAPI.clearClipboardHistory();
    } catch (e) {
      console.error('Failed to clear clipboard DB:', e);
    }
    this.history = [];
    this.render();
    this.updateBadge();
  },

  updateBadge() {
    const badge = document.getElementById('clipboard-badge');
    if (badge) {
      badge.textContent = this.history.length;
      badge.style.display = this.history.length > 0 ? '' : 'none';
    }
  },

  showToast(msg) {
    if (window.SmartActions && SmartActions.toast) {
      SmartActions.toast(msg);
    }
  },

  formatTime(ts) {
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return d.toLocaleDateString();
  },
};

window.ClipboardMgr = ClipboardMgr;

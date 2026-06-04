/* ═══════════════════════════════════════════════════════════════
   Tools Hub — Import, manage, and launch local web tools/projects.
   Supports iframe embed + pop-out to new window.
   ═══════════════════════════════════════════════════════════════ */

const Tools = {
  items: [],
  initialized: false,
  activeToolId: null,

  toolColors: [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
    '#f59e0b', '#10b981', '#06b6d4', '#3b82f6',
    '#a855f7', '#14b8a6', '#e8985e', '#64748b',
  ],

  async init() {
    if (this.initialized) return;
    this.initialized = true;
    await this.loadItems();
    this.bindEvents();
    this.render();
  },

  async loadItems() {
    this.items = await store.getAllTools();
  },

  async refresh() {
    await this.loadItems();
    this.render();
  },

  bindEvents() {
    // Add tool button
    document.getElementById('tools-add-btn').addEventListener('click', () => this.addTool());

    // Close iframe
    document.getElementById('tools-iframe-close').addEventListener('click', () => this.closeIframe());

    // Pop-out button
    document.getElementById('tools-iframe-popout').addEventListener('click', () => {
      if (this.activeToolId) {
        const tool = this.items.find((t) => t._id === this.activeToolId);
        if (tool) {
          store.openToolWindow(tool.path, tool.name);
          this.closeIframe();
        }
      }
    });
  },

  render() {
    const grid = document.getElementById('tools-grid');
    const empty = document.getElementById('tools-empty');

    grid.innerHTML = '';

    if (this.items.length === 0) {
      empty.classList.add('visible');
      grid.style.display = 'none';
      return;
    }

    empty.classList.remove('visible');
    grid.style.display = '';

    this.items.forEach((tool, i) => {
      grid.appendChild(this.createCard(tool, i));
    });
  },

  createCard(tool, index) {
    const card = document.createElement('div');
    card.className = 'tool-card';
    card.style.animationDelay = `${index * 0.05}s`;

    // Color accent bar
    const accent = document.createElement('div');
    accent.className = 'tool-card-accent';
    accent.style.background = tool.color || '#6366f1';
    card.appendChild(accent);

    // Icon
    const icon = document.createElement('div');
    icon.className = 'tool-card-icon';
    icon.style.background = (tool.color || '#6366f1') + '18';
    icon.style.color = tool.color || '#6366f1';
    icon.textContent = this.getInitials(tool.name);
    card.appendChild(icon);

    // Name
    const name = document.createElement('div');
    name.className = 'tool-card-name';
    name.textContent = tool.name;
    card.appendChild(name);

    // Path
    const pathEl = document.createElement('div');
    pathEl.className = 'tool-card-path';
    pathEl.textContent = this.shortenPath(tool.path);
    pathEl.title = tool.path;
    card.appendChild(pathEl);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'tool-card-actions';

    // Launch in-app
    const launchBtn = document.createElement('button');
    launchBtn.className = 'tool-btn tool-btn-primary';
    launchBtn.textContent = '▶ Open';
    launchBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openInIframe(tool);
    });
    actions.appendChild(launchBtn);

    // Pop-out
    const popBtn = document.createElement('button');
    popBtn.className = 'tool-btn';
    popBtn.textContent = '↗ Window';
    popBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      store.openToolWindow(tool.path, tool.name);
      store.updateTool(tool._id, { lastOpened: new Date().toISOString() });
    });
    actions.appendChild(popBtn);

    // Delete
    const delBtn = document.createElement('button');
    delBtn.className = 'tool-btn tool-btn-danger';
    delBtn.textContent = '✕';
    delBtn.title = 'Remove tool';
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await store.deleteTool(tool._id);
      await this.refresh();
    });
    actions.appendChild(delBtn);

    card.appendChild(actions);

    return card;
  },

  async addTool() {
    const filePath = await store.selectToolPath();
    if (!filePath) return;

    // Derive name from folder or filename
    const parts = filePath.replace(/\\/g, '/').split('/');
    let name = parts[parts.length - 2] || parts[parts.length - 1] || 'Tool';
    name = name.replace(/[_-]/g, ' ').replace(/\.(html|htm)$/i, '');
    // Capitalize first letter of each word
    name = name.replace(/\b\w/g, (c) => c.toUpperCase());

    const color = this.toolColors[this.items.length % this.toolColors.length];

    await store.createTool({ name, path: filePath, color });
    await this.refresh();
  },

  openInIframe(tool) {
    this.activeToolId = tool._id;
    const container = document.getElementById('tools-iframe-container');
    const iframe = document.getElementById('tools-iframe');
    const title = document.getElementById('tools-iframe-title');

    title.textContent = tool.name;
    iframe.src = 'file:///' + tool.path.replace(/\\/g, '/');
    container.classList.add('visible');

    store.updateTool(tool._id, { lastOpened: new Date().toISOString() });
  },

  closeIframe() {
    const container = document.getElementById('tools-iframe-container');
    const iframe = document.getElementById('tools-iframe');
    iframe.src = 'about:blank';
    container.classList.remove('visible');
    this.activeToolId = null;
  },

  getInitials(name) {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] || '')
      .join('')
      .toUpperCase();
  },

  shortenPath(p) {
    if (!p) return '';
    const normalized = p.replace(/\\/g, '/');
    const parts = normalized.split('/');
    if (parts.length <= 3) return normalized;
    return '…/' + parts.slice(-3).join('/');
  },
};

window.Tools = Tools;

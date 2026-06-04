/* ═══════════════════════════════════════════════════════════════
   Brain Dump — Daily journal that AI auto-categorizes into
   Canvas thoughts and Archives.
   ═══════════════════════════════════════════════════════════════ */

const BrainDump = {
  initialized: false,
  parsedItems: [],

  init() {
    if (this.initialized) return;
    this.initialized = true;
    this.bindEvents();
  },

  bindEvents() {
    document.getElementById('braindump-process').addEventListener('click', () => this.process());
    document.getElementById('braindump-clear').addEventListener('click', () => this.clearAll());
    document.getElementById('braindump-approve-all').addEventListener('click', () => this.approveAll());
  },

  async process() {
    const textarea = document.getElementById('braindump-input');
    const text = textarea.value.trim();
    if (!text) return;

    const config = Commander.getAIConfig();
    if (!config) {
      SmartActions.toast('No AI provider configured. Go to Settings → AI.');
      return;
    }

    const resultsEl = document.getElementById('braindump-results');
    const approveBtn = document.getElementById('braindump-approve-all');
    resultsEl.innerHTML = '<div class="commander-loading"><div class="commander-spinner"></div> Processing your brain dump...</div>';
    approveBtn.style.display = 'none';

    const systemPrompt = `You are a productivity assistant. The user will give you a chaotic brain dump of text. 
Parse it into structured items. Each item should be one of:
- "task": An actionable item (goes to Canvas as a thought)
- "archive": A URL, reference, or piece of info worth saving (goes to Archives)
- "note": A quick note or reminder (goes to Canvas as a low-priority thought)

Respond with ONLY valid JSON array. No markdown, no explanation.
Format:
[
  {"type": "task", "content": "...", "priority": "high|medium|low"},
  {"type": "archive", "content": "...", "title": "...", "tags": ["tag1"]},
  {"type": "note", "content": "...", "priority": "low"}
]

Rules:
- Extract URLs and mark them as "archive"
- Anything that sounds like a to-do, fix, or action → "task"
- Everything else → "note"
- Assign priority based on urgency words (ASAP, urgent, important = high; later, maybe = low)
- Keep content concise but complete`;

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ];

      const response = await window.electronAPI.aiQuery({
        provider: config.provider,
        apiKey: config.apiKey,
        model: config.model,
        messages,
      });

      const responseText = Commander.extractResponseText(response, config.provider);
      
      // Parse JSON from response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('Could not parse AI response');
      
      this.parsedItems = JSON.parse(jsonMatch[0]);
      this.renderParsedItems();
    } catch (err) {
      resultsEl.innerHTML = `<div class="commander-error">⚠️ ${err.message}</div>`;
    }
  },

  renderParsedItems() {
    const resultsEl = document.getElementById('braindump-results');
    const approveBtn = document.getElementById('braindump-approve-all');

    if (this.parsedItems.length === 0) {
      resultsEl.innerHTML = '<div class="commander-message">Nothing to categorize.</div>';
      approveBtn.style.display = 'none';
      return;
    }

    approveBtn.style.display = '';
    let html = '';

    this.parsedItems.forEach((item, i) => {
      const icons = { task: '⚡', archive: '📦', note: '📝' };
      const colors = {
        task: 'var(--accent-primary)',
        archive: 'var(--accent-warm)',
        note: 'var(--accent-mint)',
      };
      const labels = { task: 'Task', archive: 'Archive', note: 'Note' };
      const priorityColors = {
        high: 'var(--priority-high)',
        medium: 'var(--priority-medium)',
        low: 'var(--priority-low)',
      };

      html += `
        <div class="braindump-item" data-index="${i}">
          <div class="braindump-item-header">
            <span class="braindump-item-type" style="color:${colors[item.type]}">${icons[item.type]} ${labels[item.type]}</span>
            ${item.priority ? `<span class="braindump-item-priority" style="color:${priorityColors[item.priority]}">${item.priority}</span>` : ''}
            <button class="braindump-item-remove" data-index="${i}" title="Remove">✕</button>
          </div>
          <div class="braindump-item-content">${Commander.escapeHtml(item.content || item.title || '')}</div>
          ${item.tags ? `<div class="braindump-item-tags">${item.tags.map(t => `<span class="archive-card-tag">${t}</span>`).join('')}</div>` : ''}
        </div>
      `;
    });

    resultsEl.innerHTML = html;

    // Bind remove buttons
    resultsEl.querySelectorAll('.braindump-item-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        this.parsedItems.splice(idx, 1);
        this.renderParsedItems();
      });
    });
  },

  async approveAll() {
    const approveBtn = document.getElementById('braindump-approve-all');
    approveBtn.disabled = true;
    approveBtn.textContent = 'Creating...';

    let created = 0;

    for (const item of this.parsedItems) {
      try {
        if (item.type === 'task' || item.type === 'note') {
          const priority = item.priority || 'medium';
          const pos = Canvas.findOpenPosition(priority);
          await store.createThought({
            _id: Utils.generateId(),
            content: item.content,
            priority,
            persistence: 'persistent',
            tags: ['braindump'],
            x: pos.x,
            y: pos.y,
            createdAt: new Date().toISOString(),
          });
          // Update Canvas.thoughts so subsequent findOpenPosition() sees this card
          Canvas.thoughts.push({
            x: pos.x, y: pos.y,
            width: 260, priority,
            content: item.content,
          });
          created++;
        } else if (item.type === 'archive') {
          await store.createArchive({
            title: item.title || item.content?.substring(0, 50),
            content: item.content || '',
            images: [],
            tags: item.tags || ['braindump'],
          });
          created++;
        }
      } catch (e) {
        console.error('Brain dump item failed:', e);
      }
    }

    SmartActions.toast(`Created ${created} items from brain dump!`);
    this.clearAll();

    // Refresh views so new items are visible immediately
    await Canvas.refresh();
    Canvas.initDraggable();
    Timeline.render();
    if (Archives.initialized) Archives.refresh();

    approveBtn.disabled = false;
    approveBtn.textContent = '✓ Approve All';
  },

  clearAll() {
    document.getElementById('braindump-input').value = '';
    document.getElementById('braindump-results').innerHTML = '';
    document.getElementById('braindump-approve-all').style.display = 'none';
    this.parsedItems = [];
  },
};

window.BrainDump = BrainDump;

/* ═══════════════════════════════════════════════════════════════
   Quick Add — Fast thought capture modal
   Now with persistence mode (keep / today / until date)
   ═══════════════════════════════════════════════════════════════ */

const QuickAdd = {
  selectedPriority: 'medium',
  selectedPersistence: 'persistent',
  selectedTags: [],
  initialized: false,

  init() {
    if (this.initialized) return;
    this.initialized = true;
    this.bindEvents();
  },

  bindEvents() {
    const overlay = document.getElementById('quickadd-overlay');
    const closeBtn = document.getElementById('quickadd-close');
    const saveBtn = document.getElementById('quickadd-save');
    const input = document.getElementById('quickadd-input');
    const newTagInput = document.getElementById('quickadd-new-tag');
    const fab = document.getElementById('fab-add');

    // Open
    fab.addEventListener('click', () => this.open());

    // Close
    closeBtn.addEventListener('click', () => this.close());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    // Save
    saveBtn.addEventListener('click', () => this.save());

    // Ctrl+Enter to save
    input.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        this.save();
      }
    });

    // Priority buttons
    document.querySelectorAll('.priority-btn:not(.edit-priority-btn)').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.priority-btn:not(.edit-priority-btn)').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedPriority = btn.dataset.priority;
      });
    });

    // Persistence buttons
    document.querySelectorAll('.persist-btn:not(.edit-persist-btn)').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.persist-btn:not(.edit-persist-btn)').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedPersistence = btn.dataset.persist;
        // Show/hide date picker
        const dateRow = document.getElementById('quickadd-date-row');
        dateRow.style.display = btn.dataset.persist === 'until_date' ? 'flex' : 'none';
      });
    });

    // New tag creation
    newTagInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const name = newTagInput.value.trim();
        if (name) {
          const tag = await Tags.createTag(name);
          if (tag && !this.selectedTags.includes(tag.name)) {
            this.selectedTags.push(tag.name);
          }
          newTagInput.value = '';
          this.renderTags();
        }
      }
    });

    // AI Auto-Tag
    const autoTagBtn = document.getElementById('quickadd-autotag');
    if (autoTagBtn) {
      autoTagBtn.addEventListener('click', () => this.autoTag());
    }
  },

  open(customPriority = null, customCoords = null) {
    // Use default settings or overrides
    this.selectedPriority = customPriority || Settings.get('defaultPriority') || 'medium';
    this.selectedPersistence = Settings.get('defaultPersistence') || 'persistent';
    this.selectedTags = [];
    this.customCoords = customCoords;

    // Reset priority buttons
    document.querySelectorAll('.priority-btn:not(.edit-priority-btn)').forEach((b) => b.classList.remove('active'));
    const targetPriorityBtn = document.querySelector(`.priority-btn-${this.selectedPriority}:not(.edit-priority-btn)`);
    if (targetPriorityBtn) targetPriorityBtn.classList.add('active');

    // Reset persistence buttons
    document.querySelectorAll('.persist-btn:not(.edit-persist-btn)').forEach((b) => b.classList.remove('active'));
    const targetPersistBtn = document.querySelector(`.persist-btn[data-persist="${this.selectedPersistence}"]:not(.edit-persist-btn)`);
    if (targetPersistBtn) targetPersistBtn.classList.add('active');

    // Hide date row
    document.getElementById('quickadd-date-row').style.display = 'none';
    document.getElementById('quickadd-expires').value = '';

    // Reset input
    const input = document.getElementById('quickadd-input');
    input.value = '';

    // Render tags
    this.renderTags();

    // Show modal
    const overlay = document.getElementById('quickadd-overlay');
    overlay.classList.add('visible');
    this.isOpen = true;

    // Focus input
    setTimeout(() => input.focus(), 100);
  },

  close() {
    const overlay = document.getElementById('quickadd-overlay');
    overlay.classList.remove('visible');
    this.isOpen = false;
  },

  renderTags() {
    const container = document.getElementById('quickadd-tag-list');
    Tags.renderTagSelector(container, this.selectedTags, (tagName, isSelected) => {
      if (isSelected) {
        if (!this.selectedTags.includes(tagName)) {
          this.selectedTags.push(tagName);
        }
      } else {
        this.selectedTags = this.selectedTags.filter((t) => t !== tagName);
      }
    });
  },

  isSaving: false,

  async save() {
    if (this.isSaving) return;
    const input = document.getElementById('quickadd-input');
    const content = input.value.trim();

    if (!content) {
      input.focus();
      input.style.borderColor = 'var(--priority-high)';
      setTimeout(() => {
        input.style.borderColor = '';
      }, 1000);
      return;
    }

    this.isSaving = true;
    const saveBtn = document.getElementById('quickadd-save');
    if (saveBtn) saveBtn.disabled = true;

    try {
      // Calculate position — place in the relevant priority zone or use custom coordinates
      let baseX, baseY;
      if (this.customCoords) {
        baseX = this.customCoords.x;
        baseY = this.customCoords.y;
      } else {
        const pos = Canvas.findOpenPosition(this.selectedPriority);
        baseX = pos.x;
        baseY = pos.y;
      }

      // Build expiry
      let expiresAt = null;
      if (this.selectedPersistence === 'until_date') {
        const dateVal = document.getElementById('quickadd-expires').value;
        if (dateVal) {
          expiresAt = new Date(dateVal).toISOString();
        }
      }

      const thought = await store.createThought({
        content,
        priority: this.selectedPriority,
        persistence: this.selectedPersistence,
        expiresAt,
        tags: this.selectedTags,
        x: Math.max(40, baseX),
        y: Math.max(60, baseY),
      });

      this.close();

      // Update canvas and timeline
      Canvas.addCard(thought);
      Timeline.render();
    } finally {
      this.isSaving = false;
      if (saveBtn) saveBtn.disabled = false;
    }
  },

  // ─── AI Auto-Tag ───

  async autoTag() {
    const input = document.getElementById('quickadd-input');
    const content = input.value.trim();
    if (!content) {
      input.focus();
      input.style.borderColor = 'var(--priority-high)';
      setTimeout(() => { input.style.borderColor = ''; }, 1000);
      return;
    }

    const config = Commander.getAIConfig();
    if (!config) {
      SmartActions.toast('No AI provider configured. Go to Settings → AI.');
      return;
    }

    const btn = document.getElementById('quickadd-autotag');
    btn.disabled = true;
    btn.classList.add('loading');
    btn.textContent = '✨ Analyzing...';

    const existingTags = Tags.allTags.map((t) => t.name).join(', ');

    const systemPrompt = `You are a productivity assistant. Given a thought/task, analyze it and assign:
1. A priority: "high", "medium", or "low"
2. 1-3 tags that best categorize it

Existing tags the user has: [${existingTags}]
Prefer existing tags when they fit. You may suggest 1 new tag if needed.

Respond with ONLY valid JSON, no markdown:
{"priority": "high|medium|low", "tags": ["tag1", "tag2"]}

Rules:
- Words like "urgent", "ASAP", "critical", "bug", "fix now" → high
- Words like "later", "maybe", "someday", "nice to have" → low
- Everything else → medium
- Keep tag names lowercase, single-word or hyphenated`;

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ];

      const response = await window.electronAPI.aiQuery({
        provider: config.provider,
        apiKey: config.apiKey,
        model: config.model,
        messages,
      });

      const text = Commander.extractResponseText(response, config.provider);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Could not parse AI response');

      const result = JSON.parse(jsonMatch[0]);

      // Apply priority
      if (result.priority) {
        this.selectedPriority = result.priority;
        document.querySelectorAll('.priority-btn:not(.edit-priority-btn)').forEach((b) => b.classList.remove('active'));
        const targetBtn = document.querySelector(`.priority-btn-${result.priority}:not(.edit-priority-btn)`);
        if (targetBtn) targetBtn.classList.add('active');
      }

      // Apply tags
      if (result.tags && Array.isArray(result.tags)) {
        for (const tagName of result.tags) {
          const name = tagName.trim().toLowerCase();
          if (!name) continue;
          // Create tag if it doesn't exist
          await Tags.createTag(name);
          if (!this.selectedTags.includes(name)) {
            this.selectedTags.push(name);
          }
        }
        this.renderTags();
      }

      SmartActions.toast(`AI suggests: ${result.priority} priority, tags: ${(result.tags || []).join(', ')}`);
    } catch (err) {
      SmartActions.toast('AI Auto-Tag failed: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.classList.remove('loading');
      btn.textContent = '✨ AI Auto-Tag';
    }
  },
};

window.QuickAdd = QuickAdd;

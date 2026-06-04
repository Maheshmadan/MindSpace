/* ═══════════════════════════════════════════════════════════════
   Timeline — Chronological mind snapshot display
   Shows ALL thoughts (active, finished, dismissed) as a
   complete history / time machine.
   ═══════════════════════════════════════════════════════════════ */

const Timeline = {
  thoughts: [],

  initialized: false,

  async init() {
    await this.loadThoughts();
    this.render();
    if (!this.initialized) {
      this.bindSearch();
      this.initialized = true;
    }
  },

  async loadThoughts() {
    this.thoughts = await store.getAllThoughts();
  },

  async refresh() {
    await this.loadThoughts();
    this.render();
  },

  render(searchQuery = null) {
    const container = document.getElementById('timeline-content');
    const emptyState = document.getElementById('timeline-empty');
    container.innerHTML = '';

    let filtered = this.thoughts.filter((t) => Tags.passesFilter(t));

    // Apply search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.content.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      emptyState.classList.add('visible');
      return;
    }

    emptyState.classList.remove('visible');

    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Group by day
    const groups = {};
    filtered.forEach((thought) => {
      const key = Utils.getDayKey(thought.createdAt);
      if (!groups[key]) {
        groups[key] = {
          label: Utils.formatDate(thought.createdAt),
          thoughts: [],
        };
      }
      groups[key].thoughts.push(thought);
    });

    // Render groups
    Object.keys(groups).forEach((key, groupIndex) => {
      const group = groups[key];

      const dayEl = document.createElement('div');
      dayEl.className = 'timeline-day';
      dayEl.style.animationDelay = `${groupIndex * 0.05}s`;

      // Day header
      const header = document.createElement('div');
      header.className = 'timeline-day-header';
      header.textContent = group.label;
      dayEl.appendChild(header);

      // Entries
      group.thoughts.forEach((thought, i) => {
        const entry = this.createEntry(thought, i);
        dayEl.appendChild(entry);
      });

      container.appendChild(dayEl);
    });
  },

  createEntry(thought, index) {
    const entry = document.createElement('div');
    entry.className = 'timeline-entry';
    if (thought.status === 'finished') entry.classList.add('entry-finished');
    if (thought.status === 'dismissed') entry.classList.add('entry-dismissed');
    entry.dataset.id = thought._id;
    entry.dataset.priority = thought.priority;
    entry.style.animationDelay = `${index * 0.03}s`;

    const card = document.createElement('div');
    card.className = 'timeline-card';

    // Header
    const header = document.createElement('div');
    header.className = 'timeline-card-header';

    const timeAndNum = document.createElement('div');
    timeAndNum.className = 'timeline-time-group';

    const time = document.createElement('span');
    time.className = 'timeline-time';
    time.textContent = Utils.formatTime(thought.createdAt);
    timeAndNum.appendChild(time);

    if (thought.number) {
      const num = document.createElement('span');
      num.className = 'timeline-number';
      num.textContent = ` #${thought.number}`;
      timeAndNum.appendChild(num);
    }

    header.appendChild(timeAndNum);

    const badges = document.createElement('div');
    badges.className = 'timeline-badges';

    // Status badge
    if (thought.status === 'finished') {
      const statusBadge = document.createElement('span');
      statusBadge.className = 'timeline-status-badge status-finished';
      statusBadge.textContent = '✓ Finished';
      badges.appendChild(statusBadge);
    } else if (thought.status === 'dismissed') {
      const statusBadge = document.createElement('span');
      statusBadge.className = 'timeline-status-badge status-dismissed';
      statusBadge.textContent = '✕ Dismissed';
      badges.appendChild(statusBadge);
    }

    // NOW badge in timeline
    if (thought.markedNow && thought.status === 'active') {
      const nowBadge = document.createElement('span');
      nowBadge.className = 'timeline-status-badge status-now';
      nowBadge.textContent = '★ NOW';
      badges.appendChild(nowBadge);
    }

    const priorityBadge = document.createElement('span');
    priorityBadge.className = `timeline-priority-badge ${thought.priority}`;
    priorityBadge.textContent = thought.priority;
    badges.appendChild(priorityBadge);

    const expandIcon = document.createElement('span');
    expandIcon.className = 'timeline-expand-icon';
    expandIcon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>`;
    badges.appendChild(expandIcon);

    header.appendChild(badges);
    card.appendChild(header);

    // Preview (collapsed)
    const preview = document.createElement('div');
    preview.className = 'timeline-preview';
    preview.textContent = Utils.truncate(thought.content, 80);
    card.appendChild(preview);

    // Tags in preview
    if (thought.tags && thought.tags.length > 0) {
      const tagsRow = document.createElement('div');
      tagsRow.className = 'timeline-tags';
      thought.tags.forEach((tagName) => {
        const color = Tags.getTagColor(tagName);
        const tagEl = document.createElement('span');
        tagEl.className = 'card-tag';
        tagEl.textContent = tagName;
        tagEl.style.background = color.bg;
        tagEl.style.color = color.text;
        tagsRow.appendChild(tagEl);
      });
      card.appendChild(tagsRow);
    }

    // Full content (expanded)
    const full = document.createElement('div');
    full.className = 'timeline-full';

    const fullContent = document.createElement('div');
    fullContent.className = 'timeline-full-content';
    fullContent.textContent = thought.content;
    full.appendChild(fullContent);

    // Persistence info
    if (thought.persistence && thought.persistence !== 'persistent') {
      const persistInfo = document.createElement('div');
      persistInfo.className = 'timeline-persist-info';
      if (thought.persistence === 'today') {
        persistInfo.textContent = '📅 Was set for today only';
      } else if (thought.persistence === 'until_date' && thought.expiresAt) {
        persistInfo.textContent = `⏰ Expires: ${Utils.formatTimestamp(thought.expiresAt)}`;
      }
      full.appendChild(persistInfo);
    }

    // Finished time
    if (thought.finishedAt) {
      const finInfo = document.createElement('div');
      finInfo.className = 'timeline-persist-info';
      finInfo.textContent = `${thought.status === 'finished' ? '✓ Completed' : '✕ Dismissed'} at ${Utils.formatTimestamp(thought.finishedAt)}`;
      full.appendChild(finInfo);
    }

    // Tags in full view
    if (thought.tags && thought.tags.length > 0) {
      const fullTags = document.createElement('div');
      fullTags.className = 'timeline-full-tags';
      thought.tags.forEach((tagName) => {
        const color = Tags.getTagColor(tagName);
        const tagEl = document.createElement('span');
        tagEl.className = 'card-tag';
        tagEl.textContent = tagName;
        tagEl.style.background = color.bg;
        tagEl.style.color = color.text;
        fullTags.appendChild(tagEl);
      });
      full.appendChild(fullTags);
    }

    // Actions
    const actions = document.createElement('div');
    actions.className = 'timeline-full-actions';

    // Only show "Go to Canvas" for active thoughts
    if (thought.status === 'active') {
      const goToBtn = document.createElement('button');
      goToBtn.className = 'timeline-action-btn';
      goToBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg> Go to Canvas`;
      goToBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.goToCanvas(thought._id);
      });
      actions.appendChild(goToBtn);
    }

    // Restore button for finished/dismissed
    if (thought.status === 'finished' || thought.status === 'dismissed') {
      const restoreBtn = document.createElement('button');
      restoreBtn.className = 'timeline-action-btn';
      restoreBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
      </svg> Restore to Canvas`;
      restoreBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await store.restoreThought(thought._id);
        thought.status = 'active';
        thought.finishedAt = null;
        await Canvas.loadThoughts();
        Canvas.render();
        Canvas.initDraggable();
        this.render();
      });
      actions.appendChild(restoreBtn);
    }

    const editBtn = document.createElement('button');
    editBtn.className = 'timeline-action-btn';
    editBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg> Edit`;
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      App.switchView('canvas');
      setTimeout(() => Canvas.openEditModal(thought._id), 300);
    });
    actions.appendChild(editBtn);

    full.appendChild(actions);
    card.appendChild(full);

    // Click to expand/collapse
    card.addEventListener('click', () => {
      entry.classList.toggle('expanded');
    });

    entry.appendChild(card);
    return entry;
  },

  goToCanvas(thoughtId) {
    App.switchView('canvas');
    setTimeout(() => {
      Canvas.highlightCard(thoughtId);
    }, 300);
  },

  bindSearch() {
    const searchInput = document.getElementById('search-input');
    const debouncedSearch = Utils.debounce((query) => {
      this.render(query || null);
      Canvas.applyFilters();
    }, 250);

    searchInput.addEventListener('input', (e) => {
      debouncedSearch(e.target.value.trim());
    });
  },

  async refresh() {
    await this.loadThoughts();
    this.render();
  },
};

window.Timeline = Timeline;

/* ═══════════════════════════════════════════════════════════════
   Tags — Tag management (create, render, filter)
   ═══════════════════════════════════════════════════════════════ */

const Tags = {
  allTags: [],
  activeFilters: new Set(),

  async init() {
    await this.loadTags();
    this.renderFilterBar();
  },

  async loadTags() {
    this.allTags = await store.getAllTags();
  },

  async createTag(name) {
    name = name.trim().toLowerCase();
    if (!name) return null;

    // Check if already exists
    const existing = this.allTags.find((t) => t.name === name);
    if (existing) return existing;

    const colorIndex = this.allTags.length;
    const color = Utils.getTagColor(colorIndex);
    const tag = await store.createTag({ name, color });
    this.allTags.push(tag);
    this.renderFilterBar();
    return tag;
  },

  /**
   * Render tag pills in a container for selection
   * @param {HTMLElement} container
   * @param {string[]} selectedTags - currently selected tag names
   * @param {Function} onToggle - callback(tagName, isSelected)
   */
  renderTagSelector(container, selectedTags = [], onToggle = null) {
    container.innerHTML = '';
    this.allTags.forEach((tag) => {
      const pill = document.createElement('span');
      pill.className = 'tag-pill';
      pill.dataset.name = tag.name;
      pill.style.background = tag.color.bg;
      pill.style.color = tag.color.text;
      pill.style.borderColor = tag.color.border;

      if (selectedTags.includes(tag.name)) {
        pill.classList.add('selected');
      }

      // Tag name text
      const nameSpan = document.createElement('span');
      nameSpan.textContent = tag.name;
      pill.appendChild(nameSpan);

      // Delete cross
      const delBtn = document.createElement('span');
      delBtn.className = 'tag-delete';
      delBtn.innerHTML = '&times;';
      delBtn.title = 'Delete tag globally';
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation(); // prevent toggling selection
        if (confirm(`Delete tag "${tag.name}" permanently? It will be removed from all thoughts.`)) {
          await store.deleteTag(tag._id);
          this.allTags = this.allTags.filter((t) => t._id !== tag._id);
          this.activeFilters.delete(tag.name);
          this.renderFilterBar();
          this.onFilterChange();
          // re-render current selector
          this.renderTagSelector(container, selectedTags, onToggle);
        }
      });
      pill.appendChild(delBtn);

      // Toggle selection on pill click
      pill.addEventListener('click', () => {
        pill.classList.toggle('selected');
        if (onToggle) {
          onToggle(tag.name, pill.classList.contains('selected'));
        }
      });

      container.appendChild(pill);
    });
  },

  /**
   * Get tag color by name
   */
  getTagColor(tagName) {
    const tag = this.allTags.find((t) => t.name === tagName);
    return tag ? tag.color : { bg: '#f0eeeb', text: '#475569', border: '#e2e0dd' };
  },

  /**
   * Render tag filter chips in the topbar
   */
  renderFilterBar() {
    const container = document.getElementById('tag-filters');
    container.innerHTML = '';

    if (this.allTags.length === 0) return;

    // "All" chip
    const allChip = document.createElement('button');
    allChip.className = `tag-filter ${this.activeFilters.size === 0 ? 'active' : ''}`;
    allChip.textContent = 'All';
    allChip.addEventListener('click', () => {
      this.activeFilters.clear();
      this.renderFilterBar();
      this.onFilterChange();
    });
    container.appendChild(allChip);

    // Tag chips
    this.allTags.forEach((tag) => {
      const chip = document.createElement('button');
      chip.className = `tag-filter ${this.activeFilters.has(tag.name) ? 'active' : ''}`;
      chip.textContent = tag.name;
      chip.addEventListener('click', () => {
        if (this.activeFilters.has(tag.name)) {
          this.activeFilters.delete(tag.name);
        } else {
          this.activeFilters.add(tag.name);
        }
        this.renderFilterBar();
        this.onFilterChange();
      });
      container.appendChild(chip);
    });
  },

  onFilterChange() {
    // Notify canvas and timeline to re-filter
    if (window.Canvas) Canvas.applyFilters();
    if (window.Timeline) Timeline.render();
  },

  /**
   * Check if a thought passes the current filter
   */
  passesFilter(thought) {
    if (this.activeFilters.size === 0) return true;
    return thought.tags.some((t) => this.activeFilters.has(t));
  },
};

window.Tags = Tags;

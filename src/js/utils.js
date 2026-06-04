/* ═══════════════════════════════════════════════════════════════
   Utils — Helpers, ID generation, date formatting
   ═══════════════════════════════════════════════════════════════ */

const Utils = {
  /**
   * Generate a unique ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  },

  /**
   * Format a date to a human-readable string
   */
  formatDate(date) {
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    const dayMs = 86400000;

    if (diff < dayMs && d.getDate() === now.getDate()) {
      return 'Today';
    } else if (diff < 2 * dayMs && d.getDate() === now.getDate() - 1) {
      return 'Yesterday';
    }

    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  },

  /**
   * Format time (HH:MM AM/PM)
   */
  formatTime(date) {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  },

  /**
   * Format full timestamp
   */
  formatTimestamp(date) {
    return `${this.formatDate(date)} at ${this.formatTime(date)}`;
  },

  /**
   * Get day key for grouping (YYYY-MM-DD)
   */
  getDayKey(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  /**
   * Truncate text to a specified length
   */
  truncate(text, maxLength = 60) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '…';
  },

  /**
   * Debounce a function
   */
  debounce(fn, delay = 300) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Generate a pleasant pastel color for tags
   */
  generateTagColor() {
    const hues = [210, 250, 280, 320, 160, 180, 30, 45, 120, 200];
    const hue = hues[Math.floor(Math.random() * hues.length)];
    return {
      bg: `hsl(${hue}, 70%, 94%)`,
      text: `hsl(${hue}, 60%, 38%)`,
      border: `hsl(${hue}, 60%, 86%)`,
    };
  },

  /**
   * Predefined tag colors
   */
  tagColorPresets: [
    { bg: '#e0e1fc', text: '#4338ca', border: '#c7c8f9' }, // Indigo
    { bg: '#ede5fd', text: '#7c3aed', border: '#ddd0fa' }, // Violet
    { bg: '#e0fcf5', text: '#0d9488', border: '#b2f0e3' }, // Teal
    { bg: '#fdf0e4', text: '#c2742f', border: '#f5d9b8' }, // Amber
    { bg: '#fce4ec', text: '#c62828', border: '#f8bbd0' }, // Rose
    { bg: '#e8f5e9', text: '#2e7d32', border: '#c8e6c9' }, // Green
    { bg: '#e3f2fd', text: '#1565c0', border: '#bbdefb' }, // Blue
    { bg: '#fff3e0', text: '#e65100', border: '#ffe0b2' }, // Orange
  ],

  /**
   * Get a tag color from presets by index
   */
  getTagColor(index) {
    return this.tagColorPresets[index % this.tagColorPresets.length];
  },
};

// Make globally available
window.Utils = Utils;

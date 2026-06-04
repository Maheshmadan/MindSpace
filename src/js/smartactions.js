/* ═══════════════════════════════════════════════════════════════
   Smart Actions — Right-click context menu with Google,
   Gemini, and Lens search options. Works on text + images.
   ═══════════════════════════════════════════════════════════════ */

const SmartActions = {
  menu: null,
  initialized: false,

  init() {
    if (this.initialized) return;
    this.initialized = true;
    this.menu = document.getElementById('smart-context-menu');
    this.bindEvents();
  },

  bindEvents() {
    // Global right-click handler
    document.addEventListener('contextmenu', (e) => {
      // Only trigger in main app screen
      const appScreen = document.getElementById('app-screen');
      if (!appScreen || appScreen.style.display === 'none') return;

      // Don't interfere with input fields (allow default context menu)
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      e.preventDefault();
      this.show(e);
    });

    // Close on click outside
    document.addEventListener('click', () => this.hide());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hide();
    });
  },

  show(e) {
    const menu = this.menu;
    menu.innerHTML = '';

    const selectedText = window.getSelection().toString().trim();
    const imgEl = e.target.closest('.archive-card-img, .archive-paste-preview img, .archive-history-images img');
    const archiveCard = e.target.closest('.archive-card');
    const thoughtCard = e.target.closest('.thought-card');

    let hasItems = false;

    // ── Text-based actions ──
    if (selectedText) {
      this.addItem(menu, '🔍', 'Search Google', () => {
        this.searchGoogle(selectedText);
      });
      this.addItem(menu, '✨', 'Ask Gemini', () => {
        this.askGemini(selectedText);
      });
      this.addSeparator(menu);
      this.addItem(menu, '📋', 'Copy Text', () => {
        navigator.clipboard.writeText(selectedText);
        this.toast('Copied to clipboard');
      });
      hasItems = true;
    }

    // ── Image actions (clicked directly on an image) ──
    if (imgEl) {
      const imgSrc = imgEl.src || imgEl.querySelector('img')?.src;
      if (imgSrc) {
        if (hasItems) this.addSeparator(menu);
        this.addItem(menu, '✨', 'Ask Gemini (Image)', () => {
          this.askGeminiImage(imgSrc);
        });
        this.addItem(menu, '🔎', 'Search Google Lens', () => {
          this.searchLens(imgSrc);
        });
        this.addSeparator(menu);
        this.addItem(menu, '📷', 'Copy Image', () => {
          store.copyImageToClipboard(imgSrc);
          this.toast('Image copied to clipboard');
        });
        hasItems = true;
      }
    }

    // ── Card-level actions (text + images from entire card) ──
    if (!selectedText && !imgEl && (archiveCard || thoughtCard)) {
      const card = archiveCard || thoughtCard;
      const cardText = this.extractCardText(card);
      const cardImage = this.extractCardImage(card);

      

      // Single "Ask Gemini" that sends everything (image + text)
      if (cardText || cardImage) {
        this.addItem(menu, '✨', 'Ask Gemini (All)', () => {
          if (cardImage) {
            this.askGeminiAll(cardImage, cardText);
          } else {
            this.askGemini(cardText);
          }
        });
        hasItems = true;
      }

      if (cardText) {
        this.addItem(menu, '🔍', 'Search Google', () => {
          this.searchGoogle(cardText);
        });
      }

      // if (cardImage) {
      //   this.addItem(menu, '🔎', 'Search Google Lens', () => {
      //     this.searchLens(cardImage);
      //   });
      //   hasItems = true;
      // }

      if (hasItems) {
        this.addSeparator(menu);
        if (cardText) {
          this.addItem(menu, '📋', 'Copy Text', () => {
            navigator.clipboard.writeText(cardText);
            this.toast('Copied to clipboard');
          });
        }
        if (cardImage) {
          this.addItem(menu, '📷', 'Copy Image', () => {
            store.copyImageToClipboard(cardImage);
            this.toast('Image copied to clipboard');
          });
        }
      }
    }

    if (!hasItems) {
      // Fallback: just show copy if nothing specific
      return;
    }

    // Position menu
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - (menu.childElementCount * 38 + 16));
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.classList.add('visible');
  },

  hide() {
    if (this.menu) this.menu.classList.remove('visible');
  },

  addItem(menu, icon, label, onClick) {
    const item = document.createElement('button');
    item.className = 'smart-menu-item';
    item.innerHTML = `<span class="smart-menu-icon">${icon}</span><span>${label}</span>`;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
      onClick();
    });
    menu.appendChild(item);
  },

  addSeparator(menu) {
    const sep = document.createElement('div');
    sep.className = 'smart-menu-separator';
    menu.appendChild(sep);
  },

  extractCardText(card) {
    const titleEl = card.querySelector('.archive-card-title, .thought-content, .card-title');
    const contentEl = card.querySelector('.archive-card-content, .thought-text');
    let text = '';
    if (titleEl) text += titleEl.textContent.trim();
    if (contentEl) text += (text ? '\n' : '') + contentEl.textContent.trim();
    return text.substring(0, 500); // Limit length
  },

  extractCardImage(card) {
    // Grab the first image from the card
    const img = card.querySelector('.archive-card-img, .archive-card-images img');
    return img ? img.src : null;
  },

  // ── Search Engines ──

  searchGoogle(text) {
    const url = `https://www.google.com/search?q=${encodeURIComponent(text)}`;
    window.electronAPI.openExternal(url);
  },

  askGemini(text) {
    // Copy text → open Gemini → auto paste + enter
    navigator.clipboard.writeText(text).then(() => {
      window.electronAPI.openExternal('https://gemini.google.com/app');
      window.electronAPI.autoPasteSearch(3000);
      this.toast('Opening Gemini — auto-pasting...');
    });
  },

  askGeminiImage(base64Src) {
    // Image only → copy image → open Gemini → auto paste + enter
    store.copyImageToClipboard(base64Src);
    window.electronAPI.openExternal('https://gemini.google.com/app');
    window.electronAPI.autoPasteSearch(3000);
    this.toast('Opening Gemini — auto-pasting image...');
  },

  askGeminiAll(base64Src, text) {
    // Image + text → copy image first → open Gemini → paste image → paste text → enter
    store.copyImageToClipboard(base64Src);
    window.electronAPI.openExternal('https://gemini.google.com/app');
    window.electronAPI.autoPasteFull(text || '', 3000);
    this.toast('Opening Gemini — sending image + text...');
  },

  searchLens(base64Src) {
    // Copy decoded image → open Lens → auto paste + enter
    store.copyImageToClipboard(base64Src);
    window.electronAPI.openExternal('https://lens.google.com/');
    window.electronAPI.autoPasteSearch(3000);
    this.toast('Opening Google Lens — auto-pasting...');
  },

  // ── Toast notification ──

  toast(message) {
    let toastEl = document.getElementById('smart-toast');
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.id = 'smart-toast';
      toastEl.className = 'smart-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.add('visible');
    setTimeout(() => toastEl.classList.remove('visible'), 2500);
  },
};

window.SmartActions = SmartActions;

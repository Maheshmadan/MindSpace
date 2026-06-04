/* ═══════════════════════════════════════════════════════════════
   Auth — Password authentication flow
   ═══════════════════════════════════════════════════════════════ */

const Auth = {
  isFirstTime: false,

  async init() {
    const hasPassword = await store.hasPassword();
    this.isFirstTime = !hasPassword;

    const subtitle = document.getElementById('auth-subtitle');
    const confirmInput = document.getElementById('auth-confirm');
    const submitBtn = document.getElementById('auth-submit');

    if (this.isFirstTime) {
      subtitle.textContent = 'Create a password to protect your space';
      confirmInput.style.display = 'block';
      submitBtn.textContent = 'Create & Enter';
    } else {
      subtitle.textContent = 'Enter your password to unlock';
      confirmInput.style.display = 'none';
      submitBtn.textContent = 'Unlock';
    }

    this.bindEvents();
  },

  bindEvents() {
    const form = document.getElementById('auth-form');
    const toggleBtn = document.getElementById('auth-toggle-vis');
    const passwordInput = document.getElementById('auth-password');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });

    toggleBtn.addEventListener('click', () => {
      const type = passwordInput.type === 'password' ? 'text' : 'password';
      passwordInput.type = type;
      document.getElementById('auth-confirm').type = type;
    });
  },

  async handleSubmit() {
    const password = document.getElementById('auth-password').value;
    const confirm = document.getElementById('auth-confirm').value;
    const errorEl = document.getElementById('auth-error');
    const submitBtn = document.getElementById('auth-submit');

    errorEl.textContent = '';

    if (!password) {
      errorEl.textContent = 'Please enter a password';
      return;
    }

    if (password.length < 4) {
      errorEl.textContent = 'Password must be at least 4 characters';
      return;
    }

    submitBtn.disabled = true;

    try {
      if (this.isFirstTime) {
        if (password !== confirm) {
          errorEl.textContent = 'Passwords do not match';
          submitBtn.disabled = false;
          return;
        }
        await store.setPassword(password);
        this.onSuccess();
      } else {
        const valid = await store.verifyPassword(password);
        if (valid) {
          this.onSuccess();
        } else {
          errorEl.textContent = 'Incorrect password';
          submitBtn.disabled = false;
          document.getElementById('auth-password').value = '';
          document.getElementById('auth-password').focus();
        }
      }
    } catch (err) {
      errorEl.textContent = 'Something went wrong. Try again.';
      submitBtn.disabled = false;
      console.error('Auth error:', err);
    }
  },

  onSuccess() {
    const authScreen = document.getElementById('auth-screen');
    const appScreen = document.getElementById('app-screen');

    authScreen.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    authScreen.style.opacity = '0';
    authScreen.style.transform = 'scale(0.98)';

    setTimeout(() => {
      authScreen.style.display = 'none';
      appScreen.style.display = 'flex';
      appScreen.style.animation = 'fadeIn 0.4s ease';

      // Initialize the main app
      if (window.App) {
        App.init();
      }
    }, 300);
  },

  lock() {
    // Lock the encryption session (wipes sessionKey from memory)
    if (window.store) {
      store.lockSession();
    }

    const authScreen = document.getElementById('auth-screen');
    const appScreen = document.getElementById('app-screen');

    appScreen.style.display = 'none';
    authScreen.style.display = 'flex';
    authScreen.style.opacity = '1';
    authScreen.style.transform = 'scale(1)';

    document.getElementById('auth-password').value = '';
    document.getElementById('auth-error').textContent = '';
    document.getElementById('auth-submit').disabled = false;
    document.getElementById('auth-password').focus();

    // Reset to login mode (not first time)
    this.isFirstTime = false;
    document.getElementById('auth-subtitle').textContent = 'Enter your password to unlock';
    document.getElementById('auth-confirm').style.display = 'none';
    document.getElementById('auth-submit').textContent = 'Unlock';
  },
};

window.Auth = Auth;

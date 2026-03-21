(function () {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  if (!loginForm || !signupForm || !window.NutriApp) return;
  const t = (key, vars) => NutriApp.t(key, vars);

  const loginStatus = document.getElementById('login-status');
  const signupStatus = document.getElementById('signup-status');
  const historyNode = document.getElementById('account-history');

  function setStatus(node, text, ok) {
    node.textContent = text;
    node.className = `status-msg ${ok ? 'status-ok' : 'status-err'}`;
  }

  const activeUser = NutriApp.getCurrentUser();
  if (activeUser) {
    setStatus(loginStatus, `${t('label_signed_in')}: ${activeUser.name || activeUser.email}.`, true);
  }

  function renderHistory() {
    if (!historyNode) return;
    const user = NutriApp.getCurrentUser();
    if (!user) {
      historyNode.innerHTML = '<div class="history-item"><strong>Guest mode active</strong><p class="small-text">Sign in to keep reports across sessions.</p></div>';
      return;
    }

    const history = NutriApp.getHistory();
    if (!history.length) {
      historyNode.innerHTML = '<div class="history-item"><strong>No saved reports yet</strong><p class="small-text">Run an assessment to create your first snapshot.</p></div>';
      return;
    }

    historyNode.innerHTML = '';
    history.slice(0, 8).forEach((entry) => {
      const item = document.createElement('article');
      item.className = 'history-item';
      const risk = entry?.riskOutput?.category || 'Unknown';
      item.innerHTML = `
        <strong>${entry?.payload?.householdName || 'Household report'}</strong>
        <p class="small-text">${entry?.payload?.community || 'Community not set'} · ${NutriApp.formatDate(entry?.createdAt)}</p>
        <p class="small-text">Risk: ${risk}</p>
      `;
      historyNode.appendChild(item);
    });
  }

  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  if (mode === 'signup') {
    document.getElementById('signup-name').focus();
  } else {
    document.getElementById('login-email').focus();
  }

  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const result = NutriApp.login(email, password);

    if (!result.ok) {
      setStatus(loginStatus, result.error, false);
      return;
    }

    setStatus(loginStatus, t('auth_login_success'), true);

    const next = params.get('next') || './assessment.html';
    setTimeout(() => {
      window.location.href = next;
    }, 450);
  });

  signupForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;

    if (password !== confirm) {
      setStatus(signupStatus, t('auth_password_mismatch'), false);
      return;
    }

    const result = NutriApp.createAccount({ name, email, password });
    if (!result.ok) {
      setStatus(signupStatus, result.error, false);
      return;
    }

    setStatus(signupStatus, t('auth_signup_success'), true);
    signupForm.reset();
    document.getElementById('login-email').value = result.account.email;
    document.getElementById('login-email').focus();
  });

  window.addEventListener('nutri:lang-changed', () => {
    const user = NutriApp.getCurrentUser();
    if (user) {
      setStatus(loginStatus, `${t('label_signed_in')}: ${user.name || user.email}.`, true);
    }
    renderHistory();
  });

  renderHistory();
})();

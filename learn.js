(function () {
  const t = (key, vars) => (window.NutriApp?.t ? window.NutriApp.t(key, vars) : key);

  const runtimeKeys = window.NUTRIPATH_KEYS || {};
  const INTEGRATION_KEYS = {
    voiceApiKey: runtimeKeys.voiceApiKey || '',
    recipeApiKey: runtimeKeys.recipeApiKey || '',
  };
  const VOICE_API_BASE = 'https://dev.voice.ai/api/v1';
  const SPOONACULAR_API_BASE = 'https://api.spoonacular.com';
  const SPOONACULAR_PROXY_PATH = '/api/spoonacular';

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeText(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function listToHtml(items, emptyText) {
    if (!items.length) return `<li>${escapeHtml(emptyText)}</li>`;
    return items.map((item) => `<li>${item}</li>`).join('');
  }

  function badgeClass(level) {
    const key = String(level || '').toLowerCase();
    if (key.includes('urgent')) return 'severity-badge severity-urgent';
    if (key.includes('high') || key.includes('support this week')) return 'severity-badge severity-high';
    if (key.includes('moderate') || key.includes('improve meals')) return 'severity-badge severity-moderate';
    return 'severity-badge severity-low';
  }

  function initToolTabs(shellId, options = {}) {
    const shell = document.getElementById(shellId);
    if (!shell) return;

    const buttons = [...shell.querySelectorAll('.tool-tab-btn[data-tab]')];
    const panels = [...shell.querySelectorAll('.tool-panel[data-tool-tab]')];
    const focusActions = [...shell.querySelectorAll('[data-focus-actions]')];
    if (!buttons.length || !panels.length) return;

    const panelByTab = new Map();
    panels.forEach((panel) => {
      panelByTab.set(panel.dataset.toolTab, panel);
      panel.setAttribute('role', 'tabpanel');
    });

    buttons.forEach((button) => {
      button.setAttribute('role', 'tab');
    });

    function setFocusMode(enabled) {
      const allowOverview = options.allowOverview !== false;
      shell.classList.toggle('single-tool-view', enabled);
      shell.classList.toggle('overview-mode', allowOverview && !enabled);
      focusActions.forEach((node) => node.classList.toggle('hide', !enabled));
      if (Array.isArray(options.focusHideSelectors)) {
        options.focusHideSelectors.forEach((selector) => {
          document.querySelectorAll(selector).forEach((node) => {
            node.classList.toggle('hide', enabled);
          });
        });
      }
    }

    function getTabFromQuery() {
      if (!options.queryParam) return null;
      const params = new URLSearchParams(window.location.search);
      const candidate = params.get(options.queryParam);
      return candidate && panelByTab.has(candidate) ? candidate : null;
    }

    function getTabFromHash() {
      if (!options.useHash) return null;
      const hash = String(window.location.hash || '').replace('#', '');
      if (!hash) return null;
      const panel = panels.find((item) => item.id === hash);
      return panel ? panel.dataset.toolTab : null;
    }

    function setActive(tab, opts = {}) {
      const nextPanel = panelByTab.get(tab) || panelByTab.get(options.defaultTab) || panels[0];
      if (!nextPanel) return;

      buttons.forEach((button) => {
        const isActive = button.dataset.tab === nextPanel.dataset.toolTab;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      panels.forEach((panel) => {
        const isActive = panel === nextPanel;
        panel.classList.toggle('is-active', isActive);
      });

      if (opts.syncHash && options.useHash && nextPanel.id) {
        const url = new URL(window.location.href);
        if (url.hash !== `#${nextPanel.id}`) {
          url.hash = nextPanel.id;
          history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
        }
      }

      if (opts.syncQuery && options.queryParam) {
        const url = new URL(window.location.href);
        url.searchParams.set(options.queryParam, nextPanel.dataset.toolTab);
        if (options.useHash && nextPanel.id) {
          url.hash = nextPanel.id;
        }
        history.pushState(null, '', `${url.pathname}${url.search}${url.hash}`);
      }
    }

    buttons.forEach((button) => {
      button.addEventListener('click', (event) => {
        if (!button.dataset.tab) return;
        if (options.queryParam) {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
          event.preventDefault();
          setActive(button.dataset.tab, { syncHash: !!options.useHash, syncQuery: true });
          setFocusMode(!!options.focusedMode);
          return;
        }
        setActive(button.dataset.tab, { syncHash: !!options.useHash });
      });
    });

    function activateFromLocation() {
      const queryTab = getTabFromQuery();
      if (queryTab) {
        setActive(queryTab, { syncHash: false, syncQuery: false });
        setFocusMode(!!options.focusedMode);
        return true;
      }

      const hashTab = getTabFromHash();
      if (hashTab) {
        setActive(hashTab, { syncHash: false, syncQuery: false });
        setFocusMode(!!options.focusedMode);
        return true;
      }

      setFocusMode(false);
      return false;
    }

    const hasLocationPanel = activateFromLocation();
    if (!hasLocationPanel) {
      setActive(options.defaultTab || buttons[0].dataset.tab, { syncHash: false, syncQuery: false });
    }

    if (options.useHash) {
      window.addEventListener('hashchange', activateFromLocation);
    }
    if (options.queryParam) {
      window.addEventListener('popstate', activateFromLocation);
    }
  }

  function buildVoiceSupport() {
    const playBtn = document.getElementById('voice-play-result');
    const replayBtn = document.getElementById('voice-replay-result');
    const stopBtn = document.getElementById('voice-stop-result');
    const refreshVoicesBtn = document.getElementById('voice-refresh-voices');
    const providerSelect = document.getElementById('voice-provider-select');
    const voiceIdSelect = document.getElementById('voice-id-select');
    const slowMode = document.getElementById('voice-slow-mode');
    const statusNode = document.getElementById('voice-status');
    const summaryNode = document.getElementById('voice-last-summary');

    let latestText = '';
    let lastSpokenText = '';
    const audio = new Audio();
    let lastAudioUrl = '';

    function setStatus(text) {
      if (statusNode) statusNode.textContent = text;
    }

    function normalizedVoiceLanguage() {
      const raw = String(window.NutriApp?.getUiLanguage?.() || 'en').slice(0, 2).toLowerCase();
      const supported = new Set(['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'nl', 'pl', 'sv', 'ca']);
      return supported.has(raw) ? raw : 'en';
    }

    async function loadCloudVoices() {
      if (!voiceIdSelect) return;
      if (!INTEGRATION_KEYS.voiceApiKey) {
        voiceIdSelect.innerHTML = '<option value="">Default built-in voice</option>';
        setStatus('No cloud voice API key configured. Using browser voice.');
        return;
      }

      voiceIdSelect.innerHTML = '<option value="">Loading voices...</option>';
      try {
        const response = await fetch(`${VOICE_API_BASE}/tts/voices`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${INTEGRATION_KEYS.voiceApiKey}`,
          },
        });

        if (!response.ok) throw new Error(`Voice list failed (${response.status})`);
        const data = await response.json();
        const list = Array.isArray(data) ? data : Array.isArray(data?.voices) ? data.voices : Array.isArray(data?.data) ? data.data : [];
        const available = list.filter((item) => item && (!item.status || String(item.status).toUpperCase() === 'AVAILABLE'));

        voiceIdSelect.innerHTML = '<option value="">Default built-in voice</option>';
        available.forEach((voice) => {
          const option = document.createElement('option');
          option.value = String(voice.voice_id || '');
          option.textContent = voice.name ? `${voice.name}` : `Voice ${voice.voice_id}`;
          voiceIdSelect.appendChild(option);
        });

        setStatus(available.length ? `Loaded ${available.length} cloud voice(s).` : 'No custom cloud voices available. Using built-in voice.');
      } catch {
        voiceIdSelect.innerHTML = '<option value="">Default built-in voice</option>';
        setStatus('Could not load cloud voices. Browser fallback remains available.');
      }
    }

    function chooseVoice() {
      if (!window.speechSynthesis) return null;
      const voices = window.speechSynthesis.getVoices() || [];
      if (!voices.length) return null;

      const preferred = ['Google US English', 'Microsoft Aria', 'Samantha', 'Jenny', 'Daniel'];
      for (const name of preferred) {
        const hit = voices.find((voice) => voice.lang?.startsWith('en') && voice.name.includes(name));
        if (hit) return hit;
      }
      return voices.find((voice) => voice.lang?.toLowerCase().includes('en-us')) || voices.find((voice) => voice.lang?.startsWith('en')) || voices[0];
    }

    function cleanupAudioUrl() {
      if (lastAudioUrl && lastAudioUrl.startsWith('blob:')) URL.revokeObjectURL(lastAudioUrl);
      lastAudioUrl = '';
    }

    function playAudioBlob(blob, replay = false) {
      cleanupAudioUrl();
      lastAudioUrl = URL.createObjectURL(blob);
      audio.src = lastAudioUrl;
      audio.playbackRate = slowMode?.checked ? 0.9 : 1;
      audio.currentTime = 0;
      setStatus(replay ? 'Replaying cloud voice result...' : 'Playing cloud voice result...');
      return audio.play();
    }

    async function playAudioUrl(url, replay = false) {
      cleanupAudioUrl();
      lastAudioUrl = String(url || '');
      audio.src = lastAudioUrl;
      audio.playbackRate = slowMode?.checked ? 0.9 : 1;
      audio.currentTime = 0;
      setStatus(replay ? 'Replaying cloud voice result...' : 'Playing cloud voice result...');
      return audio.play();
    }

    async function speakWithCloud(message, replay = false) {
      if (!INTEGRATION_KEYS.voiceApiKey) return false;
      if (providerSelect && providerSelect.value !== 'cloud') return false;
      if (replay && audio.src) {
        audio.currentTime = 0;
        audio.playbackRate = slowMode?.checked ? 0.9 : 1;
        await audio.play();
        setStatus('Replaying last cloud voice result...');
        return true;
      }

      const payload = {
        text: message,
        language: normalizedVoiceLanguage(),
        model: 'voiceai-tts-v1-latest',
        audio_format: 'mp3',
      };
      if (voiceIdSelect && voiceIdSelect.value) payload.voice_id = voiceIdSelect.value;

      try {
        const response = await fetch(`${VOICE_API_BASE}/tts/speech`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${INTEGRATION_KEYS.voiceApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error(`Cloud voice failed (${response.status})`);
        const contentType = String(response.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('application/json')) {
          const payload = await response.json();
          if (payload?.audio_url) {
            await playAudioUrl(payload.audio_url, replay);
          } else if (payload?.audio_base64) {
            const binary = atob(payload.audio_base64);
            const bytes = new Uint8Array(binary.length);
            for (let index = 0; index < binary.length; index += 1) {
              bytes[index] = binary.charCodeAt(index);
            }
            await playAudioBlob(new Blob([bytes], { type: 'audio/mpeg' }), replay);
          } else {
            throw new Error('Cloud voice returned JSON without playable audio.');
          }
        } else {
          const blob = await response.blob();
          await playAudioBlob(blob, replay);
        }
        return true;
      } catch {
        setStatus('Cloud voice unavailable, using browser fallback.');
        return false;
      }
    }

    async function speak(text, replay = false) {
      const message = String(text || '').trim();
      if (!message) {
        setStatus('No result selected yet. Run a tool first.');
        return;
      }

      if (await speakWithCloud(message, replay)) {
        lastSpokenText = message;
        return;
      }

      if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
        if (window.NutriApp?.speak) window.NutriApp.speak(message);
        setStatus('Playing with browser fallback voice.');
        lastSpokenText = message;
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = 'en-US';
      utterance.voice = chooseVoice();
      utterance.pitch = 1;
      utterance.rate = slowMode?.checked ? 0.84 : 0.98;

      utterance.onstart = () => setStatus(replay ? 'Replaying result...' : 'Playing latest result...');
      utterance.onend = () => setStatus('Voice playback complete.');
      utterance.onerror = () => setStatus('Voice playback failed.');

      window.speechSynthesis.speak(utterance);
      lastSpokenText = message;
    }

    if (playBtn) {
      playBtn.addEventListener('click', async () => {
        speak(latestText, false);
      });
    }

    if (replayBtn) {
      replayBtn.addEventListener('click', async () => {
        speak(lastSpokenText || latestText, true);
      });
    }

    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        audio.pause();
        audio.currentTime = 0;
        setStatus('Voice stopped.');
      });
    }

    if (refreshVoicesBtn) {
      refreshVoicesBtn.addEventListener('click', loadCloudVoices);
    }

    if (providerSelect) {
      providerSelect.addEventListener('change', () => {
        if (providerSelect.value === 'cloud') {
          loadCloudVoices();
        } else {
          setStatus('Using browser voice fallback.');
        }
      });
    }

    audio.addEventListener('ended', () => {
      setStatus('Voice playback complete.');
    });

    window.addEventListener('beforeunload', () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      audio.pause();
      cleanupAudioUrl();
    });

    if (providerSelect && providerSelect.value === 'cloud') {
      loadCloudVoices();
    }

    return {
      setLatest(text) {
        latestText = String(text || '').trim();
        if (summaryNode) summaryNode.textContent = latestText || 'No result selected yet.';
      },
      speak(text) {
        speak(text, false);
      },
    };
  }

  function buildNextStepEngine() {
    const node = document.getElementById('action-next-steps');
    if (!node) {
      return {
        update() {},
      };
    }

    return {
      update(payload) {
        const title = payload?.title || 'Recommended next actions';
        const summary = payload?.summary || '';
        const steps = Array.isArray(payload?.steps) ? payload.steps.slice(0, 4) : [];

        node.innerHTML = '';

        const summaryCard = document.createElement('article');
        summaryCard.className = 'card';
        summaryCard.innerHTML = `
          <h4>${escapeHtml(title)}</h4>
          <p class="small-text">${escapeHtml(summary)}</p>
        `;
        node.appendChild(summaryCard);

        if (!steps.length) return;

        steps.forEach((step) => {
          const card = document.createElement('article');
          card.className = 'card';
          card.innerHTML = `
            <h4>${escapeHtml(step.title || 'Next action')}</h4>
            <p class="small-text">${escapeHtml(step.desc || '')}</p>
            <a class="btn btn-secondary btn-small" href="${escapeHtml(step.href || './index.html')}">${escapeHtml(step.cta || 'Open')}</a>
          `;
          node.appendChild(card);
        });
      },
    };
  }

  function initBudgetPlanner(engine, voice) {
    const budgetNode = document.getElementById('budget-weekly');
    const sizeNode = document.getElementById('budget-household');
    const priorityNode = document.getElementById('budget-priority');
    const applianceNode = document.getElementById('budget-appliances');
    const button = document.getElementById('budget-plan-btn');
    const resultNode = document.getElementById('budget-plan-result');
    if (!budgetNode || !sizeNode || !priorityNode || !applianceNode || !button || !resultNode) return;

    const foods = {
      protein: ['Eggs', 'Dry beans', 'Lentils', 'Peanut butter', 'Canned tuna', 'Greek yogurt'],
      iron: ['Lentils', 'Fortified cereal', 'Beans', 'Spinach', 'Chickpeas', 'Canned sardines'],
      pantry: ['Oats', 'Brown rice', 'Canned beans', 'Peanut butter', 'Shelf-stable milk', 'Whole grain pasta'],
      produceFallback: ['Frozen mixed vegetables', 'Cabbage', 'Carrots', 'Canned tomatoes', 'Apples', 'Bananas'],
      readyNoCook: ['Peanut butter + whole grain bread', 'Yogurt + oats', 'Canned fish + crackers', 'Banana + nut butter'],
    };

    function selectedAppliances() {
      return [...applianceNode.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
    }

    function rankByPriority(priority) {
      if (priority === 'protein') return [...foods.protein, ...foods.pantry].slice(0, 7);
      if (priority === 'iron') return [...foods.iron, ...foods.protein].slice(0, 7);
      if (priority === 'kid') return ['Eggs', 'Peanut butter', 'Yogurt', 'Oats', 'Bananas', 'Beans', 'Whole grain bread'];
      if (priority === 'senior') return ['Eggs', 'Yogurt', 'Soft beans', 'Oatmeal', 'Canned tuna', 'Bananas', 'Soup-friendly vegetables'];
      if (priority === 'pantry') return [...foods.pantry, ...foods.protein].slice(0, 7);
      return ['Beans', 'Eggs', 'Oats', 'Peanut butter', 'Frozen vegetables', 'Brown rice', 'Fortified cereal'];
    }

    button.addEventListener('click', () => {
      const weeklyBudget = Number(budgetNode.value || 0);
      const householdSize = Number(sizeNode.value || 0);
      const priority = priorityNode.value;
      const appliances = selectedAppliances();

      if (!weeklyBudget || !householdSize) {
        resultNode.classList.remove('hide');
        resultNode.innerHTML = '<p class="small-text">Enter weekly budget and household size to generate a realistic plan.</p>';
        return;
      }

      const perPerson = weeklyBudget / householdSize;
      const tier = perPerson < 12 ? 'Severe budget pressure' : perPerson < 20 ? 'Tight budget' : 'Moderate budget';
      const buyFirst = rankByPriority(priority);
      const proteinTop = foods.protein.slice(0, 4);
      const ironTop = foods.iron.slice(0, 4);
      const pantryTop = foods.pantry.slice(0, 5);
      const hasCookSurface = appliances.includes('stove') || appliances.includes('microwave');
      const prepMode = hasCookSurface
        ? 'Cook in batches and reuse leftovers for 2-3 meals.'
        : 'No-cook strategy detected: prioritize ready proteins and shelf-stable combinations.';

      const actions = [
        { title: 'Run Pantry Rescue now', desc: 'Convert your current ingredients into a better meal immediately.', cta: 'Open Pantry Rescue', href: './learn.html?tool=pantry#tool-pantry-rescue' },
        { title: 'Open Meal Builder', desc: 'Get a larger meal plan after selecting key foods to buy.', cta: 'Open Meal Builder', href: './meal-builder.html' },
        { title: 'Find food support points', desc: 'If budget is collapsing, route to verified support resources.', cta: 'Open Resource Map', href: './map.html' },
      ];

      resultNode.classList.remove('hide');
      resultNode.innerHTML = `
        <div class="result-head">
          <span class="${badgeClass(perPerson < 12 ? 'high' : perPerson < 20 ? 'moderate' : 'low')}">${escapeHtml(tier)}</span>
          <span class="small-text">$${perPerson.toFixed(2)} per person/week</span>
        </div>
        <p class="small-text"><strong>Plan focus:</strong> ${escapeHtml(prepMode)}</p>
        <div class="tool-columns">
          <div>
            <h4>Buy these before these</h4>
            <ol>${buyFirst.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>
          </div>
          <div>
            <h4>Best cheap protein options</h4>
            <ul>${listToHtml(proteinTop.map((item) => escapeHtml(item)), 'No protein list generated.')}</ul>
            <h4>Best cheap iron-support options</h4>
            <ul>${listToHtml(ironTop.map((item) => escapeHtml(item)), 'No iron list generated.')}</ul>
          </div>
        </div>
        <h4>Pantry-safe and shelf-stable options</h4>
        <ul>${listToHtml(pantryTop.map((item) => escapeHtml(item)), 'No pantry list generated.')}</ul>
        <h4>Swaps if fresh food is unavailable</h4>
        <ul>${listToHtml(foods.produceFallback.map((item) => escapeHtml(item)), 'No swaps available.')}</ul>
        ${
          hasCookSurface
            ? ''
            : `<h4>No-cook backup meals</h4><ul>${listToHtml(foods.readyNoCook.map((item) => escapeHtml(item)), 'No no-cook options available.')}</ul>`
        }
      `;

      const voiceSummary = `${tier}. Budget planner generated a buy-first list and protein and iron priorities. First actions: Run pantry rescue, open meal builder, and use resource map if access is unstable.`;
      voice.setLatest(voiceSummary);
      engine.update({
        title: `Budget Planner Result: ${tier}`,
        summary: `Generated a low-cost priority plan for a household of ${householdSize} with weekly budget of $${weeklyBudget}.`,
        steps: actions,
      });
    });
  }

  function initClaimChecker(engine, voice) {
    const input = document.getElementById('myth-input');
    const checkBtn = document.getElementById('myth-check-btn');
    const clearBtn = document.getElementById('myth-clear-btn');
    const resultNode = document.getElementById('myth-result');
    if (!input || !checkBtn || !clearBtn || !resultNode) return;

    const rules = [
      {
        keys: ['healthy food', 'too expensive', 'only expensive'],
        verdict: 'Likely myth',
        explanation: 'Affordable foods can still build nutrition when you prioritize protein and protective foods first.',
        corrected: 'Healthy food does not have to be expensive if we choose high-impact staples.',
        action: 'Use Budget Planner to generate a buy-first list for your budget.',
        href: './learn.html?tool=budget#tool-budget-planner',
      },
      {
        keys: ['overweight', 'cannot be malnourished', 'cant be malnourished'],
        verdict: 'Likely myth',
        explanation: 'A person can have enough calories but still lack protein, iron, or vitamins.',
        corrected: 'Weight alone does not rule out malnutrition risk.',
        action: 'Run Assessment and Pantry Rescue to assess diet quality and warning signals.',
        href: './assessment.html',
      },
      {
        keys: ['older', 'losing weight is normal', 'seniors naturally eat less'],
        verdict: 'Partly true / depends',
        explanation: 'Appetite may change with age, but ongoing weight loss can be a warning sign that needs follow-up.',
        corrected: 'Some appetite change is expected, but persistent weight loss is not automatically normal.',
        action: 'Use Urgency Tool and Resource Map if warning signs continue.',
        href: './learn.html?tool=escalation#tool-escalation',
      },
      {
        keys: ['protein only', 'only meat', 'protein comes from meat'],
        verdict: 'Likely myth',
        explanation: 'Protein also comes from beans, lentils, eggs, yogurt, tofu, nuts, and canned fish.',
        corrected: 'Meat is one source, but many affordable non-meat proteins are available.',
        action: 'Use Budget Planner to prioritize cheaper protein options.',
        href: './learn.html?tool=budget#tool-budget-planner',
      },
      {
        keys: ['skip meals', 'big dinner', 'skipping meals is fine'],
        verdict: 'Partly true / depends',
        explanation: 'Frequent meal skipping can worsen fatigue and nutrient gaps, especially in children and older adults.',
        corrected: 'Smaller consistent meals are usually safer than long meal gaps.',
        action: 'Use Pantry Rescue to build quick low-cost meals from what you already have.',
        href: './learn.html?tool=pantry#tool-pantry-rescue',
      },
    ];

    function detectRule(text) {
      const normalized = normalizeText(text);
      return rules.find((rule) => rule.keys.some((key) => normalized.includes(normalizeText(key))));
    }

    checkBtn.addEventListener('click', () => {
      const claim = String(input.value || '').trim();
      if (!claim) {
        resultNode.classList.remove('hide');
        resultNode.innerHTML = '<p class="small-text">Enter a claim first to run the checker.</p>';
        return;
      }

      const match = detectRule(claim);
      const fallback = {
        verdict: 'Partly true / depends',
        explanation: 'We cannot fully verify that exact claim yet with this quick checker.',
        corrected: 'Use a safer rule: prioritize protein, iron support, and warning-sign tracking.',
        action: 'Use Assessment or Budget Planner for a decision-ready next step.',
        href: './assessment.html',
      };

      const output = match || fallback;
      const actions = [
        { title: 'Run linked tool', desc: output.action, cta: 'Open tool', href: output.href },
        { title: 'Improve meals now', desc: 'Use Pantry Rescue with foods currently available.', cta: 'Open Pantry Rescue', href: './learn.html?tool=pantry#tool-pantry-rescue' },
      ];

      resultNode.classList.remove('hide');
      resultNode.innerHTML = `
        <div class="result-head">
          <span class="${badgeClass(output.verdict)}">${escapeHtml(output.verdict)}</span>
        </div>
        <p class="small-text"><strong>Claim:</strong> ${escapeHtml(claim)}</p>
        <p class="small-text"><strong>Why:</strong> ${escapeHtml(output.explanation)}</p>
        <p class="small-text"><strong>Corrected version:</strong> ${escapeHtml(output.corrected)}</p>
        <div class="tool-action-row">
          <a class="btn btn-secondary btn-small" href="${escapeHtml(output.href)}">Take practical action</a>
        </div>
      `;

      const voiceSummary = `${output.verdict}. ${output.explanation} Corrected statement: ${output.corrected}.`;
      voice.setLatest(voiceSummary);
      engine.update({
        title: `Claim Checker: ${output.verdict}`,
        summary: output.explanation,
        steps: actions,
      });
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      resultNode.classList.add('hide');
      resultNode.innerHTML = '';
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        checkBtn.click();
      }
    });
  }

  function initEscalationTool(engine, voice) {
    const memberNode = document.getElementById('escalation-member');
    const accessNode = document.getElementById('escalation-access');
    const signsNode = document.getElementById('escalation-signs');
    const button = document.getElementById('escalation-check-btn');
    const resultNode = document.getElementById('escalation-result');
    if (!memberNode || !accessNode || !signsNode || !button || !resultNode) return;

    const signWeights = {
      poor_appetite: 3,
      weight_loss: 5,
      fatigue: 4,
      pale_skin: 4,
      swelling: 8,
      confusion: 8,
      missed_meals: 4,
      low_food_access: 4,
    };

    function selectedSigns() {
      return [...signsNode.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
    }

    button.addEventListener('click', () => {
      const member = memberNode.value;
      const access = accessNode.value;
      const selected = selectedSigns();

      const has = (key) => selected.includes(key);
      let score = selected.reduce((sum, key) => sum + (signWeights[key] || 0), 0);
      if (access === 'limited') score += 2;
      if (access === 'none') score += 4;

      const urgentPattern =
        (member === 'older' && has('weight_loss') && has('confusion')) ||
        (member === 'child' && has('poor_appetite') && has('fatigue') && has('pale_skin')) ||
        (has('swelling') && has('fatigue')) ||
        (has('missed_meals') && has('low_food_access') && has('weight_loss'));

      let level = 'Monitor at home';
      let explanation = 'No severe pattern detected right now. Continue close monitoring and improve meal quality.';
      if (urgentPattern || score >= 18) {
        level = 'Urgent evaluation recommended';
        explanation = 'A concerning warning pattern is present. Fast in-person follow-up is safer.';
      } else if (score >= 12) {
        level = 'Find support this week';
        explanation = 'Warning signals and access barriers suggest support should be arranged this week.';
      } else if (score >= 7) {
        level = 'Improve meals now';
        explanation = 'There are early warning signals. Upgrade protein and iron support now and re-check soon.';
      }

      const actions = [];
      if (level === 'Urgent evaluation recommended') {
        actions.push({ title: 'Route to verified support now', desc: 'Use Resource Map immediately.', cta: 'Open Resource Map', href: './map.html' });
        actions.push({ title: 'Prepare quick nutrition support', desc: 'Use Pantry Rescue while arranging follow-up.', cta: 'Open Pantry Rescue', href: './learn.html?tool=pantry#tool-pantry-rescue' });
      } else if (level === 'Find support this week') {
        actions.push({ title: 'Check nearby support points', desc: 'Find clinics or food support services this week.', cta: 'Open Resource Map', href: './map.html' });
        actions.push({ title: 'Stabilize household meals', desc: 'Use Budget Planner and Pantry Rescue for immediate meal upgrades.', cta: 'Open Budget Planner', href: './learn.html?tool=budget#tool-budget-planner' });
      } else if (level === 'Improve meals now') {
        actions.push({ title: 'Run Pantry Rescue', desc: 'Prioritize protein and protective foods in next meal.', cta: 'Open Pantry Rescue', href: './learn.html?tool=pantry#tool-pantry-rescue' });
        actions.push({ title: 'Re-check symptoms', desc: 'Re-run this tool after 3-7 days.', cta: 'Re-run in Action Hub', href: './learn.html?tool=escalation#tool-escalation' });
      } else {
        actions.push({ title: 'Keep monitoring', desc: 'Track appetite, energy, and meal consistency.', cta: 'Take Assessment', href: './assessment.html' });
      }

      resultNode.classList.remove('hide');
      resultNode.innerHTML = `
        <div class="result-head">
          <span class="${badgeClass(level)}">${escapeHtml(level)}</span>
          <span class="small-text">Escalation score: ${score}</span>
        </div>
        <p class="small-text"><strong>Why this guidance:</strong> ${escapeHtml(explanation)}</p>
        <p class="small-text"><strong>Checked signs:</strong> ${escapeHtml(selected.length ? selected.join(', ').replace(/_/g, ' ') : 'No signs selected')}</p>
        <div class="tool-action-row">
          ${actions
            .map((item) => `<a class="btn btn-secondary btn-small" href="${escapeHtml(item.href)}">${escapeHtml(item.cta)}</a>`)
            .join('')}
        </div>
      `;

      const voiceSummary = `${level}. ${explanation} Next actions: ${actions.map((item) => item.title).join('. ')}.`;
      voice.setLatest(voiceSummary);
      engine.update({
        title: `Escalation Result: ${level}`,
        summary: explanation,
        steps: actions,
      });
    });
  }

  function initPantryRescue(engine, voice) {
    const input = document.getElementById('hub-food-input');
    const datalist = document.getElementById('hub-food-options');
    const addButton = document.getElementById('hub-add-food');
    const clearButton = document.getElementById('hub-clear-foods');
    const analyzeButton = document.getElementById('hub-analyze-foods');
    const selectedNode = document.getElementById('hub-selected-foods');
    const statusNode = document.getElementById('hub-food-status');
    const resultShell = document.getElementById('hub-food-results');

    const mealList = document.getElementById('hub-meal-list');
    const betterList = document.getElementById('hub-better-list');
    const nutrientList = document.getElementById('hub-nutrient-list');
    const gapList = document.getElementById('hub-gap-list');
    const addonList = document.getElementById('hub-addon-list');
    const swapList = document.getElementById('hub-swap-list');
    const easyFixNode = document.getElementById('hub-easy-fix');
    const qualityNode = document.getElementById('hub-quality-result');
    const nextStepsNode = document.getElementById('hub-next-steps');

    if (!input || !datalist || !addButton || !clearButton || !analyzeButton || !selectedNode || !statusNode || !resultShell || !mealList || !gapList || !swapList || !nextStepsNode) {
      return;
    }

    const foods = (window.NutriData?.foods || []).slice().sort((a, b) => a.name.localeCompare(b.name));
    const selectedFoods = new Map();
    let customCounter = 1;

    const nutrientTitle = {
      protein: 'Protein',
      iron: 'Iron',
      zinc: 'Zinc',
      calories: 'Calories',
      vitaminA: 'Vitamin A',
      vitaminC: 'Vitamin C',
      fiber: 'Fiber',
      carbs: 'Carbohydrates',
      fat: 'Healthy fats',
    };

    const criticalNutrients = ['protein', 'iron', 'vitaminA', 'vitaminC', 'fiber', 'calories'];
    const processedKeywords = ['chips', 'cookie', 'soda', 'instant noodle', 'ramen', 'candy', 'pastry'];

    function foodLabel(food) {
      if (food.custom) return food.name;
      const key = `food_${food.id}`;
      const translated = t(key);
      return translated === key ? food.name : translated;
    }

    function setStatus(text) {
      statusNode.textContent = text;
    }

    function renderFoodOptions() {
      datalist.innerHTML = '';
      foods.forEach((food) => {
        const option = document.createElement('option');
        option.value = foodLabel(food);
        datalist.appendChild(option);
      });
    }

    function inferCustomNutrients(name) {
      const text = normalizeText(name);
      const nutrients = new Set();
      const rules = [
        { words: ['bean', 'lentil', 'egg', 'fish', 'tuna', 'chicken', 'tofu', 'yogurt', 'milk', 'peanut'], nutrients: ['protein'] },
        { words: ['rice', 'bread', 'pasta', 'potato', 'oat', 'cereal', 'tortilla', 'noodle'], nutrients: ['carbs', 'calories'] },
        { words: ['spinach', 'kale', 'broccoli', 'carrot', 'pepper', 'tomato', 'orange', 'fruit', 'vegetable', 'cabbage'], nutrients: ['vitaminA', 'vitaminC', 'fiber'] },
        { words: ['nut', 'seed', 'avocado', 'oil'], nutrients: ['fat', 'calories'] },
      ];

      rules.forEach((rule) => {
        if (rule.words.some((word) => text.includes(word))) {
          rule.nutrients.forEach((item) => nutrients.add(item));
        }
      });

      if (!nutrients.size) nutrients.add('calories');
      return [...nutrients];
    }

    function makeCustomFood(raw) {
      const clean = String(raw || '').trim();
      const display = clean
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');

      const id = `custom_${customCounter++}`;
      return {
        id,
        key: id,
        custom: true,
        name: display,
        nutrients: inferCustomNutrients(display),
        cost: 1.6,
        score: 48,
      };
    }

    function resolveFood(raw) {
      const query = normalizeText(raw);
      if (!query) return null;

      const exact = foods.find((food) => normalizeText(food.name) === query || normalizeText(foodLabel(food)) === query);
      if (exact) return { ...exact, key: exact.id, custom: false };

      const partial = foods.find((food) => normalizeText(food.name).includes(query) || normalizeText(foodLabel(food)).includes(query));
      if (partial) return { ...partial, key: partial.id, custom: false };

      return makeCustomFood(raw);
    }

    function renderSelectedFoods() {
      selectedNode.innerHTML = '';
      const list = [...selectedFoods.values()];
      if (!list.length) {
        setStatus('Add foods currently available at home to run rescue planning.');
        return;
      }

      list.forEach((food) => {
        const chip = document.createElement('span');
        chip.className = 'selected-food-chip';
        chip.innerHTML = `${escapeHtml(foodLabel(food))} <button type="button" data-remove-food="${food.key}" aria-label="Remove ${escapeHtml(foodLabel(food))}">x</button>`;
        selectedNode.appendChild(chip);
      });

      setStatus(`${list.length} food item(s) selected. Run rescue plan.`);
    }

    function clearOutputs() {
      [mealList, betterList, nutrientList, gapList, addonList, swapList].forEach((node) => {
        if (node) node.innerHTML = '';
      });
      if (easyFixNode) easyFixNode.textContent = '';
      if (qualityNode) qualityNode.innerHTML = '';
      nextStepsNode.innerHTML = '';
    }

    function renderList(node, items, emptyText) {
      if (!node) return;
      node.innerHTML = listToHtml(items, emptyText);
    }

    function analyzeCoverage(foodList) {
      const coverage = new Map();
      foodList.forEach((food) => {
        food.nutrients.forEach((nutrient) => {
          if (!coverage.has(nutrient)) coverage.set(nutrient, []);
          coverage.get(nutrient).push(foodLabel(food));
          if ((nutrient === 'carbs' || nutrient === 'fat') && !coverage.has('calories')) {
            coverage.set('calories', [foodLabel(food)]);
          }
        });
      });
      return coverage;
    }

    function buildRescueMeals(foodList) {
      const hasNutrient = (food, nutrient) => food.nutrients.includes(nutrient);
      const proteins = foodList.filter((food) => hasNutrient(food, 'protein'));
      const energy = foodList.filter((food) => hasNutrient(food, 'carbs') || hasNutrient(food, 'calories'));
      const protective = foodList.filter(
        (food) => hasNutrient(food, 'vitaminA') || hasNutrient(food, 'vitaminC') || hasNutrient(food, 'fiber') || hasNutrient(food, 'iron'),
      );

      const p = proteins[0] || foodList[0];
      const e = energy[0] || foodList[0];
      const v = protective[0] || foodList[Math.min(1, foodList.length - 1)] || foodList[0];

      const bestNow = [
        `<strong>Rescue bowl:</strong> warm ${escapeHtml(foodLabel(e))}, add ${escapeHtml(foodLabel(p))}, then add ${escapeHtml(foodLabel(v))}.`,
      ];

      if (foodList.length >= 2) {
        bestNow.push(`<strong>Quick plate:</strong> pair ${escapeHtml(foodLabel(foodList[0]))} with ${escapeHtml(foodLabel(foodList[1]))}, then add any vegetable or bean item.`);
      }

      return bestNow;
    }

    function runRescue() {
      const selected = [...selectedFoods.values()];
      if (!selected.length) {
        setStatus('Add at least one food to run rescue planning.');
        resultShell.classList.add('hide');
        return;
      }

      const coverage = analyzeCoverage(selected);
      const bestNow = buildRescueMeals(selected);

      const strengths = [...coverage.keys()]
        .filter((nutrient) => criticalNutrients.includes(nutrient))
        .slice(0, 5)
        .map((nutrient) => `<strong>${escapeHtml(nutrientTitle[nutrient] || nutrient)}:</strong> available now`);

      const gaps = criticalNutrients
        .filter((nutrient) => !coverage.has(nutrient))
        .map((nutrient) => {
          const msg =
            nutrient === 'protein'
              ? 'Add low-cost protein (beans, eggs, peanut butter, canned fish).'
              : nutrient === 'iron'
                ? 'Add iron support (lentils, beans, fortified cereal, spinach).'
                : nutrient === 'vitaminA'
                  ? 'Add orange/dark-green produce or frozen vegetables.'
                  : nutrient === 'vitaminC'
                    ? 'Add tomato, citrus, cabbage, or fruit.'
                    : nutrient === 'fiber'
                      ? 'Add oats, beans, whole grains, or vegetables.'
                      : 'Add an energy food so meals are filling enough.';
          return `<strong>${escapeHtml(nutrientTitle[nutrient] || nutrient)}:</strong> ${escapeHtml(msg)}`;
        });

      const lowCostAdds = [
        'Eggs',
        'Dry beans',
        'Lentils',
        'Peanut butter',
        'Canned tuna',
        'Frozen mixed vegetables',
      ];

      const betterVersion = [
        `<strong>Upgrade option:</strong> keep your current meal and add one protein (${escapeHtml(lowCostAdds[0])} or ${escapeHtml(lowCostAdds[1])}) plus one protective food (${escapeHtml(lowCostAdds[5])}).`,
        `<strong>If budget is tight:</strong> add ${escapeHtml(lowCostAdds[3])} to breakfast and ${escapeHtml(lowCostAdds[2])} to one main meal this week.`,
      ];

      const swaps = [
        'No fresh vegetables? Use frozen mixed vegetables or cabbage.',
        'No meat? Use beans, lentils, eggs, tofu, or canned fish.',
        'Only refined carbs at home? Add beans or peanut butter to reduce nutrient gaps.',
      ];

      const normalizedSelected = normalizeText(selected.map((item) => item.name).join(' '));
      const processedHits = processedKeywords.filter((word) => normalizedSelected.includes(word));
      if (processedHits.length) {
        swaps.push('Processed-food heavy pattern detected. Keep current foods if needed, but pair each meal with protein + one protective food.');
      }

      const qualityScore =
        (coverage.has('protein') ? 2 : 0) +
        (coverage.has('iron') ? 1 : 0) +
        (coverage.has('vitaminA') || coverage.has('vitaminC') ? 1 : 0) +
        (selected.length >= 3 ? 1 : 0) -
        (processedHits.length ? 1 : 0);

      const qualityText = qualityScore >= 4 ? 'Good enough for now' : 'Needs improvement';
      const qualityMessage =
        qualityScore >= 4
          ? 'Current foods can support a workable meal today. Keep improving with one extra protein or protective food.'
          : 'Current foods are likely too weak in key nutrients. Add one low-cost protein and one protective food as soon as possible.';

      renderList(mealList, bestNow, 'Add more foods to generate meal rescue ideas.');
      renderList(betterList, betterVersion, 'No improved version generated yet.');
      renderList(nutrientList, strengths, 'No clear strengths detected yet.');
      renderList(gapList, gaps, 'No major nutrient gaps detected in this quick check.');
      renderList(addonList, lowCostAdds.map((item) => escapeHtml(item)), 'No add-on suggestions available.');
      renderList(swapList, swaps.map((item) => escapeHtml(item)), 'No swap suggestions available.');

      if (easyFixNode) {
        easyFixNode.innerHTML = `<strong>Easiest affordable improvement:</strong> Add one protein food in your next meal and one protective food before end of day.`;
      }

      if (qualityNode) {
        qualityNode.innerHTML = `
          <div class="result-head">
            <span class="${badgeClass(qualityText)}">${escapeHtml(qualityText)}</span>
          </div>
          <p class="small-text">${escapeHtml(qualityMessage)}</p>
        `;
      }

      nextStepsNode.innerHTML = `
        <p><strong>Next step 1:</strong> Make the rescue meal today.</p>
        <p><strong>Next step 2:</strong> Add one cheap protein this week.</p>
        <p><strong>Next step 3:</strong> <a href="./assessment.html">Run Assessment</a> if warning signs are present.</p>
        <p><strong>Next step 4:</strong> <a href="./map.html">Open Resource Map</a> if access is unstable.</p>
      `;

      resultShell.classList.remove('hide');
      setStatus(`Rescue plan ready for ${selected.length} food item(s).`);

      const nextSteps = [
        { title: 'Check household risk', desc: 'Use Assessment if symptoms or low appetite are present.', cta: 'Open Assessment', href: './assessment.html' },
        { title: 'Plan low-cost groceries', desc: 'Use Budget Planner to stabilize nutrition this week.', cta: 'Open Budget Planner', href: './learn.html?tool=budget#tool-budget-planner' },
        { title: 'Find support if access is unstable', desc: 'Locate verified clinics and food support.', cta: 'Open Resource Map', href: './map.html' },
      ];

      const voiceSummary = `${qualityText}. ${qualityMessage} Best action now: make the rescue meal, then add one cheap protein and one protective food.`;
      voice.setLatest(voiceSummary);
      engine.update({
        title: `Pantry Rescue: ${qualityText}`,
        summary: qualityMessage,
        steps: nextSteps,
      });
    }

    function addFood() {
      const raw = String(input.value || '').trim();
      const resolved = resolveFood(raw);
      if (!resolved) {
        setStatus('Type a food first, then click Add food.');
        return;
      }

      selectedFoods.set(resolved.key, resolved);
      input.value = '';
      renderSelectedFoods();
      clearOutputs();
      resultShell.classList.add('hide');
    }

    addButton.addEventListener('click', addFood);
    analyzeButton.addEventListener('click', runRescue);

    clearButton.addEventListener('click', () => {
      selectedFoods.clear();
      input.value = '';
      clearOutputs();
      resultShell.classList.add('hide');
      renderSelectedFoods();
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addFood();
      }
    });

    selectedNode.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const removeId = target.dataset.removeFood;
      if (!removeId) return;
      selectedFoods.delete(removeId);
      renderSelectedFoods();
      clearOutputs();
      resultShell.classList.add('hide');
    });

    window.addEventListener('nutri:lang-changed', renderFoodOptions);

    renderFoodOptions();
    renderSelectedFoods();
  }

  function initRecipeWidget(engine, voice) {
    const recipeShell = document.getElementById('recipe-tools-shell');
    if (!recipeShell) return;

    const nutritionQuery = document.getElementById('recipe-nutrition-query');
    const minProteinNode = document.getElementById('recipe-min-protein');
    const maxCaloriesNode = document.getElementById('recipe-max-calories');
    const nutritionBtn = document.getElementById('recipe-nutrition-btn');
    const nutritionResult = document.getElementById('recipe-nutrition-result');
    const extractUrlInput = document.getElementById('recipe-url-input');
    const extractBtn = document.getElementById('recipe-extract-btn');
    const extractResult = document.getElementById('recipe-extract-result');
    const classifyInput = document.getElementById('recipe-classify-input');
    const classifyBtn = document.getElementById('recipe-classify-btn');
    const classifyResult = document.getElementById('recipe-classify-result');
    const mealTimeframeNode = document.getElementById('recipe-meal-timeframe');
    const mealCaloriesNode = document.getElementById('recipe-meal-calories');
    const mealBtn = document.getElementById('recipe-meal-btn');
    const mealResult = document.getElementById('recipe-meal-result');
    const chatInput = document.getElementById('recipe-chat-input');
    const chatBtn = document.getElementById('recipe-chat-btn');
    const chatResult = document.getElementById('recipe-chat-result');
    const remixRestaurant = document.getElementById('recipe-remix-restaurant');
    const remixItem = document.getElementById('recipe-remix-item');
    const remixDiet = document.getElementById('recipe-remix-diet');
    const remixPriority = document.getElementById('recipe-remix-priority');
    const remixGoals = document.getElementById('recipe-remix-goals');
    const remixGenerateBtn = document.getElementById('recipe-remix-generate');
    const remixResetBtn = document.getElementById('recipe-remix-reset');
    const remixResult = document.getElementById('recipe-remix-result');

    function setLoading(node, isLoading, text = 'Loading...') {
      if (!node) return;
      node.classList.toggle('is-loading', isLoading);
      if (isLoading) node.textContent = text;
    }

    function recipeLink(id, title) {
      const slug = String(title || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      return `https://spoonacular.com/recipes/${slug || 'recipe'}-${id}`;
    }

    function nutrientValue(recipe, name) {
      const list = recipe?.nutrition?.nutrients;
      if (!Array.isArray(list)) return null;
      const hit = list.find((item) => String(item?.name || '').toLowerCase() === name.toLowerCase());
      if (!hit || !Number.isFinite(hit.amount)) return null;
      return `${hit.amount.toFixed(0)}${hit.unit || ''}`;
    }

    async function spoonFetch(path, { method = 'GET', params = {}, form = null } = {}) {
      const normalizedMethod = String(method || 'GET').toUpperCase();

      try {
        const proxyResponse = await fetch(SPOONACULAR_PROXY_PATH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path,
            method: normalizedMethod,
            params,
            form,
          }),
        });
        const proxyPayload = await proxyResponse.json().catch(() => null);
        if (!proxyResponse.ok) {
          const rawMessage = proxyPayload?.error || proxyPayload?.message || '';
          const message = String(rawMessage).includes('SPOONACULAR_API_KEY')
            ? 'Recipe service is not configured yet. Please try again later.'
            : rawMessage || `Recipe service failed (${proxyResponse.status})`;
          throw new Error(message);
        }
        return proxyPayload;
      } catch (proxyError) {
        if (!INTEGRATION_KEYS.recipeApiKey) {
          const message = proxyError?.message || 'Recipe service is temporarily unavailable. Please try again.';
          throw new Error(message);
        }
      }

      const url = new URL(`${SPOONACULAR_API_BASE}${path}`);
      Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        url.searchParams.set(key, String(value));
      });
      url.searchParams.set('apiKey', INTEGRATION_KEYS.recipeApiKey);

      const request = { method: normalizedMethod };
      if (normalizedMethod !== 'GET' && form) {
        request.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
        request.body = new URLSearchParams(form).toString();
      }

      const response = await fetch(url.toString(), request);
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Spoonacular request failed (${response.status})`);
      }
      return response.json();
    }

    async function fetchShoppingList(recipeIds) {
      const counts = new Map();
      for (const id of recipeIds.slice(0, 10)) {
        try {
          const info = await spoonFetch(`/recipes/${id}/ingredientWidget.json`);
          const ingredients = Array.isArray(info?.ingredients) ? info.ingredients : [];
          ingredients.forEach((item) => {
            const name = String(item?.name || '').trim();
            if (!name) return;
            counts.set(name, (counts.get(name) || 0) + 1);
          });
        } catch {
          continue;
        }
      }
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 20)
        .map(([name, score]) => `${name} (${score} recipe${score > 1 ? 's' : ''})`);
    }

    function updateEngine(title, summary, steps, voiceSummary) {
      engine.update({ title, summary, steps });
      voice.setLatest(voiceSummary || summary);
    }

    function containsAny(text, words) {
      return words.some((word) => text.includes(word));
    }

    function choose(list, index = 0) {
      if (!Array.isArray(list) || !list.length) return '';
      return list[Math.abs(index) % list.length];
    }

    function buildFastFoodRemix(payload, variant = 0) {
      const restaurant = String(payload.restaurant || '').trim();
      const item = String(payload.item || '').trim();
      const diet = String(payload.diet || 'none');
      const priority = String(payload.priority || 'balanced');
      const goals = String(payload.goals || '').trim();
      const text = normalizeText(`${restaurant} ${item} ${goals}`);

      const isVegetarianRequest =
        diet === 'vegetarian' ||
        diet === 'vegan' ||
        containsAny(text, ['vegetarian', 'veggie', 'vegan', 'cauliflower', 'black bean', 'mushroom', 'falafel', 'plant']);

      const isVegan = diet === 'vegan' || containsAny(text, ['vegan', 'dairy free', 'dairy-free']);
      const isSpicy = containsAny(text, ['spicy', 'hot', 'nashville', 'buffalo', 'chili', 'jalapeno']);
      const wantsCrispy = containsAny(text, ['crispy', 'fried', 'crunchy', 'tender', 'nugget']);
      const isBurger = containsAny(text, ['burger', 'slider', 'sandwich']);
      const isWrap = containsAny(text, ['wrap', 'burrito']);
      const isTaco = containsAny(text, ['taco']);
      const hasFries = containsAny(text, ['fries', 'wedges', 'chips']);

      let protein = 'chicken breast';
      if (isVegetarianRequest) {
        protein = containsAny(text, ['cauliflower']) ? 'cauliflower steak patty' : choose(['black bean patty', 'chickpea patty'], variant);
      } else if (containsAny(text, ['beef', 'burger', 'double'])) {
        protein = '93% lean ground turkey patty';
      } else if (containsAny(text, ['fish', 'salmon', 'shrimp'])) {
        protein = 'fish fillet (baked or air-fried)';
      }

      const base = isBurger
        ? choose(['whole wheat burger bun', 'whole grain brioche-style bun'], variant)
        : isWrap
          ? 'high-fiber tortilla'
          : isTaco
            ? 'corn tortillas'
            : 'brown rice base';

      const sauce = isVegan
        ? (isSpicy ? 'chili-lime tahini sauce' : 'lemon-herb tahini sauce')
        : (isSpicy ? 'Greek yogurt hot sauce' : 'Greek yogurt herb sauce');

      const side = hasFries ? choose(['baked potato wedges', 'air-roasted sweet potato fries'], variant) : 'quick cabbage slaw';

      const smartSwap = `${wantsCrispy ? 'Air-crisped' : 'Grilled'} ${isSpicy ? 'spicy ' : ''}${protein} with ${base}, ${sauce}, and ${side}`;

      const groceries = [
        protein,
        base,
        isVegan ? 'tahini' : 'plain Greek yogurt',
        isSpicy ? 'hot sauce or chili paste' : 'lemon + garlic',
        hasFries ? 'potatoes or sweet potatoes' : 'shredded cabbage',
        'paprika + garlic powder + black pepper',
        'lettuce, tomato, onion',
      ];

      const detailedSteps = [
        `Step 1: Prep your main item. Season ${protein} with paprika, garlic powder, black pepper, and a small amount of oil spray.`,
        `Step 2: Cook for texture. ${wantsCrispy ? 'Air-fry or oven-bake at high heat until crisp.' : 'Pan-sear or bake until fully cooked and lightly browned.'}`,
        `Step 3: Build the sauce. Mix ${sauce} and keep it thick so the sandwich/wrap still feels like fast food.`,
        `Step 4: Prep the base and toppings. Warm ${base}, then add lettuce, onion, and tomato for crunch.`,
        `Step 5: Make the side. Cook ${side} with minimal oil and keep seasoning bold (salt, pepper, paprika).`,
        'Step 6: Assemble and taste-adjust. Add sauce last, then increase spice or acidity until it matches your original craving.',
      ];

      const groceryOnly = [
        `1) Buy a ready veggie/chicken patty that matches your preference (${isVegetarianRequest ? 'vegetarian' : 'lean-protein'}).`,
        `2) Pair it with ${base} and pre-cut salad mix.`,
        `3) Use ${sauce} style from the sauce aisle or make a quick 2-minute version at home.`,
        `4) Add frozen potato wedges or bagged slaw so the full meal still feels complete.`,
      ];

      const whyBetter = [
        'Less deep-frying and less heavy sauce lowers total calories and excess oil.',
        isVegetarianRequest ? 'Keeps the meal vegetarian as requested.' : 'Keeps protein quality high with a leaner main item.',
        priority === 'health' ? 'Leans harder toward health balance while keeping flavor.' : 'Keeps taste and texture close to the original fast-food experience.',
      ];

      const nutritionEstimate = {
        calories: priority === 'health' ? '380-520' : '450-620',
        protein: isVegetarianRequest ? '18-30g' : '28-42g',
        fat: priority === 'health' ? 'low to moderate' : 'moderate',
      };

      return {
        title: `${item || 'Fast food item'} remix from ${restaurant || 'your selected place'}`,
        smartSwap,
        groceries,
        detailedSteps,
        groceryOnly,
        whyBetter,
        keepVibe: `Still ${isSpicy ? 'spicy, ' : ''}${wantsCrispy ? 'crispy, ' : ''}and satisfying in the same format you asked for.`,
        nutritionEstimate,
      };
    }

    function renderFastFoodRemix(output) {
      remixResult.innerHTML = `
        <div class="recipe-mini-card">
          <strong>Fast remix:</strong> ${escapeHtml(output.smartSwap)}
        </div>
        <div class="recipe-mini-card">
          <strong>What to buy</strong>
          <ul class="recipe-list">
            ${output.groceries.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </div>
        <div class="recipe-mini-card">
          <strong>Step-by-step (home)</strong>
          <ol class="recipe-list">
            ${output.detailedSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}
          </ol>
        </div>
        <div class="recipe-mini-card">
          <strong>Grocery-only shortcut</strong>
          <ol class="recipe-list">
            ${output.groceryOnly.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}
          </ol>
        </div>
        <div class="recipe-mini-card">
          <strong>Why better</strong>
          <ul class="recipe-list">
            ${output.whyBetter.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
          </ul>
          <div class="small-text" style="margin-top: 0.4rem;"><strong>Keep the vibe:</strong> ${escapeHtml(output.keepVibe)}</div>
          <div class="small-text" style="margin-top: 0.35rem;"><strong>Estimated nutrition:</strong> ${escapeHtml(output.nutritionEstimate.calories)} calories · ${escapeHtml(output.nutritionEstimate.protein)} protein · ${escapeHtml(output.nutritionEstimate.fat)} fat</div>
        </div>
      `;
    }

    nutritionBtn?.addEventListener('click', async () => {
      setLoading(nutritionResult, true, 'Searching by nutrition...');
      try {
        const data = await spoonFetch('/recipes/complexSearch', {
          params: {
            query: nutritionQuery?.value || '',
            number: 6,
            minProtein: minProteinNode?.value || '',
            maxCalories: maxCaloriesNode?.value || '',
            addRecipeInformation: true,
            addRecipeNutrition: true,
          },
        });

        const recipes = Array.isArray(data?.results) ? data.results : [];
        if (!recipes.length) {
          nutritionResult.innerHTML = '<p>No matches for those nutrition filters.</p>';
          return;
        }

        nutritionResult.innerHTML = recipes
          .map((recipe) => {
            const protein = nutrientValue(recipe, 'Protein');
            const calories = nutrientValue(recipe, 'Calories');
            const iron = nutrientValue(recipe, 'Iron');
            return `
              <div class="recipe-mini-card">
                <strong>${escapeHtml(recipe.title)}</strong>
                <div class="small-text">Protein: ${escapeHtml(protein || 'n/a')} · Calories: ${escapeHtml(calories || 'n/a')} · Iron: ${escapeHtml(iron || 'n/a')}</div>
                <div class="small-text">Ready in ${recipe.readyInMinutes || 'n/a'} min</div>
                <a class="btn btn-secondary btn-small" href="${escapeHtml(recipe.sourceUrl || recipeLink(recipe.id, recipe.title))}" target="_blank" rel="noreferrer">Open recipe</a>
              </div>
            `;
          })
          .join('');

        updateEngine(
          'Nutrition Requirement Recipe Search',
          'Generated recipe options filtered by nutrition targets.',
          [
            { title: 'Use Meal Builder', desc: 'Adapt top recipes to current pantry constraints.', cta: 'Open Meal Builder', href: './meal-builder.html' },
            { title: 'Run assessment if risk patterns continue', desc: 'Use the full assessment flow for structured risk output.', cta: 'Open Assessment', href: './assessment.html' },
          ],
          'Nutrition-based recipe search complete. Review protein and calorie targets.',
        );
      } catch (error) {
        nutritionResult.innerHTML = `<p>Nutrition search failed. ${escapeHtml(error.message)}</p>`;
      } finally {
        nutritionResult.classList.remove('is-loading');
      }
    });

    extractBtn?.addEventListener('click', async () => {
      const url = String(extractUrlInput?.value || '').trim();
      if (!url) {
        extractResult.innerHTML = '<p>Add a recipe URL first.</p>';
        return;
      }
      setLoading(extractResult, true, 'Extracting recipe...');
      try {
        const recipe = await spoonFetch('/recipes/extract', {
          params: {
            url,
          },
        });

        const ingredients = (recipe?.extendedIngredients || []).slice(0, 8).map((item) => item.original || item.name).filter(Boolean);
        extractResult.innerHTML = `
          <div class="recipe-mini-card">
            <strong>${escapeHtml(recipe?.title || 'Extracted recipe')}</strong>
            <div class="small-text">Servings: ${escapeHtml(recipe?.servings || 'n/a')} · Ready: ${escapeHtml(recipe?.readyInMinutes || 'n/a')} min</div>
            <div class="small-text">${escapeHtml(ingredients.length ? ingredients.join(' | ') : 'No ingredient list provided.')}</div>
            <a class="btn btn-secondary btn-small" href="${escapeHtml(recipe?.sourceUrl || url)}" target="_blank" rel="noreferrer">Open source</a>
          </div>
        `;

        updateEngine(
          'Recipe Extraction',
          'Extracted a recipe from external URL and summarized key ingredients.',
          [
            { title: 'Run Pantry Rescue', desc: 'Check if extracted recipe fits current ingredients.', cta: 'Open Pantry Rescue', href: './learn.html?tool=pantry#tool-pantry-rescue' },
            { title: 'Build shopping priorities', desc: 'Prioritize missing foods by impact and budget.', cta: 'Open Budget Planner', href: './learn.html?tool=budget#tool-budget-planner' },
          ],
          'Recipe extraction complete. Compare ingredients with pantry and budget tools.',
        );
      } catch (error) {
        extractResult.innerHTML = `<p>Extraction failed. ${escapeHtml(error.message)}</p>`;
      } finally {
        extractResult.classList.remove('is-loading');
      }
    });

    classifyBtn?.addEventListener('click', async () => {
      const title = String(classifyInput?.value || '').trim();
      if (!title) {
        classifyResult.innerHTML = '<p>Add a recipe title or description first.</p>';
        return;
      }
      setLoading(classifyResult, true, 'Classifying cuisine...');
      try {
        const data = await spoonFetch('/recipes/cuisine', {
          method: 'POST',
          form: { title },
        });

        classifyResult.innerHTML = `
          <div class="recipe-mini-card">
            <strong>Cuisine:</strong> ${escapeHtml(data?.cuisine || 'Unknown')}
            <div class="small-text">Alternatives: ${escapeHtml((data?.cuisines || []).join(', ') || 'n/a')}</div>
            <div class="small-text">Confidence: ${escapeHtml(typeof data?.confidence === 'number' ? data.confidence.toFixed(2) : 'n/a')}</div>
          </div>
        `;

        updateEngine(
          'Cuisine Classification',
          'Classified recipe cuisine and confidence for culturally relevant meal planning.',
          [
            { title: 'Run nutrition search next', desc: 'Filter recipes by your nutrient target.', cta: 'Nutrition Search', href: './meal-builder.html?recipeTool=nutrition#recipe-widget' },
            { title: 'Adapt to pantry reality', desc: 'Use Pantry Rescue for household constraints.', cta: 'Open Pantry Rescue', href: './learn.html?tool=pantry#tool-pantry-rescue' },
          ],
          'Cuisine classification complete. Use this to adapt culturally relevant meal choices.',
        );
      } catch (error) {
        classifyResult.innerHTML = `<p>Classification failed. ${escapeHtml(error.message)}</p>`;
      } finally {
        classifyResult.classList.remove('is-loading');
      }
    });

    mealBtn?.addEventListener('click', async () => {
      setLoading(mealResult, true, 'Generating meal plan and shopping list...');
      try {
        const timeFrame = mealTimeframeNode?.value || 'day';
        const plan = await spoonFetch('/mealplanner/generate', {
          params: {
            timeFrame,
            targetCalories: mealCaloriesNode?.value || '',
          },
        });

        let meals = [];
        if (timeFrame === 'day') {
          meals = Array.isArray(plan?.meals) ? plan.meals : [];
        } else {
          const week = plan?.week || {};
          const days = Object.values(week);
          days.forEach((day) => {
            if (Array.isArray(day?.meals)) meals.push(...day.meals);
          });
        }

        const uniqueMeals = meals.slice(0, timeFrame === 'day' ? 6 : 12);
        const shopping = await fetchShoppingList(uniqueMeals.map((meal) => meal.id));

        mealResult.innerHTML = `
          <div class="recipe-mini-card">
            <strong>Generated ${escapeHtml(timeFrame)} plan</strong>
            <ul class="recipe-list">
              ${uniqueMeals
                .map((meal) => `<li><a href="${escapeHtml(meal.sourceUrl || recipeLink(meal.id, meal.title))}" target="_blank" rel="noreferrer">${escapeHtml(meal.title)}</a></li>`)
                .join('')}
            </ul>
          </div>
          <div class="recipe-mini-card">
            <strong>Shopping list (aggregated)</strong>
            <ul class="recipe-list">
              ${shopping.length ? shopping.map((item) => `<li>${escapeHtml(item)}</li>`).join('') : '<li>No shopping list generated.</li>'}
            </ul>
          </div>
        `;

        updateEngine(
          'Meal Plan + Shopping List',
          `Generated a ${timeFrame} meal plan with shopping priorities.`,
          [
            { title: 'Cross-check pantry constraints', desc: 'Use Pantry Rescue if some plan meals are unrealistic.', cta: 'Open Pantry Rescue', href: './learn.html?tool=pantry#tool-pantry-rescue' },
            { title: 'Budget tune-up', desc: 'Use Budget Planner to prioritize must-buy foods first.', cta: 'Open Budget Planner', href: './learn.html?tool=budget#tool-budget-planner' },
          ],
          `Meal plan generation complete for ${timeFrame} timeframe. Shopping list created from recipe ingredients.`,
        );
      } catch (error) {
        mealResult.innerHTML = `<p>Meal plan generation failed. ${escapeHtml(error.message)}</p>`;
      } finally {
        mealResult.classList.remove('is-loading');
      }
    });

    chatBtn?.addEventListener('click', async () => {
      const question = String(chatInput?.value || '').trim();
      if (!question) {
        chatResult.innerHTML = '<p>Ask a recipe question first.</p>';
        return;
      }

      setLoading(chatResult, true, 'Thinking...');
      const normalized = normalizeText(question);
      try {
        if (normalized.includes('budget') || normalized.includes('cheap') || normalized.includes('afford')) {
          chatResult.innerHTML = '<p>Use Budget Planner in Action Hub to rank low-cost nutrition foods first, then run nutrition search for recipes.</p>';
        } else if (normalized.includes('fast food') || normalized.includes('burger') || normalized.includes('wrap')) {
          chatResult.innerHTML = '<p>Use Fast Food Remix tab to get a healthier remake with step-by-step instructions.</p>';
        } else {
          const data = await spoonFetch('/recipes/complexSearch', {
            params: {
              query: question,
              number: 3,
            },
          });
          const hits = Array.isArray(data?.results) ? data.results : [];
          chatResult.innerHTML = `
            <div class="recipe-mini-card">
              <strong>Helper suggestions</strong>
              <ul class="recipe-list">
                ${hits.length
                  ? hits.map((item) => `<li><a href="${escapeHtml(recipeLink(item.id, item.title))}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a></li>`).join('')
                  : '<li>No direct recipe matches found. Try simpler ingredients or cuisine terms.</li>'}
              </ul>
            </div>
          `;
        }

        updateEngine(
          'Recipe Chatbot Helper',
          'Provided recipe direction based on user question and available API tools.',
          [
            { title: 'Run nutrition search', desc: 'Find recipe options that fit your nutrient target.', cta: 'Nutrition Search', href: './meal-builder.html?recipeTool=nutrition#recipe-widget' },
            { title: 'Use Fast Food Remix', desc: 'Generate healthier versions of specific fast-food cravings.', cta: 'Open Fast Food Remix', href: './meal-builder.html?recipeTool=remix#recipe-widget' },
          ],
          'Recipe helper responded. Review suggested next actions and related tools.',
        );
      } catch (error) {
        chatResult.innerHTML = `<p>Recipe helper failed. ${escapeHtml(error.message)}</p>`;
      } finally {
        chatResult.classList.remove('is-loading');
      }
    });

    let remixVariant = 0;

    remixGenerateBtn?.addEventListener('click', () => {
      const payload = {
        restaurant: remixRestaurant?.value,
        item: remixItem?.value,
        diet: remixDiet?.value,
        priority: remixPriority?.value,
        goals: remixGoals?.value,
      };

      if (!String(payload.restaurant || '').trim() || !String(payload.item || '').trim()) {
        remixResult.innerHTML = '<p>Please enter the fast food place and the exact item first.</p>';
        return;
      }

      const output = buildFastFoodRemix(payload, remixVariant);
      renderFastFoodRemix(output);

      updateEngine(
        'Fast Food Remix',
        `Generated a healthier remake for ${payload.item} from ${payload.restaurant}.`,
        [
          { title: 'Try this remix tonight', desc: 'Follow the step-by-step plan and compare taste.', cta: 'Use this plan', href: './meal-builder.html?recipeTool=remix#recipe-widget' },
          { title: 'Adjust calories and protein next', desc: 'Use nutrition search for additional options.', cta: 'Open Nutrition Search', href: './meal-builder.html?recipeTool=nutrition#recipe-widget' },
          { title: 'Use budget planning if needed', desc: 'Lower cost while keeping nutrition quality.', cta: 'Open Budget Planner', href: './learn.html?tool=budget#tool-budget-planner' },
        ],
        `Fast Food Remix ready. ${output.keepVibe}`,
      );

      remixVariant += 1;
    });

    remixResetBtn?.addEventListener('click', () => {
      if (remixRestaurant) remixRestaurant.value = '';
      if (remixItem) remixItem.value = '';
      if (remixDiet) remixDiet.value = 'none';
      if (remixPriority) remixPriority.value = 'balanced';
      if (remixGoals) remixGoals.value = '';
      if (remixResult) remixResult.innerHTML = '';
      remixVariant = 0;
    });
  }

  const voice = buildVoiceSupport();
  const engine = buildNextStepEngine();

  initToolTabs('action-tools-shell', {
    defaultTab: 'budget',
    useHash: true,
    queryParam: 'tool',
    allowOverview: false,
    focusedMode: false,
    focusHideSelectors: ['#tool-next-steps', '#voice-support'],
  });
  initToolTabs('recipe-tools-shell', {
    defaultTab: 'nutrition',
    useHash: false,
    queryParam: 'recipeTool',
    allowOverview: false,
    focusedMode: false,
    focusHideSelectors: ['#meal-rescue-builder', '#meal-links'],
  });

  initBudgetPlanner(engine, voice);
  initPantryRescue(engine, voice);
  initEscalationTool(engine, voice);
  initClaimChecker(engine, voice);
  initRecipeWidget(engine, voice);
})();

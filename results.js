(function () {
  const t = (key, vars) => (window.NutriApp?.t ? window.NutriApp.t(key, vars) : key);
  const riskLabel = (category) => (window.NutriApp?.getRiskLabel ? window.NutriApp.getRiskLabel(category) : category);
  const resourceTypeLabel = (type) => (window.NutriApp?.getResourceTypeLabel ? window.NutriApp.getResourceTypeLabel(type) : type);
  const nutrientLabel = (name) => (window.NutriApp?.getNutrientLabel ? window.NutriApp.getNutrientLabel(name) : name);
  const dayLabel = (day) => (window.NutriApp?.getDayLabel ? window.NutriApp.getDayLabel(day) : day);
  const isAssessmentPage = document.body?.dataset?.page === 'assessment';
  const showInlineResults = new URLSearchParams(window.location.search).get('view') === 'results';

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function localizeFoodText(text) {
    if (!window.NutriData?.foods) return text;
    let output = String(text || '');
    const foodsByLength = NutriData.foods.slice().sort((a, b) => b.name.length - a.name.length);
    foodsByLength.forEach((food) => {
      const translated = t(`food_${food.id}`);
      if (!translated || translated === `food_${food.id}`) return;
      const pattern = new RegExp(`\\b${escapeRegExp(food.name)}\\b`, 'gi');
      output = output.replace(pattern, translated);
    });
    return output;
  }

  const report = NutriApp.getCurrentReport();
  const emptyState = document.getElementById('empty-state');
  const content = document.getElementById('results-content');
  const assessmentPanel = document.getElementById('assessment-results-panel');

  if (!content) return;
  if (isAssessmentPage && assessmentPanel && !showInlineResults) return;
  if (assessmentPanel) assessmentPanel.classList.remove('hide');

  if (!report) {
    if (emptyState) emptyState.classList.remove('hide');
    content.classList.add('hide');
    return;
  }

  if (emptyState) emptyState.classList.add('hide');
  content.classList.remove('hide');

  const categoryColors = {
    Low: '#11825f',
    Moderate: '#f4b942',
    High: '#eb7d21',
    Urgent: '#e63946'
  };

  const riskScore = report.riskOutput.risk;
  const category = report.riskOutput.category;
  const ring = document.getElementById('risk-ring');
  ring.style.setProperty('--ring-progress', String(riskScore));
  ring.style.setProperty('--ring-color', categoryColors[category] || '#17a398');

  document.getElementById('risk-score').textContent = String(riskScore);
  document.getElementById('risk-category').textContent = `${riskLabel(category)} ${t('results_risk_suffix')}`;

  const riskAlert = document.getElementById('risk-alert');
  riskAlert.textContent =
    category === 'Urgent'
      ? t('risk_urgent_alert')
      : category === 'High'
        ? t('risk_high_alert')
        : category === 'Moderate'
          ? t('risk_moderate_alert')
          : t('risk_low_alert');

  riskAlert.className = `alert ${category === 'Urgent' ? 'alert-danger' : category === 'Low' ? 'alert-success' : 'alert-warn'}`;

  const summary = document.getElementById('result-summary');
  if (summary) {
    summary.textContent = t('results_summary', {
      household: report.payload.householdName,
      date: NutriApp.formatDate(report.createdAt),
      community: report.payload.community
    });
  }

  const fallbackActionKeysByCategory = {
    Urgent: ['action_urgent_1', 'action_urgent_2', 'action_urgent_3'],
    High: ['action_high_1', 'action_high_2', 'action_high_3'],
    Moderate: ['action_moderate_1', 'action_moderate_2', 'action_moderate_3'],
    Low: ['action_low_1', 'action_low_2']
  };

  const actionKeys =
    Array.isArray(report?.riskOutput?.actionKeys) && report.riskOutput.actionKeys.length
      ? report.riskOutput.actionKeys
      : fallbackActionKeysByCategory[category] || [];

  const actionItems = actionKeys.length ? actionKeys.map((key) => t(key)) : report.riskOutput.actions || [];

  const actionsList = document.getElementById('actions-list');
  actionItems.forEach((action) => {
    const li = document.createElement('li');
    li.textContent = action;
    actionsList.appendChild(li);
  });

  document.getElementById('follow-up-text').textContent = t('results_followup', { days: report.followUpDue });

  const reasonsNode = document.getElementById('risk-reasons-list');
  if (reasonsNode) {
    const reasons = Array.isArray(report?.riskOutput?.reasons) && report.riskOutput.reasons.length
      ? report.riskOutput.reasons
      : ['Risk score is based on intake pattern, warning signs, body measurements, and affordability context.'];
    reasonsNode.innerHTML = reasons.map((reason) => `<li>${reason}</li>`).join('');
  }

  const referralNode = document.getElementById('referral-guidance');
  if (referralNode) {
    referralNode.textContent = report?.riskOutput?.referralGuidance || 'Use warning signs and access constraints to decide support urgency.';
  }

  const mealFocusNode = document.getElementById('meal-focus-guidance');
  if (mealFocusNode) {
    mealFocusNode.textContent = report?.riskOutput?.mealFocus || 'Meal focus: prioritize protein + energy + one protective food in the next meal.';
  }

  const deficiencyBody = document.querySelector('#deficiency-table tbody');
  report.deficiencies.forEach((item) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${nutrientLabel(item.name)}</td><td>${item.score}</td><td>${item.confidence}%</td>`;
    deficiencyBody.appendChild(row);
  });

  const resourceCards = document.getElementById('resource-cards');
  report.resources.forEach((resource) => {
    const box = document.createElement('div');
    box.className = 'resource-item';
    const distanceText = t('map_distance_away', { distance: resource.distanceKm });
    box.innerHTML = `
      <strong>${resource.name}</strong>
      <div class="small-text">${resourceTypeLabel(resource.type)} · ${distanceText}</div>
      <div class="small-text">${resource.open}</div>
      <div class="small-text">${resource.services.slice(0, 2).join(' · ')}</div>
    `;
    resourceCards.appendChild(box);
  });

  function buildNextSteps() {
    const age = Number(report?.payload?.ageYears || 0);
    const symptoms = Array.isArray(report?.selectedSymptoms) ? report.selectedSymptoms : [];
    const isChild = age > 0 && age <= 17;
    const isOlderAdult = age >= 60;
    const hasLowAppetite = symptoms.includes('poor_appetite');
    const hasWeightWarning = symptoms.includes('wasting') || symptoms.includes('edema') || symptoms.includes('lethargy');
    const highUrgency = ['High', 'Urgent'].includes(category);

    const steps = [];

    if (highUrgency) {
      steps.push({
        title: 'Referral and support now',
        desc: 'This screening suggests elevated nutrition risk. Find verified support points immediately.',
        cta: 'Find nearby help',
        href: './map.html',
      });
    }

    if (isChild) {
      steps.push({
        title: 'Child growth support',
        desc: 'Use Action Hub risk and urgency tools to triage child warning patterns quickly.',
        cta: 'Open Action Hub tools',
        href: './learn.html?tool=risk#tool-risk-checker',
      });
    }

    if (isOlderAdult) {
      steps.push({
        title: 'Older adult nutrition check',
        desc: 'Low appetite and weight change in seniors can be high-risk. Run risk and escalation tools now.',
        cta: 'Open Action Hub tools',
        href: './learn.html?tool=escalation#tool-escalation',
      });
    }

    if (hasLowAppetite || hasWeightWarning) {
      steps.push({
        title: 'Protein-first meal action',
        desc: 'Build a practical meal from available foods and close likely protein and iron gaps.',
        cta: 'Open Meal Builder',
        href: './meal-builder.html',
      });
    }

    steps.push({
      title: 'Check harmful nutrition beliefs',
      desc: 'Use claim checker to correct myths that can delay nutrition recovery.',
      cta: 'Check a claim',
      href: './learn.html?tool=claim#tool-claim-checker',
    });

    return steps.slice(0, 4);
  }

  const nextStepsNode = document.getElementById('next-steps-grid');
  if (nextStepsNode) {
    const nextSteps = buildNextSteps();
    nextStepsNode.innerHTML = '';
    nextSteps.forEach((step) => {
      const node = document.createElement('article');
      node.className = 'card';
      node.innerHTML = `
        <h4>${step.title}</h4>
        <p class="small-text">${step.desc}</p>
        <a class="btn btn-secondary btn-small" href="${step.href}">${step.cta}</a>
      `;
      nextStepsNode.appendChild(node);
    });
  }

  const mealBody = document.querySelector('#meal-plan-table tbody');
  report.mealPlan.days.forEach((day) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${dayLabel(day.day)}</td>
      <td>${localizeFoodText(day.breakfast)}</td>
      <td>${localizeFoodText(day.lunch)}</td>
      <td>${localizeFoodText(day.dinner)}</td>
      <td>$${day.estimatedCost}</td>
    `;
    mealBody.appendChild(row);
  });

  const budgetAlert = document.getElementById('budget-alert');
  if (report.mealPlan.budgetRisk === 'high') {
    budgetAlert.className = 'alert alert-danger';
    budgetAlert.textContent = t('budget_high');
  } else if (report.mealPlan.budgetRisk === 'moderate') {
    budgetAlert.className = 'alert alert-warn';
    budgetAlert.textContent = t('budget_moderate');
  } else {
    budgetAlert.className = 'alert alert-success';
    budgetAlert.textContent = t('budget_low');
  }

  const speakButton = document.getElementById('speak-btn');
  if (speakButton) {
    speakButton.addEventListener('click', () => {
      const text = t('results_speak_summary', {
        risk: riskLabel(category),
        actions: actionItems.join(' '),
        nutrients: report.deficiencies.map((item) => nutrientLabel(item.name)).join(', ')
      });
      NutriApp.speak(text);
    });
  }

  const printButton = document.getElementById('print-btn');
  if (printButton) {
    printButton.addEventListener('click', () => window.print());
  }

  if (isAssessmentPage && showInlineResults && assessmentPanel) {
    setTimeout(() => {
      assessmentPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }
})();

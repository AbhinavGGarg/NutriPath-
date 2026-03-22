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

  const baseActionItems = actionKeys.length ? actionKeys.map((key) => t(key)) : report.riskOutput.actions || [];

  function buildContextActionItems() {
    const items = [];
    const mealsPerDay = Number(report?.payload?.mealsPerDay || 0);
    const dietDiversity = Number(report?.payload?.dietDiversity || 0);
    const perCapitaBudget = Number(report?.payload?.weeklyBudget || 0) / Math.max(1, Number(report?.payload?.householdSize || 1));
    const selected = Array.isArray(report?.selectedSymptoms) ? report.selectedSymptoms : [];
    const highWarning = selected.includes('edema') || selected.includes('wasting') || selected.includes('lethargy');

    if (mealsPerDay > 0 && mealsPerDay <= 3) {
      items.push('Add one extra small protein meal or snack today.');
    }
    if (dietDiversity > 0 && dietDiversity <= 5) {
      items.push('Add one protective food today (greens, beans, fruit, or vegetables).');
    }
    if (report?.payload?.waterSource === 'unsafe') {
      items.push('Use safe/treated water for drinking and meal prep.');
    }
    if (perCapitaBudget > 0 && perCapitaBudget < 3.5) {
      items.push('Prioritize low-cost protein first, then add one iron-support food.');
    }
    if (highWarning && !['High', 'Urgent'].includes(category)) {
      items.push('Re-check warning signs in 48 hours and escalate if symptoms persist.');
    }

    return items;
  }

  const actionItems = [...baseActionItems, ...buildContextActionItems()]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 5);

  const actionsList = document.getElementById('actions-list');
  actionItems.forEach((action) => {
    const li = document.createElement('li');
    li.textContent = action;
    actionsList.appendChild(li);
  });

  const actionPlanStrip = document.getElementById('action-plan-strip');
  if (actionPlanStrip) {
    const todayLine = actionItems[0] || report?.riskOutput?.mealFocus || 'Improve the next meal now with protein + protective food.';
    const weekLine = actionItems[1] || report?.riskOutput?.referralGuidance || 'Use Action Hub tools this week to stabilize meals.';
    const escalateLine =
      ['High', 'Urgent'].includes(category)
        ? 'Get help now if symptoms worsen, appetite drops further, or intake becomes very low.'
        : 'Get help now if swelling, confusion, persistent weight loss, or severe fatigue appears.';

    actionPlanStrip.innerHTML = `
      <article class="action-plan-item">
        <strong>Start today</strong>
        <p class="small-text">${todayLine}</p>
      </article>
      <article class="action-plan-item">
        <strong>If possible this week</strong>
        <p class="small-text">${weekLine}</p>
      </article>
      <article class="action-plan-item">
        <strong>Get help now if you notice this</strong>
        <p class="small-text">${escalateLine}</p>
      </article>
    `;
  }

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
        href: './learn.html?tool=escalation#tool-escalation',
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
  if (mealBody && report?.mealPlan?.days) {
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
  }

  const budgetAlert = document.getElementById('budget-alert');
  if (budgetAlert && report?.mealPlan) {
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
  }

  const symptomLabelById = {
    fatigue: t('symptom_fatigue'),
    poor_appetite: t('symptom_poor_appetite'),
    diarrhea: t('symptom_diarrhea'),
    fever: t('symptom_fever'),
    pallor: t('symptom_pallor'),
    edema: t('symptom_edema'),
    wasting: t('symptom_wasting'),
    hair_loss: t('symptom_hair_loss'),
    night_vision: t('symptom_night_vision'),
    lethargy: t('symptom_lethargy'),
  };

  function selectedSymptomLabels() {
    const selected = Array.isArray(report?.selectedSymptoms) ? report.selectedSymptoms : [];
    if (!selected.length) return 'None reported';
    return selected.map((id) => symptomLabelById[id] || id).join(', ');
  }

  function topDeficienciesText() {
    const list = Array.isArray(report?.deficiencies) ? report.deficiencies.slice(0, 3) : [];
    if (!list.length) return 'No deficiency signals detected in this quick model.';
    return list.map((item) => `${nutrientLabel(item.name)} (${item.confidence}%)`).join(', ');
  }

  function topResourcesText() {
    const list = Array.isArray(report?.resources) ? report.resources.slice(0, 2) : [];
    if (!list.length) return 'No nearby resources listed.';
    return list.map((item) => `${item.name} (${resourceTypeLabel(item.type)}, ${item.distanceKm || 'n/a'} km)`).join(' | ');
  }

  function buildAudienceSummary(audience) {
    const header = [
      'NutriPath Nutrition Action Summary',
      `Date: ${NutriApp.formatDate(report.createdAt)}`,
      `Household: ${report.payload.householdName}`,
      `Community: ${report.payload.community}`,
      `Risk level: ${riskLabel(category)} (${riskScore}/99)`,
      `Follow-up due: ${report.followUpDue} day(s)`,
      '',
    ];

    if (audience === 'clinic') {
      return [
        ...header,
        'For Clinic / Health Team',
        `Age: ${report.payload.ageYears} years | Sex: ${report.payload.sex}`,
        `MUAC: ${report.payload.muac || 'Not provided'} cm`,
        `Meals/day: ${report.payload.mealsPerDay} | Diet diversity: ${report.payload.dietDiversity}/10`,
        `Reported signs: ${selectedSymptomLabels()}`,
        `Likely deficiencies: ${topDeficienciesText()}`,
        `Immediate actions: ${actionItems.join(' | ')}`,
        `Referral guidance: ${report?.riskOutput?.referralGuidance || 'Use urgency escalation and clinical judgement.'}`,
        `Nearby resources: ${topResourcesText()}`,
        '',
        'This summary is decision support and not a diagnosis.',
      ].join('\n');
    }

    if (audience === 'ngo') {
      return [
        ...header,
        'For NGO / Food Support Partner',
        `Household size: ${report.payload.householdSize}`,
        `Weekly food budget: $${report.payload.weeklyBudget}`,
        `Primary needs: ${topDeficienciesText()}`,
        `Meal focus: ${report?.riskOutput?.mealFocus || 'Increase protein + protective foods.'}`,
        `Priority next actions: ${actionItems.join(' | ')}`,
        `Closest verified resources: ${topResourcesText()}`,
        '',
        'Use this to triage support routing and follow-up scheduling.',
      ].join('\n');
    }

    return [
      ...header,
      'For Caregiver / Family',
      `What this means: ${report?.riskOutput?.referralGuidance || 'Watch appetite, energy, and meal intake.'}`,
      `Start today: ${actionItems[0] || 'Improve meals now.'}`,
      `Do next: ${actionItems[1] || 'Re-check symptoms in a few days.'}`,
      `Meal focus: ${report?.riskOutput?.mealFocus || 'Protein + energy + one protective food.'}`,
      `Where to get help: ${topResourcesText()}`,
      '',
      'Get help now if warning signs worsen.',
    ].join('\n');
  }

  function renderPrintableSummary(text) {
    const win = window.open('', '_blank', 'width=860,height=920');
    if (!win) return false;
    win.document.write(`
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>NutriPath Summary</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
            h1 { margin: 0 0 12px; font-size: 20px; }
            pre { white-space: pre-wrap; font-family: Arial, sans-serif; line-height: 1.5; font-size: 14px; }
          </style>
        </head>
        <body>
          <h1>NutriPath Summary</h1>
          <pre>${text.replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]))}</pre>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 100);
    return true;
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

  const summaryAudience = document.getElementById('summary-audience');
  const shareButton = document.getElementById('share-btn');
  const shareStatus = document.getElementById('share-status');
  const printButton = document.getElementById('print-btn');
  if (printButton) {
    printButton.addEventListener('click', () => {
      const audience = summaryAudience?.value || 'caregiver';
      const summaryText = buildAudienceSummary(audience);
      const opened = renderPrintableSummary(summaryText);
      if (!opened) window.print();
    });
  }

  if (shareButton) {
    shareButton.addEventListener('click', async () => {
      const audience = summaryAudience?.value || 'caregiver';
      const summaryText = buildAudienceSummary(audience);
      const sharePayload = {
        title: `NutriPath summary for ${audience}`,
        text: summaryText,
        url: window.location.href,
      };

      try {
        if (navigator.share) {
          await navigator.share(sharePayload);
          if (shareStatus) shareStatus.textContent = 'Summary shared successfully.';
          return;
        }
      } catch {
        // Fall through to clipboard fallback.
      }

      try {
        await navigator.clipboard.writeText(summaryText);
        if (shareStatus) shareStatus.textContent = 'Summary copied to clipboard. You can paste it into text, email, or chat.';
      } catch {
        if (shareStatus) shareStatus.textContent = 'Sharing not available on this browser. Use Print summary instead.';
      }
    });
  }

  if (isAssessmentPage && showInlineResults && assessmentPanel) {
    setTimeout(() => {
      assessmentPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }
})();

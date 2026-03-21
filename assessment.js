(function () {
  const form = document.getElementById('assessment-form');
  if (!form) return;
  const t = (key, vars) => (window.NutriApp?.t ? window.NutriApp.t(key, vars) : key);

  const symptoms = [
    { id: 'fatigue', labelKey: 'symptom_fatigue', weight: 6, nutrients: ['iron', 'protein'] },
    { id: 'poor_appetite', labelKey: 'symptom_poor_appetite', weight: 8, nutrients: ['zinc', 'protein'] },
    { id: 'diarrhea', labelKey: 'symptom_diarrhea', weight: 10, nutrients: ['zinc', 'calories'] },
    { id: 'fever', labelKey: 'symptom_fever', weight: 7, nutrients: ['protein', 'vitaminA'] },
    { id: 'pallor', labelKey: 'symptom_pallor', weight: 11, nutrients: ['iron', 'folate'] },
    { id: 'edema', labelKey: 'symptom_edema', weight: 20, nutrients: ['protein'] },
    { id: 'wasting', labelKey: 'symptom_wasting', weight: 16, nutrients: ['calories', 'protein'] },
    { id: 'hair_loss', labelKey: 'symptom_hair_loss', weight: 8, nutrients: ['zinc', 'protein'] },
    { id: 'night_vision', labelKey: 'symptom_night_vision', weight: 12, nutrients: ['vitaminA'] },
    { id: 'lethargy', labelKey: 'symptom_lethargy', weight: 16, nutrients: ['calories', 'iron'] }
  ];

  const symptomNode = document.getElementById('symptom-list');
  const communityNode = document.getElementById('community');
  const communityListNode = document.getElementById('community-options');
  const languageNode = document.getElementById('language');
  const languageListNode = document.getElementById('language-options');
  const foodInputNode = document.getElementById('assessment-food-input');
  const foodListNode = document.getElementById('assessment-food-options');
  const foodAddButton = document.getElementById('assessment-food-add');
  const foodClearButton = document.getElementById('assessment-food-clear');
  const foodSelectedNode = document.getElementById('assessment-food-selected');
  const foodStatusNode = document.getElementById('assessment-food-status');
  const progressNode = document.getElementById('progress');
  const validationNode = document.getElementById('validation-message');
  const knownFoods = (window.NutriData?.foods || []).slice().sort((a, b) => a.name.localeCompare(b.name));
  const selectedFoodMap = new Map();
  let customFoodCounter = 1;

  const communityNames = Object.keys(NutriData.communities);
  const communityLabels = communityNames
    .map((name) => `${name}, ${NutriData.communities[name].country}`)
    .sort((a, b) => a.localeCompare(b));

  communityLabels.forEach((labelText) => {
    const option = document.createElement('option');
    option.value = labelText;
    communityListNode.appendChild(option);
  });

  NutriData.languages
    .slice()
    .sort((a, b) => a.localeCompare(b))
    .forEach((language) => {
      const option = document.createElement('option');
      option.value = language;
      languageListNode.appendChild(option);
    });

  knownFoods.forEach((food) => {
    const option = document.createElement('option');
    option.value = food.name;
    foodListNode.appendChild(option);
  });

  function getFoodLabel(food) {
    if (food?.custom) return food.name;
    const key = `food_${food.id}`;
    const translated = t(key);
    return translated === key ? food.name : translated;
  }

  function renderSymptoms() {
    const checked = new Set(getSelected('symptoms'));
    symptomNode.innerHTML = '';
    symptoms.forEach((symptom) => {
      const label = document.createElement('label');
      label.className = 'checkbox-item';
      const isChecked = checked.has(symptom.id) ? 'checked' : '';
      label.innerHTML = `<input type="checkbox" name="symptoms" value="${symptom.id}" ${isChecked} /> <span>${t(symptom.labelKey)}</span>`;
      symptomNode.appendChild(label);
    });
  }

  renderSymptoms();

  const requiredFields = [
    'role',
    'language',
    'householdName',
    'community',
    'ageYears',
    'sex',
    'householdSize',
    'weeklyBudget',
    'weight',
    'height',
    'mealsPerDay',
    'dietDiversity',
    'waterSource'
  ];

  function normalizeText(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }

  function inferCustomNutrients(name) {
    const text = normalizeText(name);
    const nutrients = new Set();
    const rules = [
      { words: ['bean', 'lentil', 'egg', 'fish', 'tuna', 'chicken', 'tofu', 'yogurt', 'milk', 'peanut'], nutrients: ['protein', 'iron'] },
      { words: ['rice', 'bread', 'pasta', 'potato', 'oat', 'cereal', 'tortilla', 'noodle'], nutrients: ['carbs', 'calories'] },
      { words: ['spinach', 'kale', 'broccoli', 'carrot', 'pepper', 'tomato', 'orange', 'fruit', 'vegetable', 'cabbage'], nutrients: ['vitaminA', 'vitaminC', 'fiber'] },
      { words: ['nut', 'seed', 'avocado', 'oil'], nutrients: ['fat', 'calories'] }
    ];

    rules.forEach((rule) => {
      if (rule.words.some((word) => text.includes(word))) {
        rule.nutrients.forEach((nutrient) => nutrients.add(nutrient));
      }
    });

    if (!nutrients.size) nutrients.add('calories');
    return [...nutrients];
  }

  function makeCustomFood(raw) {
    const cleaned = String(raw || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');

    const id = `custom_assessment_${customFoodCounter++}`;
    return {
      id,
      key: id,
      custom: true,
      name: cleaned,
      nutrients: inferCustomNutrients(cleaned),
      cost: 1.5,
      score: 55
    };
  }

  function resolveFood(raw) {
    const query = normalizeText(raw);
    if (!query) return null;
    const exact = knownFoods.find((food) => normalizeText(food.name) === query);
    if (exact) return { ...exact, key: exact.id, custom: false };
    const partial = knownFoods.find((food) => normalizeText(food.name).includes(query));
    if (partial) return { ...partial, key: partial.id, custom: false };
    return makeCustomFood(raw);
  }

  function renderSelectedFoods() {
    if (!foodSelectedNode || !foodStatusNode) return;
    foodSelectedNode.innerHTML = '';
    const items = [...selectedFoodMap.values()];
    if (!items.length) {
      foodStatusNode.textContent = 'No foods added yet. You can still continue, but results are better with food inputs.';
      return;
    }

    items.forEach((food) => {
      const chip = document.createElement('span');
      chip.className = 'selected-food-chip';
      chip.innerHTML = `${food.name} <button type="button" data-remove-food="${food.key}" aria-label="Remove ${food.name}">x</button>`;
      foodSelectedNode.appendChild(chip);
    });
    foodStatusNode.textContent = `${items.length} food item(s) included in assessment logic.`;
  }

  function resolveLanguage(value) {
    const text = String(value || '').trim();
    if (!text) return '';

    const exact = NutriData.languages.find((language) => language.toLowerCase() === text.toLowerCase());
    if (exact) return exact;

    const close = NutriData.languages.find((language) => language.toLowerCase().includes(text.toLowerCase()));
    return close || text;
  }

  function resolveCommunity(value) {
    const raw = String(value || '').trim();
    if (!raw) return { key: '', label: '' };

    const withoutCountry = raw.split(',')[0].trim();
    const exact = communityNames.find((name) => name.toLowerCase() === raw.toLowerCase() || name.toLowerCase() === withoutCountry.toLowerCase());
    if (exact) {
      return { key: exact, label: `${exact}, ${NutriData.communities[exact].country}` };
    }

    const normalizedInput = normalizeText(raw);
    const scored = communityNames
      .map((name) => {
        const country = NutriData.communities[name].country;
        const searchable = normalizeText(`${name} ${country}`);
        let score = 0;
        if (searchable.startsWith(normalizedInput)) score += 6;
        if (searchable.includes(normalizedInput)) score += 3;
        if (normalizedInput && normalizedInput.includes(normalizeText(name))) score += 2;
        return { name, score };
      })
      .sort((a, b) => b.score - a.score);

    if (scored.length && scored[0].score > 0) {
      const best = scored[0].name;
      return { key: best, label: `${best}, ${NutriData.communities[best].country}` };
    }

    return { key: raw, label: raw };
  }

  function updateProgress() {
    const total = requiredFields.length + 1;
    let filled = 0;

    requiredFields.forEach((field) => {
      const value = String(form.elements[field]?.value || '').trim();
      if (value) filled += 1;
    });

    if (form.querySelectorAll('input[name="symptoms"]:checked').length > 0) filled += 1;

    const pct = Math.round((filled / total) * 100);
    const bar = progressNode.querySelector('span');
    bar.style.width = `${pct}%`;
    progressNode.setAttribute('aria-valuenow', String(pct));
  }

  form.addEventListener('input', updateProgress);
  form.addEventListener('change', updateProgress);

  if (foodAddButton && foodInputNode) {
    foodAddButton.addEventListener('click', () => {
      const resolved = resolveFood(foodInputNode.value);
      if (!resolved) return;
      selectedFoodMap.set(resolved.key, resolved);
      foodInputNode.value = '';
      renderSelectedFoods();
    });
  }

  if (foodInputNode) {
    foodInputNode.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      const resolved = resolveFood(foodInputNode.value);
      if (!resolved) return;
      selectedFoodMap.set(resolved.key, resolved);
      foodInputNode.value = '';
      renderSelectedFoods();
    });
  }

  if (foodClearButton) {
    foodClearButton.addEventListener('click', () => {
      selectedFoodMap.clear();
      if (foodInputNode) foodInputNode.value = '';
      renderSelectedFoods();
    });
  }

  if (foodSelectedNode) {
    foodSelectedNode.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const id = target.dataset.removeFood;
      if (!id) return;
      selectedFoodMap.delete(id);
      renderSelectedFoods();
    });
  }

  window.addEventListener('nutri:lang-changed', () => {
    renderSymptoms();
    updateProgress();
    renderSelectedFoods();
  });

  updateProgress();
  renderSelectedFoods();

  function getSelected(name) {
    return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map((item) => item.value);
  }

  function buildMealPlan(selectedFoods, deficiencies, weeklyBudget, householdSize) {
    const foods = selectedFoods.length ? selectedFoods : NutriData.foods.filter((food) => food.cost <= 1.5).slice(0, 10);
    const foodName = (item) => getFoodLabel(item);

    const carbFoods = foods.filter((f) => f.nutrients.includes('carbs'));
    const proteinFoods = foods.filter((f) => f.nutrients.includes('protein'));
    const protectFoods = foods.filter((f) =>
      f.nutrients.some((nutrient) => ['vitaminA', 'iron', 'vitaminC', 'folate'].includes(nutrient))
    );

    const mustTarget = deficiencies.map((d) => d.name.toLowerCase());
    const highPriorityFoods = foods
      .map((food) => {
        const matches = food.nutrients.reduce((acc, nutrient) => {
          if (mustTarget.includes('iron') && nutrient === 'iron') return acc + 1;
          if (mustTarget.includes('protein') && nutrient === 'protein') return acc + 1;
          if (mustTarget.includes('vitamin a') && nutrient === 'vitaminA') return acc + 1;
          if (mustTarget.includes('zinc') && nutrient === 'zinc') return acc + 1;
          return acc;
        }, 0);
        return { food, rank: food.score + matches * 8 };
      })
      .sort((a, b) => b.rank - a.rank)
      .map((entry) => entry.food);

    const safeCarbs = carbFoods.length ? carbFoods : highPriorityFoods;
    const safeProteins = proteinFoods.length ? proteinFoods : highPriorityFoods;
    const safeProtective = protectFoods.length ? protectFoods : highPriorityFoods;

    const week = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const plan = week.map((day, idx) => {
      const breakfast = `${foodName(safeCarbs[idx % safeCarbs.length])} + ${foodName(safeProteins[(idx + 1) % safeProteins.length])}`;
      const lunch = `${foodName(safeCarbs[(idx + 2) % safeCarbs.length])} + ${foodName(safeProteins[idx % safeProteins.length])} + ${foodName(safeProtective[idx % safeProtective.length])}`;
      const dinner = `${foodName(safeProteins[(idx + 3) % safeProteins.length])} + ${foodName(safeCarbs[(idx + 1) % safeCarbs.length])} + ${foodName(safeProtective[(idx + 2) % safeProtective.length])}`;

      const dailyCost =
        (safeCarbs[idx % safeCarbs.length].cost +
          safeProteins[(idx + 1) % safeProteins.length].cost +
          safeProtective[(idx + 2) % safeProtective.length].cost) *
        Math.min(1.22, 0.55 + householdSize * 0.12);

      return {
        day,
        breakfast,
        lunch,
        dinner,
        estimatedCost: Number(dailyCost.toFixed(2))
      };
    });

    const budgetRisk = weeklyBudget < householdSize * 2.6 ? 'high' : weeklyBudget < householdSize * 4 ? 'moderate' : 'low';

    return { days: plan, budgetRisk };
  }

  function inferDeficiencies(selectedSymptoms, selectedFoods) {
    const deficiencyScore = {
      iron: 0,
      protein: 0,
      'vitamin A': 0,
      zinc: 0,
      calories: 0
    };

    const symptomMap = Object.fromEntries(symptoms.map((s) => [s.id, s]));
    selectedSymptoms.forEach((symptomId) => {
      const symptom = symptomMap[symptomId];
      if (!symptom) return;
      symptom.nutrients.forEach((nutrient) => {
        if (nutrient === 'vitaminA') deficiencyScore['vitamin A'] += 2;
        else if (deficiencyScore[nutrient] !== undefined) deficiencyScore[nutrient] += 2;
      });
    });

    const coverage = {
      iron: 0,
      protein: 0,
      'vitamin A': 0,
      zinc: 0,
      calories: 0
    };

    selectedFoods.forEach((food) => {
      food.nutrients.forEach((nutrient) => {
        if (nutrient === 'vitaminA') coverage['vitamin A'] += 1;
        if (coverage[nutrient] !== undefined) coverage[nutrient] += 1;
        if (nutrient === 'carbs') coverage.calories += 1;
      });
    });

    Object.keys(deficiencyScore).forEach((key) => {
      if (coverage[key] <= 1) deficiencyScore[key] += 4;
      else if (coverage[key] <= 2) deficiencyScore[key] += 2;
    });

    return Object.entries(deficiencyScore)
      .map(([name, score]) => ({
        name,
        score,
        confidence: Math.min(95, 48 + score * 7)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  function computeRisk(payload, selectedSymptoms, selectedFoods) {
    let risk = 8;
    const reasons = [];

    if (Number.isFinite(payload.muac) && payload.muac > 0) {
      if (payload.muac < 11.5) {
        risk += 38;
        reasons.push('MUAC (Mid-Upper Arm Circumference) is severely low.');
      } else if (payload.muac < 12.5) {
        risk += 27;
        reasons.push('MUAC (Mid-Upper Arm Circumference) is below healthy range.');
      } else if (payload.muac < 13.5) {
        risk += 12;
        reasons.push('MUAC suggests early undernutrition risk.');
      }
    }

    const bmi = payload.weight / ((payload.height / 100) * (payload.height / 100));
    if (payload.ageYears <= 5) {
      if (bmi < 13.2) {
        risk += 22;
        reasons.push('Child growth indicators suggest low body reserves.');
      } else if (bmi < 14) {
        risk += 11;
      }
    } else {
      if (bmi < 16.5) {
        risk += 15;
        reasons.push('Weight-for-height pattern suggests possible undernutrition.');
      } else if (bmi < 18.3) risk += 8;
    }

    if (payload.mealsPerDay <= 2) {
      risk += 14;
      reasons.push('Meal frequency is low for current needs.');
    } else if (payload.mealsPerDay <= 3) risk += 8;

    if (payload.dietDiversity <= 3) {
      risk += 14;
      reasons.push('Diet diversity is limited, which raises micronutrient risk.');
    } else if (payload.dietDiversity <= 5) risk += 8;

    if (payload.waterSource === 'unsafe') {
      risk += 7;
      reasons.push('Unsafe water source may increase illness-related nutrition loss.');
    }

    const symptomWeight = selectedSymptoms.reduce((sum, id) => {
      const symptom = symptoms.find((item) => item.id === id);
      return sum + (symptom ? symptom.weight : 0);
    }, 0);
    const symptomRisk = Math.min(28, Math.round(symptomWeight * 0.55));
    risk += symptomRisk;
    if (symptomRisk >= 12) {
      reasons.push('Current warning signs indicate increased urgency.');
    }

    const perCapitaBudget = payload.weeklyBudget / payload.householdSize;
    if (perCapitaBudget < 2.2) {
      risk += 12;
      reasons.push('Food affordability is likely too low for stable nutrition.');
    } else if (perCapitaBudget < 3.5) risk += 6;

    if (selectedFoods.length > 0 && selectedFoods.length < 5) {
      risk += 8;
      reasons.push('Available food variety is narrow right now.');
    }

    risk = Math.max(1, Math.min(99, Math.round(risk)));

    let category = 'Low';
    if (risk >= 75) category = 'Urgent';
    else if (risk >= 55) category = 'High';
    else if (risk >= 35) category = 'Moderate';

    const actionKeys = [];
    if (category === 'Urgent') {
      actionKeys.push('action_urgent_1');
      actionKeys.push('action_urgent_2');
      actionKeys.push('action_urgent_3');
    } else if (category === 'High') {
      actionKeys.push('action_high_1');
      actionKeys.push('action_high_2');
      actionKeys.push('action_high_3');
    } else if (category === 'Moderate') {
      actionKeys.push('action_moderate_1');
      actionKeys.push('action_moderate_2');
      actionKeys.push('action_moderate_3');
    } else {
      actionKeys.push('action_low_1');
      actionKeys.push('action_low_2');
    }

    const referralGuidance =
      category === 'Urgent'
        ? 'Urgent evaluation recommended today. If warning signs worsen, seek immediate care.'
        : category === 'High'
          ? 'Find support this week and arrange clinical follow-up as soon as possible.'
          : category === 'Moderate'
            ? 'Improve meals now and re-check within 7-14 days.'
            : 'Monitor at home and re-check if appetite, energy, or intake declines.';

    const mealFocus =
      category === 'Urgent' || category === 'High'
        ? 'Meal focus: prioritize energy + protein foods now, then add iron and vitamin-rich foods.'
        : 'Meal focus: maintain balanced meals with one energy food, one protein food, and one protective food.';

    return {
      risk,
      category,
      actionKeys,
      actions: actionKeys.map((key) => t(key)),
      reasons: reasons.slice(0, 5),
      referralGuidance,
      mealFocus
    };
  }

  function nearestResources(communityKey, topN) {
    const point = NutriData.communities[communityKey];
    if (!point) return NutriData.resources.slice(0, topN);

    return NutriData.resources
      .map((resource) => ({
        ...resource,
        distanceKm: Number(NutriApp.haversineKm(point.lat, point.lng, resource.lat, resource.lng).toFixed(1))
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, topN);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    validationNode.classList.add('hide');

    const selectedSymptoms = getSelected('symptoms');
    const selectedFoods = [...selectedFoodMap.values()];
    const selectedFoodIds = selectedFoods.map((food) => food.id);

    const matchedCommunity = resolveCommunity(form.community.value);

    const payload = {
      role: form.role.value,
      language: resolveLanguage(form.language.value),
      householdName: form.householdName.value.trim(),
      community: matchedCommunity.label,
      communityKey: matchedCommunity.key,
      ageYears: Number(form.ageYears.value),
      sex: form.sex.value,
      householdSize: Number(form.householdSize.value),
      weeklyBudget: Number(form.weeklyBudget.value),
      weight: Number(form.weight.value),
      height: Number(form.height.value),
      muac: String(form.muac.value || '').trim() ? Number(form.muac.value) : null,
      mealsPerDay: Number(form.mealsPerDay.value),
      dietDiversity: Number(form.dietDiversity.value),
      waterSource: form.waterSource.value,
      notes: form.notes.value.trim()
    };

    for (const field of requiredFields) {
      if (!String(payload[field] ?? '').trim()) {
        validationNode.textContent = t('validation_required');
        validationNode.classList.remove('hide');
        return;
      }
    }

    const deficiencies = inferDeficiencies(selectedSymptoms, selectedFoods);
    const riskOutput = computeRisk(payload, selectedSymptoms, selectedFoods);
    const mealPlan = buildMealPlan(selectedFoods, deficiencies, payload.weeklyBudget, payload.householdSize);
    const resources = nearestResources(payload.communityKey, 3);

    const report = {
      id: `rep-${Date.now()}`,
      createdAt: new Date().toISOString(),
      payload,
      selectedSymptoms,
      selectedFoodIds,
      riskOutput,
      deficiencies,
      mealPlan,
      resources,
      followUpDue:
        riskOutput.category === 'Urgent'
          ? 2
          : riskOutput.category === 'High'
            ? 7
            : riskOutput.category === 'Moderate'
              ? 14
              : 30
    };

    NutriApp.saveReport(report);
    window.location.href = './assessment.html?view=results';
  });
})();

const RISK_CONTENT = {
  low: {
    explanation:
      "Your answers suggest low immediate nutrition risk. Keep routines steady so things do not slip.",
    watch: [
      "Appetite drops for more than 2 days",
      "New tiredness that makes daily tasks harder",
      "More skipped meals over the next week"
    ],
    actions: [
      "Keep 3 simple meal times today, even if portions are small",
      "Pair a carb + protein for your next meal",
      "Set a reminder to recheck in 3 days"
    ]
  },
  moderate: {
    explanation:
      "You may be entering nutrition risk. A few actions today can prevent this from getting worse.",
    watch: [
      "Skipping 2 or more meals in a day",
      "Low energy most of the day",
      "Unplanned weight loss or looser clothing"
    ],
    actions: [
      "Eat a small meal or snack within the next 2 hours",
      "Use the meal builder to combine what you have now",
      "Contact a local food support line today if budget is tight"
    ]
  },
  high: {
    explanation:
      "Your answers suggest high immediate nutrition risk. Start with small, practical steps right now and seek support today.",
    watch: [
      "No appetite for most of the day",
      "Dizziness, weakness, or hard-to-manage fatigue",
      "Repeated days without enough food"
    ],
    actions: [
      "Eat something easy now: carb + protein if possible",
      "Ask someone you trust to help you secure food for today",
      "Call 2-1-1 or a nearby pantry before the day ends"
    ]
  }
};

const FOOD_LIBRARY = [
  {
    key: "rice",
    aliases: ["rice", "brown rice", "white rice"],
    tags: ["carb"],
    group: "grain"
  },
  {
    key: "oats",
    aliases: ["oats", "oatmeal"],
    tags: ["carb", "fiber"],
    group: "grain"
  },
  {
    key: "bread",
    aliases: ["bread", "whole wheat bread", "toast"],
    tags: ["carb"],
    group: "grain"
  },
  {
    key: "pasta",
    aliases: ["pasta", "noodles"],
    tags: ["carb"],
    group: "grain"
  },
  {
    key: "tortilla",
    aliases: ["tortilla", "tortillas", "wrap"],
    tags: ["carb"],
    group: "grain"
  },
  {
    key: "potato",
    aliases: ["potato", "potatoes", "sweet potato"],
    tags: ["carb", "fiber"],
    group: "grain"
  },
  {
    key: "beans",
    aliases: ["beans", "black beans", "pinto beans", "kidney beans", "canned beans"],
    tags: ["protein", "fiber", "iron"],
    group: "protein"
  },
  {
    key: "lentils",
    aliases: ["lentils", "dal"],
    tags: ["protein", "fiber", "iron"],
    group: "protein"
  },
  {
    key: "eggs",
    aliases: ["egg", "eggs"],
    tags: ["protein"],
    group: "protein"
  },
  {
    key: "chicken",
    aliases: ["chicken", "chicken breast", "cooked chicken"],
    tags: ["protein", "iron"],
    group: "protein"
  },
  {
    key: "tuna",
    aliases: ["tuna", "canned tuna", "fish"],
    tags: ["protein"],
    group: "protein"
  },
  {
    key: "tofu",
    aliases: ["tofu"],
    tags: ["protein", "calcium"],
    group: "protein"
  },
  {
    key: "peanut butter",
    aliases: ["peanut butter", "pb"],
    tags: ["protein", "healthy_fat"],
    group: "protein"
  },
  {
    key: "milk",
    aliases: ["milk"],
    tags: ["protein", "calcium"],
    group: "dairy"
  },
  {
    key: "yogurt",
    aliases: ["yogurt", "curd", "greek yogurt"],
    tags: ["protein", "calcium"],
    group: "dairy"
  },
  {
    key: "cheese",
    aliases: ["cheese"],
    tags: ["calcium"],
    group: "dairy"
  },
  {
    key: "spinach",
    aliases: ["spinach", "greens"],
    tags: ["fiber", "iron"],
    group: "produce"
  },
  {
    key: "carrot",
    aliases: ["carrot", "carrots"],
    tags: ["fiber"],
    group: "produce"
  },
  {
    key: "tomato",
    aliases: ["tomato", "tomatoes"],
    tags: ["vitamin_c"],
    group: "produce"
  },
  {
    key: "frozen vegetables",
    aliases: ["frozen vegetables", "mixed vegetables", "veggies"],
    tags: ["fiber", "vitamin_c"],
    group: "produce"
  },
  {
    key: "banana",
    aliases: ["banana", "bananas"],
    tags: ["carb", "fiber"],
    group: "produce"
  },
  {
    key: "apple",
    aliases: ["apple", "apples"],
    tags: ["fiber", "vitamin_c"],
    group: "produce"
  },
  {
    key: "orange",
    aliases: ["orange", "oranges", "citrus"],
    tags: ["vitamin_c", "fiber"],
    group: "produce"
  },
  {
    key: "onion",
    aliases: ["onion", "onions"],
    tags: ["fiber"],
    group: "produce"
  },
  {
    key: "avocado",
    aliases: ["avocado"],
    tags: ["healthy_fat", "fiber"],
    group: "produce"
  },
  {
    key: "nuts",
    aliases: ["nuts", "almonds", "peanuts"],
    tags: ["healthy_fat", "protein"],
    group: "protein"
  },
  {
    key: "olive oil",
    aliases: ["olive oil", "oil"],
    tags: ["healthy_fat"],
    group: "fat"
  }
];

const NUTRIENT_LABELS = {
  protein: "Protein",
  fiber: "Fiber",
  vitamin_c: "Vitamin C",
  iron: "Iron",
  healthy_fat: "Healthy fats",
  calcium: "Calcium"
};

const RESOURCE_DB = {
  "los angeles": [
    {
      name: "LA Regional Food Bank",
      type: "Food pantry network",
      details: "Pantry distribution across LA County. Call before visiting.",
      contact: "(323) 234-3030"
    },
    {
      name: "Project Angel Food",
      type: "Home-delivered meals",
      details: "Meals for people with serious health and nutrition needs.",
      contact: "(323) 845-1800"
    },
    {
      name: "CalFresh Enrollment Help (LA)",
      type: "Benefits support",
      details: "Local enrollment support for food assistance benefits.",
      contact: "Dial 2-1-1"
    }
  ],
  "new york": [
    {
      name: "City Harvest Partner Pantries",
      type: "Food pantry network",
      details: "Find open pantry partners across NYC boroughs.",
      contact: "Dial 3-1-1"
    },
    {
      name: "Food Bank For NYC",
      type: "Meals and groceries",
      details: "Community kitchen and pantry locations by zip code.",
      contact: "(212) 566-7855"
    },
    {
      name: "ACCESS HRA Support",
      type: "Benefits support",
      details: "Assistance with SNAP and emergency food benefits.",
      contact: "Dial 3-1-1"
    }
  ],
  chicago: [
    {
      name: "Greater Chicago Food Depository",
      type: "Food pantry network",
      details: "Neighborhood pantry locator and produce support.",
      contact: "(773) 247-3663"
    },
    {
      name: "Catholic Charities Meal Sites",
      type: "Prepared meal support",
      details: "Daily meal sites in multiple neighborhoods.",
      contact: "(312) 655-7000"
    },
    {
      name: "Illinois SNAP Outreach",
      type: "Benefits support",
      details: "Help applying for ongoing food benefits.",
      contact: "Dial 2-1-1"
    }
  ],
  houston: [
    {
      name: "Houston Food Bank",
      type: "Food pantry network",
      details: "Drive-through and walk-in partner sites across the city.",
      contact: "(832) 369-9390"
    },
    {
      name: "BakerRipley Community Centers",
      type: "Food and family services",
      details: "Food distributions and family stabilization support.",
      contact: "(713) 667-9400"
    },
    {
      name: "Texas 2-1-1",
      type: "Rapid support routing",
      details: "Connects you to local pantry and emergency meal options.",
      contact: "Dial 2-1-1"
    }
  ],
  phoenix: [
    {
      name: "St. Mary's Food Bank",
      type: "Food pantry network",
      details: "Emergency food boxes and neighborhood distributions.",
      contact: "(602) 242-3663"
    },
    {
      name: "Arizona Food Assistance Finder",
      type: "Benefits + pantry support",
      details: "Find nearby pantry sites and nutrition support programs.",
      contact: "Dial 2-1-1"
    }
  ],
  atlanta: [
    {
      name: "Atlanta Community Food Bank",
      type: "Food pantry network",
      details: "Partner agencies serving metro Atlanta families.",
      contact: "(404) 892-9822"
    },
    {
      name: "Georgia Gateway SNAP Help",
      type: "Benefits support",
      details: "Support applying for and managing food benefits.",
      contact: "Dial 2-1-1"
    }
  ],
  seattle: [
    {
      name: "Food Lifeline Partners",
      type: "Food pantry network",
      details: "Find pantry, mobile food support, and meal programs.",
      contact: "(206) 545-6600"
    },
    {
      name: "Seattle Human Services Food Support",
      type: "City support routing",
      details: "Connect to food and emergency household resources.",
      contact: "Dial 2-1-1"
    }
  ],
  "san francisco": [
    {
      name: "SF-Marin Food Bank",
      type: "Pantry and grocery support",
      details: "Weekly groceries and neighborhood pantry options.",
      contact: "(415) 282-1900"
    },
    {
      name: "Medi-Cal and CalFresh Navigation",
      type: "Benefits support",
      details: "Enrollment support through city partner agencies.",
      contact: "Dial 2-1-1"
    }
  ]
};

const aliasMap = buildAliasMap(FOOD_LIBRARY);

const assessmentForm = document.getElementById("assessment-form");
const mealForm = document.getElementById("meal-form");
const resourceForm = document.getElementById("resource-form");
const resultsSection = document.getElementById("results");
const mealOutput = document.getElementById("meal-output");

const flowAssess = document.getElementById("flow-assess");
const flowResults = document.getElementById("flow-results");
const flowMeal = document.getElementById("flow-meal");
const flowSupport = document.getElementById("flow-support");

let latestSummary = "";
let latestMealSummary = "";

markFlow(flowAssess);

assessmentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  handleAssessmentSubmit();
});

mealForm.addEventListener("submit", (event) => {
  event.preventDefault();
  handleMealSubmit();
});

resourceForm.addEventListener("submit", (event) => {
  event.preventDefault();
  handleResourceSearch();
});

document.getElementById("cta-meal").addEventListener("click", () => {
  markFlow(flowMeal);
  scrollToId("meal-builder");
});

document.getElementById("cta-support").addEventListener("click", () => {
  markFlow(flowSupport);
  scrollToId("resources");
});

document.getElementById("speak-summary").addEventListener("click", () => {
  if (!latestSummary) return;
  speak(latestSummary);
});

document.getElementById("speak-meal").addEventListener("click", () => {
  if (!latestMealSummary) return;
  speak(latestMealSummary);
});

document.getElementById("save-summary").addEventListener("click", () => {
  if (!latestSummary) return;
  const payload = {
    savedAt: new Date().toISOString(),
    summary: latestSummary,
    meal: latestMealSummary || ""
  };
  localStorage.setItem("nutripath-last-result", JSON.stringify(payload));

  const scoreNode = document.getElementById("risk-score");
  scoreNode.textContent = "Saved. You can reopen this browser to view your latest result.";
});

function handleAssessmentSubmit() {
  const age = Number(document.getElementById("age").value);
  const appetite = document.getElementById("appetite").value;
  const mealsSkipped = document.getElementById("mealsSkipped").value;
  const energy = document.getElementById("energy").value;
  const affordability = document.getElementById("affordability").value;
  const errorNode = document.getElementById("assessment-error");

  if (!Number.isFinite(age) || age < 0 || age > 120 || !appetite || !mealsSkipped || !energy || !affordability) {
    errorNode.textContent = "Please complete all 5 questions to continue.";
    return;
  }

  errorNode.textContent = "";

  const scoreBreakdown = {
    age: age < 5 || age > 65 ? 2 : 0,
    appetite: appetite === "normal" ? 0 : appetite === "lower" ? 2 : 4,
    mealsSkipped: mealsSkipped === "0" ? 0 : mealsSkipped === "1" ? 2 : mealsSkipped === "2" ? 4 : 6,
    energy: energy === "normal" ? 0 : energy === "low" ? 2 : 4,
    affordability: affordability === "stable" ? 0 : affordability === "tight" ? 2 : 5
  };

  const total = Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0);

  let riskLevel = "low";
  if (total >= 12) {
    riskLevel = "high";
  } else if (total >= 6) {
    riskLevel = "moderate";
  }

  const riskData = RISK_CONTENT[riskLevel];

  const riskBadge = document.getElementById("risk-badge");
  riskBadge.textContent = riskLevel;
  riskBadge.className = `risk-badge ${riskLevel}`;

  document.getElementById("risk-explainer").textContent = riskData.explanation;
  document.getElementById("risk-score").textContent = `Risk score: ${total}/21`;

  renderList("watch-list", riskData.watch);
  renderList("today-actions", riskData.actions);

  resultsSection.classList.remove("hidden");
  markFlow(flowResults);
  scrollToId("results");

  latestSummary = `NutriPath result: ${riskLevel} risk. ${riskData.explanation} Start with this: ${riskData.actions[0]}`;
}

function handleMealSubmit() {
  const foodsRaw = document.getElementById("foods").value;
  const errorNode = document.getElementById("meal-error");

  if (!foodsRaw.trim()) {
    errorNode.textContent = "Add at least one food item to continue.";
    return;
  }

  const parsed = parseFoods(foodsRaw);
  if (parsed.matches.length === 0) {
    errorNode.textContent =
      "We could not match those foods. Try simple names like rice, eggs, beans, milk, spinach, banana.";
    return;
  }

  errorNode.textContent = "";

  const plan = buildMealPlan(parsed.matches);

  document.getElementById("meal-title").textContent = plan.mealTitle;
  document.getElementById("meal-description").textContent = plan.mealDescription;
  document.getElementById("upgrade-title").textContent = plan.upgradeTitle;
  document.getElementById("upgrade-description").textContent = plan.upgradeDescription;
  document.getElementById("recognized-foods").textContent = `Recognized foods: ${plan.recognizedFoods.join(", ")}.`;

  const nutrientGapsNode = document.getElementById("nutrient-gaps");
  nutrientGapsNode.innerHTML = "";
  plan.missingLabels.forEach((label) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = label;
    nutrientGapsNode.appendChild(chip);
  });

  mealOutput.classList.remove("hidden");
  markFlow(flowMeal);
  scrollToId("meal-output");

  latestMealSummary = `Meal now: ${plan.mealTitle}. ${plan.mealDescription}. Next: ${plan.upgradeDescription}`;
}

function handleResourceSearch() {
  const cityInput = document.getElementById("city").value.trim();
  const target = document.getElementById("resource-results");

  if (!cityInput) {
    target.innerHTML = `<article class="resource-item helper-card"><h3>Add a city first</h3><p>Type your city to get nearby options.</p></article>`;
    return;
  }

  const cityKey = sanitize(cityInput);
  const matchedKey = findCityKey(cityKey);
  const localResources = matchedKey ? RESOURCE_DB[matchedKey] : [];

  if (localResources.length === 0) {
    target.innerHTML = `
      <article class="resource-item helper-card">
        <h3>No exact local matches yet</h3>
        <p>Start with this: call <strong>2-1-1</strong> now and ask for the closest pantry or emergency food site in ${escapeHtml(
          cityInput
        )}.</p>
        <p>If possible, do this next: check <strong>Feeding America local food bank locator</strong> and city human services listings.</p>
      </article>
    `;
  } else {
    target.innerHTML = localResources
      .map(
        (resource) => `
      <article class="resource-item">
        <h3>${escapeHtml(resource.name)}</h3>
        <p><strong>${escapeHtml(resource.type)}</strong></p>
        <p>${escapeHtml(resource.details)}</p>
        <p><strong>Contact:</strong> ${escapeHtml(resource.contact)}</p>
      </article>
    `
      )
      .join("");
  }

  target.insertAdjacentHTML(
    "beforeend",
    `<article class="resource-item helper-card"><h3>National quick support</h3><p>Dial <strong>2-1-1</strong> for same-day food resources. For families with children, ask about local school meal pickup and WIC support.</p></article>`
  );

  markFlow(flowSupport);
}

function buildMealPlan(matchedFoods) {
  const byTag = (tag) => matchedFoods.find((food) => food.tags.includes(tag));
  const byGroup = (group) => matchedFoods.find((food) => food.group === group);

  const carb = byTag("carb");
  const protein = byTag("protein");
  const produce = byGroup("produce");
  const dairy = byGroup("dairy");

  let mealTitle = "Simple balanced plate";
  let mealDescription =
    "Use one filling food + one protein + one fruit or vegetable. Keep it simple and eat within the next hour.";

  if (carb && protein && produce) {
    mealTitle = `${titleCase(protein.key)} and ${titleCase(carb.key)} bowl`;
    mealDescription = `Combine ${protein.key}, ${carb.key}, and ${produce.key}. This gives energy now plus better fullness.`;
  } else if (carb && protein) {
    mealTitle = `${titleCase(protein.key)} with ${titleCase(carb.key)}`;
    mealDescription = `Pair ${protein.key} with ${carb.key}. If possible add any fruit or vegetable on the side.`;
  } else if (protein && produce) {
    mealTitle = `${titleCase(protein.key)} + ${titleCase(produce.key)} plate`;
    mealDescription = `Eat ${protein.key} with ${produce.key}. Add bread, rice, or potato if available for more energy.`;
  } else if (dairy && carb) {
    mealTitle = `${titleCase(carb.key)} with ${titleCase(dairy.key)}`;
    mealDescription = `Start with ${carb.key} and ${dairy.key} for steady energy and added protein.`;
  } else if (matchedFoods.length === 1) {
    mealTitle = `${titleCase(matchedFoods[0].key)} now`;
    mealDescription = `Start with ${matchedFoods[0].key} now. Then add one protein item if possible.`;
  }

  const missing = findMissingNutrients(matchedFoods);
  const recommendation = recommendCheapAddition(missing, matchedFoods.map((food) => food.key));

  return {
    mealTitle,
    mealDescription,
    upgradeTitle: recommendation.title,
    upgradeDescription: recommendation.description,
    missingLabels: missing.length ? missing.map((nutrient) => NUTRIENT_LABELS[nutrient]) : ["No major immediate gaps"],
    recognizedFoods: matchedFoods.map((food) => food.key)
  };
}

function findMissingNutrients(matchedFoods) {
  const seen = new Set();
  matchedFoods.forEach((food) => {
    food.tags.forEach((tag) => {
      seen.add(tag);
    });
  });

  const priorities = ["protein", "fiber", "vitamin_c", "iron", "healthy_fat", "calcium"];
  return priorities.filter((item) => !seen.has(item)).slice(0, 3);
}

function recommendCheapAddition(missingNutrients, existingKeys) {
  const additionsByNutrient = {
    protein: {
      item: "eggs",
      cost: "$3-4/dozen",
      reason: "adds protein for fullness and recovery"
    },
    fiber: {
      item: "oats",
      cost: "$2-4/bag",
      reason: "improves fullness and gut health"
    },
    vitamin_c: {
      item: "oranges",
      cost: "$1 each or less",
      reason: "supports immunity and iron absorption"
    },
    iron: {
      item: "lentils",
      cost: "$2-3/bag",
      reason: "adds iron and protein with low cost"
    },
    healthy_fat: {
      item: "peanut butter",
      cost: "$2-4/jar",
      reason: "adds calories and keeps meals satisfying"
    },
    calcium: {
      item: "milk",
      cost: "$2-4/half gallon",
      reason: "supports calcium needs for children and adults"
    }
  };

  for (const nutrient of missingNutrients) {
    const option = additionsByNutrient[nutrient];
    if (option && !existingKeys.includes(option.item)) {
      return {
        title: `Add ${titleCase(option.item)} (${option.cost})`,
        description: `If possible, do this next: add ${option.item}. It ${option.reason}.`
      };
    }
  }

  return {
    title: "Add frozen vegetables when possible",
    description: "If possible, do this next: add frozen mixed vegetables for low-cost vitamins and fiber."
  };
}

function parseFoods(input) {
  const tokens = input
    .split(/[\n,]/g)
    .map((part) => part.trim())
    .filter(Boolean);

  const matches = [];
  const seen = new Set();

  tokens.forEach((token) => {
    const cleaned = sanitize(token);
    let matchedKey = aliasMap[cleaned] || null;

    if (!matchedKey && cleaned.length >= 3) {
      matchedKey = Object.keys(aliasMap).find((alias) => alias.includes(cleaned) || cleaned.includes(alias))
        ? aliasMap[Object.keys(aliasMap).find((alias) => alias.includes(cleaned) || cleaned.includes(alias))]
        : null;
    }

    if (matchedKey && !seen.has(matchedKey)) {
      const found = FOOD_LIBRARY.find((food) => food.key === matchedKey);
      if (found) {
        matches.push(found);
        seen.add(matchedKey);
      }
    }
  });

  return { matches };
}

function buildAliasMap(foods) {
  const map = {};
  foods.forEach((food) => {
    food.aliases.forEach((alias) => {
      map[sanitize(alias)] = food.key;
    });
    map[sanitize(food.key)] = food.key;
  });
  return map;
}

function findCityKey(sanitizedInput) {
  if (RESOURCE_DB[sanitizedInput]) {
    return sanitizedInput;
  }

  const keys = Object.keys(RESOURCE_DB);
  return keys.find((key) => key.includes(sanitizedInput) || sanitizedInput.includes(key));
}

function renderList(listId, values) {
  const target = document.getElementById(listId);
  target.innerHTML = values.map((value) => `<li>${escapeHtml(value)}</li>`).join("");
}

function scrollToId(id) {
  const node = document.getElementById(id);
  if (!node) return;
  node.scrollIntoView({ behavior: "smooth", block: "start" });
}

function markFlow(activeNode) {
  [flowAssess, flowResults, flowMeal, flowSupport].forEach((node) => node.classList.remove("active"));
  activeNode.classList.add("active");
}

function titleCase(input) {
  return input
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function sanitize(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.lang = "en-US";
  window.speechSynthesis.speak(utterance);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

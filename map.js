(function () {
  if (!window.L || !window.NutriData || !window.NutriApp) return;

  const communityInput = document.getElementById('map-community');
  const communityList = document.getElementById('map-community-options');
  const communitySuggestionsNode = document.getElementById('map-community-suggestions');
  const communityFeedbackNode = document.getElementById('map-community-feedback');
  const typeSelect = document.getElementById('resource-type');
  const distanceRange = document.getElementById('max-distance');
  const distanceLabel = document.getElementById('distance-label');
  const statusNode = document.getElementById('map-status');
  const statsNode = document.getElementById('map-stats');
  const resourceList = document.getElementById('resource-list');
  const resourceListTitle = document.getElementById('resource-list-title');
  const resourceListSubtitle = document.getElementById('resource-list-subtitle');
  const applyButton = document.getElementById('apply-map-filter');
  const locateButton = document.getElementById('locate-btn');
  const locationConfirmNode = document.getElementById('location-confirm');
  const emptyStateNode = document.getElementById('map-empty-state');
  const emptyStateTitleNode = document.getElementById('map-empty-title');
  const emptyStateCopyNode = document.getElementById('map-empty-copy');
  const increaseDistanceButton = document.getElementById('btn-increase-distance');
  const showClosestButton = document.getElementById('btn-show-closest');
  const resetMapButton = document.getElementById('btn-reset-map');
  const loadingNode = document.getElementById('map-loading');
  const loadingTextNode = document.getElementById('map-loading-text');

  const DEFAULT_VIEW = { lat: 39.5, lng: -98.35, zoom: 4 };
  const DEFAULT_DISTANCE_KM = 20;
  const CLOSEST_LIMIT = 20;
  const MAX_CONTEXT_MARKERS = 320;

  const communityEntries = Object.entries(NutriData.communities)
    .map(([name, point]) => {
      const country = String(point?.country || '').trim();
      const label = `${name}, ${country}`;
      return {
        key: name,
        name,
        country,
        label,
        point,
        normalizedName: normalizeText(name),
        normalizedLabel: normalizeText(label),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  communityEntries.forEach((entry) => {
    const option = document.createElement('option');
    option.value = entry.label;
    communityList.appendChild(option);
  });

  const map = L.map('resource-map').setView([DEFAULT_VIEW.lat, DEFAULT_VIEW.lng], DEFAULT_VIEW.zoom);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  }).addTo(map);
  map.attributionControl.setPrefix('');

  map.createPane('globalLabelPane');
  const labelPane = map.getPane('globalLabelPane');
  if (labelPane) labelPane.style.zIndex = '360';

  const contextLayer = L.layerGroup().addTo(map);
  const supportsClustering = typeof L.markerClusterGroup === 'function';
  const markerLayer = supportsClustering
    ? L.markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        maxClusterRadius: 40,
        iconCreateFunction(cluster) {
          return L.divIcon({
            className: 'map-cluster',
            html: `<span class="map-cluster-badge">${cluster.getChildCount()}</span>`,
            iconSize: [34, 34],
            iconAnchor: [17, 17],
          });
        },
      })
    : L.layerGroup();
  markerLayer.addTo(map);

  const hotspotLayer = L.layerGroup().addTo(map);
  const continentLabelLayer = L.layerGroup().addTo(map);
  const countryLabelLayer = L.layerGroup().addTo(map);
  const cityLabelLayer = L.layerGroup().addTo(map);

  let mapCenter = null;
  let centerLabel = '';
  let usingCurrentLocation = false;
  let countryCentroids = [];
  let countryDataLoaded = false;
  let filterRunId = 0;
  let activeMode = 'global';

  const geocodeCache = new Map();
  const reverseGeocodeCache = new Map();
  const liveResourceCache = new Map();

  const continentPoints = [
    { code: '019', fallback: 'Americas', lat: 15, lng: -85 },
    { code: '150', fallback: 'Europe', lat: 54, lng: 15 },
    { code: '002', fallback: 'Africa', lat: 2, lng: 20 },
    { code: '142', fallback: 'Asia', lat: 35, lng: 90 },
    { code: '009', fallback: 'Oceania', lat: -20, lng: 140 },
    { code: '010', fallback: 'Antarctica', lat: -78, lng: 0 },
  ];

  function t(key, vars) {
    return window.NutriApp?.t ? window.NutriApp.t(key, vars) : key;
  }

  function resourceTypeLabel(type) {
    return window.NutriApp?.getResourceTypeLabel ? window.NutriApp.getResourceTypeLabel(type) : type;
  }

  function normalizeText(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function currentLanguage() {
    return window.NutriApp?.getUiLanguage ? window.NutriApp.getUiLanguage() : 'en';
  }

  function localizeRegion(code, fallback) {
    try {
      const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
      return regionNames.of(code) || fallback;
    } catch {
      return fallback;
    }
  }

  function setLoading(isLoading, messageKey = 'map_loading_filters') {
    if (applyButton) applyButton.disabled = isLoading;
    if (locateButton) locateButton.disabled = isLoading;
    resourceList.classList.toggle('is-loading', isLoading);
    if (!loadingNode || !loadingTextNode) return;
    loadingTextNode.textContent = t(messageKey);
    loadingNode.classList.toggle('hide', !isLoading);
  }

  function setStatus(text, tone = 'info') {
    statusNode.classList.remove('map-status-info', 'map-status-ok', 'map-status-warn');
    statusNode.classList.add(tone === 'ok' ? 'map-status-ok' : tone === 'warn' ? 'map-status-warn' : 'map-status-info');
    statusNode.textContent = text || '';
  }

  function setCommunityFeedback(text) {
    if (!communityFeedbackNode) return;
    const message = String(text || '').trim();
    communityFeedbackNode.textContent = message;
    communityFeedbackNode.classList.toggle('hide', !message);
  }

  function showLocationConfirm(text) {
    if (!locationConfirmNode) return;
    locationConfirmNode.textContent = text;
    locationConfirmNode.classList.toggle('hide', !String(text || '').trim());
  }

  function hideEmptyState() {
    if (!emptyStateNode) return;
    emptyStateNode.classList.add('hide');
  }

  function showEmptyState(maxDistance) {
    if (!emptyStateNode || !emptyStateTitleNode || !emptyStateCopyNode) return;
    emptyStateTitleNode.textContent = t('map_empty_title', { distance: maxDistance });
    emptyStateCopyNode.textContent = t('map_empty_copy', { distance: maxDistance });
    emptyStateNode.classList.remove('hide');
  }

  function applyStaticMapTexts() {
    if (increaseDistanceButton) increaseDistanceButton.textContent = t('map_btn_increase_distance');
    if (showClosestButton) showClosestButton.textContent = t('map_btn_show_closest');
    if (resetMapButton) resetMapButton.textContent = t('map_btn_reset_filters');
    if (loadingTextNode) loadingTextNode.textContent = t('map_loading_filters');
  }

  function updateDistanceLabel() {
    distanceLabel.textContent = t('map_distance_value', { distance: distanceRange.value });
  }

  function formatDistanceValue(distance) {
    if (!Number.isFinite(distance)) return null;
    if (distance >= 300) return `${Math.round(distance / 10) * 10}+ km`;
    if (distance >= 20) return `~${Math.round(distance)} km`;
    return `${distance.toFixed(1)} km`;
  }

  function formatDistanceAway(distance) {
    if (!Number.isFinite(distance)) return t('map_distance_pending');
    if (distance >= 300) return t('map_distance_away_plus', { distance: Math.round(distance / 10) * 10 });
    if (distance >= 20) return t('map_distance_away_approx', { distance: Math.round(distance) });
    return t('map_distance_away_precise', { distance: distance.toFixed(1) });
  }

  function resourceKey(resource) {
    return `${resource.type}|${resource.name}|${Number(resource.lat).toFixed(4)}|${Number(resource.lng).toFixed(4)}`;
  }

  function markerTypeClass(type) {
    return String(type || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
  }

  function resultMarkerIcon(type) {
    const typeClass = markerTypeClass(type);
    return L.divIcon({
      className: 'map-resource-icon',
      html: `<span class="map-resource-pin map-resource-pin-${typeClass}"></span>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
  }

  function mutedMarkerIcon() {
    return L.divIcon({
      className: 'map-resource-icon-muted',
      html: '<span class="map-resource-pin-muted"></span>',
      iconSize: [10, 10],
      iconAnchor: [5, 5],
    });
  }

  function createLabelMarker(lat, lng, text, type) {
    return L.marker([lat, lng], {
      pane: 'globalLabelPane',
      interactive: false,
      keyboard: false,
      icon: L.divIcon({
        className: `map-label map-label-${type}`,
        html: `<span>${escapeHtml(text)}</span>`,
      }),
    });
  }

  async function loadCountryCentroids() {
    if (countryDataLoaded) return;
    countryDataLoaded = true;
    try {
      const response = await fetch('https://raw.githubusercontent.com/gavinr/world-countries-centroids/master/dist/countries.geojson');
      if (!response.ok) return;
      const geojson = await response.json();
      if (!geojson || !Array.isArray(geojson.features)) return;
      countryCentroids = geojson.features
        .map((feature) => {
          const coords = feature?.geometry?.coordinates;
          const iso = feature?.properties?.ISO;
          if (!Array.isArray(coords) || coords.length < 2 || !iso) return null;
          return {
            iso: String(iso).toUpperCase(),
            country: feature?.properties?.COUNTRY || iso,
            lat: Number(coords[1]),
            lng: Number(coords[0]),
          };
        })
        .filter(Boolean);
    } catch {
      countryCentroids = [];
    }
  }

  function renderGlobalLabels() {
    continentLabelLayer.clearLayers();
    countryLabelLayer.clearLayers();
    cityLabelLayer.clearLayers();

    continentPoints.forEach((point) => {
      const name = localizeRegion(point.code, point.fallback);
      createLabelMarker(point.lat, point.lng, name, 'continent').addTo(continentLabelLayer);
    });

    countryCentroids.forEach((country) => {
      const localizedCountry = localizeRegion(country.iso, country.country);
      createLabelMarker(country.lat, country.lng, localizedCountry, 'country').addTo(countryLabelLayer);
    });

    communityEntries.forEach((entry) => {
      createLabelMarker(entry.point.lat, entry.point.lng, entry.name, 'city').addTo(cityLabelLayer);
    });
  }

  function renderHotspots() {
    hotspotLayer.clearLayers();

    const history = NutriApp.getHistory();
    const highRiskByCommunity = {};

    history.forEach((entry) => {
      const label = entry?.payload?.community;
      const key = entry?.payload?.communityKey || (label ? String(label).split(',')[0].trim() : '');
      if (!key) return;
      if (!['High', 'Urgent'].includes(entry?.riskOutput?.category)) return;
      if (!highRiskByCommunity[key]) {
        highRiskByCommunity[key] = { count: 0, label: label || key };
      }
      highRiskByCommunity[key].count += 1;
    });

    Object.entries(highRiskByCommunity).forEach(([communityKey, stats]) => {
      const point = NutriData.communities[communityKey];
      if (!point) return;
      L.circle([point.lat, point.lng], {
        color: '#e63946',
        fillColor: '#e63946',
        fillOpacity: 0.22,
        radius: 250 + stats.count * 120,
      })
        .bindPopup(`${stats.label}<br/>${t('map_hotspot_cases', { count: stats.count })}`)
        .addTo(hotspotLayer);
    });
  }

  function scoreCommunity(entry, normalizedQuery) {
    if (!normalizedQuery) return 0;
    if (entry.normalizedName === normalizedQuery || entry.normalizedLabel === normalizedQuery) return 100;
    if (entry.normalizedName.startsWith(normalizedQuery) || entry.normalizedLabel.startsWith(normalizedQuery)) return 70;
    if (entry.normalizedLabel.includes(normalizedQuery)) return 45;
    return 0;
  }

  function getCommunitySuggestions(value, limit = 8) {
    const normalizedQuery = normalizeText(value);
    if (!normalizedQuery) return communityEntries.slice(0, limit);

    return communityEntries
      .map((entry) => ({ entry, score: scoreCommunity(entry, normalizedQuery) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label))
      .slice(0, limit)
      .map((item) => item.entry);
  }

  function hideCommunitySuggestions() {
    if (!communitySuggestionsNode) return;
    communitySuggestionsNode.innerHTML = '';
    communitySuggestionsNode.classList.add('hide');
  }

  function renderCommunitySuggestions(value) {
    if (!communitySuggestionsNode) return;

    const query = String(value || '').trim();
    if (!query) {
      hideCommunitySuggestions();
      setCommunityFeedback('');
      return;
    }

    const suggestions = getCommunitySuggestions(query);
    if (!suggestions.length) {
      hideCommunitySuggestions();
      setCommunityFeedback(t('map_feedback_no_supported'));
      return;
    }

    setCommunityFeedback('');
    communitySuggestionsNode.innerHTML = '';
    suggestions.forEach((entry) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'map-suggestion';
      button.textContent = entry.label;
      button.addEventListener('click', () => {
        communityInput.value = entry.label;
        hideCommunitySuggestions();
        setCommunityFeedback('');
      });
      communitySuggestionsNode.appendChild(button);
    });
    communitySuggestionsNode.classList.remove('hide');
  }

  function resolveCommunityInput(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;

    const normalized = normalizeText(raw);
    const withoutCountry = normalizeText(raw.split(',')[0] || raw);

    const exact = communityEntries.find((entry) => entry.normalizedLabel === normalized || entry.normalizedName === withoutCountry);
    if (exact) {
      return {
        key: exact.key,
        label: exact.label,
        point: exact.point,
      };
    }

    const best = getCommunitySuggestions(raw, 1)[0];
    if (best) {
      return {
        key: best.key,
        label: best.label,
        point: best.point,
      };
    }

    return null;
  }

  async function timedFetch(url, options, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async function geocodeCommunityInput(value) {
    const raw = String(value || '').trim();
    const cacheKey = normalizeText(raw);
    if (!cacheKey) return null;
    if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey);

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=${encodeURIComponent(currentLanguage())}&q=${encodeURIComponent(raw)}`;
      const response = await timedFetch(url, {}, 6000);
      if (!response.ok) {
        geocodeCache.set(cacheKey, null);
        return null;
      }

      const data = await response.json();
      if (!Array.isArray(data) || !data.length) {
        geocodeCache.set(cacheKey, null);
        return null;
      }

      const top = data[0];
      const resolved = {
        lat: Number(top.lat),
        lng: Number(top.lon),
        label: raw,
      };
      if (!Number.isFinite(resolved.lat) || !Number.isFinite(resolved.lng)) {
        geocodeCache.set(cacheKey, null);
        return null;
      }

      geocodeCache.set(cacheKey, resolved);
      return resolved;
    } catch {
      geocodeCache.set(cacheKey, null);
      return null;
    }
  }

  async function reverseGeocode(lat, lng) {
    const key = `${Number(lat).toFixed(3)}|${Number(lng).toFixed(3)}|${currentLanguage()}`;
    if (reverseGeocodeCache.has(key)) return reverseGeocodeCache.get(key);

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=${encodeURIComponent(currentLanguage())}&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
      const response = await timedFetch(url, {}, 6000);
      if (!response.ok) {
        reverseGeocodeCache.set(key, null);
        return null;
      }

      const data = await response.json();
      const address = data?.address || {};
      const city = address.city || address.town || address.village || address.hamlet || address.county || '';
      const region = address.state || address.region || address.country || '';
      const place = [city, region].filter(Boolean).join(', ').trim();

      const resolved = place || String(data?.display_name || '').split(',').slice(0, 2).join(', ').trim() || null;
      reverseGeocodeCache.set(key, resolved);
      return resolved;
    } catch {
      reverseGeocodeCache.set(key, null);
      return null;
    }
  }

  function toFixedCoord(value) {
    return Number(value).toFixed(3);
  }

  function liveTypeFromTags(tags) {
    const amenity = String(tags?.amenity || '').toLowerCase();
    const office = String(tags?.office || '').toLowerCase();
    const social = String(tags?.social_facility || '').toLowerCase();

    if (['clinic', 'hospital', 'doctors', 'pharmacy'].includes(amenity)) return 'Clinic';
    if (amenity === 'food_bank') return 'Food Support';
    if (office === 'ngo' || office === 'charity') return 'NGO';
    if (amenity === 'social_facility') {
      if (social.includes('food') || social.includes('soup')) return 'Food Support';
      return 'NGO';
    }
    return 'Clinic';
  }

  function liveServicesForType(type, tags) {
    const healthcare = String(tags?.healthcare || '').trim();
    const speciality = String(tags?.healthcare_speciality || '').trim();
    const base = [];

    if (healthcare) base.push(healthcare.replace(/_/g, ' '));
    if (speciality) base.push(speciality.replace(/_/g, ' '));

    if (type === 'Clinic') {
      if (!base.length) return ['Primary care', 'Child health', 'Nutrition referral'];
      return base.slice(0, 3);
    }
    if (type === 'Food Support') {
      if (!base.length) return ['Food support', 'Voucher guidance', 'Community assistance'];
      return base.slice(0, 3);
    }
    if (!base.length) return ['Community support', 'Referral navigation', 'Case assistance'];
    return base.slice(0, 3);
  }

  function pointFromOverpassElement(element) {
    if (Number.isFinite(element?.lat) && Number.isFinite(element?.lon)) {
      return { lat: Number(element.lat), lng: Number(element.lon) };
    }
    if (Number.isFinite(element?.center?.lat) && Number.isFinite(element?.center?.lon)) {
      return { lat: Number(element.center.lat), lng: Number(element.center.lon) };
    }
    return null;
  }

  async function fetchLiveNearbyResources(center, maxDistanceKm, type) {
    if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return [];

    const searchRadiusKm = Math.min(250, Math.max(60, Math.round(maxDistanceKm * 4)));
    const radiusM = Math.round(searchRadiusKm * 1000);
    const cacheKey = `${toFixedCoord(center.lat)}|${toFixedCoord(center.lng)}|${radiusM}|${type}`;
    if (liveResourceCache.has(cacheKey)) return liveResourceCache.get(cacheKey);

    const clinicClause = `nwr["amenity"~"clinic|hospital|doctors|pharmacy"](around:${radiusM},${center.lat},${center.lng});`;
    const foodClause = `nwr["amenity"="food_bank"](around:${radiusM},${center.lat},${center.lng});`;
    const ngoClause = `nwr["office"~"ngo|charity"](around:${radiusM},${center.lat},${center.lng});`;
    const socialClause = `nwr["amenity"="social_facility"](around:${radiusM},${center.lat},${center.lng});`;

    const clauses = type === 'Clinic'
      ? [clinicClause]
      : type === 'Food Support'
        ? [foodClause, socialClause]
        : type === 'NGO'
          ? [ngoClause, socialClause]
          : [clinicClause, foodClause, ngoClause, socialClause];

    const query = `
[out:json][timeout:22];
(
${clauses.join('\n')}
);
out tags center 250;
`;

    try {
      const endpoints = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
      ];

      let payload = null;
      for (const endpoint of endpoints) {
        try {
          const response = await timedFetch(
            endpoint,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
              body: `data=${encodeURIComponent(query)}`,
            },
            7000,
          );
          if (!response.ok) continue;
          payload = await response.json();
          break;
        } catch {
          continue;
        }
      }

      if (!payload) {
        liveResourceCache.set(cacheKey, []);
        return [];
      }

      const elements = Array.isArray(payload?.elements) ? payload.elements : [];
      const seen = new Set();

      const liveResources = elements
        .map((element, idx) => {
          const point = pointFromOverpassElement(element);
          if (!point) return null;

          const tags = element.tags || {};
          const inferredType = liveTypeFromTags(tags);
          if (type !== 'All' && inferredType !== type) return null;

          const name = String(tags.name || '').trim() || `${inferredType} ${idx + 1}`;
          const dedupeKey = `${name}|${toFixedCoord(point.lat)}|${toFixedCoord(point.lng)}|${inferredType}`;
          if (seen.has(dedupeKey)) return null;
          seen.add(dedupeKey);

          return {
            id: `live-${element.type || 'node'}-${element.id || idx}`,
            name,
            type: inferredType,
            lat: point.lat,
            lng: point.lng,
            services: liveServicesForType(inferredType, tags),
            open: String(tags.opening_hours || '').trim() || 'Hours not listed',
            distance: NutriApp.haversineKm(center.lat, center.lng, point.lat, point.lng),
            source: 'live',
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 220);

      liveResourceCache.set(cacheKey, liveResources);
      return liveResources;
    } catch {
      liveResourceCache.set(cacheKey, []);
      return [];
    }
  }

  function drawCenterMarker() {
    if (!mapCenter) return;
    L.circleMarker([mapCenter.lat, mapCenter.lng], {
      radius: 8,
      color: '#0b3c5d',
      fillColor: '#17a398',
      fillOpacity: 0.92,
      weight: 2,
    })
      .addTo(contextLayer)
      .bindPopup(centerLabel || t('map_selected_center'));
  }

  function buildCombinedResources(type, liveNearby) {
    const base = NutriData.resources
      .filter((resource) => (type === 'All' ? true : resource.type === type))
      .map((resource) => {
        const distance = mapCenter
          ? NutriApp.haversineKm(mapCenter.lat, mapCenter.lng, resource.lat, resource.lng)
          : null;
        return { ...resource, distance, source: 'dataset' };
      });

    const combinedByKey = new Map();
    [...(liveNearby || []), ...base].forEach((resource) => {
      const key = resourceKey(resource);
      if (!combinedByKey.has(key)) combinedByKey.set(key, resource);
    });

    const combined = [...combinedByKey.values()];
    combined.sort((a, b) => {
      if (mapCenter) return (a.distance ?? Infinity) - (b.distance ?? Infinity);
      return a.name.localeCompare(b.name);
    });
    return combined;
  }

  function computeSelection(allResources, maxDistance) {
    if (!mapCenter) {
      return {
        mode: 'global',
        nearbyCount: allResources.length,
        displayed: allResources,
        closestDistance: allResources[0]?.distance ?? null,
      };
    }

    const nearby = allResources.filter((resource) => Number.isFinite(resource.distance) && resource.distance <= maxDistance);
    if (nearby.length) {
      return {
        mode: 'within',
        nearbyCount: nearby.length,
        displayed: nearby,
        closestDistance: nearby[0]?.distance ?? null,
      };
    }

    return {
      mode: 'closest',
      nearbyCount: 0,
      displayed: allResources.slice(0, Math.min(CLOSEST_LIMIT, allResources.length)),
      closestDistance: allResources[0]?.distance ?? null,
    };
  }

  function popupHtml(resource, distanceText, typeLabel) {
    const servicesText = Array.isArray(resource.services) ? resource.services.join(' · ') : '';
    return `
      <div class="map-popup">
        <div class="map-popup-title">${escapeHtml(resource.name)}</div>
        <div class="map-popup-meta"><span class="tag tag-${markerTypeClass(resource.type)}">${escapeHtml(typeLabel)}</span></div>
        <div class="map-popup-services"><strong>${escapeHtml(t('map_label_services'))}:</strong> ${escapeHtml(servicesText)}</div>
        <div class="map-popup-hours"><strong>${escapeHtml(t('map_label_hours'))}:</strong> ${escapeHtml(resource.open || t('common_na'))}</div>
        <div class="map-popup-hours"><strong>${escapeHtml(t('map_label_distance_short'))}:</strong> ${escapeHtml(distanceText)}</div>
      </div>
    `;
  }

  function clearMarkerLayers() {
    contextLayer.clearLayers();
    if (supportsClustering && markerLayer.clearLayers) {
      markerLayer.clearLayers();
      return;
    }
    if (markerLayer.clearLayers) markerLayer.clearLayers();
  }

  function renderContextMarkers(allResources, highlightedKeys) {
    if (!mapCenter) return;
    drawCenterMarker();

    const contextCandidates = allResources
      .filter((resource) => !highlightedKeys.has(resourceKey(resource)))
      .slice(0, MAX_CONTEXT_MARKERS);

    contextCandidates.forEach((resource) => {
      L.marker([resource.lat, resource.lng], {
        interactive: false,
        keyboard: false,
        icon: mutedMarkerIcon(),
      }).addTo(contextLayer);
    });
  }

  function renderStats(selection, allResources, maxDistance) {
    if (!statsNode) return;

    const lines = [];
    if (mapCenter) {
      lines.push(t('map_stats_showing_within', { count: selection.mode === 'within' ? selection.nearbyCount : 0, distance: maxDistance }));
    } else {
      lines.push(t('map_stats_showing_global', { count: selection.displayed.length }));
    }

    lines.push(t('map_stats_global_verified', { count: allResources.length }));

    if (mapCenter && Number.isFinite(selection.closestDistance)) {
      lines.push(t('map_stats_closest_match', { distance: formatDistanceValue(selection.closestDistance) || t('common_na') }));
    }

    statsNode.innerHTML = lines.map((line) => `<div class="map-stat-line">${escapeHtml(line)}</div>`).join('');
  }

  function renderListHeading(selection, maxDistance, centerDisplay) {
    if (selection.mode === 'within') {
      resourceListTitle.textContent = t('map_list_title_within', { distance: maxDistance });
      resourceListSubtitle.textContent = t('map_list_subtitle_within', { count: selection.nearbyCount, center: centerDisplay });
      return;
    }

    if (selection.mode === 'closest') {
      resourceListTitle.textContent = t('map_list_title_closest');
      resourceListSubtitle.textContent = t('map_list_subtitle_closest', { count: selection.displayed.length });
      return;
    }

    resourceListTitle.textContent = t('map_list_title_global');
    resourceListSubtitle.textContent = t('map_list_subtitle_global', { count: selection.displayed.length });
  }

  function renderStatusCopy(selection, maxDistance, centerDisplay) {
    if (!mapCenter) {
      setStatus(t('map_status_applied_global_better', { count: selection.displayed.length }), 'info');
      return;
    }

    if (selection.mode === 'within') {
      setStatus(
        t('map_status_applied_local_better', {
          count: selection.nearbyCount,
          distance: maxDistance,
          center: centerDisplay,
        }),
        'ok',
      );
      return;
    }

    setStatus(t('map_status_no_nearby', { distance: maxDistance }), 'warn');
  }

  function updateMapView(selection) {
    if (!mapCenter) {
      map.setView([DEFAULT_VIEW.lat, DEFAULT_VIEW.lng], DEFAULT_VIEW.zoom);
      return;
    }

    if (!selection.displayed.length) {
      map.setView([mapCenter.lat, mapCenter.lng], 10);
      return;
    }

    const bounds = L.latLngBounds([[mapCenter.lat, mapCenter.lng]]);
    const zoomItems = selection.mode === 'closest'
      ? selection.displayed.slice(0, Math.min(8, selection.displayed.length))
      : selection.displayed;

    zoomItems.forEach((resource) => bounds.extend([resource.lat, resource.lng]));

    if (!bounds.isValid()) {
      map.setView([mapCenter.lat, mapCenter.lng], 10);
      return;
    }

    map.fitBounds(bounds.pad(0.25), {
      maxZoom: selection.mode === 'within' ? 13 : 8,
      animate: true,
    });
  }

  function renderResources(selection, allResources, maxDistance) {
    activeMode = selection.mode;
    clearMarkerLayers();
    resourceList.innerHTML = '';

    const centerDisplay = centerLabel || t('map_selected_center');
    const highlighted = new Set(selection.displayed.map((resource) => resourceKey(resource)));

    renderContextMarkers(allResources, highlighted);
    renderListHeading(selection, maxDistance, centerDisplay);
    renderStats(selection, allResources, maxDistance);
    renderStatusCopy(selection, maxDistance, centerDisplay);

    if (selection.mode === 'closest' && mapCenter) {
      showEmptyState(maxDistance);
    } else {
      hideEmptyState();
    }

    if (!selection.displayed.length) {
      const node = document.createElement('article');
      node.className = 'resource-item';
      node.textContent = mapCenter ? t('map_no_data_local') : t('map_no_data_global');
      resourceList.appendChild(node);
      updateMapView(selection);
      return;
    }

    selection.displayed.forEach((resource) => {
      const typeLabel = resourceTypeLabel(resource.type);
      const distanceText = mapCenter ? formatDistanceAway(resource.distance) : t('map_distance_pending');

      const marker = L.marker([resource.lat, resource.lng], {
        icon: resultMarkerIcon(resource.type),
      }).bindPopup(popupHtml(resource, distanceText, typeLabel));
      markerLayer.addLayer(marker);

      const node = document.createElement('article');
      node.className = 'resource-item';
      node.innerHTML = `
        <div class="resource-item-head">
          <strong>${escapeHtml(resource.name)}</strong>
          <span class="resource-distance">${escapeHtml(distanceText)}</span>
        </div>
        <div class="resource-meta">
          <span class="tag tag-${markerTypeClass(resource.type)}">${escapeHtml(typeLabel)}</span>
          <span class="resource-hours">${escapeHtml(resource.open || t('common_na'))}</span>
        </div>
        <div class="resource-services">${escapeHtml((resource.services || []).join(' · '))}</div>
      `;
      node.addEventListener('click', () => {
        map.setView([resource.lat, resource.lng], 13);
        marker.openPopup();
      });
      resourceList.appendChild(node);
    });

    updateMapView(selection);
  }

  async function resolveCenter(runId) {
    const raw = String(communityInput.value || '').trim();
    if (!(usingCurrentLocation && raw === t('current_location') && mapCenter)) {
      if (!raw) {
        mapCenter = null;
        centerLabel = '';
        usingCurrentLocation = false;
        showLocationConfirm('');
        setCommunityFeedback('');
        return;
      }

      const matchedCommunity = resolveCommunityInput(raw);
      if (matchedCommunity) {
        mapCenter = { lat: matchedCommunity.point.lat, lng: matchedCommunity.point.lng };
        centerLabel = matchedCommunity.label;
        usingCurrentLocation = false;
        showLocationConfirm('');
        setCommunityFeedback('');
        communityInput.value = matchedCommunity.label;
        return;
      }

      const geocoded = await geocodeCommunityInput(raw);
      if (runId !== filterRunId) return;

      if (geocoded) {
        mapCenter = { lat: geocoded.lat, lng: geocoded.lng };
        centerLabel = geocoded.label;
        usingCurrentLocation = false;
        showLocationConfirm('');
        setCommunityFeedback(t('map_feedback_external_location'));
        return;
      }

      mapCenter = null;
      centerLabel = '';
      usingCurrentLocation = false;
      showLocationConfirm('');
      setCommunityFeedback(t('map_feedback_no_supported'));
      setStatus(t('map_feedback_no_supported'), 'warn');
    }
  }

  async function applyFilters() {
    const runId = ++filterRunId;
    const type = typeSelect.value;
    const maxDistance = Number(distanceRange.value || DEFAULT_DISTANCE_KM);

    setLoading(true, 'map_loading_filters');
    await resolveCenter(runId);
    if (runId !== filterRunId) return;

    const staticCombined = buildCombinedResources(type, []);
    const staticSelection = computeSelection(staticCombined, maxDistance);
    renderResources(staticSelection, staticCombined, maxDistance);

    if (mapCenter) {
      const liveNearby = await fetchLiveNearbyResources(mapCenter, maxDistance, type);
      if (runId !== filterRunId) return;

      const mergedCombined = buildCombinedResources(type, liveNearby);
      const mergedSelection = computeSelection(mergedCombined, maxDistance);
      renderResources(mergedSelection, mergedCombined, maxDistance);
    }

    setLoading(false);
  }

  function increaseDistanceAndApply() {
    const current = Number(distanceRange.value || DEFAULT_DISTANCE_KM);
    const max = Number(distanceRange.max || 500);
    const next = Math.min(max, current + 25);
    distanceRange.value = String(next);
    updateDistanceLabel();
    applyFilters();
  }

  function resetFilters() {
    usingCurrentLocation = false;
    mapCenter = null;
    centerLabel = '';
    communityInput.value = '';
    typeSelect.value = 'All';
    distanceRange.value = String(DEFAULT_DISTANCE_KM);
    updateDistanceLabel();
    setCommunityFeedback('');
    showLocationConfirm('');
    hideCommunitySuggestions();
    hideEmptyState();
    applyFilters();
  }

  distanceRange.addEventListener('input', updateDistanceLabel);
  applyButton.addEventListener('click', applyFilters);

  communityInput.addEventListener('input', () => {
    if (communityInput.value !== t('current_location')) usingCurrentLocation = false;
    renderCommunitySuggestions(communityInput.value);
  });

  communityInput.addEventListener('focus', () => {
    renderCommunitySuggestions(communityInput.value);
  });

  communityInput.addEventListener('blur', () => {
    setTimeout(hideCommunitySuggestions, 120);
  });

  communityInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      hideCommunitySuggestions();
      applyFilters();
    }
  });

  if (increaseDistanceButton) {
    increaseDistanceButton.addEventListener('click', increaseDistanceAndApply);
  }

  if (showClosestButton) {
    showClosestButton.addEventListener('click', () => {
      if (activeMode !== 'closest') {
        applyFilters();
        return;
      }
      resourceList.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      const first = resourceList.querySelector('.resource-item');
      if (first) {
        first.style.borderColor = 'rgba(23, 163, 152, 0.55)';
        setTimeout(() => {
          first.style.borderColor = 'rgba(11, 60, 93, 0.1)';
        }, 900);
      }
    });
  }

  if (resetMapButton) {
    resetMapButton.addEventListener('click', resetFilters);
  }

  locateButton.addEventListener('click', () => {
    if (!navigator.geolocation) {
      setStatus(t('map_location_failed'), 'warn');
      return;
    }

    setLoading(true, 'map_loading_location');
    setStatus(t('map_loading_location'), 'info');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        mapCenter = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        usingCurrentLocation = true;
        communityInput.value = t('current_location');

        const place = await reverseGeocode(mapCenter.lat, mapCenter.lng);
        if (place) {
          centerLabel = place;
          showLocationConfirm(t('map_location_using_named', { place }));
          setStatus(t('map_location_using_named', { place }), 'ok');
        } else {
          centerLabel = t('current_location');
          showLocationConfirm(t('map_location_using'));
          setStatus(t('map_location_using'), 'ok');
        }

        setCommunityFeedback('');
        hideCommunitySuggestions();
        applyFilters();
      },
      () => {
        setLoading(false);
        showLocationConfirm('');
        setStatus(t('map_location_failed'), 'warn');
        setCommunityFeedback(t('map_location_failed_hint'));
      },
      {
        enableHighAccuracy: true,
        timeout: 9000,
        maximumAge: 120000,
      },
    );
  });

  renderHotspots();
  loadCountryCentroids().then(renderGlobalLabels);
  renderGlobalLabels();
  applyStaticMapTexts();
  updateDistanceLabel();
  applyFilters();

  window.addEventListener('nutri:lang-changed', () => {
    if (usingCurrentLocation) {
      communityInput.value = t('current_location');
      if (centerLabel) {
        showLocationConfirm(t('map_location_using_named', { place: centerLabel }));
      }
    }
    applyStaticMapTexts();
    updateDistanceLabel();
    renderHotspots();
    renderGlobalLabels();
    applyFilters();
  });
})();

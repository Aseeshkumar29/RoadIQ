/**
 * RoadIQ Municipal Command Center Client
 * Leaflet.js GIS, WebSocket Live Stream, Edge AI Telemetry & Triage Engine
 */

document.addEventListener('DOMContentLoaded', () => {
  // Global State
  const state = {
    alerts: [],
    filteredAlerts: [],
    selectedAlert: null,
    activeTab: 'all', // 'all', 'critical', 'dispatched', 'resolved'
    filterSeverity: '',
    filterClass: '',
    filterWard: '',
    searchQuery: '',
    heatmapVisible: false,
    audioEnabled: true,
    wsConnected: false
  };

  // DOM Elements
  const roadMapEl = document.getElementById('roadMap');
  const incidentListEl = document.getElementById('incidentList');
  const clockDisplayEl = document.getElementById('clockDisplay');
  const wsStatusBadgeEl = document.getElementById('wsStatusBadge');
  const audioIconEl = document.getElementById('audioIcon');
  
  // KPI Elements
  const kpiTotalEventsEl = document.getElementById('kpiTotalEvents');
  const kpiPotholeCountEl = document.getElementById('kpiPotholeCount');
  const kpiManholeCountEl = document.getElementById('kpiManholeCount');
  const kpiCriticalCountEl = document.getElementById('kpiCriticalCount');
  const kpiConfirmedCountEl = document.getElementById('kpiConfirmedCount');
  
  // Tab Counter Elements
  const tabCountAllEl = document.getElementById('tabCountAll');
  const tabCountCriticalEl = document.getElementById('tabCountCritical');
  const tabCountDispatchedEl = document.getElementById('tabCountDispatched');
  const tabCountResolvedEl = document.getElementById('tabCountResolved');

  // Filter Elements
  const filterSeverityEl = document.getElementById('filterSeverity');
  const filterClassEl = document.getElementById('filterClass');
  const filterWardEl = document.getElementById('filterWard');
  const triageSearchInputEl = document.getElementById('triageSearchInput');
  const feedTabs = document.querySelectorAll('.feed-tab');

  // Action Buttons
  const btnSimulate = document.getElementById('btnSimulate');
  const btnExportCsv = document.getElementById('btnExportCsv');
  const btnReseed = document.getElementById('btnReseed');
  const btnAudioToggle = document.getElementById('btnAudioToggle');
  const btnToggleHeatmap = document.getElementById('btnToggleHeatmap');
  const btnRecenterMap = document.getElementById('btnRecenterMap');

  // Modal Elements
  const modalBackdrop = document.getElementById('modalBackdrop');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalRoadName = document.getElementById('modalRoadName');
  const modalEventId = document.getElementById('modalEventId');
  const modalTimestamp = document.getElementById('modalTimestamp');
  const modalWard = document.getElementById('modalWard');
  const modalDefectImg = document.getElementById('modalDefectImg');
  const modalHudClass = document.getElementById('modalHudClass');
  const modalHudSpeed = document.getElementById('modalHudSpeed');
  const modalCoords = document.getElementById('modalCoords');
  const btnGoogleMaps = document.getElementById('btnGoogleMaps');
  const btnFocusOnMap = document.getElementById('btnFocusOnMap');
  
  // Modal Telemetry Elements
  const modalSevBubble = document.getElementById('modalSevBubble');
  const modalSevLabel = document.getElementById('modalSevLabel');
  const modalSevCalculation = document.getElementById('modalSevCalculation');
  const modalDepthCm = document.getElementById('modalDepthCm');
  const modalMetricVisual = document.getElementById('modalMetricVisual');
  const modalMetricZrms = document.getElementById('modalMetricZrms');
  const modalMetricPeakFreq = document.getElementById('modalMetricPeakFreq');
  const modalMetricDeflection = document.getElementById('modalMetricDeflection');
  const modalMetricOnsetRate = document.getElementById('modalMetricOnsetRate');
  const modalMetricGyro = document.getElementById('modalMetricGyro');
  const modalCurrentStatusBadge = document.getElementById('modalCurrentStatusBadge');
  const modalStatusSelect = document.getElementById('modalStatusSelect');
  const modalCrewInput = document.getElementById('modalCrewInput');
  const modalNotesInput = document.getElementById('modalNotesInput');
  const modalConfirmationText = document.getElementById('modalConfirmationText');
  const btnSaveWorkOrder = document.getElementById('btnSaveWorkOrder');
  const toastContainer = document.getElementById('toastContainer');

  // Corridor Coordinates (Punjab NH-44 / LPU / Phagwara)
  const CORRIDOR_CENTER = [31.2505, 75.7112];
  const CORRIDOR_ZOOM = 13;

  // Initialize Leaflet Map
  const map = L.map('roadMap', {
    center: CORRIDOR_CENTER,
    zoom: CORRIDOR_ZOOM,
    zoomControl: true
  });

  // Basemap Tile Layers (Zero API Key Required, Clean High-Contrast GIS & Street Map)
  const esriDarkBase = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a> &copy; OpenStreetMap contributors',
    maxZoom: 16
  });

  const esriDarkRef = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
    attribution: '',
    maxZoom: 16
  });

  const darkCanvasGroup = L.layerGroup([esriDarkBase, esriDarkRef]);

  const osmLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  });

  const esriSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>, Earthstar Geographics',
    maxZoom: 18
  });
  const satelliteGroup = L.layerGroup([esriSatellite, esriDarkRef]);

  let currentBasemap = darkCanvasGroup;
  currentBasemap.addTo(map);

  function setBasemap(style) {
    map.removeLayer(currentBasemap);
    if (style === 'osm') {
      currentBasemap = osmLayer;
    } else if (style === 'satellite') {
      currentBasemap = satelliteGroup;
    } else {
      currentBasemap = darkCanvasGroup;
    }
    currentBasemap.addTo(map);
  }

  // Layer Groups
  const markersLayerGroup = L.layerGroup().addTo(map);
  let heatmapLayer = null;

  // Audio Chime Synthesizer via Web Audio API (zero external assets needed)
  let audioCtx = null;
  function playAlertChime(isCritical = false) {
    if (!state.audioEnabled) return;
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (isCritical) {
        // High urgency 2-tone alarm
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1174.66, now + 0.12);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else {
        // Subtle ping
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (e) {
      console.warn("Audio synthesis unavailable:", e);
    }
  }

  // Toast Notification Helper
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'danger') icon = '🚨';
    if (type === 'warning') icon = '⚠️';
    if (type === 'success') icon = '✅';

    toast.innerHTML = `<span>${icon}</span> <div>${message}</div>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Clock Update
  function updateClock() {
    const now = new Date();
    clockDisplayEl.textContent = now.toUTCString().slice(17, 25) + ' UTC';
  }
  setInterval(updateClock, 1000);
  updateClock();

  // Create Custom SVG Leaflet Marker Pin
  function createMarkerIcon(alert) {
    const sev = alert.severity_score;
    const isCritical = sev >= 4;
    const isMultiVehicle = alert.confirmation_count >= 3;

    const html = `
      <div class="custom-leaflet-marker">
        ${isCritical ? '<div class="marker-pulse-ring"></div>' : ''}
        <div class="marker-pin sev-${sev}" title="${alert.anomaly_class} S-${sev}">
          ${isMultiVehicle ? '🛡️' : sev}
        </div>
      </div>
    `;

    return L.divIcon({
      html: html,
      className: 'leaflet-custom-div-icon',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -18]
    });
  }

  // Populate Marker Popup Content
  function createPopupContent(alert) {
    const snap = alert.sensor_snapshot || {};
    return `
      <div class="map-popup-card">
        <div class="map-popup-header">
          <span class="map-popup-title">${alert.anomaly_class}</span>
          <span class="sev-tag sev-${alert.severity_score}">S-${alert.severity_score} ${alert.severity_label}</span>
        </div>
        <div class="map-popup-road">${alert.road_name}</div>
        <div class="map-popup-stats">
          <span>Defl: ${snap.suspension_deflection_d || '--'}mm</span>
          <span>Depth: ~${alert.estimated_depth_cm}cm</span>
          <span>${alert.confirmation_count} Cars</span>
        </div>
        <button class="btn btn-sm btn-primary map-popup-btn" onclick="window.inspectAlertById('${alert.event_id}')">
          Inspect Telemetry & Proof
        </button>
      </div>
    `;
  }

  // Render Map Markers
  function renderMapMarkers() {
    markersLayerGroup.clearLayers();

    const heatPoints = [];

    state.filteredAlerts.forEach(alert => {
      const lat = alert.latitude;
      const lon = alert.longitude;

      // Add to markers layer
      const marker = L.marker([lat, lon], { icon: createMarkerIcon(alert) });
      marker.bindPopup(createPopupContent(alert));
      
      marker.on('click', () => {
        highlightIncidentCard(alert.event_id);
      });

      markersLayerGroup.addLayer(marker);

      // Collect data for heatmap: [lat, lon, intensity]
      // Severity 5 gives 1.0, S-4 gives 0.8, etc.
      heatPoints.push([lat, lon, (alert.severity_score / 5.0) * 1.2]);
    });

    // Update Heatmap if active
    if (heatmapLayer) {
      map.removeLayer(heatmapLayer);
    }
    if (state.heatmapVisible) {
      heatmapLayer = L.heatLayer(heatPoints, {
        radius: 28,
        blur: 18,
        maxZoom: 16,
        gradient: { 0.2: '#10B981', 0.5: '#F59E0B', 0.8: '#F97316', 1.0: '#EF4444' }
      }).addTo(map);
    }
  }

  // Render Incident Feed Cards
  function renderIncidentList() {
    if (state.filteredAlerts.length === 0) {
      incidentListEl.innerHTML = `
        <div class="empty-state">
          <div style="font-size: 32px;">🔍</div>
          <div>No incidents match current filters.</div>
          <button class="btn btn-sm btn-outline" id="btnResetFilters">Clear Filters</button>
        </div>
      `;
      const btnReset = document.getElementById('btnResetFilters');
      if (btnReset) {
        btnReset.addEventListener('click', resetFilters);
      }
      return;
    }

    incidentListEl.innerHTML = '';

    state.filteredAlerts.forEach(alert => {
      const snap = alert.sensor_snapshot || {};
      const card = document.createElement('div');
      card.className = `incident-card ${alert.priority_flag ? 'critical-border' : ''}`;
      card.id = `card-${alert.event_id}`;
      if (state.selectedAlert && state.selectedAlert.event_id === alert.event_id) {
        card.classList.add('active-selected');
      }

      const statusClass = (alert.status || 'New').toLowerCase().replace(' ', '-');

      card.innerHTML = `
        <div class="card-top-row">
          <div class="badge-class">
            <span>${alert.anomaly_class === 'Pothole' ? '🕳️' : (alert.anomaly_class === 'Manhole Cover' ? '⚙️' : '⚠️')}</span>
            <span>${alert.anomaly_class}</span>
          </div>
          <span class="sev-tag sev-${alert.severity_score}">
            S-${alert.severity_score} ${alert.severity_label}
          </span>
        </div>

        <div class="card-road-title" title="${alert.road_name}">
          ${alert.road_name}
        </div>

        <div class="card-meta-line">
          <div class="meta-stats">
            <span>Defl: <strong>${snap.suspension_deflection_d || '--'}mm</strong></span>
            <span>Depth: <strong>~${alert.estimated_depth_cm}cm</strong></span>
          </div>
          ${alert.confirmation_count >= 3 ? `<span class="confirmation-badge">🛡️ ${alert.confirmation_count} Cars</span>` : ''}
        </div>

        <div class="card-footer-row">
          <span class="status-pill ${statusClass}">${alert.status}</span>
          <span style="color: var(--text-sub);">${new Date(alert.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        openInspectionModal(alert);
      });

      incidentListEl.appendChild(card);
    });
  }

  // Highlight Card when Marker is Clicked
  function highlightIncidentCard(eventId) {
    document.querySelectorAll('.incident-card').forEach(c => c.classList.remove('active-selected'));
    const targetCard = document.getElementById(`card-${eventId}`);
    if (targetCard) {
      targetCard.classList.add('active-selected');
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // Update KPI & Tab Counters
  function updateCounters() {
    const total = state.alerts.length;
    const critical = state.alerts.filter(a => a.severity_score >= 4 && a.status !== 'Resolved').length;
    const dispatched = state.alerts.filter(a => a.status === 'Dispatched').length;
    const resolved = state.alerts.filter(a => a.status === 'Resolved').length;
    const confirmed = state.alerts.filter(a => a.confirmation_count >= 3).length;
    const potholes = state.alerts.filter(a => a.anomaly_class === 'Pothole').length;
    const manholes = state.alerts.filter(a => a.anomaly_class === 'Manhole Cover').length;

    kpiTotalEventsEl.textContent = total;
    kpiCriticalCountEl.textContent = critical;
    kpiConfirmedCountEl.textContent = confirmed;
    kpiPotholeCountEl.textContent = `${potholes} Potholes`;
    kpiManholeCountEl.textContent = `${manholes} Manholes`;

    tabCountAllEl.textContent = total;
    tabCountCriticalEl.textContent = critical;
    tabCountDispatchedEl.textContent = dispatched;
    tabCountResolvedEl.textContent = resolved;
  }

  // Filter Pipeline
  function applyFilters() {
    state.filteredAlerts = state.alerts.filter(a => {
      // Tab filter
      if (state.activeTab === 'critical' && a.severity_score < 4) return false;
      if (state.activeTab === 'dispatched' && a.status !== 'Dispatched') return false;
      if (state.activeTab === 'resolved' && a.status !== 'Resolved') return false;

      // Severity dropdown
      if (state.filterSeverity && a.severity_score !== parseInt(state.filterSeverity, 10)) {
        return false;
      }

      // Class dropdown
      if (state.filterClass && a.anomaly_class !== state.filterClass) {
        return false;
      }

      // Ward dropdown
      if (state.filterWard && !a.ward_id.includes(state.filterWard)) {
        return false;
      }

      // Search keyword
      if (state.searchQuery) {
        const query = state.searchQuery.toLowerCase();
        const road = (a.road_name || '').toLowerCase();
        const ward = (a.ward_id || '').toLowerCase();
        const id = (a.event_id || '').toLowerCase();
        const vehicle = (a.vehicle_id || '').toLowerCase();
        if (!road.includes(query) && !ward.includes(query) && !id.includes(query) && !vehicle.includes(query)) {
          return false;
        }
      }

      return true;
    });

    renderMapMarkers();
    renderIncidentList();
  }

  function resetFilters() {
    state.activeTab = 'all';
    state.filterSeverity = '';
    state.filterClass = '';
    state.filterWard = '';
    state.searchQuery = '';
    
    filterSeverityEl.value = '';
    filterClassEl.value = '';
    filterWardEl.value = '';
    triageSearchInputEl.value = '';

    feedTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'all'));
    applyFilters();
  }

  // Open Detailed Modal & Populate Telemetry
  function openInspectionModal(alert) {
    state.selectedAlert = alert;
    const snap = alert.sensor_snapshot || {};
    const d_mm = snap.suspension_deflection_d || 0.0;
    const r_mm_ms = snap.suspension_onset_rate_r || 0.0;
    const raw_s = (0.15 * d_mm + 2.0 * r_mm_ms).toFixed(2);

    modalRoadName.textContent = alert.road_name;
    modalEventId.textContent = alert.event_id;
    modalTimestamp.textContent = new Date(alert.timestamp).toUTCString();
    modalWard.textContent = alert.ward_id;

    // Visual proof image
    if (alert.image_base64) {
      modalDefectImg.src = alert.image_base64;
    }
    modalHudClass.textContent = `${alert.anomaly_class.toUpperCase()} DETECTED`;
    modalHudSpeed.textContent = `SPEED: ${alert.vehicle_speed} km/h`;

    // Coordinates
    modalCoords.textContent = `${alert.latitude.toFixed(4)}° N, ${alert.longitude.toFixed(4)}° E`;
    btnGoogleMaps.href = `https://www.google.com/maps/search/?api=1&query=${alert.latitude},${alert.longitude}`;

    // Severity Box
    modalSevBubble.className = `sev-score-bubble sev-${alert.severity_score}`;
    modalSevBubble.textContent = `S-${alert.severity_score}`;
    modalSevLabel.textContent = `${alert.severity_label} — ${alert.municipal_action}`;
    modalSevCalculation.textContent = `0.15 · ${d_mm}mm + 2.0 · ${r_mm_ms}mm/ms = ${raw_s} → Clip [1..5] = ${alert.severity_score}`;
    modalDepthCm.textContent = `~${alert.estimated_depth_cm} cm`;

    // Multi-modal metrics
    modalMetricVisual.textContent = `${((snap.visual_confidence || 0.94) * 100).toFixed(1)}%`;
    modalMetricZrms.textContent = `${snap.imu_z_rms || '--'} g`;
    modalMetricPeakFreq.textContent = `${snap.peak_frequency || '--'} Hz`;
    modalMetricDeflection.textContent = `${d_mm} mm`;
    modalMetricOnsetRate.textContent = `${r_mm_ms} mm/ms`;
    modalMetricGyro.textContent = `${snap.gyro_x_peak || '--'} °/s`;

    // Triage inputs
    modalCurrentStatusBadge.textContent = `Status: ${alert.status}`;
    modalStatusSelect.value = alert.status;
    modalCrewInput.value = alert.assigned_crew || '';
    modalNotesInput.value = alert.notes || '';

    modalConfirmationText.textContent = alert.confirmation_count >= 3 
      ? `🛡️ Confirmed by ${alert.confirmation_count} independent vehicles (Priority Elevated)`
      : `🛡️ Sighted by ${alert.confirmation_count} vehicle(s)`;

    modalBackdrop.classList.add('open');
  }

  function closeInspectionModal() {
    modalBackdrop.classList.remove('open');
    state.selectedAlert = null;
    document.querySelectorAll('.incident-card').forEach(c => c.classList.remove('active-selected'));
  }

  // Expose global inspector for popup onclick
  window.inspectAlertById = function(eventId) {
    const alert = state.alerts.find(a => a.event_id === eventId);
    if (alert) openInspectionModal(alert);
  };

  // Center on Incident Map
  btnFocusOnMap.addEventListener('click', () => {
    if (state.selectedAlert) {
      map.setView([state.selectedAlert.latitude, state.selectedAlert.longitude], 16, { animate: true });
      closeInspectionModal();
    }
  });

  // Save Work Order Changes
  btnSaveWorkOrder.addEventListener('click', async () => {
    if (!state.selectedAlert) return;
    const eventId = state.selectedAlert.event_id;
    const newStatus = modalStatusSelect.value;
    const newCrew = modalCrewInput.value.trim();
    const newNotes = modalNotesInput.value.trim();

    try {
      btnSaveWorkOrder.disabled = true;
      btnSaveWorkOrder.innerHTML = '<span>Saving...</span>';

      const res = await fetch(`/api/alerts/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          assigned_crew: newCrew,
          notes: newNotes
        })
      });

      if (!res.ok) throw new Error('Failed to update alert');
      const updated = await res.json();

      // Update in local state
      const idx = state.alerts.findIndex(a => a.event_id === eventId);
      if (idx !== -1) {
        state.alerts[idx] = updated;
      }
      applyFilters();
      updateCounters();
      showToast(`Work order for ${updated.road_name} updated to "${newStatus}"`, 'success');
      closeInspectionModal();
    } catch (e) {
      showToast(e.message, 'danger');
    } finally {
      btnSaveWorkOrder.disabled = false;
      btnSaveWorkOrder.innerHTML = '<span>Save & Update Work Order</span>';
    }
  });

  // Modal Backdrop and Close
  modalCloseBtn.addEventListener('click', closeInspectionModal);
  modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeInspectionModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalBackdrop.classList.contains('open')) {
      closeInspectionModal();
    }
  });

  // Fetch Initial Data
  async function loadAlerts() {
    try {
      const res = await fetch('/api/alerts?limit=200');
      if (!res.ok) throw new Error('API fetch failed');
      const data = await res.json();
      state.alerts = data.alerts || [];
      updateCounters();
      applyFilters();
    } catch (e) {
      console.error("Alert load error:", e);
      incidentListEl.innerHTML = `<div class="empty-state">Failed to load alerts from server: ${e.message}</div>`;
    }
  }

  // Setup WebSocket Live Streaming
  function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/live`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      state.wsConnected = true;
      wsStatusBadgeEl.classList.remove('disconnected');
      wsStatusBadgeEl.innerHTML = `<span class="dot"></span> LIVE WS`;
      console.log("WebSocket connected to RoadIQ edge feed.");
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleLiveEvent(msg);
      } catch (err) {
        console.warn("WS Parse error:", err);
      }
    };

    socket.onclose = () => {
      state.wsConnected = false;
      wsStatusBadgeEl.classList.add('disconnected');
      wsStatusBadgeEl.innerHTML = `<span class="dot" style="background:#EF4444;"></span> OFFLINE`;
      console.warn("WebSocket disconnected. Reconnecting in 3s...");
      setTimeout(initWebSocket, 3000);
    };

    socket.onerror = (err) => {
      console.warn("WebSocket error:", err);
    };
  }

  // Handle Live Real-Time Events
  function handleLiveEvent(msg) {
    if (msg.type === 'NEW_ALERT' || msg.type === 'SIMULATED_TRIGGER') {
      const alert = msg.alert;
      const isCritical = alert.severity_score >= 4;

      // Play audio notification
      playAlertChime(isCritical);

      // Show toast
      showToast(
        `<strong>${alert.anomaly_class} (S-${alert.severity_score})</strong> detected on ${alert.road_name}!`,
        isCritical ? 'danger' : 'warning'
      );

      // Check if existing in state (e.g. de-duplicated)
      const existingIdx = state.alerts.findIndex(a => a.event_id === alert.event_id);
      if (existingIdx !== -1) {
        state.alerts[existingIdx] = alert;
      } else {
        state.alerts.unshift(alert);
      }

      updateCounters();
      applyFilters();

      // Trigger card flash
      setTimeout(() => {
        const card = document.getElementById(`card-${alert.event_id}`);
        if (card) {
          card.classList.add('flash-new');
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    } else if (msg.type === 'STATUS_CHANGE') {
      const updated = msg.alert;
      const idx = state.alerts.findIndex(a => a.event_id === updated.event_id);
      if (idx !== -1) {
        state.alerts[idx] = updated;
        updateCounters();
        applyFilters();
      }
    }
  }

  // Event Listeners for Controls
  filterSeverityEl.addEventListener('change', (e) => {
    state.filterSeverity = e.target.value;
    applyFilters();
  });

  filterClassEl.addEventListener('change', (e) => {
    state.filterClass = e.target.value;
    applyFilters();
  });

  filterWardEl.addEventListener('change', (e) => {
    state.filterWard = e.target.value;
    applyFilters();
  });

  triageSearchInputEl.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim();
    applyFilters();
  });

  feedTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      feedTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.activeTab = tab.dataset.tab;
      applyFilters();
    });
  });

  // Simulate Edge Hit Trigger
  btnSimulate.addEventListener('click', async () => {
    try {
      btnSimulate.disabled = true;
      btnSimulate.innerHTML = '<span class="btn-icon">⚡</span><span>Triggering...</span>';

      const res = await fetch('/api/simulator/trigger', { method: 'POST' });
      if (!res.ok) throw new Error('Simulation endpoint failed');
      const data = await res.json();
      console.log("Simulated edge trigger successful:", data);
    } catch (e) {
      showToast(`Simulation error: ${e.message}`, 'danger');
    } finally {
      setTimeout(() => {
        btnSimulate.disabled = false;
        btnSimulate.innerHTML = '<span class="btn-icon">⚡</span><span>Simulate Edge Hit</span>';
      }, 800);
    }
  });

  // Export CSV
  btnExportCsv.addEventListener('click', () => {
    window.location.href = '/api/export/csv';
    showToast('Downloading PWD Municipal Work Order CSV...', 'success');
  });

  // Reseed Data
  btnReseed.addEventListener('click', async () => {
    if (!confirm("Reseed 12 km Punjab corridor with fresh defect dataset?")) return;
    try {
      showToast('Reseeding database with Punjab road corridor data...', 'info');
      const res = await fetch('/api/seed', { method: 'POST' });
      if (!res.ok) throw new Error('Reseed failed');
      await loadAlerts();
      showToast('Corridor successfully reseeded!', 'success');
    } catch (e) {
      showToast(`Reseed error: ${e.message}`, 'danger');
    }
  });

  // Audio Toggle
  btnAudioToggle.addEventListener('click', () => {
    state.audioEnabled = !state.audioEnabled;
    audioIconEl.textContent = state.audioEnabled ? '🔔' : '🔕';
    showToast(state.audioEnabled ? 'Audio alerts enabled' : 'Audio alerts muted', 'info');
  });

  // Heatmap Toggle
  btnToggleHeatmap.addEventListener('click', () => {
    state.heatmapVisible = !state.heatmapVisible;
    btnToggleHeatmap.classList.toggle('active', state.heatmapVisible);
    renderMapMarkers();
    showToast(state.heatmapVisible ? 'Damage density heatmap enabled' : 'Damage density heatmap disabled', 'info');
  });

  // Recenter Map
  btnRecenterMap.addEventListener('click', () => {
    map.setView(CORRIDOR_CENTER, CORRIDOR_ZOOM, { animate: true });
  });

  // Basemap Selector
  const selectBasemap = document.getElementById('selectBasemap');
  if (selectBasemap) {
    selectBasemap.addEventListener('change', (e) => {
      setBasemap(e.target.value);
      showToast(`Switched map basemap to ${selectBasemap.options[selectBasemap.selectedIndex].text}`, 'info');
    });
  }

  // Initial Boot
  loadAlerts();
  initWebSocket();
});

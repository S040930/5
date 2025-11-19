// 应用状态
const state = {
    isLoggedIn: false,
    isTracking: false,
    rideData: { time: 0, distance: 0, speed: 0, calories: 0 },
    rideHistory: { speed: [], distance: [], time: [] },
    maxHistory: 30,
    lastUpdate: Date.now(),
    dataCache: {},
    timer: null,
    maps: { record: null, location: null },
    rideGeolocation: null,
    ridePath: [],
    ridePolyline: null,
    gpsWatcher: null,
    gpsWatcherType: null,
    locationGeolocation: null,
    lastRideCenterTime: 0,
    userLocation: null,
    authToken: null,
    bikeLocked: true,
    batteryLevel: 85,
    apiLoaded: false,
    mapInitAttempts: 0,
    userData: { 
        name: 'Alex Johnson', 
        phone: '13800138000',
        age: '24', 
        gender: 'Male', 
        height: '175cm', 
        weight: '68kg' 
    },
    charts: { ride: null },
    autoPauseEnabled: true,
    autoPauseThreshold: 5,
    autoPauseCounter: 0,
    isAutoPaused: false,
    quickFilter: null,
    sosCountdown: 0,
    sosTimer: null,
    tourIndex: 0,
    facilities: [],
    currentFilter: 'all',
    facilityMarkers: [],
    rideGoal: { target: 120, weeklyDistance: 48.6, sessionDistance: 0, streak: 3 },
    missions: [
        { id: 1, title: 'Pre-Exercise Warm-Up', description: 'Complete 5-10 minutes of dynamic stretching and light cardio before your ride.', reward: 50, done: false, deadline: new Date(Date.now() + 24*3600*1000).toISOString() },
        { id: 2, title: 'Long title mission example - Ride safely and explore a slightly longer title to test wrapping behavior on small screens', description: 'This mission has a longer description to evaluate text wrapping and layout behaviour when displayed on narrow mobile screens. Ensure the line breaks work correctly.', reward: 30, done: false, deadline: new Date(Date.now() + 48*3600*1000).toISOString() }
    ],
    missionXp: 0,
    weatherForecast: null,
    insightIndex: 0,
    syncStatus: 'synced',
    syncLocked: false,
    syncTimer: null,
    lastSyncTime: 0,
    performanceMetrics: {
        avgSpeed: 0,
        maxSpeed: 0,
        totalTime: 0,
        totalDistance: 0
    }
};

const FACILITY_TYPES = {
    restaurant: {
        name: 'Restaurant',
        icon: 'utensils',
        iconClass: 'fas fa-utensils',
        color: '#FF6B6B',
        poiType: '050000',
        keyword: ''
    },
    store: {
        name: 'Store',
        icon: 'shopping-cart',
        iconClass: 'fas fa-shopping-bag',
        color: '#4ECDC4',
        poiType: '060000',
        keyword: ''
    },
    repair: {
        name: 'Repair shop',
        icon: 'wrench',
        iconClass: 'fas fa-tools',
        color: '#45B7D1',
        poiType: '090000',
        keyword: 'E-bike repair,electric bicycle repair'
    },
    charging: {
        name: 'Charging spots',
        icon: 'bolt',
        iconClass: 'fas fa-bolt',
        color: '#96CEB4',
        poiType: '110100',
        keyword: 'Charging station'
    }
};

const TOUR_STORAGE_KEY = 'bikemate-tour-seen';
const TOUR_STEPS = [
    {
        title: 'Welcome to BikeMate',
        body: 'Live ride data and map tracking appear here; use the bottom nav to explore each page.'
    },
    {
        title: 'Smarter nearby facilities',
        body: 'Use quick filters to find the nearest, saved, or open facilities and view routes on the map.'
    },
    {
        title: 'Safety features',
        body: 'During rides you can trigger SOS sharing at the bottom right and rely on auto-pause for accurate data.'
    }
];

const DISTANCE_INCREMENT = 0.3 / 60;

state.weatherForecast = null;

const uiRefs = {};
function resolveApiBase() {
    if (typeof window === 'undefined') return '';
    if (window.API_BASE) return window.API_BASE;
    const custom = (window.__API_BASE_URL__ || '').trim();
    if (custom) return custom.replace(/\/$/, '');
    const { protocol, hostname, port } = window.location;
    // For local development, use a local server (e.g., python -m http.server 8080)
    // For GitHub Pages, window.location.origin will be the https:// URL
    const isLoopback = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname);
    const isLanIp = /^10\./.test(hostname) || /^192\.168\./.test(hostname) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
    if (isLoopback || isLanIp) {
        const targetPort = '8080';
        const finalPort = port && port !== targetPort ? targetPort : port;
        const portSegment = finalPort ? `:${finalPort}` : '';
        return `${protocol}//${hostname}${portSegment}`;
    }
    return window.location.origin;
}

function isStaticHost() {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname || '';
    return host.endsWith('github.io');
}

const API_BASE = resolveApiBase();
window.API_BASE = API_BASE;

function apiFetch(path, options) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return fetch(`${API_BASE}${normalizedPath}`, options);
}

function sanitizeCnPhone(value) {
    if (!value && value !== 0) return '';
    const digits = String(value).replace(/\D/g, '').slice(0, 11);
    return digits;
}

function getUI(id) {
    if (!id) return null;
    const cached = uiRefs[id];
    if (cached && cached.isConnected) {
        return cached;
    }
    const element = document.getElementById(id);
    if (element) {
        uiRefs[id] = element;
    }
    return element;
}

function clampBatteryLevel(value) {
    const numeric = Number(value);
    const safeValue = Number.isFinite(numeric) ? numeric : 0;
    return Math.round(Math.max(0, Math.min(100, safeValue)));
}

function refreshUIRefs() {
    [
        'notification', 'time-value', 'speed-value', 'distance-value', 'calories-value',
        'avg-speed', 'max-speed', 'pace', 'sync-status',
        'time-trend', 'speed-trend', 'distance-trend', 'calories-trend',
        'goal-target-text', 'goal-progress-text', 'goal-progress-km-text', 'goal-complete-text', 
        'goal-remaining-text', 'goal-average-text', 'goal-streak-text', 'goal-slider', 
        'goal-slider-display', 'goal-motivation-text', 'goal-celebration', 'goal-milestones',
        'mission-list', 'mission-xp', 'insight-weather', 'insight-tip', 'insight-air', 
        'insight-time', 'insight-wind', 'insight-recommendation', 'current-time', 
        'badge-live', 'badge-paused', 'badge-autopause', 'sos-button', 'facility-list',
        'perf-fps', 'perf-frame', 'low-motion-toggle', 'perf-panel', 'insight-aqi', 'insight-aqi-meta', 'weather-updated', 'forecast-grid', 'weather-card'
    ].forEach(id => getUI(id));
}

let goalUiFrame = null;
let goalProgressAnim = null;
let fireworksOverlay = null;
let fireworksCanvas = null;
let fireworksCtx = null;
let fireworksRafId = null;
let fireworksEndTimer = null;
let fireworksParticles = [];
let fireworksScale = 1;
let previewRafId = null;
let sliderPreviewValue = null;
let sliderIsActive = false;
let lastGoalSnapshot = null;
let metricsFrame = null;
let facilityFilterTimer = null;
let mapLoadRequested = false;
let apiLoadTimeout = null;

window.state = state;

let notificationTimer = null;
const ambientIntervals = { clock: null, battery: null, location: null };
let isDocumentHidden = typeof document !== 'undefined' ? document.hidden : false;
let facilityFetchController = null;

let perfStats = {
    lastTime: null,
    frameCount: 0,
    fps: 0,
    avgFrameMs: 0,
    frameWindow: [],
    rafId: null,
    enabled: true
};

function scheduleApiTimeoutCheck() {
    if (apiLoadTimeout || !mapLoadRequested) return;
    apiLoadTimeout = setTimeout(() => {
        if (!state.apiLoaded && mapLoadRequested) {
            updateApiStatus('error', 'API load timed out, please click the "Force Load Map" button', 'error');
        }
        apiLoadTimeout = null;
    }, 10000);
}

function isSecureContextCompatible() {
    try {
        // window.isSecureContext is standard; fallback to checking protocol
        return !!(window.isSecureContext || (location && location.protocol === 'https:'));
    } catch (e) {
        return false;
    }
}

async function isGeolocationAvailable() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return false;
    if (!isSecureContextCompatible()) return false;
    try {
        if (navigator.permissions && navigator.permissions.query) {
            const status = await navigator.permissions.query({ name: 'geolocation' });
            return status.state !== 'denied';
        }
    } catch (e) {
        // ignore - not supported or permission query failed
    }
    return true;
}

// 尝试通过 watchPosition 收集多个位置样本，返回精度最好的样本或在超时后返回最佳已有样本 (模块级别)
async function acquirePreciseLocationWithSamples({ timeout = 12000, samples = 4, desiredAccuracy = 50 } = {}) {
    return new Promise((resolve, reject) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            return reject(new Error('Geolocation not supported'));
        }

        const readings = [];
        let watchId = null;
        let finished = false;

        const cleanup = () => {
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
            finished = true;
        };

        const onSuccess = (position) => {
            if (finished) return;
            readings.push(position);

            // 选择当前最优样本（最小 accuracy）
            const best = readings.reduce((a, b) => (a.coords.accuracy || Infinity) < (b.coords.accuracy || Infinity) ? a : b);

            // 如果达到了期望精度或样本量足够，则返回最优样本
            if ((best.coords.accuracy && best.coords.accuracy <= desiredAccuracy) || readings.length >= samples) {
                cleanup();
                return resolve(best);
            }
        };

        const onError = (err) => {
            if (finished) return;
            // 如果已经有样本，则以最佳样本为准，否则返回错误
            if (readings.length) {
                const best = readings.reduce((a, b) => (a.coords.accuracy || Infinity) < (b.coords.accuracy || Infinity) ? a : b);
                cleanup();
                return resolve(best);
            }
            cleanup();
            return reject(err);
        };

        try {
            watchId = navigator.geolocation.watchPosition(onSuccess, onError, { enableHighAccuracy: true, maximumAge: 0, timeout });
        } catch (e) {
            return reject(e);
        }

        // 超时保护：到时间后返回最佳已有样本或错误
        const timer = setTimeout(() => {
            if (finished) return;
            if (readings.length) {
                const best = readings.reduce((a, b) => (a.coords.accuracy || Infinity) < (b.coords.accuracy || Infinity) ? a : b);
                cleanup();
                return resolve(best);
            }
            cleanup();
            return reject(new Error('Timeout obtaining location samples'));
        }, timeout + 2000);
    });
}

function haversineDistanceKm(lat1, lng1, lat2, lng2) {
    const toRad = (deg) => deg * (Math.PI / 180);
    const R = 6371000; // Earth radius in meters
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c) / 1000; // convert to km
}

function handleAutoPauseFromSpeed(speed) {
    if (!state.autoPauseEnabled) return;
    const pauseThreshold = 2.5;
    if (speed < pauseThreshold) {
        state.autoPauseCounter++;
        if (!state.isAutoPaused && state.autoPauseCounter >= state.autoPauseThreshold) {
            state.isAutoPaused = true;
            showNotification('Stop detected; tracking auto-paused', 'info');
            updateTrackingBadges();
        }
    } else {
        state.autoPauseCounter = 0;
        if (state.isAutoPaused) {
            state.isAutoPaused = false;
            showNotification('Ride resumed, tracking continued', 'success');
            updateTrackingBadges();
        }
    }
}

function handleGpsPositionUpdate(lng, lat, accuracy, timestamp = Date.now(), source = 'amap') {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;

    state.userLocation = { lng, lat, accuracy: accuracy ?? null, source };

    if (!state.isTracking) {
        if (state.maps.record && Date.now() - state.lastRideCenterTime > 6000) {
            state.maps.record.setCenter([lng, lat]);
            state.lastRideCenterTime = Date.now();
        }
        return;
    }

    const point = { lng, lat, timestamp };
    state.ridePath.push(point);

    if (state.ridePath.length === 1) {
        state.rideData.speed = 0;
        if (state.ridePolyline) {
            state.ridePolyline.setPath([[lng, lat]]);
        }
        updateRideMetrics();
        return;
    }

    const prev = state.ridePath[state.ridePath.length - 2];
    const segmentKm = haversineDistanceKm(prev.lat, prev.lng, lat, lng);
    const dtSeconds = Math.max((timestamp - prev.timestamp) / 1000, 0);
    const segmentSpeed = dtSeconds > 0 ? (segmentKm / dtSeconds) * 3600 : 0;
    state.rideData.speed = Number(segmentSpeed.toFixed(1));

    handleAutoPauseFromSpeed(state.rideData.speed);

    if (state.isAutoPaused) {
        if (state.ridePolyline) {
            state.ridePolyline.setPath(state.ridePath.map(p => [p.lng, p.lat]));
        }
        updateRideMetrics();
        return;
    }

    if (segmentKm > 0 && Number.isFinite(segmentKm)) {
        state.rideData.distance += segmentKm;
        if (state.rideGoal) {
            state.rideGoal.sessionDistance = Number((state.rideGoal.sessionDistance + segmentKm).toFixed(2));
            updateGoalUI();
        }
    }

    state.rideData.calories = Math.round(state.rideData.distance * 22);

    if (state.ridePolyline) {
        state.ridePolyline.setPath(state.ridePath.map(p => [p.lng, p.lat]));
    }

    if (state.maps.record && timestamp - state.lastRideCenterTime > 8000) {
        state.maps.record.setCenter([lng, lat]);
        state.lastRideCenterTime = timestamp;
    }

    updateRideMetrics();
}

function startRideGpsWatcher() {
    stopRideGpsWatcher();
    if (!state.rideGeolocation && typeof AMap !== 'undefined') {
        AMap.plugin('AMap.Geolocation', () => {
            state.rideGeolocation = new AMap.Geolocation({
                enableHighAccuracy: true,
                timeout: 10000,
                convert: true,
                zoomToAccuracy: true,
                showButton: false,
                extensions: 'all'
            });
            if (state.maps.record) {
                state.maps.record.addControl(state.rideGeolocation);
            }
            startRideGpsWatcher();
        });
        return;
    }
    if (state.rideGeolocation) {
        state.gpsWatcherType = 'interval';
        state.gpsWatcher = setInterval(() => {
            state.rideGeolocation.getCurrentPosition((status, result) => {
                if (status === 'complete' && result.position) {
                    const { lng, lat } = result.position;
                    handleGpsPositionUpdate(lng, lat, result.accuracy || null, Date.now(), 'amap');
                } else if (result) {
                    console.warn('AMap ride geolocation error:', result.message || result);
                }
            });
        }, 2000);
        return;
    }

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
        showNotification('Using browser geolocation fallback', 'warning');
        state.gpsWatcherType = 'browser';
        state.gpsWatcher = navigator.geolocation.watchPosition((position) => {
            const { longitude, latitude, accuracy } = position.coords;
            handleGpsPositionUpdate(longitude, latitude, accuracy, Date.now(), 'browser');
        }, (error) => {
            console.warn('Browser watchPosition error:', error);
        }, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        });
        return;
    }

    showNotification('GPS unavailable on this device', 'error');
}

function stopRideGpsWatcher() {
    if (!state.gpsWatcher) return;
    if (state.gpsWatcherType === 'interval') {
        clearInterval(state.gpsWatcher);
    } else if (state.gpsWatcherType === 'browser' && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(state.gpsWatcher);
    }
    state.gpsWatcher = null;
    state.gpsWatcherType = null;
}

function requestImmediateRideFix() {
    if (state.rideGeolocation) {
        state.rideGeolocation.getCurrentPosition((status, result) => {
            if (status === 'complete' && result.position) {
                handleGpsPositionUpdate(result.position.lng, result.position.lat, result.accuracy || null, Date.now(), 'amap');
            }
        });
        return;
    }

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            const { longitude, latitude, accuracy } = position.coords;
            handleGpsPositionUpdate(longitude, latitude, accuracy, Date.now(), 'browser');
        }, (error) => {
            console.warn('Immediate browser position failed:', error);
        }, {
            enableHighAccuracy: true,
            timeout: 10000
        });
    }
}

function requestMapForPage(targetPage) {
    const initPageMap = () => {
        if (targetPage === 'record' && state.apiLoaded && !state.maps.record) {
            setTimeout(() => initRecordMap(), 100);
        } else if (targetPage === 'location' && state.apiLoaded && !state.maps.location) {
            setTimeout(() => initLocationMap(), 100);
        }
    };

    if (state.apiLoaded) {
        initPageMap();
        return;
    }

    if (typeof loadAmapApi !== 'function') {
        console.warn('Map loader unavailable');
        return;
    }

    // Optimization: Only load map if not already loading
    if (mapLoadRequested) {
        console.log('Map API already loading, waiting...');
        return;
    }

    mapLoadRequested = true;
    updateApiStatus('info', 'Loading map API...', 'info');
    scheduleApiTimeoutCheck();

    // Optimization: Use faster timeout on mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const loadTimeout = isMobile ? 8000 : 12000;
    
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Map load timeout')), loadTimeout);
    });

    Promise.race([loadAmapApi(), timeoutPromise])
        .then(() => {
            state.apiLoaded = true;
            initPageMap();
            updateApiStatus('success', 'Map loaded', 'success');
        })
        .catch((err) => {
            console.error('AMap API failed to load', err);
            updateApiStatus('error', 'Map API failed to load, please retry', 'error');
            mapLoadRequested = false; // Allow retry
        });
}

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function showNotification(message, type = 'success') {
    const notification = getUI('notification');
    if (!notification) return;
    notification.textContent = message;
    notification.classList.remove('success', 'info', 'error', 'warning', 'show');
    notification.classList.add(type);
    requestAnimationFrame(() => notification.classList.add('show'));
    if (notificationTimer) {
        clearTimeout(notificationTimer);
    }
    notificationTimer = setTimeout(() => {
        notification.classList.remove('show');
    }, 3200);
}

function updateLowMotionClass(enabled) {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('low-motion', !!enabled);
}

function toggleLowMotion(enabled) {
    const value = typeof enabled === 'boolean' ? enabled : !document.body.classList.contains('low-motion');
    updateLowMotionClass(value);
    try {
        window.localStorage.setItem('bikemate-low-motion', value ? '1' : '0');
    } catch (e) {}
}

function initLowMotionFromSettings() {
    try {
        const stored = window.localStorage.getItem('bikemate-low-motion');
        if (stored === '1') {
            updateLowMotionClass(true);
            const toggle = document.getElementById('low-motion-toggle');
            if (toggle) toggle.checked = true;
            return;
        }
    } catch (e) {}

    if (window.matchMedia) {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (mq.matches) {
            updateLowMotionClass(true);
            const toggle = document.getElementById('low-motion-toggle');
            if (toggle) toggle.checked = true;
        }
    }
}

function togglePerfPanel(forceVisible) {
    const panel = document.getElementById('perf-panel');
    if (!panel) return;
    const currentlyVisible = panel.classList.contains('visible');
    const next = typeof forceVisible === 'boolean' ? forceVisible : !currentlyVisible;
    panel.classList.toggle('visible', next);
    panel.classList.toggle('hidden', !next);
}

function startPerfMonitor() {
    const fpsEl = document.getElementById('perf-fps');
    const frameEl = document.getElementById('perf-frame');
    if (!fpsEl || !frameEl) return;

    perfStats.lastTime = performance.now();
    perfStats.frameCount = 0;
    perfStats.frameWindow = [];
    perfStats.enabled = true;

    const loop = (now) => {
        if (!perfStats.enabled) return;
        const dt = now - perfStats.lastTime;
        perfStats.lastTime = now;
        perfStats.frameCount += 1;
        if (dt > 0) perfStats.frameWindow.push(dt);
        if (perfStats.frameWindow.length > 60) perfStats.frameWindow.shift();

        const n = perfStats.frameWindow.length;
        if (n > 0) {
            const sum = perfStats.frameWindow.reduce((a, b) => a + b, 0);
            perfStats.avgFrameMs = sum / n;
            perfStats.fps = Math.round(1000 / perfStats.avgFrameMs);
            fpsEl.textContent = `${perfStats.fps}`;
            frameEl.textContent = `${perfStats.avgFrameMs.toFixed(1)} ms`;
        }

        perfStats.rafId = requestAnimationFrame(loop);
    };

    if (perfStats.rafId) cancelAnimationFrame(perfStats.rafId);
    perfStats.rafId = requestAnimationFrame(loop);
}

function updateTrackingBadges() {
    const liveBadge = getUI('badge-live');
    const pausedBadge = getUI('badge-paused');
    const autopauseBadge = getUI('badge-autopause');
    if (liveBadge) {
        liveBadge.classList.toggle('hidden', !state.isTracking || state.isAutoPaused);
    }
    if (pausedBadge) {
        pausedBadge.classList.toggle('hidden', state.isTracking);
    }
    if (autopauseBadge) {
        autopauseBadge.classList.toggle('hidden', !state.isAutoPaused);
    }
}

function updateSOSButton() {
    const sosButton = getUI('sos-button');
    if (!sosButton) return;
    sosButton.classList.toggle('hidden', !state.isLoggedIn || !state.isTracking);
    const badge = sosButton.querySelector('.sos-badge');
    if (badge) {
        badge.textContent = state.sosCountdown ? `${state.sosCountdown}s` : '3s';
    }
}

function getGoalProgressKm() {
    return Number((state.rideGoal.weeklyDistance + state.rideGoal.sessionDistance).toFixed(2));
}

// Enhanced goal UI update with animations and visual feedback
function updateGoalUI() {
    if (!state.rideGoal || isDocumentHidden) return;
    
    const snapshot = {
        target: state.rideGoal.target,
        completed: getGoalProgressKm(),
        streak: state.rideGoal.streak
    };
    
    snapshot.remaining = Math.max(snapshot.target - snapshot.completed, 0);
    snapshot.percent = snapshot.target > 0 ? Math.min(100, Math.round((snapshot.completed / snapshot.target) * 100)) : 0;
    snapshot.dailyAverage = Number((snapshot.completed / 7).toFixed(1));
    
    if (goalUiFrame) {
        cancelAnimationFrame(goalUiFrame);
    }
    
    goalUiFrame = requestAnimationFrame(() => {
        goalUiFrame = null;
        applyGoalSnapshot(snapshot);
        startGoalProgressAnimation(snapshot.percent, snapshot.completed);
        updateGoalMilestones(snapshot.percent);
        updateMotivationalMessage(snapshot.percent, snapshot.remaining);
    });
}

// Helper: smooth value interpolation with easing and optional completion callback
function animateValue(from, to, duration, onUpdate, onComplete, easing = t => 1 - Math.pow(1 - t, 3)) {
    const startTime = performance.now();
    const diff = to - from;
    const step = (now) => {
        const progress = Math.min(1, Math.max(0, (now - startTime) / duration));
        const eased = easing(progress);
        const current = from + diff * eased;
        onUpdate(current, progress);
        if (progress < 1) {
            requestAnimationFrame(step);
        } else if (onComplete) {
            onComplete();
        }
    };
    requestAnimationFrame(step);
}

// Smooth animation for goal progress ring and percentage
function startGoalProgressAnimation(targetPercent, completedKm) {
    const progressCircle = document.getElementById('goal-progress-circle');
    const percentEl = getUI('goal-progress-text');
    const progressKmEl = getUI('goal-progress-km-text');
    if (!progressCircle || !percentEl) return;

    const radius = 70;
    const circumference = 2 * Math.PI * radius;

    const duration = 600; // ms

    const parsedTextPercent = parseFloat(percentEl.textContent);
    const startPercentRaw = goalProgressAnim && typeof goalProgressAnim.currentPercent === 'number'
        ? goalProgressAnim.currentPercent
        : (isNaN(parsedTextPercent) ? 0 : parsedTextPercent);
    const clampedStart = isFinite(startPercentRaw) ? Math.max(0, Math.min(100, startPercentRaw)) : 0;

    const startKm = goalProgressAnim && typeof goalProgressAnim.completedKm === 'number'
        ? goalProgressAnim.completedKm
        : completedKm;

    const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

    goalProgressAnim = { currentPercent: clampedStart, frameId: null, completedKm };

    animateValue(clampedStart, targetPercent, duration, (current) => {
        goalProgressAnim.currentPercent = current;
        const offset = circumference - (current / 100) * circumference;
        progressCircle.style.strokeDashoffset = offset;
        percentEl.textContent = `${Math.round(current)}%`;
    }, null, easeOutCubic);

    animateValue(startKm, completedKm, duration, (val) => {
        if (progressKmEl) {
            progressKmEl.textContent = `${Number(val).toFixed(1)} km`;
        }
    }, null, easeOutCubic);
}

// Apply goal snapshot with enhanced visual feedback
function applyGoalSnapshot(snapshot) {
    const previous = lastGoalSnapshot || snapshot;
    // Update text elements
    const targetEl = getUI('goal-target-text');
    const progressEl = getUI('goal-progress-text');
    const progressKmEl = getUI('goal-progress-km-text');
    const completeEl = getUI('goal-complete-text');
    const remainingEl = getUI('goal-remaining-text');
    const averageEl = getUI('goal-average-text');
    const streakEl = getUI('goal-streak-text');
    const sliderDisplay = getUI('goal-slider-display');
    const slider = getUI('goal-slider');
    
    const animateText = (el, from, to, formatter = (v) => v) => {
        if (!el) return;
        animateValue(from, to, 300, (val) => {
            el.textContent = formatter(val);
        });
    };

    if (targetEl) animateText(targetEl, previous.target, snapshot.target, v => `This week's goal ${Math.round(v)} km`);
    if (progressKmEl) animateText(progressKmEl, previous.completed, snapshot.completed, v => `${v.toFixed(1)} km`);
    if (completeEl) animateText(completeEl, previous.completed, snapshot.completed, v => `${v.toFixed(1)} km`);
    if (remainingEl) animateText(remainingEl, previous.remaining, snapshot.remaining, v => `${v.toFixed(1)} km`);
    if (averageEl) animateText(averageEl, previous.dailyAverage, snapshot.dailyAverage, v => `${v.toFixed(1)} km`);
    if (sliderDisplay) animateText(sliderDisplay, previous.target, snapshot.target, v => `${Math.round(v)} km`);
    
    // Update streak badge
    if (streakEl) {
        const streakNumber = streakEl.querySelector('.streak-number');
        const streakLabel = streakEl.querySelector('.streak-label');
        if (streakNumber) streakNumber.textContent = snapshot.streak;
        if (streakLabel) streakLabel.textContent = snapshot.streak === 1 ? 'day streak' : 'day streak';
    }
    
    // Animate progress ring (SVG circle)
    // Progress ring is driven by startGoalProgressAnimation
    
    // Update slider value
    if (slider) {
        slider.value = snapshot.target;
    }
    
    // Trigger celebration if goal reached
    if (snapshot.percent >= 100 && snapshot.completed > 0) {
        triggerGoalCelebration();
    }

    lastGoalSnapshot = snapshot;
}

// Update milestone achievements
function updateGoalMilestones(percent) {
    const milestones = document.querySelectorAll('.milestone-item');
    milestones.forEach(milestone => {
        const milestoneValue = parseInt(milestone.getAttribute('data-milestone'), 10);
        if (percent >= milestoneValue) {
            milestone.classList.add('achieved');
        } else {
            milestone.classList.remove('achieved');
        }
    });
}

// Update motivational message based on progress
function updateMotivationalMessage(percent, remaining) {
    const motivationEl = getUI('goal-motivation-text');
    if (!motivationEl) return;
    
    let message = '';
    
    if (percent === 0) {
        message = 'Start riding toward your goal! 🚴';
    } else if (percent < 25) {
        message = `Great start! ${remaining} km to go—keep the pace! 💪`;
    } else if (percent < 50) {
        message = `Completed ${percent}%—keep going! You're doing great! ⭐`;
    } else if (percent < 75) {
        message = `Over halfway! Push another ${remaining} km to reach the goal! 🔥`;
    } else if (percent < 100) {
        message = `Awesome! Only ${remaining} km left—victory in sight! 🏆`;
    } else {
        message = `Congrats! You completed this week's goal! Keep up the great work! 🎉`;
    }
    
    motivationEl.textContent = message;
}

// Trigger celebration animation
function triggerGoalCelebration() {
    const celebration = getUI('goal-celebration');
    if (!celebration) return;
    
    // Only trigger once per session
    if (celebration.classList.contains('active')) return;
    
    celebration.classList.add('active');
    startFireworksCelebration();
    
    // Create confetti particles
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'confetti-particle';
        particle.style.cssText = `
            position: absolute;
            width: 8px;
            height: 8px;
            background: ${['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B'][Math.floor(Math.random() * 4)]};
            border-radius: 50%;
            left: ${50 + (Math.random() - 0.5) * 40}%;
            top: ${50 + (Math.random() - 0.5) * 40}%;
            animation: confetti ${0.8 + Math.random() * 0.4}s ease-out forwards;
        `;
        celebration.appendChild(particle);
    }
    
    // Add confetti animation
    if (!document.getElementById('confetti-animation')) {
        const style = document.createElement('style');
        style.id = 'confetti-animation';
        style.textContent = `
            @keyframes confetti {
                0% { transform: translate(0, 0) scale(1); opacity: 1; }
                100% { 
                    transform: translate(${Math.random() * 200 - 100}px, ${Math.random() * 200 - 100}px) scale(0); 
                    opacity: 0; 
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Clean up after animation
    setTimeout(() => {
        celebration.classList.remove('active');
        celebration.innerHTML = '';
    }, 2000);
    
    // Show success notification
    showNotification("🎉 Congrats! You hit this week's ride goal!", 'success');
}

// Full-screen fireworks celebration (performance-friendly)
function startFireworksCelebration(duration = 3600) {
    if (fireworksRafId) return; // Already running
    ensureFireworksOverlay();
    resizeFireworksCanvas();
    fireworksOverlay.classList.add('active');
    const start = performance.now();
    let lastSpawn = start;
    let lastFrame = start;

    const loop = (now) => {
        const elapsed = now - start;
        const delta = (now - lastFrame) / 1000;
        lastFrame = now;

        // Spawn bursts periodically (throttled)
        if (now - lastSpawn > 280 && fireworksParticles.length < 200) {
            spawnFireworkBurst();
            lastSpawn = now;
        }

        stepFireworks(delta);
        renderFireworks();

        if (elapsed < duration) {
            fireworksRafId = requestAnimationFrame(loop);
        } else {
            stopFireworksCelebration();
        }
    };

    fireworksRafId = requestAnimationFrame(loop);
    if (fireworksEndTimer) clearTimeout(fireworksEndTimer);
    fireworksEndTimer = setTimeout(stopFireworksCelebration, duration + 200);
}

function ensureFireworksOverlay() {
    if (fireworksOverlay) return fireworksOverlay;
    fireworksOverlay = document.createElement('div');
    fireworksOverlay.id = 'fireworks-overlay';
    fireworksOverlay.className = 'fireworks-overlay';
    fireworksCanvas = document.createElement('canvas');
    fireworksOverlay.appendChild(fireworksCanvas);
    document.body.appendChild(fireworksOverlay);
    fireworksCtx = fireworksCanvas.getContext('2d');
    window.addEventListener('resize', resizeFireworksCanvas);
    return fireworksOverlay;
}

function resizeFireworksCanvas() {
    if (!fireworksCanvas || !fireworksCtx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    fireworksScale = dpr;
    fireworksCanvas.width = window.innerWidth * dpr;
    fireworksCanvas.height = window.innerHeight * dpr;
    fireworksCanvas.style.width = '100%';
    fireworksCanvas.style.height = '100%';
    fireworksCtx.setTransform(1, 0, 0, 1, 0, 0);
    fireworksCtx.scale(dpr, dpr);
}

function spawnFireworkBurst() {
    const colors = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#F472B6'];
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * window.innerHeight * 0.55; // avoid bottom-only bursts
    const count = 26 + Math.floor(Math.random() * 18);
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const speed = 90 + Math.random() * 120;
        fireworksParticles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0,
            ttl: 1.2 + Math.random() * 0.4,
            color: colors[Math.floor(Math.random() * colors.length)]
        });
    }
}

function stepFireworks(delta) {
    if (!delta || !fireworksParticles.length) return;
    const gravity = 90;
    fireworksParticles = fireworksParticles.filter(p => {
        p.life += delta;
        if (p.life > p.ttl) return false;
        p.x += p.vx * delta;
        p.y += p.vy * delta;
        p.vy += gravity * delta;
        p.vx *= 0.99;
        p.vy *= 0.99;
        return true;
    });
}

function renderFireworks() {
    if (!fireworksCtx || !fireworksCanvas) return;
    fireworksCtx.setTransform(1, 0, 0, 1, 0, 0);
    fireworksCtx.clearRect(0, 0, fireworksCanvas.width, fireworksCanvas.height);
    fireworksCtx.setTransform(fireworksScale, 0, 0, fireworksScale, 0, 0);
    fireworksCtx.globalCompositeOperation = 'lighter';
    for (const p of fireworksParticles) {
        const alpha = 1 - p.life / p.ttl;
        fireworksCtx.fillStyle = hexToRgba(p.color, alpha);
        fireworksCtx.beginPath();
        fireworksCtx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
        fireworksCtx.fill();
    }
    fireworksCtx.globalCompositeOperation = 'source-over';
}

function stopFireworksCelebration() {
    if (fireworksRafId) {
        cancelAnimationFrame(fireworksRafId);
        fireworksRafId = null;
    }
    if (fireworksEndTimer) {
        clearTimeout(fireworksEndTimer);
        fireworksEndTimer = null;
    }
    fireworksParticles = [];
    if (fireworksCtx && fireworksCanvas) {
        fireworksCtx.setTransform(1, 0, 0, 1, 0, 0);
        fireworksCtx.clearRect(0, 0, fireworksCanvas.width, fireworksCanvas.height);
    }
    if (fireworksOverlay) {
        fireworksOverlay.classList.remove('active');
    }
}

function hexToRgba(hex, alpha = 1) {
    const trimmed = hex.replace('#', '');
    const num = parseInt(trimmed, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function finalizeGoalSession() {
    if (!state.rideGoal) return;
    if (state.rideGoal.sessionDistance > 0) {
        state.rideGoal.weeklyDistance = Number((state.rideGoal.weeklyDistance + state.rideGoal.sessionDistance).toFixed(2));
        state.rideGoal.sessionDistance = 0;
    }
    updateGoalUI();
}

function previewGoalTarget(value) {
    if (!state.rideGoal) return;

    sliderIsActive = true;
    sliderPreviewValue = Number(value);

    if (previewRafId) {
        cancelAnimationFrame(previewRafId);
    }

    // Smooth continuous goal preview (lightweight UI update)
    previewRafId = requestAnimationFrame(() => {
        previewRafId = null;
        updateSliderDisplayOnly(sliderPreviewValue);
    });
}

// Lightweight preview label update (no full UI recompute)
function updateSliderDisplayOnly(value) {
    const sliderDisplay = getUI('goal-slider-display');
    if (!sliderDisplay) return;
    sliderDisplay.textContent = `${Math.round(value)} km`;
}

function commitGoalTarget(value) {
    sliderIsActive = false;
    const targetValue = Number(value);
    commitSliderPreview(targetValue);
}

// 提交滑块预览值（实际更新state和完整UI）
function commitSliderPreview(value) {
    if (!state.rideGoal) return;

    const targetValue = Number(value);
    const oldValue = state.rideGoal.target;

    // 如果值没有变化，跳过
    if (oldValue === targetValue) return;

    state.rideGoal.target = targetValue;

    if (goalUiFrame) {
        cancelAnimationFrame(goalUiFrame);
    }

    // Full UI refresh only on commit for smoothness
    goalUiFrame = requestAnimationFrame(() => {
        goalUiFrame = null;
        updateGoalUI();
        showNotification(`✅ Weekly goal set to ${targetValue} km`, 'success');
        if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(50);
        }
        triggerSliderCommitAnimation();
    });
}

// 滑块提交动画反馈
function triggerSliderCommitAnimation() {
    const sliderDisplay = getUI('goal-slider-display');
    if (!sliderDisplay) return;
    
    // 使用CSS动画代替JS动画
    sliderDisplay.classList.add('slider-commit-pulse');
    
    // 移除动画类
    setTimeout(() => {
        sliderDisplay.classList.remove('slider-commit-pulse');
    }, 300);
}

function renderMissions() {
    const list = getUI('mission-list');
    if (!list) return;
    state.missionXp = state.missions.filter(m => m.done).reduce((sum, mission) => sum + mission.reward, 0);
    const xpEl = getUI('mission-xp');
    if (xpEl) {
        xpEl.textContent = `${state.missionXp} XP`;
    }
    if (!state.missions || state.missions.length === 0) {
        list.innerHTML = '<div class="mission-item" style="opacity:0.8; text-align:center;">No missions for today</div>';
    } else {
        list.innerHTML = state.missions.map(mission => `
        <div class="mission-item ${mission.done ? 'completed' : ''}">
            <div class="mission-info">
                <div class="mission-title">${mission.title}</div>
                <div class="mission-desc">${mission.description}</div>
                <div class="mission-meta">Reward ${mission.reward} XP${mission.deadline ? ` · Due ${new Date(mission.deadline).toLocaleDateString()}` : ''}</div>
            </div>
            <button class="mission-btn ${mission.done ? 'completed' : ''}" onclick="toggleMissionCompletion(${mission.id})">
                ${mission.done ? 'Undo' : 'Mark complete'}
            </button>
        </div>
        `).join('');
    }
}

// Attempt to load missions from API (if provided), fallback to local `state.missions` when unavailable
async function loadMissionsFromApi() {
    try {
        const res = await apiFetch('/api/missions');
        if (!res.ok) {
            // No server-side missions API; fallback is fine
            console.log('Missions API not available, using local missions (status:', res.status, ')');
            // If we have cached missions in localStorage use them
            try {
                const cached = localStorage.getItem('bikemate-missions');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed)) {
                        state.missions = parsed;
                        return state.missions;
                    }
                }
            } catch (e) {
                // ignore parse errors
            }
            return state.missions;
        }
        const data = await res.json();
        if (!Array.isArray(data)) {
            console.warn('Missions API returned unexpected data, expected array:', data);
            return state.missions;
        }
        // Normalize items: ensure id/title/description/reward/done fields exist
        const normalized = data.map((m, idx) => ({
            id: m.id || (1000 + idx),
            title: m.title || m.name || 'Untitled mission',
            description: m.description || m.desc || '',
            reward: m.reward || m.xp || 0,
            done: !!m.done,
            deadline: m.deadline || null
        }));
        state.missions = normalized;
        try {
            localStorage.setItem('bikemate-missions', JSON.stringify(state.missions));
        } catch (e) {
            // ignore
        }
        console.log('Loaded missions from API:', state.missions.length);
        return state.missions;
    } catch (e) {
        console.warn('Failed to load missions from API, using local state.missions', e);
        // try to use cached missions
        try {
            const cached = localStorage.getItem('bikemate-missions');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed)) {
                    state.missions = parsed;
                }
            }
        } catch (err) {
            // ignore
        }
        return state.missions;
    }
}

function toggleMissionCompletion(id) {
    state.missions = state.missions.map(mission => mission.id === id ? { ...mission, done: !mission.done } : mission);
    renderMissions();
    const mission = state.missions.find(m => m.id === id);
    if (mission) {
        showNotification(mission.done ? `${mission.title} completed, earned ${mission.reward} XP` : `${mission.title} has been reset`, mission.done ? 'success' : 'info');
    }
    try { localStorage.setItem('bikemate-missions', JSON.stringify(state.missions)); } catch (e) { console.warn('Failed to persist missions to localStorage', e); }
}

function setWeatherPlaceholder(message = 'This function is still under development') {
    const placeholder = message || 'This function is still under development';
    ['insight-weather', 'insight-tip', 'insight-air', 'insight-air-meta', 'insight-time', 'insight-wind', 'insight-recommendation', 'insight-aqi', 'insight-aqi-meta', 'weather-updated']
        .forEach(id => {
            const el = getUI(id);
            if (el) el.textContent = placeholder;
        });
    const forecastGrid = getUI('forecast-grid');
    if (forecastGrid) {
        forecastGrid.innerHTML = `<div class="forecast-item"><div class="forecast-day">${placeholder}</div></div>`;
    }
}

function setWeatherLoading(isLoading) {
    const card = getUI('weather-card');
    if (card) card.classList.toggle('loading', !!isLoading);
    if (isLoading) {
        setWeatherPlaceholder('Loading...');
    }
}

// Lightweight translation for common Chinese weather terms to English
function translateWeatherText(text = '') {
    const map = {
        '晴': 'Sunny',
        '多云': 'Cloudy',
        '阴': 'Overcast',
        '小雨': 'Light rain',
        '中雨': 'Moderate rain',
        '大雨': 'Heavy rain',
        '阵雨': 'Shower',
        '雷阵雨': 'Thunder shower',
        '小雪': 'Light snow',
        '中雪': 'Moderate snow',
        '大雪': 'Heavy snow',
        '雨夹雪': 'Sleet',
        '雾': 'Fog',
        '霾': 'Haze',
        '沙尘暴': 'Sandstorm'
    };
    return map[text] || text;
}

function translateCityName(text = '') {
    if (!text || text === '--') return text;

    // Clean up common suffixes
    const cleaned = text.replace(/(市|区|县|省|自治区|特别行政区|新区|开发区)$/u, '');

    // Comprehensive city mapping
    const map = {
        // Major municipalities
        '北京': 'Beijing',
        '上海': 'Shanghai',
        '天津': 'Tianjin',
        '重庆': 'Chongqing',

        // Guangdong Province
        '广州': 'Guangzhou',
        '深圳': 'Shenzhen',
        '珠海': 'Zhuhai',
        '汕头': 'Shantou',
        '佛山': 'Foshan',
        '韶关': 'Shaoguan',
        '湛江': 'Zhanjiang',
        '肇庆': 'Zhaoqing',
        '江门': 'Jiangmen',
        '茂名': 'Maoming',
        '惠州': 'Huizhou',
        '梅州': 'Meizhou',
        '汕尾': 'Shanwei',
        '河源': 'Heyuan',
        '阳江': 'Yangjiang',
        '清远': 'Qingyuan',
        '东莞': 'Dongguan',
        '中山': 'Zhongshan',
        '潮州': 'Chaozhou',
        '揭阳': 'Jieyang',
        '云浮': 'Yunfu',

        // Jiangsu Province
        '南京': 'Nanjing',
        '苏州': 'Suzhou',
        '无锡': 'Wuxi',
        '徐州': 'Xuzhou',
        '常州': 'Changzhou',
        '南通': 'Nantong',
        '连云港': 'Lianyungang',
        '淮安': 'Huai\'an',
        '盐城': 'Yancheng',
        '扬州': 'Yangzhou',
        '镇江': 'Zhenjiang',
        '泰州': 'Taizhou',
        '宿迁': 'Suqian',
        '太仓': 'Taicang',

        // Zhejiang Province
        '杭州': 'Hangzhou',
        '宁波': 'Ningbo',
        '温州': 'Wenzhou',
        '嘉兴': 'Jiaxing',
        '湖州': 'Huzhou',
        '绍兴': 'Shaoxing',
        '金华': 'Jinhua',
        '衢州': 'Quzhou',
        '舟山': 'Zhoushan',
        '台州': 'Taizhou',
        '丽水': 'Lishui',

        // Shandong Province
        '济南': 'Jinan',
        '青岛': 'Qingdao',
        '淄博': 'Zibo',
        '枣庄': 'Zaozhuang',
        '东营': 'Dongying',
        '烟台': 'Yantai',
        '潍坊': 'Weifang',
        '济宁': 'Jining',
        '泰安': 'Tai\'an',
        '威海': 'Weihai',
        '日照': 'Rizhao',
        '莱芜': 'Laiwu',
        '临沂': 'Linyi',
        '德州': 'Dezhou',
        '聊城': 'Liaocheng',
        '滨州': 'Binzhou',
        '菏泽': 'Heze',

        // Other major cities
        '成都': 'Chengdu',
        '武汉': 'Wuhan',
        '西安': 'Xi\'an',
        '郑州': 'Zhengzhou',
        '长沙': 'Changsha',
        '合肥': 'Hefei',
        '昆明': 'Kunming',
        '贵阳': 'Guiyang',
        '南宁': 'Nanning',
        '福州': 'Fuzhou',
        '厦门': 'Xiamen',
        '石家庄': 'Shijiazhuang',
        '太原': 'Taiyuan',
        '兰州': 'Lanzhou',
        '西宁': 'Xining',
        '乌鲁木齐': 'Urumqi',
        '拉萨': 'Lhasa',
        '海口': 'Haikou',
        '沈阳': 'Shenyang',
        '大连': 'Dalian',
        '长春': 'Changchun',
        '哈尔滨': 'Harbin',
        '南昌': 'Nanchang',

        // Special Administrative Regions
        '香港': 'Hong Kong',
        '澳门': 'Macau',
        '台北': 'Taipei',

        // Provinces (for provincial-level data)
        '广东': 'Guangdong',
        '广西': 'Guangxi',
        '江苏': 'Jiangsu',
        '浙江': 'Zhejiang',
        '福建': 'Fujian',
        '山东': 'Shandong',
        '河北': 'Hebei',
        '河南': 'Henan',
        '湖北': 'Hubei',
        '湖南': 'Hunan',
        '江西': 'Jiangxi',
        '安徽': 'Anhui',
        '山西': 'Shanxi',
        '陕西': 'Shaanxi',
        '辽宁': 'Liaoning',
        '吉林': 'Jilin',
        '黑龙江': 'Heilongjiang',
        '甘肃': 'Gansu',
        '青海': 'Qinghai',
        '四川': 'Sichuan',
        '贵州': 'Guizhou',
        '云南': 'Yunnan',
        '内蒙古': 'Inner Mongolia',
        '宁夏': 'Ningxia',
        '新疆': 'Xinjiang',
        '西藏': 'Tibet',
        '海南': 'Hainan'
    };

    // Return English name if found, otherwise return original text
    return map[cleaned] || text;
}

function translateWindDirection(text = '') {
    const map = {
        '东': 'E',
        '南': 'S',
        '西': 'W',
        '北': 'N',
        '东北': 'NE',
        '东南': 'SE',
        '西北': 'NW',
        '西南': 'SW'
    };
    return map[text] || text;
}

function formatWindText(direction = '', power = '') {
    const dir = translateWindDirection(direction);
    const powerText = power ? ` Level ${power}` : '';
    return dir ? `${dir} Wind${powerText}`.trim() : (powerText.trim() || '--');
}

function updateWeatherUI(weatherData) {
    // 只更新四宫格天气信息
    if (!weatherData) {
        setWeatherPlaceholder();
        return;
    }
    // 兼容 live 和 forecast 数据，优先用 forecast
    let city = '--', desc = '--', temp = '--', wind = '--';
    if (weatherData.casts && weatherData.casts.length) {
        city = translateCityName(weatherData.city || '--');
        const firstCast = weatherData.casts[0];
        desc = `${translateWeatherText(firstCast.dayweather || '--')} / ${translateWeatherText(firstCast.nightweather || '--')}`;
        temp = (firstCast.daytemp || '--') + '℃ ~ ' + (firstCast.nighttemp || '--') + '℃';
        wind = formatWindText(firstCast.daywind, firstCast.daypower);
    } else if (weatherData.live) {
        city = translateCityName(weatherData.city || '--');
        desc = translateWeatherText(weatherData.live.weather || '--');
        temp = weatherData.live.temperature ? weatherData.live.temperature + '℃' : '--';
        wind = formatWindText(weatherData.live.winddirection, weatherData.live.windpower);
    }
    const cityEl = document.getElementById('weather-city');
    const descEl = document.getElementById('weather-desc');
    const tempEl = document.getElementById('weather-temp');
    const windEl = document.getElementById('weather-wind');
    if (cityEl) cityEl.textContent = city;
    if (descEl) descEl.textContent = desc;
    if (tempEl) tempEl.textContent = temp;
    if (windEl) windEl.textContent = wind.trim() || '--';
    // 未来天气预报和更新时间等原有逻辑保留
    const updatedEl = getUI('weather-updated');
    if (updatedEl) {
        const now = new Date();
        updatedEl.textContent = `Updated at ${now.toLocaleTimeString('en-US', { hour12: false })}`;
    }
    // forecast-grid 及7天预报已移除
}

function getAmapKey() {
    return window.__AMAP_KEY__ || 'ca544fecfb222fa00fb4219fbbebae1f';
}

function getWeatherIcon(desc = '') {
    const text = (desc || '').toLowerCase();
    if (text.includes('Thunder')) return '⛈️';
    if (text.includes('Rain')) return '🌧️';
    if (text.includes('Snow')) return '❄️';
    if (text.includes('Cloudy')) return '☁️';
    if (text.includes('Overcast')) return '☁️';
    if (text.includes('Fog') || text.includes('Haze')) return '🌫️';
    if (text.includes('Sunny')) return '☀️';
    return '🌤️';
}

async function fetchWeatherForecastFromAmap() {
    const key = getAmapKey();
    if (!key) {
        updateWeatherUI(null);
        return;
    }

    let locationParam = '';
    if (state.userLocation) {
        locationParam = `${state.userLocation.lng},${state.userLocation.lat}`;
    } else if (state.maps.location && state.maps.location.getCenter) {
        const center = state.maps.location.getCenter();
        if (center?.lng && center?.lat) {
            locationParam = `${center.lng},${center.lat}`;
        }
    }

    let cityCode = '';

    try {
        if (locationParam) {
            const regeoUrl = `https://restapi.amap.com/v3/geocode/regeo?location=${locationParam}&key=${key}`;
            const regeoRes = await fetch(regeoUrl);
            const regeoData = await regeoRes.json();
            cityCode = regeoData?.regeocode?.addressComponent?.adcode || '';
        }
    } catch (err) {
        console.warn('Geocoding failed, using IP location instead', err);
    }

    const queryCity = cityCode || 'auto';
    try {
        const [liveRes, forecastRes] = await Promise.all([
            fetch(`https://restapi.amap.com/v3/weather/weatherInfo?key=${key}&extensions=base&city=${encodeURIComponent(queryCity)}`),
            fetch(`https://restapi.amap.com/v3/weather/weatherInfo?key=${key}&extensions=all&city=${encodeURIComponent(queryCity)}`)
        ]);

        const liveData = await liveRes.json().catch(() => null);
        const forecastData = await forecastRes.json().catch(() => null);

        const live = liveData?.status === '1' ? liveData?.lives?.[0] : null;
        const forecast = forecastData?.status === '1' ? forecastData?.forecasts?.[0] : null;

        if (!live && !forecast) {
            updateWeatherUI(null);
            return;
        }

        const normalized = {
            city: forecast?.city || live?.city || '',
            province: forecast?.province || live?.province || '',
            reportTime: live?.reporttime || forecast?.reporttime || '',
            casts: forecast?.casts || [],
            live,
            aqi: live?.aqi ? { aqi: live.aqi, category: 'Live' } : null
        };
        state.weatherForecast = normalized;
        updateWeatherUI(normalized);
    } catch (err) {
        console.error('Weather fetch failed', err);
        updateWeatherUI(null);
    }
}

async function refreshWeatherForecast() {
    setWeatherLoading(true);
    await fetchWeatherForecastFromAmap();
    setWeatherLoading(false);
}

function updateApiStatus(status, message, type = '') {
    const statusEl = document.getElementById('api-status');
    if (!statusEl) return;
    statusEl.className = `api-status ${type}`.trim();
    statusEl.innerHTML = `<i class="fas fa-${status === 'success' ? 'check-circle' : status === 'error' ? 'exclamation-triangle' : 'spinner fa-spin'}"></i> ${message}`;
}

function updateBikeLockButton() {
    const badge = document.getElementById('bike-lock-status');
    const render = document.querySelector('.bike-render');
    if (!badge) return;
    badge.classList.toggle('unlocked', !state.bikeLocked);
    badge.innerHTML = state.bikeLocked ? '<i class="fas fa-lock"></i><span>Locked</span>' : '<i class="fas fa-lock-open"></i><span>Unlocked</span>' ;
    if (render) {
        render.classList.toggle('unlocked', !state.bikeLocked);
    }
}

function toggleBikeLock() {
    state.bikeLocked = !state.bikeLocked;
    updateBikeLockButton();
    showNotification(state.bikeLocked ? 'Bike locked' : 'Bike unlocked', state.bikeLocked ? 'info' : 'success');
}

function toggleDebugInfo() {
    const debugInfo = document.getElementById('map-debug-info');
    if (debugInfo) {
        debugInfo.style.display = debugInfo.style.display === 'none' ? 'block' : 'none';
    }
}

function updateDebugInfo() {
    const statusEl = document.getElementById('debug-status');
    const apiEl = document.getElementById('debug-api');
    const mapStatusEl = document.getElementById('map-status');
    if (statusEl) {
        statusEl.textContent = state.apiLoaded ? 'Status: API loaded' : 'Status: waiting for API';
    }
    if (apiEl) {
        apiEl.textContent = `API: ${state.apiLoaded ? 'Load complete' : 'Loading...'}`;
    }
    if (mapStatusEl) {
        mapStatusEl.textContent = state.maps.record ? 'Map status: initialized' : 'Map status: waiting to initialize';
    }
}

window.performanceMonitor = {
    metrics: {},
    start(label) {
        this.metrics[label] = { start: performance.now(), end: null };
    },
    end(label) {
        const metric = this.metrics[label];
        if (metric && metric.start) {
            metric.end = performance.now();
        }
    },
    get(label) {
        const metric = this.metrics[label];
        return metric && metric.end ? metric.end - metric.start : null;
    },
    report() {
        const summary = Object.entries(this.metrics).reduce((acc, [label, metric]) => {
            if (metric && metric.start && metric.end) {
                acc[label] = `${(metric.end - metric.start).toFixed(2)}ms`;
            }
            return acc;
        }, {});
        if (Object.keys(summary).length === 0) {
            return;
        }
        console.table(summary);
    }
};

function forceLoadMap() {
    if (state.maps.record) {
        state.maps.record.destroy();
        state.maps.record = null;
    }
    state.ridePolyline = null;
    state.rideGeolocation = null;
    updateApiStatus('info', 'Reloading map...', 'info');
    requestMapForPage('record');
}

function navigateTo(pageId) {
    if (!state.isLoggedIn && pageId !== 'login-page') {
        showNotification('Please log in to access this page', 'warning');
        pageId = 'login-page';
    }
    document.querySelectorAll('.page').forEach(page => {
        page.classList.toggle('active', page.id === pageId);
    });
    document.querySelectorAll('.nav-item').forEach(item => {
        const match = item.getAttribute('onclick');
        if (!match) return;
        const target = match.match(/'([^']+)'/);
        if (!target) return;
        item.classList.toggle('active', target[1] === pageId);
    });
    if (pageId === 'record-page') {
        requestMapForPage('record');
        initChart();
    } else if (pageId === 'location-page') {
        requestMapForPage('location');
    }
}

function updateCurrentTime() {
    const timeEl = getUI('current-time');
    if (!timeEl) return;
    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString('zh-CN', { hour12: false });
}

function startAmbientUpdates() {
    stopAmbientUpdates();
    updateCurrentTime();
    updateBattery();
    updateLocationTime();
    ambientIntervals.clock = setInterval(updateCurrentTime, 1000);
    ambientIntervals.battery = setInterval(() => {
        state.batteryLevel = clampBatteryLevel(state.batteryLevel + (Math.random() - 0.5));
        updateBattery();
    }, 15000);
    ambientIntervals.location = setInterval(updateLocationTime, 20000);
}

function stopAmbientUpdates() {
    Object.keys(ambientIntervals).forEach(key => {
        if (ambientIntervals[key]) {
            clearInterval(ambientIntervals[key]);
            ambientIntervals[key] = null;
        }
    });
}

function handleVisibilityChange() {
    isDocumentHidden = document.hidden;
    if (isDocumentHidden) {
        stopAmbientUpdates();
        if (goalUiFrame) {
            cancelAnimationFrame(goalUiFrame);
            goalUiFrame = null;
        }
        if (metricsFrame) {
            cancelAnimationFrame(metricsFrame);
            metricsFrame = null;
        }
    } else {
        startAmbientUpdates();
        updateGoalUI();
        updateRideMetrics();
    }
}

function handleLogin(event) {
    console.log('handleLogin called', event);
    
    if (event) {
        event.preventDefault();
    }
    
    const accountInput = document.getElementById('account');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('login-btn');
    const accountError = document.getElementById('account-error');
    const passwordError = document.getElementById('password-error');
    const loadingOverlay = document.getElementById('login-loading-overlay');
    const progressBar = document.getElementById('login-progress-bar');
    const bikeRolling = document.getElementById('bike-rolling');
    const bikeLoadingText = document.getElementById('bike-loading-text');
    const fallbackSpinner = document.getElementById('fallback-spinner');
    const loadingTitle = document.getElementById('loading-title');
    const loadingSubtitle = document.getElementById('loading-subtitle');
    const stageProgramEl = document.getElementById('stage-program');
    const stageMapEl = document.getElementById('stage-map');
    
    console.log('Form elements found:', {
        accountInput: !!accountInput,
        passwordInput: !!passwordInput,
        loginBtn: !!loginBtn,
        loadingOverlay: !!loadingOverlay
    });
    
    if (!accountInput || !passwordInput || !loginBtn) {
        console.error('Missing required form elements');
        return;
    }
    
    // Reset error messages
    if (accountError) accountError.style.display = 'none';
    if (passwordError) passwordError.style.display = 'none';
    accountInput.classList.remove('error');
    passwordInput.classList.remove('error');
    
    const account = accountInput.value.trim();
    const password = passwordInput.value.trim();
    
    console.log('Login credentials:', { account, passwordLength: password.length });
    
    // Form validation
    let hasError = false;
    
    // Account validation (Email or Phone Number)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // Phone regex: supports formats like +1234567890, 1234567890, 123-456-7890, (123) 456-7890, etc.
    const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
    // Simplified Chinese mobile number: 11 digits starting with 1
    const cnPhoneRegex = /^1[3-9]\d{9}$/;
    
    const isEmail = emailRegex.test(account);
    const isPhone = phoneRegex.test(account.replace(/[\s\-\.\(\)]/g, '')) || cnPhoneRegex.test(account);
    
    if (!account) {
        if (accountError) {
            accountError.querySelector('span').textContent = 'Email or phone number is required';
            accountError.style.display = 'flex';
        }
        accountInput.classList.add('error');
        hasError = true;
    } else if (!isEmail && !isPhone) {
        if (accountError) {
            accountError.querySelector('span').textContent = 'Please enter a valid email or phone number';
            accountError.style.display = 'flex';
        }
        accountInput.classList.add('error');
        hasError = true;
    }
    
    // Password validation
    if (!password) {
        if (passwordError) {
            passwordError.querySelector('span').textContent = 'Password is required';
            passwordError.style.display = 'flex';
        }
        passwordInput.classList.add('error');
        hasError = true;
    } else if (password.length < 6) {
        if (passwordError) {
            passwordError.querySelector('span').textContent = 'Password must be at least 6 characters';
            passwordError.style.display = 'flex';
        }
        passwordInput.classList.add('error');
        hasError = true;
    }
    
    if (hasError) {
        // Shake animation for errors
        const loginCard = document.querySelector('.login-card');
        if (loginCard) {
            loginCard.classList.add('shake');
            setTimeout(() => loginCard.classList.remove('shake'), 500);
        }
        return;
    }
    
    // Disable button and show loading state
    loginBtn.disabled = true;
    loginBtn.classList.add('loading');
    
    // Show immersive loading overlay
    if (loadingOverlay) {
        loadingOverlay.classList.add('active');
    }
    
    // Record start time for dynamic animation calculation
    const loadingStartTime = Date.now();
    const FALLBACK_THRESHOLD = 8000; // 8 seconds
    const MIN_ANIMATION_DURATION = 1500; // Minimum 1.5 seconds for visual effect
    
    let fallbackTimeout = null;
    let isLoadingComplete = false;
    let hasFallback = false;
    let programLoadTime = 0;
    let mapLoadTime = 0;
    let animationFrameId = null;
    let isPaused = false;
    let pausedTime = 0;
    let totalPausedDuration = 0;
    
    // Animation synchronization controller
    class AnimationSyncController {
        constructor(bikeElement, progressElement, trackWidth) {
            this.bike = bikeElement;
            this.progress = progressElement;
            this.trackWidth = trackWidth;
            this.startTime = null;
            this.duration = null;
            this.rafId = null;
            this.isPaused = false;
            this.pausedAt = 0;
            this.pausedDuration = 0;
            this.currentProgress = 0;
            this.isRunning = false;
            
            // Calculate bike travel distance
            this.bikeStartPos = -80; // Starting position (off-screen left)
            this.bikeEndPos = this.trackWidth + 80; // Ending position (off-screen right)
            this.bikeTravelDistance = this.bikeEndPos - this.bikeStartPos;
        }
        
        start(durationMs) {
            if (this.isRunning) return;
            
            this.duration = durationMs;
            this.startTime = performance.now();
            this.isRunning = true;
            this.currentProgress = 0;
            
            // Reset positions
            if (this.bike) {
                this.bike.style.transition = 'none';
                this.bike.style.left = `${this.bikeStartPos}px`;
            }
            if (this.progress) {
                this.progress.style.transition = 'none';
                this.progress.style.width = '0%';
            }
            
            console.log('AnimationSyncController started:', {
                duration: this.duration,
                bikeStartPos: this.bikeStartPos,
                bikeEndPos: this.bikeEndPos,
                bikeTravelDistance: this.bikeTravelDistance
            });
            
            this.animate();
        }
        
        animate() {
            if (!this.isRunning) return;
            
            const currentTime = performance.now();
            const elapsed = currentTime - this.startTime - this.pausedDuration;
            
            // Calculate progress (0 to 1)
            let progress = Math.min(elapsed / this.duration, 1);
            
            // Apply easing function (ease-in-out for smooth acceleration/deceleration)
            progress = this.easeInOutCubic(progress);
            
            this.currentProgress = progress;
            
            // Update progress bar
            if (this.progress) {
                const progressPercent = progress * 100;
                this.progress.style.width = `${progressPercent}%`;
            }
            
            // Update bike position (synchronized with progress)
            if (this.bike) {
                const bikePosition = this.bikeStartPos + (this.bikeTravelDistance * progress);
                this.bike.style.left = `${bikePosition}px`;
            }
            
            // Continue animation if not complete
            if (progress < 1 && !this.isPaused) {
                this.rafId = requestAnimationFrame(() => this.animate());
            } else if (progress >= 1) {
                this.complete();
            }
        }
        
        easeInOutCubic(t) {
            return t < 0.5
                ? 4 * t * t * t
                : 1 - Math.pow(-2 * t + 2, 3) / 2;
        }
        
        pause() {
            if (!this.isRunning || this.isPaused) return;
            
            this.isPaused = true;
            this.pausedAt = performance.now();
            
            if (this.rafId) {
                cancelAnimationFrame(this.rafId);
                this.rafId = null;
            }
            
            console.log('Animation paused at progress:', this.currentProgress);
        }
        
        resume() {
            if (!this.isRunning || !this.isPaused) return;
            
            const pauseDuration = performance.now() - this.pausedAt;
            this.pausedDuration += pauseDuration;
            this.isPaused = false;
            
            console.log('Animation resumed after pause duration:', pauseDuration);
            
            this.animate();
        }
        
        updateProgress(targetProgress) {
            // Manually update to specific progress (0-1)
            if (!this.isRunning) return;
            
            this.currentProgress = Math.min(Math.max(targetProgress, 0), 1);
            
            // Update progress bar
            if (this.progress) {
                this.progress.style.width = `${this.currentProgress * 100}%`;
            }
            
            // Update bike position
            if (this.bike) {
                const bikePosition = this.bikeStartPos + (this.bikeTravelDistance * this.currentProgress);
                this.bike.style.left = `${bikePosition}px`;
            }
        }
        
        complete() {
            this.isRunning = false;
            this.currentProgress = 1;
            
            if (this.rafId) {
                cancelAnimationFrame(this.rafId);
                this.rafId = null;
            }
            
            // Ensure final positions
            if (this.progress) {
                this.progress.style.width = '100%';
            }
            if (this.bike) {
                this.bike.style.left = `${this.bikeEndPos}px`;
            }
            
            console.log('Animation completed');
        }
        
        stop() {
            this.isRunning = false;
            
            if (this.rafId) {
                cancelAnimationFrame(this.rafId);
                this.rafId = null;
            }
        }
        
        reset() {
            this.stop();
            this.startTime = null;
            this.duration = null;
            this.isPaused = false;
            this.pausedAt = 0;
            this.pausedDuration = 0;
            this.currentProgress = 0;
            
            if (this.bike) {
                this.bike.style.left = `${this.bikeStartPos}px`;
            }
            if (this.progress) {
                this.progress.style.width = '0%';
            }
        }
    }
    
    // Initialize animation controller
    let animationController = null;
    if (bikeRolling && progressBar) {
        const trackElement = bikeRolling.parentElement;
        const trackWidth = trackElement ? trackElement.offsetWidth : 600;
        animationController = new AnimationSyncController(bikeRolling, progressBar, trackWidth);
        
        // Handle window resize to maintain sync across different screen sizes
        const handleResize = () => {
            if (animationController && trackElement) {
                const newWidth = trackElement.offsetWidth;
                animationController.trackWidth = newWidth;
                animationController.bikeEndPos = newWidth + 80;
                animationController.bikeTravelDistance = animationController.bikeEndPos - animationController.bikeStartPos;
                
                // Update current position if animation is running
                if (animationController.isRunning && animationController.currentProgress > 0) {
                    const bikePosition = animationController.bikeStartPos + 
                        (animationController.bikeTravelDistance * animationController.currentProgress);
                    if (bikeRolling) {
                        bikeRolling.style.left = `${bikePosition}px`;
                    }
                }
                
                console.log('Animation controller resized:', {
                    newWidth,
                    bikeEndPos: animationController.bikeEndPos,
                    bikeTravelDistance: animationController.bikeTravelDistance
                });
            }
        };
        
        // Debounce resize handler
        let resizeTimeout = null;
        const debouncedResize = () => {
            if (resizeTimeout) clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(handleResize, 150);
        };
        
        window.addEventListener('resize', debouncedResize);
        
        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            window.removeEventListener('resize', debouncedResize);
            if (animationController) {
                animationController.stop();
            }
        });
    }
    
    // Helper function to pause/resume animation (for future use)
    const pauseAnimation = () => {
        if (animationController) {
            animationController.pause();
            isPaused = true;
            pausedTime = Date.now();
            console.log('Animation paused');
        }
    };
    
    const resumeAnimation = () => {
        if (animationController && isPaused) {
            const pauseDuration = Date.now() - pausedTime;
            totalPausedDuration += pauseDuration;
            animationController.resume();
            isPaused = false;
            console.log('Animation resumed after', pauseDuration, 'ms');
        }
    };
    
    // Helper function to update stage status
    const updateStageStatus = (stageEl, status) => {
        if (!stageEl) return;
        stageEl.classList.remove('loading', 'completed', 'failed');
        stageEl.classList.add(status);
        
        const statusIcon = stageEl.querySelector('.stage-status i');
        if (statusIcon) {
            statusIcon.className = '';
            if (status === 'completed') {
                statusIcon.className = 'fas fa-check-circle';
            } else if (status === 'failed') {
                statusIcon.className = 'fas fa-times-circle';
            } else {
                statusIcon.className = 'fas fa-spinner fa-spin';
            }
        }
    };
    
    // Initialize stages as loading
    updateStageStatus(stageProgramEl, 'loading');
    updateStageStatus(stageMapEl, 'loading');
    
    // Setup fallback after threshold
    fallbackTimeout = setTimeout(() => {
        if (!isLoadingComplete) {
            hasFallback = true;
            // Hide bike animation, show spinner
            if (bikeRolling) {
                bikeRolling.style.display = 'none';
            }
            if (fallbackSpinner) {
                fallbackSpinner.style.display = 'block';
                fallbackSpinner.classList.add('active');
            }
            if (bikeLoadingText) {
                bikeLoadingText.textContent = 'Loading is taking longer than expected...';
                bikeLoadingText.classList.add('error');
            }
            if (loadingTitle) {
                loadingTitle.textContent = 'Please wait';
            }
            if (loadingSubtitle) {
                loadingSubtitle.textContent = 'Establishing connection...';
            }
        }
    }, FALLBACK_THRESHOLD);
    
    // Create promise for program initialization
    const programInitPromise = new Promise((resolve) => {
        const programStartTime = Date.now();
        const loginUrl = `${API_BASE}/api/login`;
        console.log('Starting programInitPromise - calling /api/login', { API_BASE });
        console.log('Request payload:', { account, isEmail, isPhone, password: '***' });
        
        if (bikeLoadingText && !hasFallback) {
            bikeLoadingText.textContent = 'Authenticating user...';
        }
        
        // Simulate program initialization (auth check, config load, etc.)
        const loginRequest = isStaticHost()
            ? Promise.resolve({
                status: 200,
                ok: true,
                json: async () => ({ token: 'demo-token', user: { name: account || 'Demo User' } })
              })
            : apiFetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    account: account,
                    email: isEmail ? account : null,
                    phone: isPhone ? account : null,
                    password: password 
                })
              });
        loginRequest
        .then(async res => {
            console.log('Login API response status:', res.status, 'OK:', res.ok, 'URL:', loginUrl);
            if (!res.ok) {
                const text = await res.text();
                console.log('Error response body:', text);
                let errorData;
                try {
                    errorData = JSON.parse(text);
                } catch (e) {
                    errorData = { message: text || `Login failed (${res.status})` };
                }
                const message = errorData.message || `Login failed (${res.status})`;
                const statusDetail = res.status ? ` [HTTP ${res.status}]` : '';
                throw new Error(`${message}${statusDetail}`);
            }
            return res.json();
        })
        .then(data => {
            programLoadTime = Date.now() - programStartTime;
            console.log('Login API response data:', data, 'Load time:', programLoadTime, 'ms');
            
            updateStageStatus(stageProgramEl, 'completed');
            
            if (data.token) {
                state.authToken = data.token;
                // Check secure context before using localStorage to avoid SecurityError
                try {
                    if (window.isSecureContext || window.location.protocol === 'https:') {
                        localStorage.setItem('bikemate-token', data.token);
                    } else {
                        console.warn('Insecure context: localStorage disabled');
                    }
                } catch (e) {
                    console.warn('Failed to save token to localStorage:', e);
                }
                resolve({ success: true, duration: programLoadTime });
            } else {
                resolve({ success: false, error: 'Login failed - no token', duration: programLoadTime });
            }
        })
        .catch(err => {
            programLoadTime = Date.now() - programStartTime;
            console.error('Login error:', err);
            updateStageStatus(stageProgramEl, 'failed');
            
            let errorMsg = err && err.message ? err.message : 'Network error';
            if (err && err.name === 'TypeError') {
                errorMsg = `Could not reach server at ${loginUrl}`;
            }
            resolve({ success: false, error: errorMsg, duration: programLoadTime });
        });
    });
    
    // Create promise for AMap API loading
    const amapLoadPromise = new Promise((resolve) => {
        const mapStartTime = Date.now();
        
        if (bikeLoadingText && !hasFallback) {
            setTimeout(() => {
                if (!isLoadingComplete && bikeLoadingText) {
                    bikeLoadingText.textContent = 'Loading map resources...';
                }
            }, 200);
        }
        
        // Check if AMap API is already loaded
        if (window.AMap && state.apiLoaded) {
            mapLoadTime = 0;
            updateStageStatus(stageMapEl, 'completed');
            resolve({ success: true, duration: 0 });
            return;
        }
        
        // Listen for amap-ready event
        const amapReadyHandler = () => {
            mapLoadTime = Date.now() - mapStartTime;
            console.log('AMap API loaded successfully, Load time:', mapLoadTime, 'ms');
            updateStageStatus(stageMapEl, 'completed');
            resolve({ success: true, duration: mapLoadTime });
        };
        
        window.addEventListener('amap-ready', amapReadyHandler, { once: true });
        
        // Start loading AMap API
        if (typeof window.loadAmapApi === 'function') {
            window.loadAmapApi().then(success => {
                if (success === false) {
                    // Map loading was skipped or failed gracefully
                    mapLoadTime = Date.now() - mapStartTime;
                    window.removeEventListener('amap-ready', amapReadyHandler);
                    console.log('Map loading skipped or failed gracefully, continuing without map');
                    updateStageStatus(stageMapEl, 'completed'); // Show as completed to not block loading
                    resolve({ success: false, error: 'Map skipped for mobile', duration: mapLoadTime, skipped: true });
                    return;
                }
                // Wait for actual map ready event
            }).catch(err => {
                mapLoadTime = Date.now() - mapStartTime;
                window.removeEventListener('amap-ready', amapReadyHandler);
                console.error('AMap load error:', err);
                updateStageStatus(stageMapEl, 'failed');
                const errorMsg = err && err.message ? err.message : 'Map load failed';
                resolve({ success: false, error: errorMsg, duration: mapLoadTime });
            });
        } else {
            // If loadAmapApi is not available, resolve immediately
            window.removeEventListener('amap-ready', amapReadyHandler);
            mapLoadTime = Date.now() - mapStartTime;
            updateStageStatus(stageMapEl, 'failed');
            resolve({ success: false, error: 'AMap loader not available', duration: mapLoadTime });
        }
        
        // Timeout fallback for AMap loading
        setTimeout(() => {
            if (mapLoadTime === 0) {
                window.removeEventListener('amap-ready', amapReadyHandler);
                mapLoadTime = Date.now() - mapStartTime;
                if (!state.apiLoaded) {
                    updateStageStatus(stageMapEl, 'failed');
                    resolve({ success: false, error: 'AMap load timeout', duration: mapLoadTime });
                }
            }
        }, FALLBACK_THRESHOLD + 1000);
    });
    
    // Monitor loading with Promise.all and calculate dynamic animation duration
    Promise.all([programInitPromise, amapLoadPromise])
        .then(([programResult, amapResult]) => {
            isLoadingComplete = true;
            clearTimeout(fallbackTimeout);
            
            console.log('All loading complete:', { programResult, amapResult });
            
            // Calculate total loading time (sum of both durations)
            const totalLoadTime = programResult.duration + amapResult.duration;
            console.log('Total load time calculation:', {
                programDuration: programResult.duration,
                mapDuration: amapResult.duration,
                totalLoadTime: totalLoadTime
            });
            
            // Ensure minimum animation duration for visual effect
            const effectiveAnimationTime = Math.max(totalLoadTime, MIN_ANIMATION_DURATION);
            const animationDurationSeconds = effectiveAnimationTime / 1000;
            
            console.log('Animation duration:', animationDurationSeconds, 'seconds');
            
            // Start synchronized animation
            if (animationController && !hasFallback) {
                animationController.start(effectiveAnimationTime);
            }
            
            // Update loading text based on results
            if (bikeLoadingText && !hasFallback) {
                if (programResult.success && amapResult.success) {
                    bikeLoadingText.textContent = `Resources loaded in ${(totalLoadTime / 1000).toFixed(2)}s!`;
                    bikeLoadingText.classList.remove('error');
                    bikeLoadingText.classList.add('success');
                } else if (programResult.success) {
                    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                    const isGitHubPages = window.location.hostname.endsWith('github.io');
                    
                    if (isMobile && isGitHubPages) {
                        bikeLoadingText.textContent = 'Ready for mobile use! (Map features optimized)';
                    } else {
                        bikeLoadingText.textContent = 'Login successful (map degraded mode)';
                    }
                    bikeLoadingText.classList.remove('error');
                    bikeLoadingText.classList.add('success');
                } else {
                    bikeLoadingText.textContent = 'Login failed';
                    bikeLoadingText.classList.remove('success');
                    bikeLoadingText.classList.add('error');
                }
            }
            
            // Calculate completion delay (wait for animation to finish)
            const currentTime = Date.now();
            const elapsedTime = currentTime - loadingStartTime;
            const remainingAnimationTime = Math.max(effectiveAnimationTime - elapsedTime, 0);
            const completionDelay = hasFallback ? 500 : remainingAnimationTime + 300;
            
            console.log('Completion timing:', {
                elapsedTime,
                remainingAnimationTime,
                completionDelay
            });
            
            // Wait for animation to complete before transitioning
            setTimeout(() => {
                if (programResult.success) {
                    state.isLoggedIn = true;
                    
                    // Add success state to loading overlay
                    if (loadingOverlay) {
                        loadingOverlay.classList.add('success');
                    }
                    
                    showNotification('Welcome back! Login successful', 'success');
                    
                    // Hide overlay and navigate
                    setTimeout(() => {
                        if (loadingOverlay) {
                            loadingOverlay.classList.remove('active', 'success');
                        }
                        loginBtn.disabled = false;
                        loginBtn.classList.remove('loading');
                        
                        // Reset animation controller
                        if (animationController) {
                            animationController.reset();
                        }
                        
                        // Reset stages
                        if (stageProgramEl) stageProgramEl.classList.remove('loading', 'completed', 'failed');
                        if (stageMapEl) stageMapEl.classList.remove('loading', 'completed', 'failed');
                        
                        // Reset loading text
                        if (bikeLoadingText) {
                            bikeLoadingText.textContent = 'Initializing program...';
                            bikeLoadingText.classList.remove('success', 'error');
                        }
                        
                        navigateTo('record-page');
                        
                        // Initialize ambient updates
                        startAmbientUpdates();
                        
                        // Request map initialization for current page
                        requestMapForPage('record');
                    }, 800);
                } else {
                    // Handle login failure
                    if (loadingOverlay) {
                        loadingOverlay.classList.remove('active');
                    }
                    loginBtn.disabled = false;
                    loginBtn.classList.remove('loading');
                    
                    // Reset animation controller
                    if (animationController) {
                        animationController.reset();
                    }
                    
                    // Reset fallback spinner
                    if (fallbackSpinner) {
                        fallbackSpinner.style.display = 'none';
                        fallbackSpinner.classList.remove('active');
                    }
                    
                    // Reset stages
                    if (stageProgramEl) stageProgramEl.classList.remove('loading', 'completed', 'failed');
                    if (stageMapEl) stageMapEl.classList.remove('loading', 'completed', 'failed');
                    
                    // Reset loading text
                    if (bikeLoadingText) {
                        bikeLoadingText.textContent = 'Initializing program...';
                        bikeLoadingText.classList.remove('success', 'error');
                    }
                    
                    const errorMessage = programResult.error || 'Login failed';
                    showNotification(errorMessage, 'error');
                    
                    // Show error on form
                    if (passwordError) {
                        passwordError.querySelector('span').textContent = errorMessage;
                        passwordError.style.display = 'flex';
                    }
                    passwordInput.classList.add('error');
                }
            }, completionDelay);
        })
        .catch((err) => {
            // This should not happen since both promises always resolve
            console.error('Unexpected error in loading process:', err);
            isLoadingComplete = true;
            clearTimeout(fallbackTimeout);
            
            if (animationController) {
                animationController.stop();
            }
            
            if (loadingOverlay) {
                loadingOverlay.classList.remove('active');
            }
            loginBtn.disabled = false;
            loginBtn.classList.remove('loading');
            
            showNotification('An unexpected error occurred', 'error');
        });
}

function handleLogout() {
    state.isLoggedIn = false;
    state.authToken = null;
    localStorage.removeItem('bikemate-token');
    if (state.maps.record) {
        state.maps.record.destroy();
        state.maps.record = null;
    }
    if (state.maps.location) {
        state.maps.location.destroy();
        state.maps.location = null;
    }
    state.locationGeolocation = null;
    stopRideGpsWatcher();
    state.quickFilter = null;
    state.isTracking = false;
    state.isAutoPaused = false;
    if (state.timer) {
        clearInterval(state.timer);
        state.timer = null;
    }
    if (state.sosTimer) {
        clearInterval(state.sosTimer);
        state.sosTimer = null;
    }
    state.sosCountdown = 0;
    finalizeGoalSession();
    updateTrackingBadges();
    updateSOSButton();
    showNotification('Logged out');
    navigateTo('login-page');
}


function toggleTracking() {
    const btn = document.getElementById('tracking-btn');
    const icon = document.getElementById('tracking-icon');
    const text = document.getElementById('tracking-text');

    if (!btn || !icon || !text) return;

    if (!state.isTracking) {
        if (!state.maps.record) {
            showNotification('Map is still loading; please open the record tab first', 'warning');
            requestMapForPage('record');
            return;
        }
        state.isTracking = true;
        state.rideData = { time: 0, distance: 0, speed: 0, calories: 0 };
        state.ridePath = [];
        if (state.ridePolyline) {
            state.ridePolyline.setPath([]);
        }
        if (state.rideGoal) {
            state.rideGoal.sessionDistance = 0;
            updateGoalUI();
        }
        state.lastRideCenterTime = Date.now();
        
        // 重置同步状态
        state.syncLocked = false;
        state.lastSyncTime = 0;
        if (state.syncTimer) {
            clearTimeout(state.syncTimer);
            state.syncTimer = null;
        }
        setSyncStatusSafe('synced');
        
        btn.className = 'btn btn-danger';
        icon.className = 'fas fa-stop';
        text.textContent = 'Stop tracking';
        showNotification('Tracking started');
        state.isAutoPaused = false;
        state.autoPauseCounter = 0;
        updateTrackingBadges();
        updateSOSButton();
        state.timer = setInterval(() => {
            if (state.isAutoPaused) {
                updateRideMetrics();
                return;
            }
            state.rideData.time++;
            updateRideMetrics();
        }, 1000);
        startRideGpsWatcher();
        requestImmediateRideFix();
    } else {
        state.isTracking = false;
        btn.className = 'btn btn-primary';
        icon.className = 'fas fa-play';
        text.textContent = 'Start ride';
        showNotification('Tracking stopped');
        stopRideGpsWatcher();
        if (state.timer) {
            clearInterval(state.timer);
            state.timer = null;
        }
        if (state.sosTimer) {
            clearInterval(state.sosTimer);
            state.sosTimer = null;
            state.sosCountdown = 0;
        }
        
        // 清理同步状态
        state.syncLocked = false;
        if (state.syncTimer) {
            clearTimeout(state.syncTimer);
            state.syncTimer = null;
        }
        setSyncStatusSafe('synced');
        
        state.isAutoPaused = false;
        state.autoPauseCounter = 0;
        finalizeGoalSession();
        updateTrackingBadges();
        updateSOSButton();
    }
}

// 增强的Live数据更新机制（带防抖和状态锁定）
function updateRideMetrics() {
    if (metricsFrame || isDocumentHidden) return;
    
    const now = Date.now();
    const timeDiff = (now - state.lastUpdate) / 1000;
    state.lastUpdate = now;
    
    metricsFrame = requestAnimationFrame(() => {
        metricsFrame = null;
        
        try {
            const { time, distance, speed, calories } = state.rideData;
            
            // 仅在首次更新或数据有显著变化时触发同步状态
            const shouldShowSyncing = shouldTriggerSyncStatus();
            if (shouldShowSyncing) {
                triggerSyncStatusUpdate();
            }
            
            // 记录历史数据（用于趋势计算）
            updateDataHistory('speed', speed);
            updateDataHistory('distance', distance);
            updateDataHistory('time', time);
            
            // 计算性能指标
            updatePerformanceMetrics();
            
            // 批量更新UI元素
            const updates = [
                { id: 'time-value', value: formatTime(time), animate: false },
                { id: 'speed-value', value: speed.toFixed(1), animate: true },
                { id: 'distance-value', value: distance.toFixed(1), animate: true },
                { id: 'calories-value', value: Math.round(calories), animate: true }
            ];
            
            batchUpdateUI(updates);
            
            // 更新趋势指示器
            updateTrendIndicators();
            
            // 更新数据摘要
            updateDataSummary();
            
        } catch (error) {
            console.error('Failed to update metrics:', error);
            setSyncStatusSafe('error');
        }
    });
}

// 批量更新UI（性能优化）
function batchUpdateUI(updates) {
    updates.forEach(({ id, value, animate }) => {
        const element = getUI(id);
        if (!element) return;
        
        const oldValue = element.textContent;
        if (oldValue === value.toString()) return;
        
        if (animate && !document.body.classList.contains('low-motion')) {
            element.style.transition = 'transform 0.3s ease, color 0.3s ease';
            element.style.transform = 'scale(1.1)';
            element.style.color = '#60A5FA';
            
            setTimeout(() => {
                element.textContent = value;
                element.style.transform = 'scale(1)';
                element.style.color = '';
            }, 150);
        } else {
            element.textContent = value;
        }
    });
}

// 更新数据历史
function updateDataHistory(key, value) {
    if (!state.rideHistory[key]) {
        state.rideHistory[key] = [];
    }
    
    state.rideHistory[key].push(value);
    
    if (state.rideHistory[key].length > state.maxHistory) {
        state.rideHistory[key].shift();
    }
}

// 计算趋势
function calculateTrend(key) {
    const history = state.rideHistory[key];
    if (!history || history.length < 2) return 'neutral';
    
    const recent = history.slice(-5);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const latest = recent[recent.length - 1];
    
    const diff = latest - avg;
    const threshold = avg * 0.05;
    
    if (diff > threshold) return 'up';
    if (diff < -threshold) return 'down';
    return 'neutral';
}

// 更新趋势指示器
function updateTrendIndicators() {
    const trends = {
        speed: calculateTrend('speed'),
        distance: calculateTrend('distance')
    };
    
    // 更新速度趋势
    const speedTrend = getUI('speed-trend');
    if (speedTrend) {
        const history = state.rideHistory.speed || [];
        const change = history.length >= 2 
            ? (history[history.length - 1] - history[history.length - 2]).toFixed(1)
            : 0;
        
        speedTrend.className = 'metric-trend ' + trends.speed;
        const icon = trends.speed === 'up' ? 'fa-arrow-up' : trends.speed === 'down' ? 'fa-arrow-down' : 'fa-minus';
        speedTrend.innerHTML = `<i class="fas ${icon}"></i> <span>${change > 0 ? '+' : ''}${change}</span>`;
    }
    
    // 更新距离趋势
    const distanceTrend = getUI('distance-trend');
    if (distanceTrend) {
        const history = state.rideHistory.distance || [];
        const change = history.length >= 2 
            ? (history[history.length - 1] - history[history.length - 2]).toFixed(2)
            : 0;
        
        distanceTrend.className = 'metric-trend up';
        distanceTrend.innerHTML = `<i class="fas fa-plus"></i> <span>+${change}</span>`;
    }
    
    // 更新卡路里趋势
    const caloriesTrend = getUI('calories-trend');
    if (caloriesTrend) {
        const calories = Math.round(state.rideData.calories);
        const lastCalories = state.dataCache.lastCalories || 0;
        const change = calories - lastCalories;
        
        caloriesTrend.className = 'metric-trend up';
        caloriesTrend.innerHTML = `<i class="fas fa-plus"></i> <span>+${change}</span>`;
        
        state.dataCache.lastCalories = calories;
    }
}

// 更新性能指标
function updatePerformanceMetrics() {
    const { speed, distance, time } = state.rideData;
    
    // 更新最高速度
    if (speed > state.performanceMetrics.maxSpeed) {
        state.performanceMetrics.maxSpeed = speed;
    }
    
    // 计算平均速度
    if (time > 0) {
        state.performanceMetrics.avgSpeed = (distance / (time / 3600));
    }
    
    state.performanceMetrics.totalTime = time;
    state.performanceMetrics.totalDistance = distance;
}

// 更新数据摘要
function updateDataSummary() {
    const avgSpeedEl = getUI('avg-speed');
    const maxSpeedEl = getUI('max-speed');
    const paceEl = getUI('pace');
    
    if (avgSpeedEl) {
        avgSpeedEl.textContent = state.performanceMetrics.avgSpeed.toFixed(1) + ' km/h';
    }
    
    if (maxSpeedEl) {
        maxSpeedEl.textContent = state.performanceMetrics.maxSpeed.toFixed(1) + ' km/h';
    }
    
    if (paceEl) {
        const pace = state.performanceMetrics.avgSpeed > 0 
            ? 60 / state.performanceMetrics.avgSpeed 
            : 0;
        const paceMin = Math.floor(pace);
        const paceSec = Math.round((pace - paceMin) * 60);
        paceEl.textContent = pace > 0 ? `${paceMin}:${paceSec.toString().padStart(2, '0')}/km` : '--:--/km';
    }
}

// 判断是否应该触发同步状态更新（防抖条件）
function shouldTriggerSyncStatus() {
    const now = Date.now();
    const timeSinceLastSync = now - state.lastSyncTime;
    
    // 防抖：距离上次同步至少2秒才触发新的同步
    const SYNC_DEBOUNCE_MS = 2000;
    
    // 如果正在Syncing且未超时，不触发
    if (state.syncLocked && timeSinceLastSync < SYNC_DEBOUNCE_MS) {
        return false;
    }
    
    // 如果已经是synced状态且时间未超过防抖周期，不触发
    if (state.syncStatus === 'synced' && timeSinceLastSync < SYNC_DEBOUNCE_MS) {
        return false;
    }
    
    return true;
}

// 触发同步状态更新（带锁定机制）
function triggerSyncStatusUpdate() {
    if (state.syncLocked) return;
    
    // 锁定状态
    state.syncLocked = true;
    state.lastSyncTime = Date.now();
    
    // 清除旧的定时器
    if (state.syncTimer) {
        clearTimeout(state.syncTimer);
        state.syncTimer = null;
    }
    
    // 立即显示Syncing
    setSyncStatusSafe('syncing');
    
    // 200ms后显示Synced（模拟同步Completed）
    state.syncTimer = setTimeout(() => {
        setSyncStatusSafe('synced');
        state.syncLocked = false;
        state.syncTimer = null;
    }, 200);
}

// 安全更新同步状态（内部使用，带冲突检测）
function setSyncStatusSafe(status) {
    // 验证状态值
    const validStatuses = ['syncing', 'synced', 'error', 'offline'];
    if (!validStatuses.includes(status)) {
        console.warn('Invalid sync status:', status);
        return;
    }
    
    // 如果状态没有变化，跳过更新
    if (state.syncStatus === status) return;
    
    state.syncStatus = status;
    const syncStatusEl = getUI('sync-status');
    if (!syncStatusEl) return;
    
    syncStatusEl.className = 'sync-status ' + status;
    
    const statusConfig = {
        syncing: { icon: 'fa-circle-notch fa-spin', text: 'Syncing' },
        synced: { icon: 'fa-check-circle', text: 'Synced' },
        error: { icon: 'fa-exclamation-circle', text: 'Error' },
        offline: { icon: 'fa-wifi-slash', text: 'Offline' }
    };
    
    const config = statusConfig[status];
    syncStatusEl.innerHTML = `<i class="fas ${config.icon}"></i><span>${config.text}</span>`;
}

// 更新同步状态（公共API，用于外部调用）
function updateSyncStatus(status) {
    // 特殊状态（error, offline）可以立即设置，不受锁定限制
    if (status === 'error' || status === 'offline') {
        // 清除锁定和定时器
        state.syncLocked = false;
        if (state.syncTimer) {
            clearTimeout(state.syncTimer);
            state.syncTimer = null;
        }
        setSyncStatusSafe(status);
        return;
    }
    
    // 普通状态使用防抖机制
    if (status === 'syncing' || status === 'synced') {
        if (shouldTriggerSyncStatus()) {
            triggerSyncStatusUpdate();
        }
    }
}

function triggerSOS() {
    if (state.sosTimer || !state.isTracking) {
        return;
    }

    state.sosCountdown = 3;
    updateSOSButton();
    showNotification('Preparing to send SOS location...', 'warning');

    state.sosTimer = setInterval(() => {
        state.sosCountdown -= 1;
        if (state.sosCountdown > 0) {
            updateSOSButton();
            return;
        }

        clearInterval(state.sosTimer);
        state.sosTimer = null;
        state.sosCountdown = 0;
        updateSOSButton();
        showNotification('SOS location shared with emergency contacts', 'error');
    }, 1000);
}

// UI功能
function editField(fieldName, element) {
    const currentValue = element.textContent.trim();
    
    // Create input container
    const inputContainer = document.createElement('div');
    inputContainer.className = 'edit-field-container';
    inputContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px; margin-top: 8px;';
    
    // Create input element
    const input = document.createElement('input');
    input.className = 'form-control';
    input.value = fieldName === 'phone' ? sanitizeCnPhone(currentValue) : currentValue;
    input.placeholder = `Enter ${fieldName}`;
    
    // Set input type and validation based on field
    if (fieldName === 'name') {
        input.type = 'text';
        input.setAttribute('minlength', '2');
        input.setAttribute('maxlength', '50');
    } else if (fieldName === 'phone') {
        input.type = 'tel';
        input.placeholder = 'Enter 11-digit mobile number (e.g., 13800138000)';
        input.setAttribute('maxlength', '11');
    } else {
        input.type = 'text';
    }
    
    // Error message element
    const errorMsg = document.createElement('div');
    errorMsg.className = 'error-message';
    errorMsg.style.cssText = 'color: var(--danger); font-size: 13px; display: none; margin-top: 4px;';
    
    // Button container
    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = 'display: flex; gap: 8px;';
    
    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.textContent = 'Save';
    saveBtn.style.cssText = 'flex: 1; padding: 8px 16px;';
    
    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'flex: 1; padding: 8px 16px;';
    
    // Validation function
    const validateInput = () => {
        let value = input.value.trim();
        let isValid = true;
        let errorMessage = '';
        
        // Check if empty
        if (!value || value.length === 0) {
            isValid = false;
            errorMessage = `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} cannot be empty`;
        }
        // Validate name
        else if (fieldName === 'name') {
            if (value.length < 2) {
                isValid = false;
                errorMessage = 'Name must be at least 2 characters';
            } else if (!/^[a-zA-Z\s\u4e00-\u9fa5.-]+$/.test(value)) {
                isValid = false;
                errorMessage = 'Name can only contain letters, spaces, and basic punctuation';
            }
        }
        // Validate phone
        else if (fieldName === 'phone') {
            const digitsOnly = sanitizeCnPhone(value);
            if (digitsOnly.length !== 11 || digitsOnly[0] !== '1') {
                isValid = false;
                errorMessage = 'Phone number must be an 11-digit Chinese mobile (starts with 1)';
            } else {
                value = digitsOnly;
                input.value = digitsOnly;
            }
        }
        // Other fields (age, gender, height, weight)
        else {
            if (fieldName === 'age') {
                const age = parseInt(value);
                if (isNaN(age) || age < 1 || age > 150) {
                    isValid = false;
                    errorMessage = 'Please enter a valid age (1-150)';
                }
            } else if (fieldName === 'height') {
                if (!/^\d+(\.\d+)?(cm|m|ft|in)?$/i.test(value)) {
                    isValid = false;
                    errorMessage = 'Please enter a valid height (e.g., 175cm, 5.8ft)';
                }
            } else if (fieldName === 'weight') {
                if (!/^\d+(\.\d+)?(kg|lbs|lb)?$/i.test(value)) {
                    isValid = false;
                    errorMessage = 'Please enter a valid weight (e.g., 68kg, 150lbs)';
                }
            }
        }
        
        if (!isValid) {
            errorMsg.textContent = errorMessage;
            errorMsg.style.display = 'block';
            input.classList.add('error');
        } else {
            errorMsg.style.display = 'none';
            input.classList.remove('error');
        }
        
        return isValid;
    };
    
    // Save function
    const saveField = () => {
        if (!validateInput()) {
            input.focus();
            return;
        }
        
        let newValue = input.value.trim();
        if (fieldName === 'phone') {
            newValue = sanitizeCnPhone(newValue);
        }
        
        // Update state
        state.userData[fieldName] = newValue;
        
        // Save to localStorage
        try {
            localStorage.setItem('bikemate-userdata', JSON.stringify(state.userData));
        } catch (e) {
            console.warn('Failed to save user data to localStorage:', e);
        }
        
        // Update display
        element.textContent = newValue;
        element.style.display = 'inline';
        
        // Remove edit UI
        inputContainer.remove();

        // Sync dependent UI elements
        syncUserDataToUI();
        
        // Show success notification
        showNotification(`${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} updated successfully`, 'success');
    };
    
    // Cancel function
    const cancelEdit = () => {
        element.style.display = 'inline';
        inputContainer.remove();
    };
    
    // Event listeners
    saveBtn.onclick = saveField;
    cancelBtn.onclick = cancelEdit;
    
    // Save on Enter key
    input.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveField();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        }
    };
    
    // Real-time validation on input
    input.oninput = () => {
        if (fieldName === 'phone') {
            const digitsOnly = input.value.replace(/\D/g, '').slice(0, 11);
            input.value = digitsOnly;
        }
        if (errorMsg.style.display === 'block') {
            validateInput();
        }
    };
    
    // Assemble UI
    btnContainer.appendChild(saveBtn);
    btnContainer.appendChild(cancelBtn);
    inputContainer.appendChild(input);
    inputContainer.appendChild(errorMsg);
    inputContainer.appendChild(btnContainer);
    
    // Replace display with input
    element.style.display = 'none';
    element.parentNode.appendChild(inputContainer);
    
    // Focus and select
    input.focus();
    input.select();
}

function showAvatarModal() {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    modalTitle.textContent = 'Choose avatar';
    modalBody.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0;">
            ${['user', 'user-tie', 'user-astronaut', 'user-ninja'].map(icon => `
                <div style="width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 2px solid transparent;" onclick="selectAvatar('${icon}', this)">
                    <i class="fas fa-${icon}" style="font-size: 24px;"></i>
                </div>
            `).join('')}
        </div>
    `;

    modal.classList.add('active');
}

function selectAvatar(icon, element) {
    document.querySelectorAll('#modal-body > div > div').forEach(el => {
        el.style.borderColor = 'transparent';
    });
    element.style.borderColor = 'var(--primary)';

    document.getElementById('modal-save').onclick = () => {
        document.querySelector('.avatar').innerHTML = `<i class="fas fa-${icon}"></i>`;
        closeModal();
        showNotification('Avatar updated');
    };
}

function closeModal() {
    document.getElementById('modal').classList.remove('active');
}

// 开发中提示
function showDevNotice(featureName) {
    const overlay = document.getElementById('dev-overlay');
    const notice = document.getElementById('dev-notice');
    const noticeText = document.getElementById('dev-notice-text');

    if (noticeText) {
        noticeText.textContent = `${featureName} is in development, stay tuned!`;
    }

    overlay?.classList.add('visible');
    notice?.classList.add('visible');
}

function closeDevNotice() {
    document.getElementById('dev-overlay')?.classList.remove('visible');
    document.getElementById('dev-notice')?.classList.remove('visible');
}

// 高德地图相关函数 - 增强版
function initRecordMap() {
    performanceMonitor.start('Record map initialization');
    performanceMonitor.start('Total load time');

    // 检查地图API是否加载
    if (typeof AMap === 'undefined') {
        console.error('AMap API not loaded');
        performanceMonitor.end('Record map initialization');
        return;
    }
    if (state.maps.record || !document.getElementById('record-map-placeholder')) return;

    const placeholder = document.getElementById('record-map-placeholder');
    const debugStatus = document.getElementById('debug-status');
    const mapStatusEl = document.getElementById('map-status');

    state.mapInitAttempts++;

    // 检查高德地图API是否加载
    if (typeof AMap === 'undefined') {
        console.error('AMap API not loaded');
        if (placeholder) {
            placeholder.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px; color: var(--warning);"></i>
                    <div style="color: var(--text-secondary); margin-bottom: 12px;">Map load failed</div>
                    <div style="color: var(--text-secondary); font-size: 12px;">Attempts: ${state.mapInitAttempts}/3</div>
                    <button class="btn btn-primary" style="margin-top: 12px; padding: 8px 16px; font-size: 12px;" onclick="forceLoadMap()">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </div>
            `;
        }
        if (debugStatus) {
            debugStatus.textContent = 'Status: API not loaded';
        }
        if (mapStatusEl) {
            mapStatusEl.textContent = `Map status: init failed (attempt ${state.mapInitAttempts}/3)`;
        }
        return;
    }

    try {
        if (debugStatus) {
            debugStatus.textContent = 'Status: initializing map...';
        }
        if (mapStatusEl) {
            mapStatusEl.textContent = 'Map status: initializing...';
        }

        state.maps.record = new AMap.Map('record-map', {
            zoom: 15,
            center: [121.130, 31.460],
            mapStyle: 'amap://styles/normal',
            features: ['bg', 'road', 'building', 'point'],
            viewMode: '2D'
        });

        state.maps.record.addControl(new AMap.Scale());
        state.maps.record.addControl(new AMap.ToolBar({ position: 'RB' }));

        state.ridePolyline = new AMap.Polyline({
            path: [],
            strokeColor: '#FF6B6B',
            strokeWeight: 6,
            strokeOpacity: 0.9,
            strokeStyle: 'solid',
            lineJoin: 'round',
            showDir: true
        });
        state.ridePolyline.setMap(state.maps.record);

        if (placeholder) {
            placeholder.classList.add('hidden');
        }

        if (debugStatus) {
            debugStatus.textContent = 'Status: map loaded successfully';
        }
        if (mapStatusEl) {
            mapStatusEl.textContent = 'Map status: initialized successfully';
        }

        state.lastRideCenterTime = Date.now();

        AMap.plugin('AMap.Geolocation', () => {
            state.rideGeolocation = new AMap.Geolocation({
                enableHighAccuracy: true,
                timeout: 10000,
                convert: true,
                zoomToAccuracy: true,
                showButton: false,
                extensions: 'all'
            });
            state.maps.record.addControl(state.rideGeolocation);
            state.rideGeolocation.getCurrentPosition((status, result) => {
                if (status === 'complete' && result.position) {
                    const { lng, lat } = result.position;
                    const accuracy = result.accuracy || null;
                    const now = Date.now();
                    state.ridePath = [{ lng, lat, timestamp: now }];
                    if (state.ridePolyline) {
                        state.ridePolyline.setPath([[lng, lat]]);
                    }
                    state.maps.record.setCenter([lng, lat]);
                    state.lastRideCenterTime = now;
                    handleGpsPositionUpdate(lng, lat, accuracy, now, 'amap');
                } else if (result) {
                    console.warn('Initial ride geolocation failed:', result.message || result);
                }
            });
        });

        showNotification('Map loaded successfully');

        performanceMonitor.end('Record map initialization');
        performanceMonitor.end('Total load time');
        performanceMonitor.report();

    } catch (error) {
        console.error('AMap initialization failed:', error);
        if (placeholder) {
            placeholder.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px; color: var(--warning);"></i>
                    <div style="color: var(--text-secondary); margin-bottom: 12px;">Map initialization failed</div>
                    <div style="color: var(--text-secondary); font-size: 12px;">Error: ${error.message}</div>
                    <button class="btn btn-primary" style="margin-top: 12px; padding: 8px 16px; font-size: 12px;" onclick="forceLoadMap()">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </div>
            `;
        }
        if (debugStatus) {
            debugStatus.textContent = `Status: initialization failed - ${error.message}`;
        }
        if (mapStatusEl) {
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            const isGitHubPages = window.location.hostname.endsWith('github.io');
            
            if (isMobile && isGitHubPages) {
                mapStatusEl.textContent = 'Map status: Optimized for mobile - map features available locally';
            } else {
                mapStatusEl.textContent = `Map status: initialization failed - ${error.message}`;
            }
        }
    }
}

function initLocationMap() {
    performanceMonitor.start('Location map initialization');
    performanceMonitor.start('Total load time');

    if (state.maps.location || !document.getElementById('location-map-placeholder')) {
        performanceMonitor.end('Location map initialization');
        return;
    }

    const placeholder = document.getElementById('location-map-placeholder');

    // 检查高德地图API是否加载
    if (typeof AMap === 'undefined') {
        console.error('AMap API not loaded');
        if (placeholder) {
            placeholder.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px; color: var(--warning);"></i>
                    <div style="color: var(--text-secondary);">Map load failed, please check your network connection</div>
                </div>
            `;
        }
        return;
    }

    // 显示加载提示
    if (placeholder) {
        placeholder.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-map-marker-alt" style="font-size: 48px; margin-bottom: 16px; color: var(--primary);"></i>
                    <div style="color: var(--text-secondary);">Getting your location...</div>
                </div>
        `;
    }

    try {
        const defaultCenter = [121.130, 31.460];

        state.maps.location = new AMap.Map('location-map', {
            zoom: 15,
            center: defaultCenter,
            mapStyle: 'amap://styles/normal',
            features: ['bg', 'road', 'building', 'point'],
            viewMode: '2D'
        });

        state.maps.location.addControl(new AMap.Scale());
        state.maps.location.addControl(new AMap.ToolBar({ position: 'RB' }));

        if (placeholder) {
            placeholder.classList.add('hidden');
        }

        let perfCompleted = false;
        let precisePerfEnded = false;

        const endPrecisePerf = () => {
            if (precisePerfEnded) return;
            precisePerfEnded = true;
            performanceMonitor.end('Precise location acquisition');
        };

        const updateLocationUI = (lng, lat, accuracy, source) => {
            if (state.maps.location) {
                state.maps.location.setCenter([lng, lat]);
                state.maps.location.setZoom(17);
            }
            const accEl = document.getElementById('location-accuracy');
            if (accEl) {
                accEl.textContent = accuracy ? `Precision: ±${Math.round(accuracy)} m` : 'Precision: -- m';
            }
            const lastEl = document.getElementById('last-updated');
            if (lastEl) {
                lastEl.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
            }
            refreshWeatherForecast();
        };

        const finishPerfTracking = () => {
            if (perfCompleted) return;
            perfCompleted = true;
            performanceMonitor.end('Location map initialization');
            performanceMonitor.end('Total load time');
            performanceMonitor.report();
        };

        const fallbackToBrowserSamples = async () => {
            try {
                const position = await acquirePreciseLocationWithSamples({ timeout: 14000, samples: 5, desiredAccuracy: 50 });
                const { longitude, latitude } = position.coords;
                const accuracy = position.coords.accuracy;
                handleGpsPositionUpdate(longitude, latitude, accuracy, Date.now(), 'browser');
                updateLocationUI(longitude, latitude, accuracy, 'browser');
                showNotification('Updated location via browser GPS', 'info');
            } catch (error) {
                console.warn('Browser fallback failed:', error);
                showNotification('Unable to obtain location; please check permissions and network', 'warning');
            } finally {
                endPrecisePerf();
                finishPerfTracking();
            }
        };

        const getAmapPositionOnce = () => new Promise((resolve, reject) => {
            if (!state.locationGeolocation) {
                reject(new Error('Geolocation plugin unavailable'));
                return;
            }
            state.locationGeolocation.getCurrentPosition((status, result) => {
                if (status === 'complete' && result.position) {
                    resolve(result);
                } else {
                    reject(result);
                }
            });
        });

        const requestAmapLocation = async () => {
            if (!state.locationGeolocation) {
                await fallbackToBrowserSamples();
                return;
            }
            try {
                const result = await getAmapPositionOnce();
                const { lng, lat } = result.position;
                const accuracy = result.accuracy || null;
                handleGpsPositionUpdate(lng, lat, accuracy, Date.now(), 'amap');
                updateLocationUI(lng, lat, accuracy, 'amap');
                showNotification('Current location updated', 'success');
                endPrecisePerf();
                finishPerfTracking();
            } catch (error) {
                console.warn('AMap Geolocation failed, fallback to browser', error);
                await fallbackToBrowserSamples();
            }
        };

        const initResampleButton = () => {
            const resampleBtn = document.getElementById('resample-btn');
            if (!resampleBtn) return;
            resampleBtn.addEventListener('click', async () => {
                    resampleBtn.disabled = true;
                    showNotification('Re-sampling your location...');
                try {
                    await requestAmapLocation();
                } finally {
                    resampleBtn.disabled = false;
                }
            });
        };

        AMap.plugin('AMap.Geolocation', () => {
            performanceMonitor.start('Precise location acquisition');
            state.locationGeolocation = new AMap.Geolocation({
                enableHighAccuracy: true,
                timeout: 10000,
                convert: true,
                zoomToAccuracy: true,
                showButton: false,
                extensions: 'all'
            });
            state.maps.location.addControl(state.locationGeolocation);
            requestAmapLocation();
        });

        initResampleButton();
    } catch (error) {
        console.error('Location feature failed to initialize:', error);
        if (placeholder) {
            placeholder.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px; color: var(--warning);"></i>
                    <div style="color: var(--text-secondary);">Location initialization failed</div>
                </div>
            `;
        }
        performanceMonitor.end('Location map initialization');
        performanceMonitor.end('Total load time');
        performanceMonitor.report();
    }
}

function addFacilityMarkers(userLng, userLat) {
    if (!state.maps.location) return;

    // 清除已有标记
    if (state.facilityMarkers.length > 0) {
        state.facilityMarkers.forEach(marker => {
            marker.setMap(null);
        });
        state.facilityMarkers = [];
    }

    // 设施图标配置 - 使用内联SVG避免ORBError
        const iconConfig = {
            restaurant: { 
                icon: 'utensils', 
                color: '#FF6B6B', 
                // 使用内联SVG而不是远程图片URL
                svgIcon: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='30' viewBox='0 0 24 24' fill='none' stroke='%23FF6B6B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m18 8-1.46-1.46a2 2 0 0 0-2.82 0L8 12v8h8Z'/%3E%3Ccircle cx='12' cy='16' r='1'/%3E%3Cpath d='m15 5-2-2-2 2'/%3E%3C/svg%3E`
            },
            store: { 
                icon: 'shopping-cart', 
                color: '#4ECDC4', 
                svgIcon: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='30' viewBox='0 0 24 24' fill='none' stroke='%234ECDC4' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='9' cy='21' r='1'/%3E%3Ccircle cx='20' cy='21' r='1'/%3E%3Cpath d='M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6'/%3E%3C/svg%3E`
            },
            repair: { 
                icon: 'wrench', 
                color: '#45B7D1', 
                svgIcon: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='30' viewBox='0 0 24 24' fill='none' stroke='%2345B7D1' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z'/%3E%3C/svg%3E`
            },
            charging: { 
                icon: 'bolt', 
                color: '#96CEB4', 
                svgIcon: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='30' viewBox='0 0 24 24' fill='none' stroke='%2396CEB4' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M13 2L3 14h9l-1 8 10-12h-9l1-8z'/%3E%3C/svg%3E`
            }
        };

    // 为每个设施添加标记
    state.facilities.forEach(facility => {
        if (!facility.location) return;
        const config = iconConfig[facility.type];
        const position = [facility.location.lng, facility.location.lat];
        const marker = new AMap.Marker({
            position: position,
            title: facility.name,
            icon: new AMap.Icon({
                size: new AMap.Size(30, 30),
                image: config.svgIcon,  // 使用内联SVG替代远程图标
                imageSize: new AMap.Size(30, 30)
            }),
            animation: 'AMAP_ANIMATION_DROP'
        });

        // 创建信息窗体内容
        let infoContent = `<div style="padding: 10px; min-width: 200px;">
            <h4 style="margin: 0 0 8px 0; color: var(--text);">${facility.name}</h4>
            <p style="margin: 4px 0; color: var(--text-secondary); font-size: 14px;">
                <i class="fas fa-map-marker-alt"></i> ${facility.address}
            </p>
            <p style="margin: 4px 0; color: var(--text-secondary); font-size: 14px;">
                <i class="fas fa-route"></i> ${facility.distance} km
            </p>`;

        // 根据设施类型添加特定信息
        if (facility.type === 'restaurant') {
            infoContent += `
                <p style="margin: 4px 0; color: var(--text-secondary); font-size: 14px;">
                    ${facility.tel ? `<i class="fas fa-phone"></i> ${facility.tel}<br>` : ''}
                    ${typeof facility.rating === 'number' ? `<i class="fas fa-star"></i> ${facility.rating} ⭐<br>` : ''}
                    ${facility.business_area ? `<i class="fas fa-map-marker-alt"></i> ${facility.business_area}` : ''}
                </p>`;
        } else if (facility.type === 'store') {
            infoContent += `
                <p style="margin: 4px 0; color: var(--text-secondary); font-size: 14px;">
                    ${facility.tel ? `<i class="fas fa-phone"></i> ${facility.tel}<br>` : ''}
                    ${typeof facility.rating === 'number' ? `<i class="fas fa-star"></i> ${facility.rating} ⭐<br>` : ''}
                    ${facility.business_area ? `<i class="fas fa-map-marker-alt"></i> ${facility.business_area}` : ''}
                </p>`;
        } else if (facility.type === 'repair') {
            infoContent += `
                <p style="margin: 4px 0; color: var(--text-secondary); font-size: 14px;">
                    ${facility.tel ? `<i class="fas fa-phone"></i> ${facility.tel}<br>` : ''}
                    ${facility.hours ? `<i class="fas fa-clock"></i> ${facility.hours}<br>` : ''}
                    ${typeof facility.rating === 'number' ? `<i class="fas fa-star"></i> ${facility.rating} ⭐` : ''}
                </p>`;
        } else if (facility.type === 'charging') {
            if (typeof facility.available === 'number' && typeof facility.total === 'number' && facility.total > 0) {
                const percentage = Math.round((facility.available / facility.total) * 100);
                const color = percentage > 50 ? 'var(--success)' : percentage > 20 ? 'var(--warning)' : 'var(--danger)';
                infoContent += `
                    <p style="margin: 4px 0; color: ${color}; font-size: 14px;">
                        <i class="fas fa-plug"></i> ${facility.available}/${facility.total} available<br>
                        <i class="fas fa-percentage"></i> ${percentage}% open
                    </p>`;
            }
        }

        infoContent += `
            <button onclick="navigateToFacility(${facility.id})" style="margin-top: 8px; padding: 6px 12px; background: var(--primary); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                <i class="fas fa-directions"></i> Navigate
            </button>
        </div>`;

        const infoWindow = new AMap.InfoWindow({
            content: infoContent,
            offset: new AMap.Pixel(0, -30)
        });

        marker.on('click', function() {
            infoWindow.open(state.maps.location, marker.getPosition());
        });

        marker.setMap(state.maps.location);
        state.facilityMarkers.push(marker);
    });
}

function updateQuickActionUI() {
    document.querySelectorAll('.quick-action').forEach(actionEl => {
        const action = actionEl.dataset.action;
        actionEl.classList.toggle('active', state.quickFilter === action);
    });
}

function setFacilityQuickFilter(action) {
    state.quickFilter = state.quickFilter === action ? null : action;
    updateQuickActionUI();
    renderFacilities();
}

function renderFacilities() {
    const facilityList = document.getElementById('facility-list');
    if (!facilityList) return;

    updateQuickActionUI();

    // 过滤设施
    let filteredFacilities = state.currentFilter === 'all' 
        ? [...state.facilities] 
        : state.facilities.filter(f => f.type === state.currentFilter);

    switch (state.quickFilter) {
        case 'open':
            filteredFacilities = filteredFacilities.filter(f => f.open === true);
            break;
        case 'nearest':
            filteredFacilities = filteredFacilities.slice().sort((a, b) => a.distance - b.distance).slice(0, 3);
            break;
        default:
            break;
    }

    // 按距离排序
    filteredFacilities.sort((a, b) => (a.distance || 0) - (b.distance || 0));

    // 渲染设施列表
    facilityList.innerHTML = filteredFacilities.map(facility => {
        const config = FACILITY_TYPES[facility.type] || {};

        // 开放状态指示
        const openStatusClass = facility.open === true ? 'open' : facility.open === false ? 'closed' : 'unknown';
        const openStatusText = facility.open === true ? 'Open now' : facility.open === false ? 'Closed' : 'Unknown status';
        const facilityDetails = buildFacilityDetailSection(facility);

        return `
            <div class="facility-item" onclick="showFacilityOnMap(${facility.id})">
                <div class="facility-header">
                    <div class="facility-icon" style="background: ${config.color || '#4ECDC4'}; color: white;">
                        <i class="fas fa-${config.icon || 'map-marker-alt'}"></i>
                    </div>
                    <div class="facility-basic-info">
                        <div class="facility-name-row">
                            <div class="facility-name">${facility.name}</div>
                            <div class="open-status ${openStatusClass}">
                                ${openStatusText}
                            </div>
                        </div>
                        <div class="facility-meta">
                            <span class="facility-distance">
                                <i class="fas fa-map-marker-alt"></i> ${facility.distance ?? '--'} km
                            </span>
                            <span class="facility-type">${config.name || facility.type}</span>
                        </div>
                    </div>
                </div>

                <div class="facility-address">
                    <i class="fas fa-map-marker-alt text-gray-500"></i>
                    <span>${facility.address}</span>
                </div>

                ${facilityDetails}

                <div class="facility-actions">
                    <button onclick="event.stopPropagation(); navigateToFacility(${facility.id})" 
                            class="navigate-btn">
                        <i class="fas fa-directions"></i> Navigate
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // 无结果提示
    if (filteredFacilities.length === 0) {
        facilityList.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <p>No facilities found</p>
                <button onclick="filterFacilities('all')" class="try-all-btn">Show all types</button>
            </div>
        `;
    }
}

function buildFacilityDetailSection(facility) {
    const detailItems = [];

    const pushItem = (iconClass, content, contentClass = '') => {
        if (!content) return;
        const spanClass = contentClass ? ` class="${contentClass}"` : '';
        detailItems.push(`
            <div class="detail-item">
                <i class="${iconClass}"></i>
                <span${spanClass}>${content}</span>
            </div>
        `);
    };

    if (typeof facility.rating === 'number') {
        pushItem('fas fa-star text-warning', facility.rating, 'rating');
    }

    const typeSpecificBuilders = {
        restaurant: () => pushItem('fas fa-utensils', facility.cuisine),
        store: () => pushItem('fas fa-tag', facility.category),
        repair: () => pushItem('fas fa-toolbox', facility.services),
        charging: () => {
            if (typeof facility.available === 'number' && typeof facility.total === 'number' && facility.total > 0) {
                const { percentage, statusClass } = getChargingAvailabilityMeta(facility);
                pushItem(`fas fa-plug ${statusClass}`, `${facility.available}/${facility.total} available`);
                pushItem(`fas fa-percentage ${statusClass}`, `${percentage}% open`);
            }
        }
    };

    if (typeSpecificBuilders[facility.type]) {
        typeSpecificBuilders[facility.type]();
    }

    pushItem('fas fa-clock', facility.businessHours);
    if (facility.tel && facility.tel !== 'No phone number available') {
        pushItem('fas fa-phone-alt', facility.tel);
    }

    if (!detailItems.length) {
        return '';
    }

    return `
        <div class="facility-details">
            ${detailItems.join('')}
        </div>
    `;
}

function getChargingAvailabilityMeta(facility) {
    if (!facility.total) {
        return { percentage: 0, statusClass: 'text-success' };
    }
    const percentage = Math.max(0, Math.min(100, Math.round((facility.available / facility.total) * 100)));
    let statusClass = 'text-success';
    if (percentage <= 20) {
        statusClass = 'text-danger';
    } else if (percentage <= 50) {
        statusClass = 'text-warning';
    }
    return { percentage, statusClass };
}


function maybeStartTour() {
    if (!state.isLoggedIn || typeof localStorage === 'undefined') return;
    if (localStorage.getItem(TOUR_STORAGE_KEY)) return;

    const overlay = document.getElementById('tour-overlay');
    if (!overlay) return;

    state.tourIndex = 0;
    updateTourContent();
    overlay.classList.add('visible');
}

function updateTourContent() {
    const title = document.getElementById('tour-title');
    const body = document.getElementById('tour-body');
    const stepsContainer = document.getElementById('tour-steps');
    const nextBtn = document.getElementById('tour-next-btn');

    const step = TOUR_STEPS[state.tourIndex];
    if (title) title.textContent = step?.title || '';
    if (body) body.textContent = step?.body || '';

    if (stepsContainer) {
        stepsContainer.innerHTML = TOUR_STEPS.map((_, index) => (
            `<span class="tour-step ${index === state.tourIndex ? 'active' : ''}"></span>`
        )).join('');
    }

    if (nextBtn) {
        nextBtn.textContent = state.tourIndex === TOUR_STEPS.length - 1 ? 'Completed' : 'Next';
    }
}

function nextTourStep() {
    if (state.tourIndex < TOUR_STEPS.length - 1) {
        state.tourIndex += 1;
        updateTourContent();
        return;
    }
    completeTour(false);
}

function skipTour() {
    completeTour(true);
}

function completeTour(skipped) {
    const overlay = document.getElementById('tour-overlay');
    if (overlay) {
        overlay.classList.remove('visible');
    }
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    }
    showNotification(skipped ? 'Tour skipped; you can revisit it in help' : 'Walkthrough complete—enjoy your ride!', 'info');
}

function filterFacilities(type) {
    prepareFacilityFilterUI(type);
    if (facilityFilterTimer) {
        clearTimeout(facilityFilterTimer);
    }
    facilityFilterTimer = setTimeout(() => {
        facilityFilterTimer = null;
        processFacilityFilter(type);
    }, 120);
}

function prepareFacilityFilterUI(type) {
    state.currentFilter = type;
    document.querySelectorAll('.facility-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    const activeTab = document.querySelector(`.facility-tab[onclick="filterFacilities('${type}')"]`);
    if (activeTab) {
        activeTab.classList.add('active');
    }
    updateQuickActionUI();

    const facilityList = getUI('facility-list');
    if (facilityList) {
        facilityList.innerHTML = '<div class="loading-indicator">Loading...</div>';
    }
}

function processFacilityFilter(type) {
    // 检查是否有位置信息
    if (!state.userLocation && (!state.maps.location || !state.maps.location.getCenter())) {
        const facilityList = getUI('facility-list');
        if (facilityList) {
            facilityList.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-map-marker-alt"></i>
                    <p>Couldn't get current location; nearby facilities not loaded yet.</p>
                </div>
            `;
        }
        return;
    }

    // 获取Current location
    let currentLng, currentLat;
    if (state.userLocation) {
        currentLng = state.userLocation.lng;
        currentLat = state.userLocation.lat;
    } else {
        const center = state.maps.location.getCenter();
        currentLng = center.lng;
        currentLat = center.lat;
    }

    // 调用高德地图API获取数据
    if (facilityFetchController) {
        facilityFetchController.abort();
    }
    facilityFetchController = new AbortController();
    const controller = facilityFetchController;

    async function fetchAndUpdateData() {
        try {
            // 获取筛选的设施类型
            const facilityTypes = type === 'all' 
                ? Object.keys(FACILITY_TYPES)
                : [type];

            let allResults = [];

            // 遍历每种类型获取数据
            for (const facilityType of facilityTypes) {
                const results = await fetchNearbyFacilities(currentLng, currentLat, facilityType, { signal: controller.signal });
                allResults = [...allResults, ...results];
            }

            // 如果获取到了数据，更新状态中的设施列表
            state.facilities = allResults;

            // 重新渲染设施列表
            renderFacilities();

            // 仅显示设备位置，不更新设施标记

            // 检查数据available性
            checkDataAvailability(type, state.facilities);
        } catch (error) {
            if (error.name === 'AbortError') {
                return;
            }
            console.error('Failed to fetch facility data:', error);
            renderFacilities();
        } finally {
            if (facilityFetchController === controller) {
                facilityFetchController = null;
            }
        }
    }

    fetchAndUpdateData();
}

function showFacilityOnMap(facilityId) {
    const facility = state.facilities.find(f => f.id === facilityId);
    if (!facility || !state.maps.location || !facility.location) return;

    const position = [facility.location.lng, facility.location.lat];

    // 移动地图到设施位置
    state.maps.location.setCenter(position);
    state.maps.location.setZoom(16);

    // 显示信息窗体
    const infoWindow = new AMap.InfoWindow({
        content: `<div style="padding: 10px; min-width: 200px;">
            <h4 style="margin: 0 0 8px 0; color: var(--text);">${facility.name}</h4>
            <p style="margin: 4px 0; color: var(--text-secondary); font-size: 14px;">
                <i class="fas fa-map-marker-alt"></i> ${facility.address}
            </p>
            <p style="margin: 4px 0; color: var(--text-secondary); font-size: 14px;">
                <i class="fas fa-route"></i> ${facility.distance} km
            </p>
            <button onclick="navigateToFacility(${facility.id})" style="margin-top: 8px; padding: 6px 12px; background: var(--primary); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                <i class="fas fa-directions"></i> Navigate
            </button>
        </div>`,
        offset: new AMap.Pixel(0, -30)
    });

    infoWindow.open(state.maps.location, position);

    showNotification(`Showing ${facility.name}`);
}


// 从高德地图API获取POI数据的函数
async function fetchNearbyFacilities(lng, lat, facilityType, options = {}) {
    const { signal } = options;
    try {
        // 显示全局加载状态
        showGlobalLoading(true);
        // 显示通知
        showNotification('Fetching nearby facilities data...', 'info');

        // 设置查询参数
        const facilityConfig = FACILITY_TYPES[facilityType];
        const params = new URLSearchParams({
            location: `${lng},${lat}`,
            keywords: facilityConfig?.keyword || '',
            types: facilityType !== 'all' ? (facilityConfig?.poiType || '') : '',
            radius: 2000,  // 查询半径2km
            offset: 20,    // 返回20条结果
            page: 1,
            key: getAmapKey()
        });

        // 设置Request timed out
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timed out')), 10000);
        });

        const apiUrl = `https://restapi.amap.com/v3/place/around?${params}`;
        const fetchPromise = fetch(apiUrl, { signal });

        // 竞争fetch和超时
        const response = await Promise.race([fetchPromise, timeoutPromise]);

        // 检查响应状态
        if (!response.ok) {
            const errorMsg = `API request failed: ${response.status}`;
            console.error(errorMsg);
            showNotification(errorMsg, 'error');
            return [];
        }

        const data = await response.json();

        // 检查API返回的状态码
        if (data.status !== '1') {
            const errorMsg = `API returned error: ${data.info || 'Unknown error'}`;
            console.error(errorMsg);
            showNotification(errorMsg, 'error');
            return [];
        }

        // 处理返回的POI数据
        const poiList = data.pois || [];

        // 检查是否有结果
        if (poiList.length === 0) {
            console.info(`No ${getTypeName(facilityType)} data found`);
            showNotification(`No nearby ${getTypeName(facilityType)} info`, 'info');
        }

        return processPOIData(poiList, lng, lat, facilityType);
    } catch (error) {
        console.error('Exception while fetching POI data:', error);

        // 根据Error类型显示不同的提示
        if (error.message === 'Request timed out') {
            showNotification('Network timeout, please check your network settings', 'error');
        } else if (error.message.includes('Network')) {
            showNotification('Network error, please check your network settings', 'error');
        } else {
            showNotification('Failed to fetch facility data, please try again later', 'error');
        }

        return [];
    } finally {
        // 隐藏全局加载状态
        showGlobalLoading(false);
    }
}

// 显示/隐藏全局加载状态
function showGlobalLoading(show) {
    let loadingElement = document.getElementById('global-loading');

    if (!loadingElement && show) {
        // 创建加载元素
        loadingElement = document.createElement('div');
        loadingElement.id = 'global-loading';
        loadingElement.className = 'global-loading-overlay';
        loadingElement.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading...</div>
        `;
        document.body.appendChild(loadingElement);

        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .global-loading-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.3);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                backdrop-filter: blur(2px);
            }
            .loading-spinner {
                width: 40px;
                height: 40px;
                border: 4px solid #f3f3f3;
                border-top: 4px solid #007aff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            .loading-text {
                margin-top: 10px;
                color: #333;
                font-size: 14px;
                background: white;
                padding: 5px 10px;
                border-radius: 4px;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }

    if (loadingElement) {
        loadingElement.style.display = show ? 'flex' : 'none';
    }
}

// 获取类型名称
function getTypeName(type) {
    return FACILITY_TYPES[type]?.name || type;
}

// 处理POI数据，转换为应用需要的格式
function processPOIData(poiList, userLng, userLat, facilityType) {
    try {
        const facilities = poiList.map((poi, index) => {
            // 安全地解析坐标
            let poiLng = 0, poiLat = 0;
            try {
                const [lng, lat] = poi.location.split(',').map(Number);
                poiLng = lng || 0;
                poiLat = lat || 0;
            } catch (e) {
                console.warn('Failed to parse coordinates:', poi.location);
            }

            // 计算距离
            let distance = 0;
            try {
                distance = calculateDistance(userLng, userLat, poiLng, poiLat);
            } catch (e) {
                console.warn('Failed to calculate distance:', e);
            }

            // 过滤非电动自行车Repair shop
            if (facilityType === 'repair') {
                const text = `${poi.name || ''} ${poi.address || ''} ${poi.type || ''} ${poi.typecode || ''}`.toLowerCase();
    const hasBike = /(electric bike|e-bike|ebike|bicycle|bike)/i.test(text);
    const isCarOnly = /(car|sedan|auto repair|auto shop|tire shop)/i.test(text);
                if (!hasBike || isCarOnly) {
                    return null;
                }
            }

            const facility = {
                id: Date.now() + index,
                name: poi.name || 'Unknown place',
                type: facilityType,
                distance: Math.round(distance / 100) / 10, // 保留一位小数
                address: poi.address || 'Unknown address',
                location: { lng: poiLng, lat: poiLat },
                rating: poi.rating ? parseFloat(poi.rating) : null,
                business_area: poi.business_area || '',
                tel: poi.tel || '',
                open: poi.biz_ext?.business_status === '1' ? true : (poi.biz_ext?.business_status === '3' ? false : null),
                businessHours: poi.biz_ext?.open_time || poi.opentime || ''
            };

            return facility;
        }).filter(Boolean);

        // 按距离排序
        return facilities.sort((a, b) => a.distance - b.distance);
    } catch (error) {
        console.error('Failed to process POI data:', error);
        showNotification('Processing failed, please try again later', 'error');
        return [];
    }
}

// 计算两点之间的距离（米）
function calculateDistance(lng1, lat1, lng2, lat2) {
    try {
        // 验证输入参数
        if (typeof lng1 !== 'number' || typeof lat1 !== 'number' || 
            typeof lng2 !== 'number' || typeof lat2 !== 'number') {
            throw new Error('Coordinate parameters must be numbers');
        }

        const R = 6371e3; // 地球半径（米）
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lng2 - lng1) * Math.PI) / 180;

        const a =
            Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    } catch (error) {
        console.error('Failed to calculate distance:', error);
        return 0;
    }
}

function navigateToFacility(facilityId) {
    const facility = state.facilities.find(f => f.id === facilityId);
    if (!facility) return;

    // 检查是否有位置信息和设施位置信息
    if (state.userLocation && facility.location) {
        // 使用高德地图Navigate
        const url = `https://uri.amap.com/navigation?from=${state.userLocation.lng},${state.userLocation.lat}&to=${facility.location.lng},${facility.location.lat}&mode=walk`;
        window.open(url, '_blank');
        showNotification(`Starting navigation to ${facility.name}`);
    } else {
        // 模拟Navigate
        showNotification(`Starting navigation to ${facility.name}`);
        setTimeout(() => {
            showNotification(`Arrived at ${facility.name}`, 'success');
        }, 3000);
    }
}

// 检查数据available性，显示开发中提示
function checkDataAvailability(type, facilities) {
    // 数据完全依赖高德返回，此处无需人工填充占位
}

// 图表
function initChart() {
    if (state.charts.ride) return;

    const canvas = document.getElementById('ride-chart');
    if (!canvas) return;

    if (typeof Chart === 'undefined') {
        console.warn('Chart.js is not available');
        const chartContainer = canvas.parentElement;
        if (chartContainer) {
            chartContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    <i class="fas fa-chart-bar" style="font-size: 40px; margin-bottom: 12px; opacity: 0.5;"></i>
                    <div style="font-size: 14px;">Chart loading...</div>
                </div>
            `;
        }
        return;
    }

    try {
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('Unable to get 2D context from canvas');
            return;
        }

        state.charts.ride = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Distance (km)',
                    data: [12, 19, 8, 15, 22, 18, 25],
                    backgroundColor: 'rgba(139, 92, 246, 0.7)',
                    hoverBackgroundColor: 'rgba(139, 92, 246, 0.9)',
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255,255,255,0.2)',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return context.parsed.y + ' km';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: 'var(--text-secondary)',
                            callback: function(value) {
                                return value + ' km';
                            }
                        },
                        grid: {
                            color: 'rgba(255,255,255,0.05)',
                            drawBorder: false
                        }
                    },
                    x: {
                        ticks: {
                            color: 'var(--text-secondary)'
                        },
                        grid: { display: false },
                        border: { display: false }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Chart initialization failed:', error);
        const chartContainer = canvas.parentElement;
        if (chartContainer) {
            chartContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    <i class="fas fa-exclamation-circle" style="font-size: 40px; margin-bottom: 12px; opacity: 0.5;"></i>
                    <div style="font-size: 14px;">Chart failed to load</div>
                </div>
            `;
        }
    }
}

function changeChartPeriod(period, button) {
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    button.classList.add('active');

    if (state.charts.ride) {
        let newData, newLabels;

        switch(period) {
            case 'week':
                newLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                newData = [12, 19, 8, 15, 22, 18, 25];
                break;
            case 'month':
                newLabels = ['Week 1', 'Week 2', 'Week 3', '4 weeks'];
                newData = [85, 92, 78, 95];
                break;
            case 'year':
                newLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                newData = [120, 135, 155, 180, 195, 210, 225, 240, 220, 200, 185, 170];
                break;
        }

        state.charts.ride.data.labels = newLabels;
        state.charts.ride.data.datasets[0].data = newData;
        state.charts.ride.update();
    }
}

// 更新电池和位置时间
function updateBattery() {
    const batteryElement = document.getElementById('bike-battery-percent');
    const normalized = clampBatteryLevel(state.batteryLevel);
    state.batteryLevel = normalized;
    if (batteryElement) batteryElement.textContent = `${normalized}%`;
}

function updateLocationTime() {
    const element = document.getElementById('last-updated');
    if (element) {
        const minutesAgo = Math.floor(Math.random() * 5) + 1;
        element.textContent = `Last updated: ${minutesAgo} minutes ago`;
    }
}

// 初始化优化的滑块 - 移动端性能优化
function initOptimizedSlider() {
    const slider = getUI('goal-slider');
    if (!slider) return;
    
    // Mobile: use step 5 for better performance, Desktop: step 1
    const isMobile = /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent);
    slider.setAttribute('step', isMobile ? '5' : '1');
    
    let lastUpdateTime = 0;
    const throttleDelay = isMobile ? 50 : 16; // 20fps on mobile, 60fps on desktop
    
    const markActive = () => { sliderIsActive = true; };
    const commitFromSlider = () => commitGoalTarget(slider.value);
    
    // Throttled input handler for better mobile performance
    slider.addEventListener('input', (e) => {
        const now = Date.now();
        if (now - lastUpdateTime >= throttleDelay) {
            lastUpdateTime = now;
            previewGoalTarget(e.target.value);
        }
    }, { passive: true });
    
    // Commit on release/change
    slider.addEventListener('change', (e) => {
        commitGoalTarget(e.target.value);
    }, { passive: true });
    
    // Pointer/mouse/touch support with passive listeners
    slider.addEventListener('pointerdown', markActive, { passive: true });
    slider.addEventListener('pointerup', () => {
        sliderIsActive = false;
        commitFromSlider();
    }, { passive: true });
    
    // Touch optimization for iOS
    slider.addEventListener('touchstart', markActive, { passive: true });
    slider.addEventListener('touchend', () => {
        sliderIsActive = false;
        commitFromSlider();
    }, { passive: true });
    slider.addEventListener('touchstart', markActive, { passive: true });
    slider.addEventListener('touchend', () => {
        sliderIsActive = false;
        commitFromSlider();
    }, { passive: true });
    slider.addEventListener('mouseup', () => {
        sliderIsActive = false;
        commitFromSlider();
    }, { passive: true });
    
    console.log('✅ Slider component initialized with optimizations');
}

 

// Load user data from localStorage and sync to UI
function loadUserData() {
    try {
        const stored = localStorage.getItem('bikemate-userdata');
        if (stored) {
            const data = JSON.parse(stored);
            // Merge with existing data (keep defaults for missing fields)
            state.userData = { ...state.userData, ...data };
            if ('email' in state.userData) {
                delete state.userData.email;
            }
        }
    } catch (e) {
        console.warn('Failed to load user data from localStorage:', e);
    }

    if (state.userData.phone) {
        const sanitizedPhone = sanitizeCnPhone(state.userData.phone);
        state.userData.phone = sanitizedPhone.length === 11 && sanitizedPhone[0] === '1' ? sanitizedPhone : '';
    }

    try {
        localStorage.setItem('bikemate-userdata', JSON.stringify(state.userData));
    } catch (e) {
        console.warn('Failed to persist sanitized user data:', e);
    }
    
    // Sync to UI
    syncUserDataToUI();
}

// Sync user data from state to UI elements
function syncUserDataToUI() {
    const fields = ['name', 'phone', 'age', 'gender', 'height', 'weight'];
    fields.forEach(field => {
        const element = document.getElementById(`user-${field}-field`);
        if (element) {
            element.textContent = state.userData[field] || '--';
        }
    });
    
    // Also update the display name and phone in profile header
    const displayName = document.getElementById('display-name');
    if (displayName) {
        displayName.textContent = state.userData.name || '—';
    }

    const displayPhone = document.getElementById('display-phone');
    if (displayPhone) {
        displayPhone.textContent = state.userData.phone || '—';
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('Page loaded, starting initialization...');
    initLowMotionFromSettings();
    startPerfMonitor();
    refreshUIRefs();

    // Load user data from localStorage
    loadUserData();

    // 自动恢复已存在的登录会话
    const storedToken = localStorage.getItem('bikemate-token');
    if (storedToken) {
        state.authToken = storedToken;
        state.isLoggedIn = true;
    }

    // 监听APILoad complete事件
    window.addEventListener('amap-ready', function() {
        console.log('AMap API loaded');
        state.apiLoaded = true;
        updateApiStatus('success', 'AMap API loaded successfully!', 'success');

        // 隐藏状态提示
        setTimeout(() => {
            const statusEl = document.getElementById('api-status');
            if (statusEl) {
                statusEl.style.display = 'none';
            }
        }, 3000);

        // 如果当前在地图页面，初始化地图
        const recordPage = document.getElementById('record-page');
        if (recordPage && recordPage.classList.contains('active')) {
            setTimeout(() => initRecordMap(), 500);
        }
    });

    // 初始化页面
    navigateTo(state.isLoggedIn ? 'record-page' : 'login-page');
    updateRideMetrics();
    updateBattery();
    updateBikeLockButton();
    updateTrackingBadges();
    updateSOSButton();
    updateQuickActionUI();
    updateGoalUI();
    renderMissions();
    refreshWeatherForecast();
    initChart();
    
    // 初始化优化的滑块事件监听器
    initOptimizedSlider();

    

    // 允许点击车辆渲染直接解锁/锁定
    const bikeRender = document.querySelector('.bike-render');
    if (bikeRender) {
        bikeRender.addEventListener('click', () => {
            toggleBikeLock();
        });
    }

    // 定时更新
    startAmbientUpdates();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 绑定回车键登录
    const passwordInput = document.getElementById('password');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    }
});

// 确保所有函数和代码块正确闭合

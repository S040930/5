(function () {
    if (!window.__AMAP_KEY__) {
        window.__AMAP_KEY__ = '08fdc5ee94bf41d5987973b88a444293';
    }
    const resolveApiBase = () => {
        if (typeof window === 'undefined') return '';
        if (window.API_BASE) return window.API_BASE;
        const custom = (window.__API_BASE_URL__ || '').trim();
        if (custom) return custom.replace(/\/$/, '');
        const { protocol, hostname, port } = window.location;
        const isLocal = ['localhost', '127.0.0.1', '::1'].includes(hostname);
        // For local development, serve via http.server or similar (not file://)
        if (isLocal) {
            const targetPort = '8080';
            const finalPort = port && port !== targetPort ? targetPort : port;
            const portSegment = finalPort ? `:${finalPort}` : '';
            return `${protocol}//${hostname}${portSegment}`;
        }
        return window.location.origin;
    };
    const API_BASE = resolveApiBase();
    window.API_BASE = API_BASE;
    const AMAP_KEY_CACHE = 'amap-key-cache';
    const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours
    let amapLoadPromise = null;
    let amapLoadResolver = null;

    const setStatus = (message) => {
        const statusEl = document.getElementById('map-status');
        if (statusEl) {
            statusEl.textContent = message;
        }
    };

    const getCachedKey = () => {
        try {
            const cached = localStorage.getItem(AMAP_KEY_CACHE);
            if (!cached) return '';
            const parsed = JSON.parse(cached);
            if (parsed?.key && parsed?.ts && Date.now() - parsed.ts < CACHE_TTL) {
                return parsed.key;
            }
        } catch (err) {
            console.warn('Failed to read cached AMap key', err);
        }
        return '';
    };

    const cacheKey = (key) => {
        if (!key) return;
        try {
            localStorage.setItem(AMAP_KEY_CACHE, JSON.stringify({ key, ts: Date.now() }));
        } catch (err) {
            console.warn('Failed to cache AMap key', err);
        }
    };

    const resolveAmapKey = () => {
        const cached = getCachedKey();
        if (cached) return Promise.resolve(cached);

        if (window.__AMAP_KEY__) {
            cacheKey(window.__AMAP_KEY__);
            return Promise.resolve(window.__AMAP_KEY__);
        }
        return fetch(`${API_BASE}/api/config`)
            .then(res => res.ok ? res.json() : Promise.reject(new Error('Invalid config response')))
            .then(cfg => {
                if (cfg && cfg.amapKey) {
                    cacheKey(cfg.amapKey);
                    return cfg.amapKey;
                }
                return '';
            })
            .catch(err => {
                console.error('Failed to fetch AMap key', err);
                return '';
            });
    };

    const injectScript = (key) => {
        if (!key) {
            console.error('AMap key not provided, cannot load map');
            setStatus('API key missing, cannot load map');
            return Promise.reject(new Error('Missing AMap key'));
        }
        if (window.AMap) {
            return Promise.resolve(true);
        }
        const existingScript = document.querySelector('script[data-amap-sdk]');
        if (existingScript) {
            return amapLoadPromise || Promise.resolve(true);
        }

        if (window.performanceMonitor) {
            window.performanceMonitor.start('Map API load');
        }

        amapLoadPromise = new Promise((resolve, reject) => {
            amapLoadResolver = resolve;
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.dataset.amapSdk = 'true';
            script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}&plugin=AMap.Scale,AMap.ToolBar,AMap.Marker,AMap.InfoWindow,AMap.Polyline,AMap.Icon&callback=initAMap`;
            script.defer = true;
            script.onerror = function () {
                console.error('AMap API failed to load');
                setStatus('API load failed');
                amapLoadPromise = null;
                reject(new Error('Map API load failed'));
            };
            document.head.appendChild(script);
        });

        return amapLoadPromise;
    };

    // 动态加载高德地图API
    window.loadAmapApi = function () {
        // Check if we're on a mobile device or have network restrictions
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isGitHubPages = window.location.hostname.endsWith('github.io');

        // If page is not a secure context, skip the map to avoid insecure resource loads/blocked geolocation
        const isSecureContext = (typeof window !== 'undefined') && (window.isSecureContext || window.location.protocol === 'https:');
        if (!isSecureContext) {
            console.warn('Skipping map load: insecure context (non-HTTPS). Map and location features require HTTPS.');
            return Promise.resolve(false);
        }

        // Allow map loading on mobile GitHub Pages if in secure context
        // Note: Map loading might be slower on mobile, but users can still access the feature
        if (isMobile && isGitHubPages) {
            console.log('Mobile device on GitHub Pages: map loading enabled in secure context');
        }

        if (window.AMap) {
            if (window.state) {
                window.state.apiLoaded = true;
            }
            return Promise.resolve(true);
        }
        if (amapLoadPromise) return amapLoadPromise;

        // Add timeout for mobile devices
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Map API load timeout on mobile')), isMobile ? 10000 : 15000);
        });

        const loadPromise = resolveAmapKey().then(injectScript);

        return Promise.race([loadPromise, timeoutPromise]).catch(err => {
            console.warn('AMap API failed to load, continuing without map:', err.message);
            return false;
        });
    };

    window.initAMap = function () {
        console.log('AMap API loaded successfully');

        if (window.performanceMonitor) {
            window.performanceMonitor.end('Map API load');
        }

        if (window.state) {
            window.state.apiLoaded = true;
        }

        // Load AMap UI library after core API is ready
        const uiScript = document.createElement('script');
        uiScript.src = 'https://webapi.amap.com/ui/1.1/main.js';
        uiScript.crossOrigin = 'anonymous';
        uiScript.referrerPolicy = 'no-referrer';
        uiScript.onload = function() {
            console.log('AMap UI loaded');
        };
        uiScript.onerror = function() {
            console.warn('AMap UI failed to load (optional)');
        };
        document.head.appendChild(uiScript);

        window.dispatchEvent(new Event('amap-ready'));
        if (amapLoadResolver) {
            amapLoadResolver(true);
            amapLoadPromise = Promise.resolve(true);
        }
    };
})();

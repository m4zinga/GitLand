/**
 * GitLand content script.
 *
 * Resolves the customization for the current GitHub page and applies it:
 *  - a background image (plus an optional overlay color) painted behind the page;
 *  - a set of CSS custom properties (Primer variables) that recolor GitHub's UI.
 *
 * The configuration lives in a repository called `background_profile` owned either by the
 * visited account ("internet") or by the logged-in account ("personal"). Because the requests
 * are made from github.com with the user's session, a *private* `background_profile` repository
 * is readable only by its owner: that is what makes the "personal" mode private.
 *
 * Runs at document_start so cached customizations are applied before GitHub paints,
 * and re-resolves on GitHub's client-side (Turbo / React) navigations.
 */
(() => {
    'use strict';

    const CONFIG_REPO = 'background_profile';
    const CONFIG_FILE = 'github_customization.json';
    const DEFAULT_PRIORITIES = ['internet', 'personal'];

    const CACHE_KEY = 'gitlandCache';
    const LOGIN_KEY = 'gitlandLastLogin';
    const CACHE_TTL = 10 * 60 * 1000;          // reuse a fetched JSON for 10 minutes...
    const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // ...and drop entries older than a day.

    // Hosts GitHub's Content-Security-Policy lets the page load images from (img-src).
    const CSP_IMAGE_HOST = /(^|\.)(github\.com|githubusercontent\.com|githubassets\.com|googleusercontent\.com)$/i;
    // JSON configs are only fetched from GitHub, so visiting a profile never pings third-party servers.
    const JSON_HOST = /^(github\.com|raw\.githubusercontent\.com|gist\.githubusercontent\.com)$/i;

    // First path segments that are GitHub routes, not accounts (GitHub reserves these names).
    const RESERVED_ROUTES = new Set([
        'about', 'account', 'apps', 'codespaces', 'collections', 'contact', 'copilot', 'customer-stories',
        'dashboard', 'enterprise', 'events', 'explore', 'features', 'github-copilot', 'issues', 'login',
        'logout', 'marketplace', 'new', 'notifications', 'organizations', 'orgs', 'pricing', 'pulls',
        'readme', 'search', 'security', 'sessions', 'settings', 'signup', 'site', 'sponsors', 'stars',
        'team', 'topics', 'trending', 'users', 'watching'
    ]);

    const VAR_NAME = /^--[A-Za-z0-9_-]{1,100}$/;
    const root = document.documentElement;

    const state = {
        runId: 0,
        path: null,
        scope: null,          // "internet" | "personal" | null
        configOwner: null,
        imageUrl: null,       // URL as written in the configuration
        imageCss: null,       // url(...) actually painted (may be a blob: URL)
        blobUrl: null,
        colors: {},           // colors coming from the configuration
        overrides: {},        // live edits made from the popup
        warnings: []
    };

    /* ------------------------------------------------------------------ storage */

    const storageGet = (keys) => new Promise((resolve) => {
        chrome.storage.local.get(keys, (result) => resolve(chrome.runtime.lastError ? {} : result));
    });
    const storageSet = (obj) => new Promise((resolve) => chrome.storage.local.set(obj, () => resolve()));

    let cachePromise = null;
    let cacheDirty = false;
    function loadCache() {
        if (!cachePromise) {
            cachePromise = storageGet(CACHE_KEY).then((r) => {
                const cache = r[CACHE_KEY] || {};
                const now = Date.now();
                for (const [k, v] of Object.entries(cache)) {
                    if (!v || now - v.t > CACHE_MAX_AGE) delete cache[k];
                }
                return cache;
            });
        }
        return cachePromise;
    }
    async function persistCache() {
        if (!cacheDirty) return;
        cacheDirty = false;
        await storageSet({ [CACHE_KEY]: await loadCache() });
    }

    /* -------------------------------------------------------------- networking */

    const inflight = new Map();

    function isAllowedJsonUrl(url) {
        try {
            const u = new URL(url);
            return u.protocol === 'https:' && JSON_HOST.test(u.hostname);
        } catch {
            return false;
        }
    }

    async function fetchJsonFresh(url) {
        if (!inflight.has(url)) {
            const p = (async () => {
                try {
                    const res = await fetch(url, { credentials: 'same-origin' });
                    if (!res.ok) return null; // 404 = no configuration: cached as a negative result
                    const data = await res.json();
                    return data && typeof data === 'object' ? data : null;
                } catch (err) {
                    console.debug('[GitLand] could not load', url, err);
                    return undefined; // network/parse error: not cached
                }
            })();
            inflight.set(url, p);
            p.finally(() => inflight.delete(url));
        }
        return inflight.get(url);
    }

    /**
     * Returns the JSON at `url`, using the local cache (stale-while-revalidate).
     * `onRevalidated` is called if a stale cached value turned out to be outdated.
     */
    async function getJson(url, warnings, onRevalidated) {
        if (!isAllowedJsonUrl(url)) {
            warnings.push(`Ignored non-GitHub URL: ${url}`);
            return null;
        }
        const cache = await loadCache();
        // github.com answers depend on the session (private repos), so the login is part of the key.
        const key = `${loggedInUser || ''}|${url}`;
        const hit = cache[key];
        const store = (data) => {
            cache[key] = { t: Date.now(), d: data };
            cacheDirty = true;
        };

        if (hit) {
            if (Date.now() - hit.t > CACHE_TTL) {
                fetchJsonFresh(url).then((data) => {
                    if (data === undefined) return;
                    const changed = JSON.stringify(data) !== JSON.stringify(hit.d);
                    store(data);
                    persistCache();
                    if (changed && onRevalidated) onRevalidated();
                });
            }
            return hit.d;
        }

        const data = await fetchJsonFresh(url);
        if (data !== undefined) store(data);
        return data ?? null;
    }

    /* ------------------------------------------------------------ page context */

    function getPathInfo() {
        const parts = location.pathname.split('/').filter(Boolean);
        const first = parts[0] || '';
        if (!first || RESERVED_ROUTES.has(first.toLowerCase()) || first.includes('.')) {
            return { owner: null, repo: null };
        }
        return { owner: first, repo: parts[1] || null };
    }

    function readMeta(selector) {
        const el = document.querySelector(selector);
        return el && el.content ? el.content.trim() : null;
    }

    let loggedInUser = null; // from <meta name="user-login">, cached for document_start

    /* --------------------------------------------------------------- resolving */

    const configUrl = (user) =>
        `https://github.com/${encodeURIComponent(user)}/${CONFIG_REPO}/raw/HEAD/${CONFIG_FILE}`;

    /** Picks the entry (profile or repository) of a configuration matching the current page. */
    function pickEntry(config, configOwner, page) {
        const repos = config.repo && typeof config.repo === 'object' ? config.repo : {};
        if (page.owner && page.repo) {
            const owner = page.owner.toLowerCase();
            const repo = page.repo.toLowerCase();
            for (const [key, entry] of Object.entries(repos)) {
                const k = key.toLowerCase();
                // "repo" targets a repository of the configuration owner, "owner/repo" any repository.
                const matches = k.includes('/')
                    ? k === `${owner}/${repo}`
                    : k === repo && owner === configOwner.toLowerCase();
                if (matches && entry && typeof entry === 'object') return entry;
            }
        }
        return config.profile && typeof config.profile === 'object' ? config.profile : null;
    }

    async function getPriorities() {
        const { priorities } = await storageGet('priorities');
        return Array.isArray(priorities) ? priorities : DEFAULT_PRIORITIES;
    }

    async function resolve({ force = false } = {}) {
        const page = getPathInfo();
        const path = location.pathname;
        if (!force && path === state.path) return;
        state.path = path;
        const runId = ++state.runId;
        const isCurrent = () => runId === state.runId;
        const revalidate = () => { if (isCurrent()) resolve({ force: true }); };
        const warnings = [];

        const candidates = { internet: page.owner, personal: loggedInUser };
        let found = null;
        for (const scope of await getPriorities()) {
            const user = candidates[scope];
            if (!user) continue;
            const config = await getJson(configUrl(user), warnings, revalidate);
            if (!isCurrent()) return;
            if (config) {
                found = { scope, user, entry: pickEntry(config, user, page) };
                break;
            }
        }

        let colors = {};
        let imageUrl = null;
        if (found && found.entry) {
            imageUrl = typeof found.entry.background_image === 'string' ? found.entry.background_image : null;
            if (typeof found.entry.style === 'string' && found.entry.style) {
                const style = await getJson(found.entry.style, warnings, revalidate);
                if (!isCurrent()) return;
                colors = sanitizeColors(style && style.color, warnings);
            }
        }

        await setBackground(imageUrl, warnings, isCurrent);
        if (!isCurrent()) return;
        state.scope = found ? found.scope : null;
        state.configOwner = found ? found.user : null;
        state.colors = colors;
        state.warnings = warnings;
        render();
        persistCache();
    }

    /**
     * GitHub renamed the contribution graph variables: "--color-calendar[-theme]-graph-day-L1-bg"
     * is now "--contribution-<theme>-bgColor-1". Older style files keep working through this alias.
     */
    function modernName(key) {
        const m = key.match(/^--color-calendar-(?:(halloween|winter)-)?graph-day-L([0-4])-bg$/);
        return m ? `--contribution-${m[1] || 'default'}-bgColor-${m[2]}` : key;
    }

    function sanitizeColors(input, warnings) {
        const out = {};
        if (!input || typeof input !== 'object') return out;
        for (const [rawKey, value] of Object.entries(input)) {
            const key = modernName(rawKey);
            if (VAR_NAME.test(key) && typeof value === 'string' && value.length < 120 && CSS.supports('color', value)) {
                if (key === rawKey || !(key in input)) out[key] = value.trim();
            } else if (value !== '') {
                warnings.push(`Ignored invalid entry ${key}: ${value}`);
            }
        }
        return out;
    }

    /* -------------------------------------------------------------- background */

    const cssUrl = (url) => `url("${url.replace(/["\\\n\r]/g, (c) => encodeURIComponent(c))}")`;

    async function setBackground(url, warnings, isCurrent) {
        if (url === state.imageUrl) return;

        let painted = null;
        let blobUrl = null;
        if (url) {
            let parsed = null;
            try { parsed = new URL(url, location.href); } catch { /* invalid */ }
            if (!parsed || !/^(https:|data:)$/.test(parsed.protocol)) {
                warnings.push(`Invalid background image URL: ${url}`);
            } else if (parsed.protocol === 'data:' || CSP_IMAGE_HOST.test(parsed.hostname)) {
                painted = cssUrl(parsed.href);
            } else {
                // GitHub's CSP blocks images from other hosts: load the bytes ourselves and paint
                // them through a blob: URL (allowed by the CSP). Needs the host to send CORS headers.
                try {
                    const res = await fetch(parsed.href, { credentials: 'omit' });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    blobUrl = URL.createObjectURL(await res.blob());
                    painted = cssUrl(blobUrl);
                } catch {
                    warnings.push(`GitHub blocks images from ${parsed.hostname} and it does not allow CORS: host the image in your ${CONFIG_REPO} repository.`);
                }
            }
        }
        if (!isCurrent()) {
            if (blobUrl) URL.revokeObjectURL(blobUrl);
            return;
        }
        if (state.blobUrl) URL.revokeObjectURL(state.blobUrl);
        state.blobUrl = blobUrl;
        state.imageUrl = url;
        state.imageCss = painted;
    }

    /* ------------------------------------------------------------------ render */

    let styleEl = null;

    function effectiveColors() {
        return { ...state.colors, ...state.overrides };
    }

    /**
     * Writes every customization into a single <style> element (one style recalculation per
     * update). It is attached to <html>, outside <head>/<body>, so Turbo navigations keep it.
     */
    function render() {
        const colors = effectiveColors();
        const active = Boolean(state.imageCss) || Object.keys(colors).length > 0;

        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'gitland-style';
        }
        const decls = Object.entries(colors).map(([k, v]) => `  ${k}: ${v} !important;`);
        if (state.imageCss) decls.push(`  --gitland-bg-image: ${state.imageCss};`);
        const css = active ? `html.gitland-active {\n${decls.join('\n')}\n}` : '';
        if (styleEl.textContent !== css) styleEl.textContent = css;
        if (!styleEl.isConnected) root.appendChild(styleEl);

        root.classList.toggle('gitland-active', active);
        root.classList.toggle('gitland-has-image', Boolean(state.imageCss));
        root.classList.toggle('gitland-has-header', '--bgColor-header' in colors);
    }

    /* -------------------------------------------------------- popup messaging */

    function computedColors(keys) {
        const cs = getComputedStyle(root);
        const out = {};
        for (const key of keys) {
            if (VAR_NAME.test(key)) out[key] = cs.getPropertyValue(key).trim();
        }
        return out;
    }

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (!message || typeof message !== 'object') return;
        switch (message.type) {
            case 'gitland:getState':
                sendResponse({
                    scope: state.scope,
                    configOwner: state.configOwner,
                    loggedInUser,
                    pageOwner: getPathInfo().owner,
                    imageUrl: state.imageUrl,
                    colors: effectiveColors(),
                    configColors: state.colors,
                    overrides: state.overrides,
                    computed: computedColors(message.keys || []),
                    warnings: state.warnings
                });
                break;
            case 'gitland:setColor':
                if (VAR_NAME.test(message.key) && CSS.supports('color', message.value)) {
                    state.overrides[message.key] = message.value;
                    render();
                }
                break;
            case 'gitland:resetOverrides':
                state.overrides = {};
                render();
                sendResponse(true);
                break;
            case 'gitland:reload':
                // Drop the cache so edits pushed to the configuration repository show up immediately.
                loadCache().then(async (cache) => {
                    for (const k of Object.keys(cache)) delete cache[k];
                    cacheDirty = true;
                    await persistCache();
                    state.imageUrl = undefined;
                    await resolve({ force: true });
                    sendResponse(true);
                });
                return true; // async response
        }
    });

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.priorities) resolve({ force: true });
    });

    /* ---------------------------------------------------------------- startup */

    // 1) document_start: use the last known login and the cache to paint immediately.
    let loginFromPage = false;
    storageGet(LOGIN_KEY).then((r) => {
        if (!loginFromPage) loggedInUser = r[LOGIN_KEY] || null;
        resolve();
    });

    // 2) once <head> is parsed, read the real login; re-resolve if it changed.
    function onDomReady() {
        loginFromPage = true;
        const login = readMeta('meta[name="user-login"]') || null;
        if (login !== loggedInUser) {
            loggedInUser = login;
            storageSet({ [LOGIN_KEY]: login });
            resolve({ force: true });
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onDomReady, { once: true });
    } else {
        onDomReady();
    }

    // 3) GitHub navigates without reloading (Turbo + React): follow URL changes.
    const onNavigate = () => resolve();
    document.addEventListener('turbo:load', onNavigate);
    window.addEventListener('popstate', onNavigate);
    if (window.navigation && typeof window.navigation.addEventListener === 'function') {
        window.navigation.addEventListener('navigatesuccess', onNavigate);
    }
})();

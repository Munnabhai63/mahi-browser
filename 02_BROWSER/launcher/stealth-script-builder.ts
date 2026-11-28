import { getApiAuthToken } from '../../08_SECURITY/install-secrets.js';
import type { StealthScriptContext } from './launcher-shared.js';
import { buildStealthEnvDeviceSection } from './stealth-env-device-script.js';
import { buildStealthIframeRealmSection } from './stealth-iframe-realm-script.js';
import { buildStealthNavigatorTzSection } from './stealth-navigator-tz-script.js';
import { buildStealthWorkerUaHintsSection } from './stealth-worker-uahints-script.js';
import { buildStealthCanvasWebglSection } from './stealth-canvas-webgl-script.js';
import { buildStealthMediaWebrtcSection } from './stealth-media-webrtc-script.js';

export function buildStealthCoreScript(ctx: StealthScriptContext): string {
  return [
    buildStealthEnvDeviceSection(ctx),
    buildStealthIframeRealmSection(ctx),
    buildStealthNavigatorTzSection(ctx),
    buildStealthWorkerUaHintsSection(ctx),
    buildStealthCanvasWebglSection(ctx),
    buildStealthMediaWebrtcSection(ctx),
  ].join('');
}

export function buildBackgroundWorkerScript(ctx: StealthScriptContext): string {
  const { profileId, badgeNumber, profileName } = ctx;
  return `
(function() {
  var profileId = ${JSON.stringify(profileId)};
  var pNum = ${JSON.stringify(badgeNumber)};
  var pName = ${JSON.stringify(profileName)};
  var API_BASE = 'http://127.0.0.1:32123';
  var AUTH_TOKEN = ${JSON.stringify(getApiAuthToken())};
  var activePorts = new Set();

  chrome.runtime.onConnect.addListener(function(port) {
    if (port.name === 'mahi_sync_port') {
      activePorts.add(port);
      port.onMessage.addListener(function(msg) {
        if (msg && msg.type === 'BROADCAST_SYNC_ACTION') {
          fetch(API_BASE + '/sync/broadcast?token=' + AUTH_TOKEN, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + AUTH_TOKEN
            },
            body: JSON.stringify({
              sourceProfileId: profileId,
              action: msg.action
            })
          }).catch(function() { void 0; /* page-context stealth isolation */ });
        }
      });

      port.onDisconnect.addListener(function() {
        activePorts.delete(port);
      });
    }
  });

  chrome.runtime.onMessage.addListener(function(msg) {
    if (msg && msg.type === 'QUICK_SWITCH' && msg.number) {
      fetch(API_BASE + '/profiles/quick-switch?token=' + encodeURIComponent(AUTH_TOKEN), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + AUTH_TOKEN
        },
        body: JSON.stringify({ number: msg.number })
      }).catch(function() { void 0; /* page-context stealth isolation */ });
    }
  });

  function connectSSE() {
    try {
      var url = API_BASE + '/sync/events?profileId=' + encodeURIComponent(profileId) + '&token=' + AUTH_TOKEN;
      fetch(url).then(function(response) {
        if (!response.body) return;
        var reader = response.body.getReader();
        var decoder = new TextDecoder();
        var buffer = '';

        function readChunk() {
          reader.read().then(function(result) {
            if (result.done) {
              setTimeout(connectSSE, 1500);
              return;
            }
            buffer += decoder.decode(result.value, { stream: true });
            var parts = buffer.split('\\n\\n');
            buffer = parts.pop();

            for (var i = 0; i < parts.length; i++) {
              var line = parts[i].trim();
              if (line.startsWith('data:')) {
                var jsonStr = line.slice(5).trim();
                try {
                  var action = JSON.parse(jsonStr);
                  if (action && action.type === 'START_WARMUP' && action.payload && Array.isArray(action.payload.sites)) {
                    if (!action.payload.profileId || action.payload.profileId === profileId) {
                      startWarmerSequence(action.payload.sites);
                    }
                  } else if (action && action.type && action.type !== 'CONNECTED') {
                    // Forward to all active connected ports
                    activePorts.forEach(function(p) {
                      try { p.postMessage(action); } catch(e) { activePorts.delete(p); }
                    });
                    // Fallback to tabs message
                    chrome.tabs.query({}, function(tabs) {
                      if (tabs) {
                        for (var j = 0; j < tabs.length; j++) {
                          if (tabs[j].id) {
                            chrome.tabs.sendMessage(tabs[j].id, action).catch(function() { void 0; /* page-context stealth isolation */ });
                          }
                        }
                      }
                    });
                  }
                } catch(err) { void 0; /* page-context stealth isolation */ }
              }
            }
            readChunk();
          }).catch(function() {
            setTimeout(connectSSE, 1500);
          });
        }
        readChunk();
      }).catch(function() {
        setTimeout(connectSSE, 2500);
      });
    } catch(e) {
      setTimeout(connectSSE, 2500);
    }
  }

  // Automated Profile Warmer / Cookie Farmer
  function checkWarmerQueue() {
    fetch(API_BASE + '/profiles/' + encodeURIComponent(profileId) + '/warmer-queue?token=' + AUTH_TOKEN)
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d && d.success && Array.isArray(d.sites) && d.sites.length > 0) {
          startWarmerSequence(d.sites);
        }
      }).catch(function() { void 0; /* page-context stealth isolation */ });
  }

  function startWarmerSequence(sites) {
    if (!sites || sites.length === 0) return;
    var idx = 0;

    function navigateNext() {
      if (idx >= sites.length) return;
      var targetUrl = sites[idx];
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        var tabId = (tabs && tabs[0]) ? tabs[0].id : null;
        if (!tabId) {
          chrome.tabs.query({}, function(allTabs) {
            if (allTabs && allTabs[0]) {
              chrome.tabs.update(allTabs[0].id, { url: targetUrl });
            }
          });
        } else {
          chrome.tabs.update(tabId, { url: targetUrl });
        }
        idx++;
        if (idx < sites.length) {
          setTimeout(navigateNext, 3800);
        }
      });
    }

    setTimeout(navigateNext, 500);
  }

  connectSSE();
  setTimeout(checkWarmerQueue, 1500);
  setTimeout(checkWarmerQueue, 3500);

  try {
    if (chrome.action) {
      chrome.action.setBadgeText({ text: '#' + pNum });
      chrome.action.setBadgeBackgroundColor({ color: '#0284c7' });
      chrome.action.setTitle({ title: '#' + pNum + ' - ' + pName });
    }
  } catch(e) { void 0; /* page-context stealth isolation */ }
})();
`;
}

export function buildContentScript(ctx: StealthScriptContext): string {
  const { profileId, profileName, badgeNumber, showProfileBadge } = ctx;
  return `
(function() {
  var pId = ${JSON.stringify(profileId)};
  var pName = ${JSON.stringify(profileName)};
  var pNum = ${JSON.stringify(badgeNumber)};
  var brandedLabel = '[#' + pNum + ' ' + pName + ']';

  var colorPalette = [
    'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
    'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
    'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
  ];
  var profileColor = colorPalette[(Math.max(1, parseInt(pNum, 10)) - 1) % colorPalette.length] || colorPalette[0];

  // Stealth script is already registered in manifest content_scripts world: MAIN at document_start

  function updateTitle() {
    try {
      var prefix = brandedLabel + ' ';
      if (document.title && !document.title.startsWith(prefix)) {
        var cleanTitle = document.title
          .replace(/^\\[#\\d+\\s+[^\\s\\]]+\\]\\s*/, '')
          .replace(/^M\\d+\\s+—\\s+MAHI SKILLS\\s*-\\s*/, '');
        document.title = prefix + cleanTitle;
      }
    } catch(e) { void 0; /* page-context stealth isolation */ }
  }

  // In clean production mode, suppress the in-page badge and title prefix unless explicitly enabled in settings.
  var enableInPageBadge = ${JSON.stringify(showProfileBadge)};
  if (enableInPageBadge) {
    try {
      updateTitle();
      var observer = new MutationObserver(updateTitle);
      observer.observe(document.querySelector('head') || document.documentElement, {
        subtree: true,
        characterData: true,
        childList: true
      });
    } catch(e) { void 0; /* page-context stealth isolation */ }
    window.addEventListener('load', injectTopBarPill);
    setTimeout(injectTopBarPill, 400);
    setTimeout(injectTopBarPill, 1200);
    setInterval(injectTopBarPill, 800);
  }


  // Quick Profile Switch / Launch (Space + Number, Shift + Number, or Number + Space)

  var digitBuffer = '';
  var bufferTimer = null;
  var isSpaceDown = false;

  window.addEventListener('keydown', function(e) {
    try {
      var activeEl = document.activeElement;
      var tag = activeEl ? (activeEl.tagName || '').toUpperCase() : '';
      var isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (activeEl && activeEl.isContentEditable);
      if (isInput) {
        digitBuffer = '';
        return;
      }

      if (e.key === ' ' || e.code === 'Space') {
        isSpaceDown = true;
      }

      var digitMatch = (e.code && e.code.match(/^Digit([0-9])$/)) || (e.code && e.code.match(/^Numpad([0-9])$/));
      if (digitMatch && (isSpaceDown || e.shiftKey)) {
        e.preventDefault();
        var quickNum = parseInt(digitMatch[1], 10);
        if (quickNum > 0) {
          digitBuffer = '';
          chrome.runtime.sendMessage({ type: 'QUICK_SWITCH', number: quickNum }).catch(function() { void 0; /* page-context stealth isolation */ });
          return;
        }
      }

      if (e.key >= '0' && e.key <= '9') {
        digitBuffer += e.key;
        clearTimeout(bufferTimer);
        bufferTimer = setTimeout(function() { digitBuffer = ''; }, 1200);
        return;
      }

      if ((e.key === ' ' || e.code === 'Space') && digitBuffer.length > 0) {
        e.preventDefault();
        var num = parseInt(digitBuffer, 10);
        digitBuffer = '';
        clearTimeout(bufferTimer);
        if (!isNaN(num) && num > 0) {
          chrome.runtime.sendMessage({ type: 'QUICK_SWITCH', number: num }).catch(function() { void 0; /* page-context stealth isolation */ });
        }
        return;
      }

      digitBuffer = '';
    } catch(err) { void 0; /* page-context stealth isolation */ }
  }, true);

  window.addEventListener('keyup', function(e) {
    if (e.key === ' ' || e.code === 'Space') {
      isSpaceDown = false;
    }
  }, true);

  // -------------------------------------------------------------
  // 4. Multi-Window Real-Time Action Synchronizer Engine
  // -------------------------------------------------------------
  var isHandlingRemoteAction = false;

  function showClickRipple(x, y) {
    // Zero DOM footprint to prevent anti-bot MutationObserver detection on external target pages
  }

  function handleReplicatedAction(action) {
    if (!action || !action.type) return;
    isHandlingRemoteAction = true;

    try {
      if (action.type === 'CLICK' && action.payload) {
        var cx = action.payload.xRatio * (window.innerWidth || 1920);
        var cy = action.payload.yRatio * (window.innerHeight || 1080);
        showClickRipple(cx, cy);

        var el = document.elementFromPoint(cx, cy);
        if (el) {
          var target = el.closest('a, button, input, select, textarea, [role="button"], label') || el;
          try { target.focus(); } catch(e) { void 0; /* page-context stealth isolation */ }

          var pDown = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: action.payload.button || 0, view: window });
          var mDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: action.payload.button || 0, view: window });
          var pUp = new MouseEvent('pointerup', { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: action.payload.button || 0, view: window });
          var mUp = new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: action.payload.button || 0, view: window });
          var clk = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: action.payload.button || 0, view: window });

          try { target.dispatchEvent(pDown); } catch(e) { void 0; /* page-context stealth isolation */ }
          try { target.dispatchEvent(mDown); } catch(e) { void 0; /* page-context stealth isolation */ }
          try { target.dispatchEvent(pUp); } catch(e) { void 0; /* page-context stealth isolation */ }
          try { target.dispatchEvent(mUp); } catch(e) { void 0; /* page-context stealth isolation */ }
          try { target.dispatchEvent(clk); } catch(e) { void 0; /* page-context stealth isolation */ }

          if (target.tagName === 'A' && target.href && !target.target) {
            try { window.location.href = target.href; } catch(e) { void 0; /* page-context stealth isolation */ }
          }
        }
      } else if (action.type === 'TYPE' && action.payload) {
        var targetEl = document.activeElement;
        if (!targetEl || (targetEl.tagName !== 'INPUT' && targetEl.tagName !== 'TEXTAREA' && !targetEl.isContentEditable)) {
          if (action.payload.name) targetEl = document.querySelector('[name="' + action.payload.name + '"]');
          if (!targetEl && action.payload.id) targetEl = document.getElementById(action.payload.id);
          if (!targetEl) targetEl = document.querySelector('textarea, input[type="search"], input[type="text"], input:not([type="hidden"])');
        }
        if (targetEl && action.payload.value !== undefined) {
          try { targetEl.focus(); } catch(e) { void 0; /* page-context stealth isolation */ }
          try {
            var isTxt = targetEl.tagName === 'TEXTAREA';
            var proto = isTxt ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
            var setter = Object.getOwnPropertyDescriptor(proto, 'value');
            if (setter && setter.set) {
              setter.set.call(targetEl, action.payload.value);
            } else {
              targetEl.value = action.payload.value;
            }
          } catch(e) {
            targetEl.value = action.payload.value;
          }
          targetEl.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          targetEl.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
          try {
            targetEl.dispatchEvent(new InputEvent('input', {
              bubbles: true,
              cancelable: true,
              composed: true,
              data: action.payload.value,
              inputType: 'insertText'
            }));
          } catch(e) { void 0; /* page-context stealth isolation */ }
        }
      } else if (action.type === 'KEY' && action.payload) {
        var keyTarget = document.activeElement || document.querySelector('textarea, input:not([type="hidden"])');
        if (keyTarget) {
          var kDown = new KeyboardEvent('keydown', {
            key: action.payload.key || 'Enter',
            code: action.payload.code || 'Enter',
            keyCode: action.payload.keyCode || 13,
            which: action.payload.keyCode || 13,
            bubbles: true,
            cancelable: true,
            composed: true
          });
          var kUp = new KeyboardEvent('keyup', {
            key: action.payload.key || 'Enter',
            code: action.payload.code || 'Enter',
            keyCode: action.payload.keyCode || 13,
            which: action.payload.keyCode || 13,
            bubbles: true,
            cancelable: true,
            composed: true
          });
          keyTarget.dispatchEvent(kDown);
          keyTarget.dispatchEvent(kUp);
          if ((action.payload.key === 'Enter' || action.payload.keyCode === 13) && keyTarget.form) {
            try {
              if (typeof keyTarget.form.requestSubmit === 'function') keyTarget.form.requestSubmit();
              else keyTarget.form.submit();
            } catch(e) { void 0; /* page-context stealth isolation */ }
          }
        }
      } else if (action.type === 'SCROLL' && action.payload) {
        var targetScroll = action.payload.scrollYRatio * (document.documentElement.scrollHeight || 1);
        window.scrollTo({ top: targetScroll, behavior: 'smooth' });
      } else if (action.type === 'NAVIGATE' && action.payload && action.payload.url) {
        if (window.location.href !== action.payload.url) {
          window.location.replace(action.payload.url);
        }
      } else if (action.type === 'START_WARMUP' && action.payload && Array.isArray(action.payload.sites)) {
        if (!action.payload.profileId || action.payload.profileId === pId) {
          var warmData = { sites: action.payload.sites, index: 0 };
          sessionStorage.setItem('__MAHI_WARM_QUEUE__', JSON.stringify(warmData));
          window.location.href = warmData.sites[0];
        }
      }
    } catch(err) { void 0; /* page-context stealth isolation */ } finally {
      setTimeout(function() { isHandlingRemoteAction = false; }, 80);
    }
  }

  // Dedicated background port connection (100% immune to HTTPS Mixed Content blocks)
  var syncPort = null;
  function connectSyncPort() {
    try {
      syncPort = chrome.runtime.connect({ name: 'mahi_sync_port' });
      syncPort.onMessage.addListener(function(action) {
        handleReplicatedAction(action);
      });
      syncPort.onDisconnect.addListener(function() {
        syncPort = null;
        setTimeout(connectSyncPort, 1000);
      });
    } catch(e) {
      setTimeout(connectSyncPort, 1500);
    }
  }
  connectSyncPort();

  // Also listen to messages from background worker (Dual Channel Backup)
  try {
    chrome.runtime.onMessage.addListener(function(action) {
      handleReplicatedAction(action);
    });
  } catch(e) { void 0; /* page-context stealth isolation */ }

  // Broadcast user action via background service worker
  function sendSyncAction(type, payload) {
    if (isHandlingRemoteAction) return;
    try {
      if (syncPort) {
        syncPort.postMessage({
          type: 'BROADCAST_SYNC_ACTION',
          action: {
            type: type,
            payload: payload,
            timestamp: Date.now()
          }
        });
      } else {
        chrome.runtime.sendMessage({
          type: 'BROADCAST_SYNC_ACTION',
          action: {
            type: type,
            payload: payload,
            timestamp: Date.now()
          }
        }).catch(function() { void 0; /* page-context stealth isolation */ });
      }
    } catch(err) { void 0; /* page-context stealth isolation */ }
  }


  // Capture user clicks
  window.addEventListener('click', function(e) {
    if (isHandlingRemoteAction) return;
    var xRatio = e.clientX / (window.innerWidth || 1);
    var yRatio = e.clientY / (window.innerHeight || 1);
    sendSyncAction('CLICK', { xRatio: xRatio, yRatio: yRatio, button: e.button });
  }, true);

  // Capture user typing
  window.addEventListener('input', function(e) {
    if (isHandlingRemoteAction) return;
    var activeEl = e.target;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
      sendSyncAction('TYPE', { value: activeEl.value, name: activeEl.name, id: activeEl.id });
    }
  }, true);

  // Capture user key presses & Enter key submission
  window.addEventListener('keydown', function(e) {
    if (isHandlingRemoteAction) return;
    if (e.key === 'Enter') {
      sendSyncAction('KEY', { key: 'Enter', code: e.code, keyCode: 13 });
    }
  }, true);

  window.addEventListener('keyup', function(e) {
    if (isHandlingRemoteAction) return;
    var activeEl = e.target;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
      sendSyncAction('TYPE', { value: activeEl.value, name: activeEl.name, id: activeEl.id });
    }
  }, true);

  // Capture scrolling (throttled)
  var scrollThrottle = null;
  window.addEventListener('scroll', function() {
    if (isHandlingRemoteAction) return;
    if (scrollThrottle) return;
    scrollThrottle = setTimeout(function() {
      scrollThrottle = null;
      var scrollYRatio = window.scrollY / (document.documentElement.scrollHeight || 1);
      sendSyncAction('SCROLL', { scrollYRatio: scrollYRatio });
    }, 120);
  }, { passive: true });


  // -------------------------------------------------------------
  // Live Automated Cookie Warmer & Real Browser Surfing Sequence
  // -------------------------------------------------------------
  try {
    function checkAndRunWarmer() {
      var rawQueue = sessionStorage.getItem('__MAHI_WARM_QUEUE__');
      if (rawQueue) {
        processWarmerQueue(JSON.parse(rawQueue));
      }
    }

    function processWarmerQueue(q) {
      if (!q || !Array.isArray(q.sites) || q.index >= q.sites.length) {
        sessionStorage.removeItem('__MAHI_WARM_QUEUE__');
        return;
      }
      var currentIdx = q.index + 1;
      var total = q.sites.length;
      var targetUrl = q.sites[q.index];

      var hud = document.getElementById('__mahi_warmer_hud');
      if (!hud) {
        hud = document.createElement('div');
        hud.id = '__mahi_warmer_hud';
        document.documentElement.appendChild(hud);
      }
      hud.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483647;' +
        'background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%);' +
        'color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;' +
        'font-size:13px;font-weight:700;padding:12px 22px;border-radius:18px;' +
        'box-shadow:0 12px 30px rgba(0,0,0,0.6),0 0 0 1px rgba(245,158,11,0.5);' +
        'display:flex;align-items:center;gap:10px;pointer-events:none;';
      hud.innerHTML = '<span style="font-size:18px;">🚜</span> <span>[MAHI WARMER] Farming Site ' + currentIdx + '/' + total + ': <b>' + (window.location.hostname || targetUrl) + '</b></span>';

      setTimeout(function() { window.scrollBy({ top: 350, behavior: 'smooth' }); }, 800);
      setTimeout(function() { window.scrollBy({ top: 500, behavior: 'smooth' }); }, 1800);

      q.index++;
      if (q.index < q.sites.length) {
        sessionStorage.setItem('__MAHI_WARM_QUEUE__', JSON.stringify(q));
        setTimeout(function() {
          window.location.href = q.sites[q.index];
        }, 3200);
      } else {
        sessionStorage.removeItem('__MAHI_WARM_QUEUE__');
        setTimeout(function() {
          if (hud) {
            hud.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)';
            hud.innerHTML = '<span style="font-size:18px;">✅</span> <span>FARMING COMPLETE! All ' + total + ' Sites Visited & Saved to History!</span>';
            setTimeout(function() { hud.remove(); }, 6000);
          }
        }, 1500);
      }
    }

    setTimeout(checkAndRunWarmer, 800);
  } catch(e) { void 0; /* page-context stealth isolation */ }

})();

`;
}

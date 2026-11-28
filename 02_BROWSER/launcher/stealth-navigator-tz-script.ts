import type { StealthScriptContext } from './launcher-shared.js';

/**
 * Generates WebDriver & automation artifact masking, Chrome runtime mocking,
 * Navigator overrides, and Timezone / Date / Intl spoofing.
 */
export function buildStealthNavigatorTzSection(ctx: StealthScriptContext): string {
  const {
    isCamoufox,
    hardwareConcurrency,
    deviceMemory,
    platformStr,
    maxTouchPoints,
    languagesList,
  } = ctx;

  return `
  // -------------------------------------------------------------
  // 1. Automation & WebDriver Masking
  // -------------------------------------------------------------
  try {
    if (typeof Navigator !== 'undefined' && Navigator.prototype) {
      var proto = Navigator.prototype;
      var origWbDesc = Object.getOwnPropertyDescriptor(proto, 'webdriver');
      var getterObj = {
        get webdriver() { return false; }
      };
      var fallbackGetter = Object.getOwnPropertyDescriptor(getterObj, 'webdriver').get;
      var targetGetter = (origWbDesc && origWbDesc.get && origWbDesc.get.name === 'get webdriver')
        ? origWbDesc.get
        : fallbackGetter;
      var proxyWebdriver = new Proxy(targetGetter, {
        apply: function(target, thisArg, argumentsList) {
          if (!thisArg || !(thisArg instanceof Navigator)) {
            if (origWbDesc && typeof origWbDesc.get === 'function') {
              try {
                return origWbDesc.get.apply(thisArg, argumentsList);
              } catch(e) {
                throw e;
              }
            }
            throw new TypeError("Failed to execute 'webdriver' on 'Navigator': Illegal invocation");
          }
          return false;
        }
      });
      Object.defineProperty(proto, 'webdriver', {
        get: proxyWebdriver,
        enumerable: true,
        configurable: true
      });
      registerNative(proxyWebdriver, 'get webdriver');
      if (origWbDesc && typeof origWbDesc.get === 'function') {
        registerNative(origWbDesc.get, 'get webdriver');
      }
    }
    if (typeof navigator !== 'undefined') {
      try { delete navigator.webdriver; } catch(e) { void 0; /* page-context stealth isolation */ }
    }
  } catch(e) { void 0; /* page-context stealth isolation */ }

  // Remove Chromedriver / automation artifacts (pattern-based sweep)
  try {
    var windowPropNames = Object.getOwnPropertyNames(window);
    var autoRegex = /^(\\$?cdc_|__webdriver|__selenium|__fxdriver)/;
    for (var aIdx = 0; aIdx < windowPropNames.length; aIdx++) {
      if (autoRegex.test(windowPropNames[aIdx])) {
        try { delete window[windowPropNames[aIdx]]; } catch(e) { void 0; /* page-context stealth isolation */ }
      }
    }
  } catch(e) { void 0; /* page-context stealth isolation */ }

  // Chrome Runtime Mocking (for Chromium-family engines)
  if (!${isCamoufox}) {
    try {
      if (!window.chrome) { window.chrome = {}; }
      if (!window.chrome.runtime) {
        window.chrome.runtime = {
          connect: function() {},
          sendMessage: function() {},
          id: undefined
        };
      }
      if (!window.chrome.app) {
        window.chrome.app = {
          isInstalled: false,
          InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
          RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
          getDetails: function() { return null; },
          getIsInstalled: function() { return false; },
          runningState: function() { return 'cannot_run'; }
        };
      }
    } catch(e) { void 0; /* page-context stealth isolation */ }
  }

  // -------------------------------------------------------------
  // 2. Hardware Navigator Overrides & Locale/Languages
  // -------------------------------------------------------------
  try {
    function spoofNavigator(prop, value) {
      if (typeof navigator !== 'undefined') {
        try { delete navigator[prop]; } catch(e) { void 0; /* page-context stealth isolation */ }
      }
      var desc = Object.getOwnPropertyDescriptor(Navigator.prototype, prop);
      var dummy = { get [prop]() { return value; } };
      var fallbackGetter = Object.getOwnPropertyDescriptor(dummy, prop).get;
      var targetGetter = (desc && desc.get && desc.get.name === 'get ' + prop) ? desc.get : fallbackGetter;
      var proxy = new Proxy(targetGetter, {
        apply: function(target, thisArg, argumentsList) {
          if (!thisArg || !(thisArg instanceof Navigator)) {
            if (desc && typeof desc.get === 'function') {
              try {
                return desc.get.apply(thisArg, argumentsList);
              } catch(e) {
                throw e;
              }
            }
            throw new TypeError("Failed to execute '" + prop + "' on 'Navigator': Illegal invocation");
          }
          return value;
        }
      });
      Object.defineProperty(Navigator.prototype, prop, {
        get: proxy,
        enumerable: desc ? desc.enumerable : true,
        configurable: desc ? desc.configurable : true
      });
      registerNative(proxy, 'get ' + prop);
      if (desc && typeof desc.get === 'function') registerNative(desc.get, 'get ' + prop);
    }

    spoofNavigator('hardwareConcurrency', ${hardwareConcurrency});
    spoofNavigator('deviceMemory', ${deviceMemory});
    spoofNavigator('platform', ${JSON.stringify(platformStr)});
    spoofNavigator('maxTouchPoints', ${maxTouchPoints});
    spoofNavigator('language', ${JSON.stringify(languagesList[0] || 'en-US')});
    spoofNavigator('languages', Object.freeze(${JSON.stringify(languagesList)}));

    // -------------------------------------------------------------
    // Timezone Spoofing (Intl.DateTimeFormat & Date.prototype.getTimezoneOffset)
    // FIX-3: Retained JS timezone proxies because FIX-0 proved native --tz and env TZ
    // are no-ops on Windows Chromium and CDP Emulation does not cover Web Workers/Service Workers.
    // Guarded with !mahiTzApplied and registerNative for descriptor integrity.
    // -------------------------------------------------------------
    if (targetTz && !mahiTzApplied) {
      try {
        var getTzOffset = function(date, tz) {
          try {
            var formatter = new Intl.DateTimeFormat('en-US', {
              timeZone: tz,
              year: 'numeric', month: 'numeric', day: 'numeric',
              hour: 'numeric', minute: 'numeric', second: 'numeric',
              hour12: false, hourCycle: 'h23'
            });
            var parts = formatter.formatToParts(date);
            var map = {};
            for (var pIdx = 0; pIdx < parts.length; pIdx++) map[parts[pIdx].type] = parseInt(parts[pIdx].value, 10);
            var tzHour = map.hour === 24 ? 0 : map.hour;
            var tzDate = Date.UTC(map.year, map.month - 1, map.day, tzHour, map.minute, map.second);
            var utcDate = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());
            return Math.round((utcDate - tzDate) / 60000);
          } catch(e) {
            return 0;
          }
        };

        var origGetTimezoneOffset = Date.prototype.getTimezoneOffset;
        var proxyGetTimezoneOffset = new Proxy(origGetTimezoneOffset, {
          apply: function(target, thisArg, args) {
            if (thisArg instanceof Date && !isNaN(thisArg.getTime())) {
              return getTzOffset(thisArg, targetTz);
            }
            return target.apply(thisArg, args);
          }
        });
        Date.prototype.getTimezoneOffset = proxyGetTimezoneOffset;
        registerNative(proxyGetTimezoneOffset, 'getTimezoneOffset');
        registerNative(origGetTimezoneOffset, 'getTimezoneOffset');

        var explicitTzMap = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
        var origDTF = Intl.DateTimeFormat;
        var ProxyDTF = function DateTimeFormat() {
          var locales = arguments[0];
          var options = arguments[1];
          var hasExplicitTz = options && options.timeZone;
          var opts = Object.assign({}, options);
          if (!opts.timeZone) {
            opts.timeZone = targetTz;
          }
          var inst;
          if (!(this instanceof ProxyDTF)) {
            inst = origDTF(locales, opts);
          } else {
            inst = new origDTF(locales, opts);
          }
          if (explicitTzMap && inst && typeof inst === 'object') {
            explicitTzMap.set(inst, !!hasExplicitTz);
          }
          return inst;
        };
        try {
          Object.defineProperty(ProxyDTF, 'length', { value: 0, configurable: true });
        } catch(e) { void 0; /* page-context stealth isolation */ }
        ProxyDTF.prototype = origDTF.prototype;
        ProxyDTF.prototype.constructor = ProxyDTF;
        if (origDTF.supportedLocalesOf) {
          ProxyDTF.supportedLocalesOf = origDTF.supportedLocalesOf;
        }
        registerNative(ProxyDTF, 'DateTimeFormat');
        registerNative(origDTF, 'DateTimeFormat');
        Intl.DateTimeFormat = ProxyDTF;

        var origResolved = origDTF.prototype.resolvedOptions;
        var proxyResolved = new Proxy(origResolved, {
          apply: function(target, thisArg, args) {
            var res = target.apply(thisArg, args);
            if (res && (!explicitTzMap || !explicitTzMap.get(thisArg))) {
              res.timeZone = targetTz;
            }
            return res;
          }
        });
        origDTF.prototype.resolvedOptions = proxyResolved;
        registerNative(proxyResolved, 'resolvedOptions');
        registerNative(origResolved, 'resolvedOptions');

        var formatTzDate = function(date, mode) {
          try {
            var dtf = new Intl.DateTimeFormat('en-US', {
              timeZone: targetTz,
              weekday: 'short', month: 'short', day: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit', second: '2-digit',
              hour12: false, hourCycle: 'h23', timeZoneName: 'long'
            });
            var parts = {};
            var pList = dtf.formatToParts(date);
            for (var pi = 0; pi < pList.length; pi++) parts[pList[pi].type] = pList[pi].value;
            if (parts.hour === '24') parts.hour = '00';

            var offMin = getTzOffset(date, targetTz);
            var sign = offMin <= 0 ? '+' : '-';
            var absOff = Math.abs(offMin);
            var offH = ('0' + Math.floor(absOff / 60)).slice(-2);
            var offM = ('0' + (absOff % 60)).slice(-2);
            var offStr = 'GMT' + sign + offH + offM;

            if (mode === 'date') {
              return parts.weekday + ' ' + parts.month + ' ' + parts.day + ' ' + parts.year;
            }
            if (mode === 'time') {
              return parts.hour + ':' + parts.minute + ':' + parts.second + ' ' + offStr + ' (' + (parts.timeZoneName || targetTz) + ')';
            }
            return parts.weekday + ' ' + parts.month + ' ' + parts.day + ' ' + parts.year + ' ' + parts.hour + ':' + parts.minute + ':' + parts.second + ' ' + offStr + ' (' + (parts.timeZoneName || targetTz) + ')';
          } catch(e) {
            return null;
          }
        };

        var origDateToString = Date.prototype.toString;
        var proxyDateToString = new Proxy(origDateToString, {
          apply: function(target, thisArg, args) {
            if (thisArg instanceof Date && !isNaN(thisArg.getTime())) {
              var formatted = formatTzDate(thisArg, 'full');
              if (formatted) return formatted;
            }
            return target.apply(thisArg, args);
          }
        });
        Date.prototype.toString = proxyDateToString;
        registerNative(proxyDateToString, 'toString');
        registerNative(origDateToString, 'toString');

        var origDateToTimeString = Date.prototype.toTimeString;
        var proxyDateToTimeString = new Proxy(origDateToTimeString, {
          apply: function(target, thisArg, args) {
            if (thisArg instanceof Date && !isNaN(thisArg.getTime())) {
              var formatted = formatTzDate(thisArg, 'time');
              if (formatted) return formatted;
            }
            return target.apply(thisArg, args);
          }
        });
        Date.prototype.toTimeString = proxyDateToTimeString;
        registerNative(proxyDateToTimeString, 'toTimeString');
        registerNative(origDateToTimeString, 'toTimeString');

        var origDateToDateString = Date.prototype.toDateString;
        var proxyDateToDateString = new Proxy(origDateToDateString, {
          apply: function(target, thisArg, args) {
            if (thisArg instanceof Date && !isNaN(thisArg.getTime())) {
              var formatted = formatTzDate(thisArg, 'date');
              if (formatted) return formatted;
            }
            return target.apply(thisArg, args);
          }
        });
        Date.prototype.toDateString = proxyDateToDateString;
        registerNative(proxyDateToDateString, 'toDateString');
        registerNative(origDateToDateString, 'toDateString');

        var hookDateLocale = function(prop) {
          var orig = Date.prototype[prop];
          if (!orig) return;
          var proxy = new Proxy(orig, {
            apply: function(target, thisArg, args) {
              if (thisArg instanceof Date && !isNaN(thisArg.getTime())) {
                var locales = args[0];
                var options = Object.assign({}, args[1]);
                if (!options.timeZone) {
                  options.timeZone = targetTz;
                }
                return target.call(thisArg, locales, options);
              }
              return target.apply(thisArg, args);
            }
          });
          Date.prototype[prop] = proxy;
          registerNative(proxy, prop);
          registerNative(orig, prop);
        };
        hookDateLocale('toLocaleString');
        hookDateLocale('toLocaleDateString');
        hookDateLocale('toLocaleTimeString');
      } catch(e) { void 0; /* page-context stealth isolation */ }
    }
`;
}

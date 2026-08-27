const fs = require('fs');

let data = fs.readFileSync('02_BROWSER/launcher.ts', 'utf8');

const searchStr = `// 2. Hardware Navigator Overrides
  // -------------------------------------------------------------
  try {
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: function() { return \${hardwareConcurrency}; },
      enumerable: true,
      configurable: true
    });

    Object.defineProperty(navigator, 'deviceMemory', {
      get: function() { return \${deviceMemory}; },
      enumerable: true,
      configurable: true
    });

    Object.defineProperty(navigator, 'platform', {
      get: function() { return \${JSON.stringify(isMac ? 'MacIntel' : 'Win32')}; },
      enumerable: true,
      configurable: true
    });

    Object.defineProperty(navigator, 'maxTouchPoints', {
      get: function() { return 0; },
      enumerable: true,
      configurable: true
    });
  } catch(e) {}`;

const replaceStr = `// 2. Hardware Navigator Overrides
  // -------------------------------------------------------------
  if (!window.__mahiProxies) window.__mahiProxies = [];
  try {
    function spoofNavigator(prop, value) {
      var desc = Object.getOwnPropertyDescriptor(Navigator.prototype, prop);
      if (!desc) return;
      var proxy = new Proxy(desc.get, {
        apply: function() { return value; }
      });
      Object.defineProperty(Navigator.prototype, prop, {
        get: proxy,
        enumerable: desc.enumerable,
        configurable: desc.configurable
      });
      window.__mahiProxies.push({ p: proxy, o: desc.get, n: 'get ' + prop });
    }

    spoofNavigator('hardwareConcurrency', \${hardwareConcurrency});
    spoofNavigator('deviceMemory', \${deviceMemory});
    spoofNavigator('platform', \${JSON.stringify(isMac ? 'MacIntel' : 'Win32')});
    spoofNavigator('maxTouchPoints', 0);
  } catch(e) {}`;

data = data.replace(searchStr, replaceStr);

const searchToString = `// Mask toString for native appearance
    var origToString = Function.prototype.toString;
    Function.prototype.toString = new Proxy(origToString, {
      apply: function(target, thisArg, argumentsList) {
        if (thisArg === proxyToDataURL || thisArg === origToDataURL) {
          return "function toDataURL() { [native code] }";
        }
        if (thisArg === proxyGetImageData || thisArg === origGetImageData) {
          return "function getImageData() { [native code] }";
        }
        return target.apply(thisArg, argumentsList);
      }
    });`;

const replaceToString = `// Mask toString for native appearance
    if (!window.__mahiProxies) window.__mahiProxies = [];
    window.__mahiProxies.push({ p: proxyToDataURL, o: origToDataURL, n: 'toDataURL' });
    window.__mahiProxies.push({ p: proxyGetImageData, o: origGetImageData, n: 'getImageData' });
    
    var origToString = Function.prototype.toString;
    var proxyToString = new Proxy(origToString, {
      apply: function(target, thisArg, argumentsList) {
        if (thisArg === origToString || thisArg === proxyToString) {
          return 'function toString() { [native code] }';
        }
        for (var i = 0; i < window.__mahiProxies.length; i++) {
          var item = window.__mahiProxies[i];
          if (thisArg === item.p || thisArg === item.o) {
            return 'function ' + item.n + '() { [native code] }';
          }
        }
        return target.apply(thisArg, argumentsList);
      }
    });
    Function.prototype.toString = proxyToString;`;

data = data.replace(searchToString, replaceToString);

fs.writeFileSync('02_BROWSER/launcher.ts', data);
console.log('done');

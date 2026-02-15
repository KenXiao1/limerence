/**
 * Predefine script — injected into every iframe's <head>.
 *
 * Simplified port of JS-Slash-Runner/src/iframe/predefine.js.
 * Sets up TavernHelper API access from within the iframe by copying
 * properties from parent.TavernHelper and binding `_` prefixed functions.
 */

/**
 * Generate the predefine JS source string to inject into iframe srcdoc.
 */
export function generatePredefineScript(iframeId: string): string {
  // This runs inside the iframe. We use a self-executing function to avoid polluting global scope.
  return `
(function() {
  "use strict";

  // Store iframe ID for identification
  window.__TH_IFRAME_ID = ${JSON.stringify(iframeId)};

  var parentTH = null;
  try { parentTH = window.parent.TavernHelper; } catch(e) {}
  if (!parentTH) {
    console.warn("[Limerence] TavernHelper not found on parent window");
    return;
  }

  // Copy non-bind properties directly
  var keys = Object.keys(parentTH);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (key.charAt(0) === '_') continue; // skip bind functions for now
    var val = parentTH[key];
    if (typeof val === 'function') {
      // Wrap to preserve 'this' context
      window[key] = val.bind(parentTH);
    } else {
      window[key] = val;
    }
  }

  // Bind functions: _eventOn -> eventOn, bound to this iframe's window
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (key.charAt(0) !== '_') continue;
    var fn = parentTH[key];
    if (typeof fn !== 'function') continue;
    var publicName = key.slice(1); // remove leading _
    window[publicName] = fn.bind(window);
  }

  // Convenience aliases matching JS-Slash-Runner conventions
  if (typeof window.eventOn === 'function') {
    window.addEventListener('pagehide', function() {
      try {
        if (typeof window.eventClearAll === 'function') {
          window.eventClearAll();
        }
      } catch(e) {}
    });
  }

  // SillyTavern.getContext() proxy
  try {
    var parentCtx = window.parent.__LimerenceSillyTavernContext;
    if (parentCtx) {
      Object.defineProperty(window, 'SillyTavern', {
        configurable: true,
        get: function() {
          return { getContext: parentCtx };
        }
      });
    }
  } catch(e) {}
})();
`;
}

/**
 * Generate the auto-resize script for message iframes.
 * Uses ResizeObserver to watch body height and postMessage to parent.
 */
export function generateAutoResizeScript(iframeId: string): string {
  return `
(function() {
  "use strict";
  var id = ${JSON.stringify(iframeId)};
  var lastHeight = 0;

  function reportHeight() {
    var h = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight
    );
    if (h !== lastHeight && h > 0) {
      lastHeight = h;
      try {
        window.parent.postMessage({
          type: 'limerence-iframe-resize',
          iframeId: id,
          height: h
        }, '*');
      } catch(e) {}
    }
  }

  // Initial report after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      reportHeight();
      // Also report after a short delay for async content
      setTimeout(reportHeight, 100);
      setTimeout(reportHeight, 500);
      setTimeout(reportHeight, 1500);
    });
  } else {
    reportHeight();
    setTimeout(reportHeight, 100);
    setTimeout(reportHeight, 500);
  }

  // Watch for size changes
  if (typeof ResizeObserver !== 'undefined') {
    var ro = new ResizeObserver(function() { reportHeight(); });
    ro.observe(document.documentElement);
    if (document.body) ro.observe(document.body);
    else document.addEventListener('DOMContentLoaded', function() {
      if (document.body) ro.observe(document.body);
    });
  }

  // Fallback: periodic check
  setInterval(reportHeight, 2000);
})();
`;
}

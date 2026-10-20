// Plain JS bridge — used at runtime by the Capacitor WebView.
// The TypeScript definitions (index.ts / definitions.ts) are for
// IDE autocompletion only; the app loads this file directly.

(function () {
  if (typeof window === 'undefined' || !window.Capacitor) return;

  var core = window.Capacitor;
  var registerPlugin = core.registerPlugin || (core.Plugins && function () {});

  if (registerPlugin) {
    window.NativeGit = registerPlugin('NativeGit');
  }
})();

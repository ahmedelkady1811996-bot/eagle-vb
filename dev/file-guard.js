(function () {
  if (location.protocol === 'file:') return;
  var shown = false;
  function warn() {
    if (shown) return;
    shown = true;
    var bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:9999;max-width:420px;padding:12px 14px;'
      + 'border-radius:12px;background:#1f2937;color:#e5e7eb;font:13px/1.6 system-ui,sans-serif;box-shadow:0 18px 40px -14px rgba(0,0,0,.6)';
    bar.innerHTML = '<b style="display:block;margin-bottom:4px">Open this file over http</b>'
      + 'Browsers block ES modules on <code>file://</code>.<br>'
      + 'Run <code>start.bat</code>, or the Electron app, or <code>node dev/serve.js</code>.';
    document.body.appendChild(bar);
    setTimeout(function () { bar.remove(); }, 9000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', warn);
  else warn();
})();
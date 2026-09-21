(()=>{
  let deferredPrompt = null;
  const installButtons = () => Array.from(document.querySelectorAll('[data-pwa-install]'));
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  function setInstallVisibility(show){
    installButtons().forEach(btn=>{
      btn.hidden = !show;
      btn.setAttribute('aria-hidden', show ? 'false':'true');
    });
  }

  async function install(){
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch {}
    deferredPrompt = null;
    setInstallVisibility(false);
  }

  window.addEventListener('beforeinstallprompt', e=>{
    e.preventDefault();
    deferredPrompt = e;
    if (!isStandalone()) setInstallVisibility(true);
  });

  window.addEventListener('appinstalled', ()=>{
    deferredPrompt = null;
    setInstallVisibility(false);
  });

  document.addEventListener('click', e=>{
    const btn = e.target.closest('[data-pwa-install]');
    if (btn) install();
  });

  document.addEventListener('DOMContentLoaded', ()=>{
    setInstallVisibility(false);
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('./service-worker.js', {scope:'./'}).catch(()=>{});
    }
  });
})();

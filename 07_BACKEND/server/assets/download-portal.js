(() => {
  function setOsTab(os) {
    const btnWindows = document.getElementById('tab-windows');
    const btnMac = document.getElementById('tab-mac');
    const btnLinux = document.getElementById('tab-linux');
    const title = document.getElementById('download-title');
    const subtitle = document.getElementById('download-subtitle');
    const btnText = document.getElementById('download-btn-text');

    if (!btnWindows || !btnMac || !btnLinux || !title || !subtitle || !btnText) return;

    const activeClass =
      'flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 bg-emerald-500 text-slate-950 shadow-md';
    const inactiveClass =
      'flex-1 py-2 px-3 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition flex items-center justify-center space-x-2';

    btnWindows.className = inactiveClass;
    btnMac.className = inactiveClass;
    btnLinux.className = inactiveClass;

    if (os === 'windows') {
      btnWindows.className = activeClass;
      title.textContent = 'MAHI Browser for Windows (64-bit)';
      subtitle.textContent = 'Production installer with automatic desktop launcher and stealth sandbox';
      btnText.textContent = 'Download MAHI Installer (64-bit)';
    } else if (os === 'mac') {
      btnMac.className = activeClass;
      title.textContent = 'MAHI Browser for macOS (Universal)';
      subtitle.textContent = 'Apple Silicon (M1/M2/M3/M4) & Intel DMG Package';
      btnText.textContent = 'Download macOS Package (.dmg)';
    } else if (os === 'linux') {
      btnLinux.className = activeClass;
      title.textContent = 'MAHI Browser for Linux (x64)';
      subtitle.textContent = 'Debian / Ubuntu (.deb) and Standalone AppImage';
      btnText.textContent = 'Download Linux AppImage';
    }
  }

  function handleDownloadTrigger() {
    const modal = document.getElementById('download-modal');
    if (modal) modal.classList.remove('hidden');
  }

  function closeDownloadModal() {
    const modal = document.getElementById('download-modal');
    if (modal) modal.classList.add('hidden');
  }

  function bindPortalHandlers() {
    document.querySelectorAll('[data-os-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const os = btn.getAttribute('data-os-tab');
        if (os) setOsTab(os);
      });
    });

    const downloadBtn = document.getElementById('main-download-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', handleDownloadTrigger);
    }

    const closeBtn = document.getElementById('close-download-modal-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeDownloadModal);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindPortalHandlers);
  } else {
    bindPortalHandlers();
  }
})();

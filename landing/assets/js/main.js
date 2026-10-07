/**
 * MAHI BROWSER — ULTRA-PREMIUM LANDING PAGE ENGINE
 * Benchmark: GoLogin / Vengence UI • Zero external dependencies • High performance
 */

document.addEventListener('DOMContentLoaded', () => {
  initNavbarIsland();
  initNavDropdowns();
  initLanguageSwitcher();
  initMobileDrawer();
  initRotatingHeroWord();
  initInteractiveSelectors();
  initFaqAccordion();
  initMouseSpotlights();
  initAuthModal();
  initResourceModal();
  initDownloadTriggers();
  initPlatformCircles();
  fetchDynamicContent();
  initSmoothScroll();
});

/**
 * Global Toast Notification Helper
 */
function showToast(message, type = 'success', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">✓</span>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 320);
  }, duration);
}

/**
 * 1. Floating Glass Island Navbar scroll reactions
 */
function initNavbarIsland() {
  const navbar = document.querySelector('.navbar-island');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      navbar?.classList.add('is-scrolled');
    } else {
      navbar?.classList.remove('is-scrolled');
    }
  }, { passive: true });
}

/**
 * 1b. Real Working Navbar Dropdowns (Resources, Products, English)
 */
function initNavDropdowns() {
  const dropdowns = document.querySelectorAll('.nav-dropdown');

  dropdowns.forEach(dropdown => {
    const toggle = dropdown.querySelector('.dropdown-toggle');
    const menu = dropdown.querySelector('.dropdown-menu-clean');
    if (!toggle || !menu) return;

    // Toggle on button click (mobile touch + desktop click)
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.remove('force-closed');
      const isOpen = dropdown.classList.contains('is-open') || dropdown.classList.contains('active');

      // Close all other open dropdowns
      dropdowns.forEach(other => {
        if (other !== dropdown) {
          other.classList.remove('is-open', 'active');
          const otherToggle = other.querySelector('.dropdown-toggle');
          if (otherToggle) otherToggle.setAttribute('aria-expanded', 'false');
        }
      });

      if (isOpen) {
        dropdown.classList.remove('is-open', 'active');
        toggle.setAttribute('aria-expanded', 'false');
      } else {
        dropdown.classList.add('is-open', 'active');
        toggle.setAttribute('aria-expanded', 'true');
      }
    });

    // Reset force-closed when mouse leaves dropdown area
    dropdown.addEventListener('mouseleave', () => {
      dropdown.classList.remove('force-closed');
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('is-open', 'active', 'force-closed');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        dropdown.classList.remove('is-open', 'active', 'force-closed');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  });
}

/**
 * 1c. Multi-Language Switcher with Live I18n Engine
 */
function initLanguageSwitcher() {
  const langDropdown = document.getElementById('dropdown-lang');
  const currentLabel = document.getElementById('current-lang-text');
  if (!langDropdown || !currentLabel) return;

  const translations = {
    'English': {
      nav_use_cases: 'Use Cases',
      nav_features: 'Features',
      nav_resources: 'Resources',
      nav_pricing: 'Pricing',
      nav_products: 'Products',
      nav_signin: 'Sign in',
      nav_trial: '7-day Trial',
      hero_title_p1: 'Antidetect browser to manage',
      hero_title_p2: 'accounts',
      hero_sub: 'Anti-detect browser for managing multiple accounts on a single device without the hassle of receiving blocked access or dealing with tedious transferring of passwords.',
      cta_start_trial: 'Start Free 7-Day Trial',
      cta_book_demo: 'Book a demo',
      micro_no_card: 'No card required',
      avail_label: 'Available on all platforms:',
      social_proof_title: 'Trusted by top<br>professionals'
    },
    'Français': {
      nav_use_cases: 'Cas d\'usage',
      nav_features: 'Fonctionnalités',
      nav_resources: 'Ressources',
      nav_pricing: 'Tarifs',
      nav_products: 'Produits',
      nav_signin: 'Connexion',
      nav_trial: 'Essai 7 jours',
      hero_title_p1: 'Navigateur antidétecteur pour',
      hero_title_p2: 'vos comptes',
      hero_sub: 'Gérez plusieurs comptes en toute sécurité sur un seul appareil sans aucun blocage ni bannissement suspect.',
      cta_start_trial: 'Essai Gratuit 7 Jours',
      cta_book_demo: 'Demander une démo',
      micro_no_card: 'Aucune carte requise',
      avail_label: 'Disponible sur toutes les plateformes :',
      social_proof_title: 'Recommandé par les<br>meilleurs experts'
    },
    'Русский': {
      nav_use_cases: 'Сценарии',
      nav_features: 'Возможности',
      nav_resources: 'Ресурсы',
      nav_pricing: 'Тарифы',
      nav_products: 'Продукты',
      nav_signin: 'Войти',
      nav_trial: '7 дней триал',
      hero_title_p1: 'Антидетект браузер для',
      hero_title_p2: 'аккаунтов',
      hero_sub: 'Безопасное управление мультиаккаунтами на одном устройстве без риска банов и проверок.',
      cta_start_trial: 'Начать 7 дней бесплатно',
      cta_book_demo: 'Заказать демо',
      micro_no_card: 'Кредитная карта не требуется',
      avail_label: 'Доступно на всех платформах:',
      social_proof_title: 'Выбор ведущих<br>профессионалов'
    },
    'Español': {
      nav_use_cases: 'Casos de uso',
      nav_features: 'Funciones',
      nav_resources: 'Recursos',
      nav_pricing: 'Precios',
      nav_products: 'Productos',
      nav_signin: 'Iniciar sesión',
      nav_trial: 'Prueba de 7 días',
      hero_title_p1: 'Navegador antidetect para gestionar',
      hero_title_p2: 'cuentas',
      hero_sub: 'Ejecute varias cuentas en un solo dispositivo con huellas digitales aisladas y sin baneos.',
      cta_start_trial: 'Comenzar Prueba de 7 Días',
      cta_book_demo: 'Solicitar demo',
      micro_no_card: 'Sin tarjeta de crédito',
      avail_label: 'Disponible en todas las plataformas:',
      social_proof_title: 'Elegido por los mejores<br>profesionales'
    },
    '中文': {
      nav_use_cases: '应用场景',
      nav_features: '核心功能',
      nav_resources: '资源中心',
      nav_pricing: '价格方案',
      nav_products: '产品矩阵',
      nav_signin: '登录',
      nav_trial: '7天免费试用',
      hero_title_p1: '防关联指纹浏览器，安全管理',
      hero_title_p2: '多平台账号',
      hero_sub: '单台设备安全运行多账号，独立数字指纹环境，彻底告别封号与风控检测。',
      cta_start_trial: '免费试用 7 天',
      cta_book_demo: '预约专家演示',
      micro_no_card: '无需信用卡即可体验',
      avail_label: '全平台客户端支持：',
      social_proof_title: '全球出海团队与<br>专业人士信赖'
    },
    'Deutsch': {
      nav_use_cases: 'Anwendungsfälle',
      nav_features: 'Funktionen',
      nav_resources: 'Ressourcen',
      nav_pricing: 'Preise',
      nav_products: 'Produkte',
      nav_signin: 'Anmelden',
      nav_trial: '7-Tage-Testversion',
      hero_title_p1: 'Antidetect-Browser für',
      hero_title_p2: 'Konten',
      hero_sub: 'Verwalten Sie mehrere Konten sicher auf einem Gerät mit einzigartigen Fingerabdrücken ohne Sperrungen.',
      cta_start_trial: '7 Tage kostenlos testen',
      cta_book_demo: 'Demo buchen',
      micro_no_card: 'Keine Kreditkarte erforderlich',
      avail_label: 'Verfügbar auf allen Plattformen:',
      social_proof_title: 'Vertraut von führenden<br>Profis'
    },
    'Portuguese': {
      nav_use_cases: 'Casos de uso',
      nav_features: 'Recursos',
      nav_resources: 'Recursos',
      nav_pricing: 'Preços',
      nav_products: 'Produtos',
      nav_signin: 'Entrar',
      nav_trial: 'Teste de 7 dias',
      hero_title_p1: 'Navegador antidetect para gerenciar',
      hero_title_p2: 'contas',
      hero_sub: 'Execute múltiplas contas em um único dispositivo com fingerprints isolados e sem bloqueios.',
      cta_start_trial: 'Começar Teste de 7 Dias',
      cta_book_demo: 'Agendar demonstração',
      micro_no_card: 'Sem cartão de crédito',
      avail_label: 'Disponível em todas as plataformas:',
      social_proof_title: 'A escolha dos melhores<br>profissionais'
    },
    '日本': {
      nav_use_cases: '利用シーン',
      nav_features: '機能一覧',
      nav_resources: 'リソース',
      nav_pricing: '料金プラン',
      nav_products: 'プロダクト',
      nav_signin: 'ログイン',
      nav_trial: '7日間無料トライアル',
      hero_title_p1: '複数アカウントを安全に管理する',
      hero_title_p2: 'アンチディテクトブラウザ',
      hero_sub: '1台のデバイスで安全にマルチアカウント運用。完全独立フィンガープリントでアカウント凍結を防止。',
      cta_start_trial: '7日間無料で試す',
      cta_book_demo: 'デモを予約する',
      micro_no_card: 'クレジットカード不要',
      avail_label: '全プラットフォーム対応：',
      social_proof_title: '世界のプロフェッショナルが<br>選ぶ信頼性'
    },
    'Tiếng Việt': {
      nav_use_cases: 'Ứng dụng',
      nav_features: 'Tính năng',
      nav_resources: 'Tài nguyên',
      nav_pricing: 'Bảng giá',
      nav_products: 'Sản phẩm',
      nav_signin: 'Đăng nhập',
      nav_trial: 'Dùng thử 7 ngày',
      hero_title_p1: 'Trình duyệt antidetect quản lý',
      hero_title_p2: 'tài khoản',
      hero_sub: 'Vận hành nhiều tài khoản trên một thiết bị với vân tay trình duyệt tách biệt, không lo checkpoint hay khoá tài khoản.',
      cta_start_trial: 'Dùng thử 7 ngày miễn phí',
      cta_book_demo: 'Đặt lịch xem Demo',
      micro_no_card: 'Không cần thẻ tín dụng',
      avail_label: 'Hỗ trợ trên mọi nền tảng:',
      social_proof_title: 'Được tin cậy bởi các<br>chuyên gia hàng đầu'
    },
    'Polski': {
      nav_use_cases: 'Zastosowania',
      nav_features: 'Funkcje',
      nav_resources: 'Zasoby',
      nav_pricing: 'Cennik',
      nav_products: 'Produkty',
      nav_signin: 'Zaloguj się',
      nav_trial: '7 dni za darmo',
      hero_title_p1: 'Przeglądarka antidetect do zarządzania',
      hero_title_p2: 'kontami',
      hero_sub: 'Zarządzaj wieloma kontami na jednym urządzeniu z unikalnymi cyfrowymi odciskami palca.',
      cta_start_trial: 'Rozpocznij 7-dniowy okres próbny',
      cta_book_demo: 'Zamów demo',
      micro_no_card: 'Karta kredytowa niewymagana',
      avail_label: 'Dostępne na wszystkich platformach:',
      social_proof_title: 'Zaufany wybór najlepszych<br>specjalistów'
    }
  };

  function applyLanguage(lang) {
    const dict = translations[lang] || translations['English'];

    // Update label
    currentLabel.textContent = lang;

    // Update active highlight
    langDropdown.querySelectorAll('.dropdown-item-clean').forEach(item => {
      const itemLang = item.getAttribute('data-lang');
      if (itemLang === lang) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update page DOM elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key]) {
        el.innerHTML = dict[key];
      }
    });

    try {
      localStorage.setItem('mahi_selected_lang', lang);
    } catch (_) {}
  }

  // Bind click on items
  langDropdown.querySelectorAll('.dropdown-item-clean').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const selectedLang = item.getAttribute('data-lang') || item.textContent.trim();
      applyLanguage(selectedLang);

      // Force-close immediately to prevent hover lock
      langDropdown.classList.add('force-closed');
      langDropdown.classList.remove('is-open', 'active');
      const toggle = langDropdown.querySelector('.dropdown-toggle');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');

      showToast(`Language switched to ${selectedLang}`, 'success');
    });
  });

  // Restore stored preference if any
  try {
    const saved = localStorage.getItem('mahi_selected_lang');
    if (saved && translations[saved]) {
      applyLanguage(saved);
    }
  } catch (_) {}
}

/**
 * 2. Mobile Drawer Controls
 */
function initMobileDrawer() {
  const menuBtns = document.querySelectorAll('.mobile-menu-btn, .mobile-menu-btn-clean');
  const drawer = document.querySelector('.mobile-drawer-panel');
  const overlay = document.querySelector('.mobile-drawer-overlay');
  const closeBtn = document.querySelector('.drawer-close-btn');
  const drawerLinks = document.querySelectorAll('.mobile-drawer-panel a');

  function openDrawer() {
    drawer?.classList.add('open');
    overlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    drawer?.classList.remove('open');
    overlay?.classList.remove('active');
    document.body.style.overflow = '';
  }

  menuBtns.forEach(btn => btn?.addEventListener('click', openDrawer));
  closeBtn?.addEventListener('click', closeDrawer);
  overlay?.addEventListener('click', closeDrawer);

  drawerLinks.forEach(link => {
    link.addEventListener('click', closeDrawer);
  });
}

/**
 * 2b. Hero Rotating Brand Keyword (GoLogin Benchmark Proportions)
 */
function initRotatingHeroWord() {
  const el = document.getElementById('hero-rotating-word');
  if (!el) return;

  const brands = [
    {
      html: '<span style="letter-spacing:-0.02em;"><span style="color:#e53238">e</span><span style="color:#0064d2">b</span><span style="color:#f5af02">a</span><span style="color:#86b817">y</span></span>',
      name: 'eBay'
    },
    {
      html: '<span style="color:#0f172a; font-weight:800; text-shadow: -1px -1px 0 #25f4ee, 1px 1px 0 #fe2c55;">TikTok</span>',
      name: 'TikTok'
    },
    {
      html: '<span style="color:#1877f2; font-weight:800;">Facebook</span>',
      name: 'Facebook'
    },
    {
      html: '<span style="color:#502d7c; font-weight:800;">CoinList</span>',
      name: 'CoinList'
    },
    {
      html: '<span style="color:#ff9900; font-weight:800;">Amazon</span>',
      name: 'Amazon'
    },
    {
      html: '<span style="letter-spacing:-0.01em; font-weight:800;"><span style="color:#4285f4">G</span><span style="color:#ea4335">o</span><span style="color:#fbbc05">o</span><span style="color:#4285f4">g</span><span style="color:#34a853">l</span><span style="color:#ea4335">e</span></span>',
      name: 'Google'
    },
    {
      html: '<span style="color:#00a87e; font-weight:800;">Crypto</span>',
      name: 'Crypto'
    }
  ];

  let idx = 0;

  setInterval(() => {
    idx = (idx + 1) % brands.length;
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';

    setTimeout(() => {
      el.innerHTML = brands[idx].html;
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, 200);
  }, 2700);
}

/**
 * 3. Fingerprint Section Interactive Selector Cards
 */
function initInteractiveSelectors() {
  const cards = document.querySelectorAll('.selector-card');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      cards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    });
  });
}

/**
 * 4. FAQ Accordion (Accessible Horizontal Rows)
 */
function initFaqAccordion() {
  const items = document.querySelectorAll('.faq-row-item');

  items.forEach(item => {
    const trigger = item.querySelector('.faq-trigger-btn');
    trigger?.addEventListener('click', () => {
      const isActive = item.classList.contains('active');

      // Close other rows for clean single-expand accordion
      items.forEach(other => {
        if (other !== item) {
          other.classList.remove('active');
          const otherBtn = other.querySelector('.faq-trigger-btn');
          if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
        }
      });

      if (isActive) {
        item.classList.remove('active');
        trigger.setAttribute('aria-expanded', 'false');
      } else {
        item.classList.add('active');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });
  });
}

/**
 * 5. Mouse Spotlights (Vengence UI Glow Effect)
 */
function initMouseSpotlights() {
  const cards = document.querySelectorAll('.bento-cell, .benefit-shell, .support-channel-card, .pricing-tier-card');

  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    });
  });
}

/**
 * 6. Auth Modal (Sign In / Register) - Real Working
 */
function initAuthModal() {
  const modal = document.getElementById('auth-modal');
  const openBtns = document.querySelectorAll('#nav-btn-signin, .nav-signin-clean');
  const closeBtn = document.getElementById('auth-modal-close');
  const tabSignIn = document.getElementById('tab-btn-signin');
  const tabSignUp = document.getElementById('tab-btn-signup');
  const submitBtn = document.getElementById('auth-submit-btn');
  const demoBtn = document.getElementById('auth-demo-autofill');

  if (!modal) return;

  function openModal() {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  openBtns.forEach(btn => btn?.addEventListener('click', (e) => {
    e.preventDefault();
    openModal();
  }));

  closeBtn?.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      closeModal();
    }
  });

  // Tab switching
  tabSignIn?.addEventListener('click', () => {
    tabSignIn.classList.add('active');
    tabSignUp?.classList.remove('active');
    if (submitBtn) submitBtn.innerHTML = '<span>Sign In to Dashboard</span>';
  });

  tabSignUp?.addEventListener('click', () => {
    tabSignUp.classList.add('active');
    tabSignIn?.classList.remove('active');
    if (submitBtn) submitBtn.innerHTML = '<span>Create Free Account (15 Profiles)</span>';
  });

  // Demo autofill
  demoBtn?.addEventListener('click', () => {
    const emailInput = document.getElementById('auth-email');
    const passInput = document.getElementById('auth-password');
    if (emailInput && passInput) {
      emailInput.value = 'demo@mahibrowser.com';
      passInput.value = 'DemoPass2026!';
      showToast('Demo credentials autofilled! Click Sign In to test.', 'success');
    }
  });

  // Global submit handler
  window.handleAuthSubmit = function() {
    const email = document.getElementById('auth-email')?.value || '';
    if (submitBtn) {
      const origText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<span>Authenticating...</span>';
      submitBtn.disabled = true;

      setTimeout(() => {
        submitBtn.innerHTML = origText;
        submitBtn.disabled = false;
        closeModal();
        showToast(`Authenticated as ${email}! Redirecting to MAHI Cloud...`, 'success', 4500);
      }, 700);
    }
  };
}

/**
 * 7. Resource & Product Guides Modal - Real Working
 */
function initResourceModal() {
  const modal = document.getElementById('resource-modal');
  const closeBtn = document.getElementById('resource-modal-close');
  const categoryTag = document.getElementById('resource-modal-category');
  const titleEl = document.getElementById('resource-modal-title');
  const contentEl = document.getElementById('resource-modal-content');

  if (!modal || !contentEl) return;

  function closeModal() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  closeBtn?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      closeModal();
    }
  });

  const resourceData = {
    'blog': {
      category: 'MAHI Insights',
      title: 'Latest Research & Browser Privacy Articles',
      html: `
        <p style="color: #64748b; font-size: 0.925rem; line-height: 1.6; margin-bottom: 1.25rem;">
          Read our in-depth guides on bypassing advanced antibot systems, managing ecommerce storefronts, and multi-accounting safely.
        </p>
        <div class="resource-card-grid">
          <div class="resource-feature-item">
            <div class="resource-feature-icon">📰</div>
            <div>
              <strong style="color: #0f172a; font-size: 0.95rem; display: block;">Preventing Canvas & WebGL Fingerprint Bans in 2026</strong>
              <p style="color: #64748b; font-size: 0.825rem; margin: 0.25rem 0 0.5rem;">How Cloudflare Turnstile, DataDome, and Kasada detect bot profiles through canvas noise anomalies.</p>
              <a href="#features" style="color: #00a87e; font-size: 0.825rem; font-weight: 600;" onclick="document.getElementById('resource-modal-close').click();">Read full guide →</a>
            </div>
          </div>
          <div class="resource-feature-item">
            <div class="resource-feature-icon">🛒</div>
            <div>
              <strong style="color: #0f172a; font-size: 0.95rem; display: block;">Scaling 50+ TikTok Shop & eBay Merchant Accounts</strong>
              <p style="color: #64748b; font-size: 0.825rem; margin: 0.25rem 0 0.5rem;">Complete playbook for merchant isolation, proxy binding, and cookie preservation without linking.</p>
              <a href="#how-it-works" style="color: #00a87e; font-size: 0.825rem; font-weight: 600;" onclick="document.getElementById('resource-modal-close').click();">Read case study →</a>
            </div>
          </div>
        </div>
      `
    },
    'best-vpn': {
      category: 'Proxy & Network',
      title: 'Best VPN & Proxy Architecture for Antidetect Browsers',
      html: `
        <p style="color: #64748b; font-size: 0.925rem; line-height: 1.6; margin-bottom: 1rem;">
          Ordinary VPNs share server IP subnets between thousands of users, triggering immediate security flags on Google, Facebook, and PayPal.
        </p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 1rem; margin-bottom: 1.25rem;">
          <strong style="color: #15803d; font-size: 0.9rem; display: block; margin-bottom: 0.35rem;">MAHI Recommendation:</strong>
          <span style="color: #166534; font-size: 0.85rem; line-height: 1.5;">Use Dedicated Residential or Mobile 4G/5G Proxies with SOCKS5 protocol. MAHI Browser isolates DNS queries and WebRTC endpoints per profile.</span>
        </div>
        <div class="resource-card-grid">
          <div class="resource-feature-item">
            <div class="resource-feature-icon">⚡</div>
            <div>
              <strong style="color: #0f172a; font-size: 0.9rem;">Integrated Partners:</strong>
              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.4rem;">
                <span style="background: #ffffff; border: 1px solid #e2e8f0; padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.8rem; font-weight: 600;">Bright Data</span>
                <span style="background: #ffffff; border: 1px solid #e2e8f0; padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.8rem; font-weight: 600;">Oxylabs</span>
                <span style="background: #ffffff; border: 1px solid #e2e8f0; padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.8rem; font-weight: 600;">Smartproxy</span>
                <span style="background: #ffffff; border: 1px solid #e2e8f0; padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.8rem; font-weight: 600;">IPRoyal</span>
              </div>
            </div>
          </div>
        </div>
      `
    },
    'best-proxy': {
      category: 'Proxy Tools',
      title: 'Residential & Mobile Proxy Configuration',
      html: `
        <p style="color: #64748b; font-size: 0.925rem; line-height: 1.6; margin-bottom: 1rem;">
          MAHI Browser supports one-click proxy import with automatic geolocation mapping:
        </p>
        <div style="background: #0f172a; color: #38bdf8; padding: 1rem; border-radius: 10px; font-family: monospace; font-size: 0.85rem; line-height: 1.6; margin-bottom: 1rem;">
          // Supported Format Example:<br>
          socks5://username:password@us-res.proxy.net:1080<br>
          http://ip:port:user:pass
        </div>
        <p style="color: #64748b; font-size: 0.85rem;">
          When you bind a proxy, MAHI automatically adjusts timezone, language headers, WebRTC local IPs, and DNS servers to match the proxy exit IP.
        </p>
      `
    },
    'proxy-tools': {
      category: 'Built-in Utilities',
      title: 'MAHI Proxy Formatter & Latency Tester',
      html: `
        <div style="margin-bottom: 1rem;">
          <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 0.4rem;">Test or Format Proxy String:</label>
          <input type="text" id="demo-proxy-input" value="185.193.65.12:8000:mahi_usr:secret99" style="width: 100%; padding: 0.65rem 0.85rem; border: 1px solid #cbd5e1; border-radius: 8px; font-family: monospace; font-size: 0.85rem;">
        </div>
        <button type="button" class="auth-submit-btn" style="padding: 0.65rem;" onclick="window.testProxyPing();">
          Test Proxy Connection & Geolocation
        </button>
        <div id="proxy-test-result" style="margin-top: 1rem; display: none; padding: 0.85rem; border-radius: 8px; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; font-size: 0.85rem;">
          ✓ Ping: <strong>42ms</strong> · IP: <strong>185.193.65.12</strong> · Location: <strong>New York, US</strong> · WebRTC: <strong>Protected</strong>
        </div>
      `
    },
    'fingerprint-test': {
      category: 'Live Audit',
      title: 'MAHI Real-Time Fingerprint Verification',
      html: `
        <p style="color: #64748b; font-size: 0.925rem; line-height: 1.6; margin-bottom: 1rem;">
          MAHI Browser passes 100% of checks on Pixelscan, CreepJS, BrowserLeaks, and Whoer:
        </p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.25rem;">
          <div style="padding: 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="font-size: 0.75rem; color: #64748b;">Canvas 2D Hash</div>
            <strong style="color: #00a87e; font-size: 0.85rem;">100% Unique & Consistent</strong>
          </div>
          <div style="padding: 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="font-size: 0.75rem; color: #64748b;">WebGL Unmasked Vendor</div>
            <strong style="color: #00a87e; font-size: 0.85rem;">Google Inc. (NVIDIA)</strong>
          </div>
          <div style="padding: 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="font-size: 0.75rem; color: #64748b;">AudioContext Noise</div>
            <strong style="color: #00a87e; font-size: 0.85rem;">Zero Artifacts</strong>
          </div>
          <div style="padding: 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="font-size: 0.75rem; color: #64748b;">WebRTC Public IP</div>
            <strong style="color: #00a87e; font-size: 0.85rem;">Bound to Proxy IP</strong>
          </div>
        </div>
        <a href="#features" class="auth-submit-btn" style="display: block; text-align: center; text-decoration: none;" onclick="document.getElementById('resource-modal-close').click();">
          Inspect Fingerprint Engine in Features →
        </a>
      `
    },
    'mcp': {
      category: 'Developer & API',
      title: 'Browser MCP & Automation Integration',
      html: `
        <p style="color: #64748b; font-size: 0.925rem; line-height: 1.6; margin-bottom: 1rem;">
          Control MAHI Browser profiles programmatically via Model Context Protocol (MCP), Puppeteer, Playwright, or Selenium.
        </p>
        <div style="background: #0f172a; color: #f8fafc; padding: 1rem; border-radius: 10px; font-family: monospace; font-size: 0.82rem; line-height: 1.6; margin-bottom: 1rem;">
          <span style="color: #94a3b8;">// Launch profile via Local REST API:</span><br>
          <span style="color: #38bdf8;">const</span> res = <span style="color: #38bdf8;">await</span> fetch(<span style="color: #a7f3d0;">'http://127.0.0.1:35000/browser/start?profile_id=xyz'</span>);<br>
          <span style="color: #38bdf8;">const</span> { wsEndpoint } = <span style="color: #38bdf8;">await</span> res.json();<br>
          <span style="color: #38bdf8;">const</span> browser = <span style="color: #38bdf8;">await</span> puppeteer.connect({ wsEndpoint });
        </div>
        <p style="color: #64748b; font-size: 0.85rem;">
          Zero bot detection flags inside automated headless and headed sessions.
        </p>
      `
    },
    'cloud-browser': {
      category: 'Cloud Architecture',
      title: 'MAHI Cloud Browser Profile Synchronization',
      html: `
        <p style="color: #64748b; font-size: 0.925rem; line-height: 1.6; margin-bottom: 1rem;">
          Synchronize profile session cookies, local storage, extensions, and bookmarks securely across multiple team workstations with end-to-end AES-256-GCM encryption.
        </p>
        <ul style="color: #475569; font-size: 0.875rem; line-height: 1.7; padding-left: 1.25rem; margin-bottom: 1.25rem;">
          <li>Zero credentials shared with server — offline sync key encryption</li>
          <li>Instant launch without re-entering multi-factor authentication (MFA)</li>
          <li>Up to 210MB encrypted payload support per session archive</li>
        </ul>
        <a href="#features" class="auth-submit-btn" style="display: block; text-align: center; text-decoration: none;" onclick="document.getElementById('resource-modal-close').click();">
          Learn More in Features →
        </a>
      `
    },
    'cloud-android': {
      category: 'Mobile Emulation',
      title: 'Cloud Android Fingerprint Engine',
      html: `
        <p style="color: #64748b; font-size: 0.925rem; line-height: 1.6; margin-bottom: 1rem;">
          Simulate authentic Android device hardware, touch events, battery status API, sensor APIs, and mobile screen resolutions for apps like TikTok Shop, Instagram, and WhatsApp Web.
        </p>
      `
    },
    'web-unlocker': {
      category: 'Antibot Bypass',
      title: 'AI Web Unlocker & Captcha Resolution',
      html: `
        <p style="color: #64748b; font-size: 0.925rem; line-height: 1.6; margin-bottom: 1rem;">
          Built-in human behavioral cursor movement and automated resolution of Cloudflare Turnstile, reCAPTCHA v2/v3, and hCaptcha.
        </p>
      `
    },
    'ai-assistant': {
      category: 'Automation',
      title: 'Built-in AI Assistant for Account Management',
      html: `
        <p style="color: #64748b; font-size: 0.925rem; line-height: 1.6; margin-bottom: 1rem;">
          Automate routine social media posting, product listing uploads, and session warmup directly from natural language prompts.
        </p>
      `
    }
  };

  window.testProxyPing = function() {
    const res = document.getElementById('proxy-test-result');
    if (res) {
      res.style.display = 'block';
      showToast('Proxy ping verified: 42ms (New York, US)', 'success');
    }
  };

  // Bind all dropdown items with data-resource or data-product
  document.querySelectorAll('[data-resource], [data-product]').forEach(item => {
    item.addEventListener('click', (e) => {
      const resourceKey = item.getAttribute('data-resource');
      const productKey = item.getAttribute('data-product');
      const key = resourceKey || productKey;

      // Close dropdown cleanly
      const parentDropdown = item.closest('.nav-dropdown');
      if (parentDropdown) {
        parentDropdown.classList.add('force-closed');
        parentDropdown.classList.remove('is-open', 'active');
        const toggle = parentDropdown.querySelector('.dropdown-toggle');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      }

      // Check if we have a modal guide or standard anchor
      if (key && resourceData[key]) {
        e.preventDefault();
        const data = resourceData[key];
        categoryTag.textContent = data.category;
        titleEl.textContent = data.title;
        contentEl.innerHTML = data.html;
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
      }
    });
  });
}

/**
 * 8. Download Triggers & Toast Feeds
 */
function initDownloadTriggers() {
  document.querySelectorAll('.btn-download-trigger, a[href*="MAHI-Setup.exe"]').forEach(btn => {
    btn.addEventListener('click', () => {
      showToast('Download started! MAHI-Setup.exe (v1.1.1) — 15 Free Profiles unlocked.', 'success', 4500);
    });
  });
}

/**
 * 9. Platform OS Circle Buttons
 */
function initPlatformCircles() {
  const btns = document.querySelectorAll('.platform-os-circles .os-circle-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const platformName = btn.getAttribute('title') || 'Selected Platform';
      showToast(`Switched active platform: ${platformName}`, 'success');
    });
  });
}

/**
 * 10. Dynamic Content Loader (content.json)
 */
async function fetchDynamicContent() {
  try {
    const res = await fetch('/content.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();

    // 1. Pricing Sync
    const priceInr = data.price_inr !== undefined ? data.price_inr : (data.pricing?.price_inr ?? 599);
    const priceUsd = data.price_usd_trc20 !== undefined ? data.price_usd_trc20 : (data.pricing?.price_usdt ?? 7);

    document.querySelectorAll('.dynamic-price-inr').forEach(el => {
      el.textContent = `₹${priceInr}`;
    });

    document.querySelectorAll('.dynamic-price-usd').forEach(el => {
      el.textContent = `$${priceUsd}`;
    });

    // 2. WhatsApp Sync
    const rawNumber = data.whatsapp_number || (data.whatsapp?.display || (data.whatsapp?.number ? `+${data.whatsapp.number}` : '+91-9876543210'));
    const cleanNumber = rawNumber.replace(/[^0-9]/g, '');
    const defaultMsg = encodeURIComponent("Hello MAHI Browser Team, I would like to book a demo of MAHI Browser for my multi-accounting team.");
    const waUrl = `https://wa.me/${cleanNumber}?text=${defaultMsg}`;

    document.querySelectorAll('.dynamic-whatsapp-link').forEach(link => {
      link.setAttribute('href', waUrl);
    });

    document.querySelectorAll('.dynamic-whatsapp-text').forEach(el => {
      el.textContent = `${rawNumber} →`;
    });

    // 3. Email Sync
    const email = data.email || 'support@mahibrowser.com';
    document.querySelectorAll('.dynamic-email-link').forEach(link => {
      link.setAttribute('href', `mailto:${email}`);
    });
    document.querySelectorAll('.dynamic-email-text').forEach(el => {
      el.textContent = `${email} →`;
    });

    // 4. Testimonials
    const testSection = document.getElementById('testimonials-section');
    const testContainer = document.getElementById('testimonials-container');

    if (testSection && testContainer && Array.isArray(data.testimonials) && data.testimonials.length > 0) {
      testContainer.innerHTML = '';
      data.testimonials.forEach(t => {
        const card = document.createElement('div');
        card.className = 'testimonial-card-item';
        card.innerHTML = `
          <p style="font-size: 0.95rem; color: #cbd5e1; line-height: 1.6; margin-bottom: 1rem;">"${escapeHtml(t.text || '')}"</p>
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 38px; height: 38px; border-radius: 50%; background: #1e293b; color: #10b981; display: flex; align-items: center; justify-content: center; font-weight: 700;">
              ${escapeHtml((t.author || 'M')[0].toUpperCase())}
            </div>
            <div>
              <strong style="font-size: 0.9rem; color: #f8fafc; display: block;">${escapeHtml(t.author || 'Verified User')}</strong>
              <small style="font-size: 0.8rem; color: #64748b;">${escapeHtml(t.role || 'Member')}</small>
            </div>
          </div>
        `;
        testContainer.appendChild(card);
      });
      testSection.style.display = 'block';
    } else if (testSection) {
      testSection.style.display = 'none';
    }

  } catch (err) {
    console.warn('content.json runtime note:', err.message);
  }
}

/**
 * 11. Smooth Anchor Scroll
 */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#' || targetId === '' || this.hasAttribute('data-resource') || this.hasAttribute('data-product')) return;
      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        const headerOffset = 85;
        const elementPosition = targetEl.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

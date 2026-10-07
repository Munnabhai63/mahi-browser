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
  initPlatformShowcase();
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
function showToast(message, type = 'success', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  // Keep max 2 active toasts to prevent stacking clutter
  while (container.children.length >= 2) {
    container.removeChild(container.firstChild);
  }

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
      social_proof_title: 'Trusted by top<br>professionals',
      showcase_title: 'Manage all your accounts safely<br>from one device',
      showcase_sub: 'Log into multiple accounts on a single device, just like a regular browser,<br class="hide-mobile"> without triggering unexpected suspicion checks',
      showcase_on_any_site: 'On any website!',
      benefit_card_1_title: 'No bans or suspicious logins on <strong>any site</strong>',
      benefit_card_1_sub: 'Independent Canvas 2D, WebGL, and AudioContext signatures ensure algorithms treat each profile as a completely separate device.',
      benefit_card_2_title: 'Access accounts <strong>from any location</strong>',
      benefit_card_2_sub: 'Bind residential, mobile, or datacenter proxies with automatic timezone, WebRTC, and geolocation alignment.',
      benefit_card_3_title: 'Share accounts easily with <strong>any team member</strong>',
      benefit_card_3_sub: 'Encrypted cloud synchronization lets coworkers access profiles without sharing raw passwords or triggering MFA locks.'
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
      social_proof_title: 'Recommandé par les<br>meilleurs experts',
      showcase_title: 'Gérez tous vos comptes en toute sécurité<br>depuis un seul appareil',
      showcase_sub: 'Connectez-vous à plusieurs comptes sur un seul appareil sans déclencher de vérifications de sécurité inattendues.',
      showcase_on_any_site: 'Sur n\'importe quel site web !',
      benefit_card_1_title: 'Aucun bannissement ni connexion suspecte sur <strong>aucun site</strong>',
      benefit_card_1_sub: 'Les signatures indépendantes garantissent que chaque profil est considéré comme un appareil distinct.',
      benefit_card_2_title: 'Accédez à vos comptes <strong>depuis n\'importe où</strong>',
      benefit_card_2_sub: 'Liez des proxys résidentiels ou mobiles avec synchronisation automatique du fuseau horaire.',
      benefit_card_3_title: 'Partagez vos comptes facilement avec <strong>votre équipe</strong>',
      benefit_card_3_sub: 'La synchronisation cloud chiffrée permet un accès d\'équipe instantané sans partager de mots de passe.'
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
      social_proof_title: 'Выбор ведущих<br>профессионалов',
      showcase_title: 'Безопасное управление всеми аккаунтами<br>на одном устройстве',
      showcase_sub: 'Входите во множество аккаунтов на одном ПК без риска блокировок и подозрительных проверок.',
      showcase_on_any_site: 'На любом веб-сайте!',
      benefit_card_1_title: 'Без банов и подозрений на <strong>любых сайтах</strong>',
      benefit_card_1_sub: 'Уникальные отпечатки Canvas, WebGL и аудио гарантируют полную независимость профилей.',
      benefit_card_2_title: 'Доступ к аккаунтам <strong>из любой точки мира</strong>',
      benefit_card_2_sub: 'Подключение резидентских и мобильных прокси с автоматической подстройкой таймзоны и WebRTC.',
      benefit_card_3_title: 'Удобный шеринг аккаунтов с <strong>командой</strong>',
      benefit_card_3_sub: 'Синхронизация профилей в зашифрованном облаке без передачи паролей и триггеров 2FA.'
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
      social_proof_title: 'Elegido por los mejores<br>profesionales',
      showcase_title: 'Gestione todas sus cuentas de forma segura<br>desde un solo dispositivo',
      showcase_sub: 'Inicie sesión en varias cuentas en un solo dispositivo sin activar bloqueos ni comprobaciones de seguridad.',
      showcase_on_any_site: '¡En cualquier sitio web!',
      benefit_card_1_title: 'Sin baneos ni sospechas en <strong>ningún sitio</strong>',
      benefit_card_1_sub: 'Huellas independientes de Canvas y WebGL para que los sitios vean cada perfil como un equipo nuevo.',
      benefit_card_2_title: 'Acceda a sus cuentas <strong>desde cualquier ubicación</strong>',
      benefit_card_2_sub: 'Asigne proxies residenciales y móviles con alineación automática de zona horaria y WebRTC.',
      benefit_card_3_title: 'Comparta cuentas fácilmente con <strong>su equipo</strong>',
      benefit_card_3_sub: 'Sincronización segura en la nube para trabajar en equipo sin compartir contraseñas maestras.'
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
      social_proof_title: '全球出海团队与<br>专业人士信赖',
      showcase_title: '一台设备安全管理<br>所有多平台账号',
      showcase_sub: '如同普通浏览器一样在单台设备上运行多账号，彻底告别意外风控与关联封禁。',
      showcase_on_any_site: '支持任意主流网站与平台！',
      benefit_card_1_title: '在<strong>任意平台</strong>均无封号或异常登录风险',
      benefit_card_1_sub: '独立的 Canvas、WebGL 与音频特征码，平台算法将每个环境识别为纯净独立设备。',
      benefit_card_2_title: '<strong>随时随地</strong>自由访问任意地理位置账号',
      benefit_card_2_sub: '无缝绑定住宅代理与移动代理，时区、WebRTC 与语言头全自动对齐。',
      benefit_card_3_title: '与<strong>任意团队成员</strong>一键快速共享账号配置',
      benefit_card_3_sub: '加密云端同步环境与 Cookie，无需透露登录明文密码即可团队协同作业。'
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
      social_proof_title: 'Vertraut von führenden<br>Profis',
      showcase_title: 'Verwalten Sie alle Ihre Konten sicher<br>von einem einzigen Gerät',
      showcase_sub: 'Melden Sie sich auf einem Gerät bei mehreren Konten an, ohne Sicherheitsprüfungen auszulösen.',
      showcase_on_any_site: 'Auf jeder Website!',
      benefit_card_1_title: 'Keine Sperren oder verdächtige Logins auf <strong>jeder Website</strong>',
      benefit_card_1_sub: 'Unabhängige Browser-Fingerabdrücke garantieren eine vollständige Profil-Isolation.',
      benefit_card_2_title: 'Zugriff auf Konten <strong>von jedem Standort</strong>',
      benefit_card_2_sub: 'Wohn- und Mobil-Proxys binden mit automatischer Zeitzonen- und WebRTC-Ausrichtung.',
      benefit_card_3_title: 'Teilen Sie Konten einfach mit <strong>Ihrem Team</strong>',
      benefit_card_3_sub: 'Verschlüsselte Cloud-Synchronisierung ohne Weitergabe vertraulicher Passwörter.'
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
      social_proof_title: 'A escolha dos melhores<br>profissionais',
      showcase_title: 'Gerencie todas as suas contas com segurança<br>em um único dispositivo',
      showcase_sub: 'Faça login em várias contas em um único dispositivo sem disparar verificações inesperadas de segurança.',
      showcase_on_any_site: 'Em qualquer site!',
      benefit_card_1_title: 'Sem bloqueios ou logins suspeitos em <strong>qualquer site</strong>',
      benefit_card_1_sub: 'Assinaturas Canvas e WebGL independentes garantem que cada perfil pareça um dispositivo separado.',
      benefit_card_2_title: 'Acesse contas <strong>de qualquer local</strong>',
      benefit_card_2_sub: 'Vincule proxies residenciais ou móveis com ajuste automático de fuso horário e WebRTC.',
      benefit_card_3_title: 'Compartilhe contas facilmente com <strong>sua equipe</strong>',
      benefit_card_3_sub: 'Sincronização na nuvem criptografada para acesso colaborativo seguro sem compartilhar senhas.'
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
      social_proof_title: '世界のプロフェッショナルが<br>選ぶ信頼性',
      showcase_title: '1台のデバイスですべての<br>アカウントを安全に一元管理',
      showcase_sub: '通常ブラウザと同じ操作感で複数アカウントを同時起動。不審なセキュリティチェックや凍結を回避。',
      showcase_on_any_site: 'あらゆるWebサイトに対応！',
      benefit_card_1_title: '<strong>あらゆるサイト</strong>でBANや不審ログイン警告をゼロに',
      benefit_card_1_sub: '独立したCanvas、WebGL、AudioContext指紋により、アルゴリズムは各プロファイルを別端末と認識。',
      benefit_card_2_title: '<strong>世界中のどこからでも</strong>自由にアカウントへアクセス',
      benefit_card_2_sub: '住宅・モバイルプロキシと自動タイムゾーン・WebRTC連携で位置偽装を完璧にシミュレート。',
      benefit_card_3_title: '<strong>チームメンバー全員</strong>とワンクリックで安全に共有',
      benefit_card_3_sub: 'パスワードを開示することなく、暗号化クラウドで安全にセッションとプロファイルを共有可能。'
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
      social_proof_title: 'Được tin cậy bởi các<br>chuyên gia hàng đầu',
      showcase_title: 'Quản lý an toàn tất cả tài khoản<br>trên cùng một thiết bị',
      showcase_sub: 'Đăng nhập nhiều tài khoản trên một thiết bị như trình duyệt thông thường, không lo checkpoint bất thường.',
      showcase_on_any_site: 'Trên mọi trang web!',
      benefit_card_1_title: 'Không khoá tài khoản hay cảnh báo trên <strong>mọi nền tảng</strong>',
      benefit_card_1_sub: 'Vân tay số Canvas và WebGL độc lập đảm bảo mỗi hồ sơ là một thiết bị vật lý hoàn toàn riêng biệt.',
      benefit_card_2_title: 'Truy cập tài khoản <strong>từ mọi vị trí địa lý</strong>',
      benefit_card_2_sub: 'Gán proxy dân cư, proxy di động với tính năng tự động đồng bộ múi giờ và WebRTC chuẩn xác.',
      benefit_card_3_title: 'Chia sẻ tài khoản dễ dàng cho <strong>thành viên nhóm</strong>',
      benefit_card_3_sub: 'Đồng bộ hóa đám mây mã hóa giúp làm việc nhóm an toàn mà không cần chia sẻ mật khẩu gốc.'
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
      social_proof_title: 'Zaufany wybór najlepszych<br>specjalistów',
      showcase_title: 'Bezpiecznie zarządzaj wszystkimi kontami<br>z jednego urządzenia',
      showcase_sub: 'Loguj się do wielu kont na jednym urządzeniu bez wywoływania podejrzanych kontroli bezpieczeństwa.',
      showcase_on_any_site: 'Na dowolnej stronie internetowej!',
      benefit_card_1_title: 'Brak banów i podejrzanych logowań na <strong>dowolnej witrynie</strong>',
      benefit_card_1_sub: 'Niezależne odciski Canvas i WebGL sprawiają, że profile są traktowane jako osobne komputery.',
      benefit_card_2_title: 'Dostęp do kont <strong>z dowolnej lokalizacji</strong>',
      benefit_card_2_sub: 'Wiązanie proxy rezydencyjnych i mobilnych z automatyczną synchronizacją strefy czasowej i WebRTC.',
      benefit_card_3_title: 'Łatwo udostępniaj konta <strong>członkom zespołu</strong>',
      benefit_card_3_sub: 'Zaszyfrowana synchronizacja w chmurze umożliwia bezpieczną współpracę bez ujawniania haseł.'
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
 * 2c. Real-Working Multi-Account Platform Showcase Engine
 * Handles real-time platform switching (Gmail, Facebook, Amazon, LinkedIn, eBay)
 * Updates browser tabs, URL bar, proxy latency chips, and dashboard feeds.
 */
function initPlatformShowcase() {
  const platformButtons = document.querySelectorAll('.platform-switch-btn');
  const tabsList = document.querySelectorAll('.mockup-tab-pill');
  const addTabBtn = document.querySelector('.mockup-add-tab-btn');
  const benefitCards = document.querySelectorAll('.benefit-card-clean');
  const urlEl = document.getElementById('mockup-url-text');
  const proxyEl = document.getElementById('mockup-proxy-text');
  const viewportEl = document.getElementById('mockup-viewport-content');

  if (!viewportEl) return;

  const platformData = {
    gmail: {
      name: 'Gmail',
      icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M2 5.5V18.5C2 19.33 2.67 20 3.5 20H6V11L12 15.5L18 11V20H20.5C21.33 20 22 19.33 22 18.5V5.5C22 4.12 20.4 3.32 19.3 4.15L12 9.62L4.7 4.15C3.6 3.32 2 4.12 2 5.5Z" fill="#ea4335"/><path d="M18 11V20H20.5C21.33 20 22 19.33 22 18.5V5.5L18 11Z" fill="#4285f4"/><path d="M2 18.5C2 19.33 2.67 20 3.5 20H6V11L2 5.5V18.5Z" fill="#34a853"/><path d="M19.3 4.15L18 11L12 15.5L18 20H20.5C21.33 20 22 19.33 22 18.5V5.5C22 4.12 20.4 3.32 19.3 4.15Z" fill="#fbbc05"/></svg>`,
      url: 'https://mail.google.com/mail/u/0/#inbox',
      proxy: 'US-East Residential · 38ms · Canvas Masked',
      tabPrefix: 'Gmail profile',
      profiles: [
        {
          badge: 'Primary Google Workspace · Admin Profile',
          title: 'Unified Corporate Inbox & Security Center',
          metric1: { label: 'Unread (Priority)', val: '4 messages' },
          metric2: { label: 'Security Health', val: '100% Secure' },
          metric3: { label: 'Session Status', val: 'Active & Valid' },
          items: [
            { tag: 'PRIMARY', tagColor: 'green', title: 'Google Workspace Billing - Monthly Statement', detail: 'From: workspace-noreply@google.com · Paid: $120.00' },
            { tag: 'PAYMENT', tagColor: 'green', title: 'Stripe Notification: Payout of $4,820.00 on the way', detail: 'From: notifications@stripe.com · Bank transfer in transit' },
            { tag: 'CLOUD', tagColor: 'blue', title: 'Google Cloud Platform: All 12 VM instances healthy', detail: 'From: cloud-alerts@google.com · CPU load: 18% avg' }
          ]
        },
        {
          badge: 'Agency Operations Hub · Client Ops Mail',
          title: 'Client Communications & Project Delivery',
          metric1: { label: 'Active Threads', val: '12 open' },
          metric2: { label: 'Delivery Rate', val: '99.4%' },
          metric3: { label: 'Proxy IP', val: '185.220.101.4' },
          items: [
            { tag: 'CLIENT', tagColor: 'blue', title: 'E-commerce Brand X: Contract signed & approved', detail: 'From: david@brandx.com · Attached: Executed_Agreement.pdf' },
            { tag: 'SLACK', tagColor: 'blue', title: '14 new notifications in #enterprise-onboarding', detail: 'From: notification@slack.com · Team activity summary' },
            { tag: 'SECURITY', tagColor: 'green', title: '2-Step Verification Completed Successfully', detail: 'Zero suspicious access triggers from local session' }
          ]
        },
        {
          badge: 'Outreach & Lead Gen · Warmup Node #3',
          title: 'Automated Email Warmup & Cold Outreach',
          metric1: { label: 'Inbox Placement', val: '98.8%' },
          metric2: { label: 'Warmup Score', val: '100 / 100' },
          metric3: { label: 'Sent Today', val: '40 / 40' },
          items: [
            { tag: 'WARMUP', tagColor: 'green', title: 'Mailreach Warmup Engine: Daily cycle complete', detail: '100% emails landed in primary folder · Zero spam folder flags' },
            { tag: 'REPLY', tagColor: 'green', title: 'Interested in Agency Growth Services - Quick Call?', detail: 'From: michael@growthagency.io · Requesting 15 min demo' },
            { tag: 'CALENDAR', tagColor: 'blue', title: 'Google Calendar: Discovery Call tomorrow at 2 PM', detail: 'Calendar invite confirmed with prospect' }
          ]
        }
      ]
    },
    facebook: {
      name: 'Facebook',
      icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="#1877f2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
      url: 'https://business.facebook.com/adsmanager/campaigns',
      proxy: 'UK-Mobile 4G · 34ms · Independent Canvas 2D',
      tabPrefix: 'Facebook profile',
      profiles: [
        {
          badge: 'Meta Ads Manager · Main BM',
          title: 'Campaigns Overview (Active Agency Profile)',
          metric1: { label: 'Spend (Today)', val: '$1,420.50' },
          metric2: { label: 'Avg ROAS', val: '4.32x' },
          metric3: { label: 'Purchases', val: '184 conv' },
          items: [
            { tag: 'ACTIVE', tagColor: 'green', title: 'Scale US - Broad Advantage+ Audience', detail: 'Budget: $500/day · Impressions: 42.1K · CTR: 3.4%' },
            { tag: 'ACTIVE', tagColor: 'green', title: 'Retargeting 30d Viewers - Dynamic Catalog', detail: 'Budget: $250/day · Frequency: 1.8 · Cost per Purchase: $14.20' },
            { tag: 'LEARNING', tagColor: 'blue', title: 'UK Creative Hook Test - Video Angle 3', detail: 'Budget: $100/day · Hook Rate: 46% · Zero bans flagged' }
          ]
        },
        {
          badge: 'Meta Ads Manager · Backup BM',
          title: 'Agency Backup & Client Retargeting',
          metric1: { label: 'Daily Cap', val: '$5,000' },
          metric2: { label: 'Page Health', val: '100% Good' },
          metric3: { label: 'Warmup Score', val: '99/100' },
          items: [
            { tag: 'ACTIVE', tagColor: 'green', title: 'Local UK Lead Generation - High Intent', detail: 'Leads: 84 · CPL: £4.20 · All instant forms verified' },
            { tag: 'SCHEDULED', tagColor: 'blue', title: 'Q4 Black Friday Early Bird Teaser', detail: 'Launching in 24h · Isolated browser cookies synced' },
            { tag: 'CLEAN', tagColor: 'green', title: 'Payment Profile - Primary Card Verified', detail: 'Billing threshold reached · Zero verification flags' }
          ]
        },
        {
          badge: 'Meta Ads Manager · Creative Farm',
          title: 'Creative Testing & UGC Sandbox',
          metric1: { label: 'Ads Testing', val: '18 variants' },
          metric2: { label: 'Top Winner', val: 'Video_V4' },
          metric3: { label: 'Proxy Node', val: 'London 4G' },
          items: [
            { tag: 'TESTING', tagColor: 'blue', title: 'UGC Split Test #12 - Founders Story', detail: 'Thumbstop: 52% · Outbound CTR: 4.1%' },
            { tag: 'ACTIVE', tagColor: 'green', title: 'High Budget Duplication Winner Set', detail: 'Scaling $300/day · WebRTC protected via proxy' },
            { tag: 'SAFE', tagColor: 'green', title: 'Browser Fingerprint Consistency Check', detail: 'AudioContext + WebGL matches native macOS Big Sur' }
          ]
        }
      ]
    },
    amazon: {
      name: 'Amazon',
      icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="#ff9900"><path d="M13.958 10.09c0 1.25-.04 2.33-.87 3.32-.67.79-1.58 1.24-2.58 1.24-1.37 0-2.16-.99-2.16-2.45 0-2.88 2.54-3.37 5.61-3.37v1.26zm3.5 8.41c-.24.2-.61.22-.88.06-1.22-.76-1.44-1.12-2.12-2.12-2.03 1.94-3.48 2.45-6.1 2.45-3.07 0-5.46-1.9-5.46-5.41 0-2.75 1.54-4.83 3.8-5.78 1.96-.82 4.7-.97 6.76-1.21v-.47c0-.82-.07-1.81-.59-2.49-.46-.6-1.25-.86-2.01-.86-1.4 0-2.63.73-2.97 2.18-.06.27-.25.5-.53.51l-3.37-.36c-.25-.05-.51-.23-.44-.57.77-3.69 4.07-4.82 7.37-4.82 1.89 0 4.36.49 5.86 1.87 1.9 1.74 1.72 4.05 1.72 6.47v5.89c0 1.8.76 2.59 1.48 3.56.24.33.27.71.05.95l-2.58 1.93z"/></svg>`,
      url: 'https://sellercentral.amazon.com/inventory',
      proxy: 'US-Residential Proxy · 41ms · Protected WebRTC',
      tabPrefix: 'Amazon profile',
      profiles: [
        {
          badge: 'Seller Central · Primary US Brand',
          title: 'Storefront Dashboard & FBA Performance',
          metric1: { label: 'Today’s Sales', val: '$14,920' },
          metric2: { label: 'Buy Box Win', val: '94.2%' },
          metric3: { label: 'Account Health', val: '1000 / Healthy' },
          items: [
            { tag: 'FBA IN STOCK', tagColor: 'green', title: 'Ergonomic Office Chair - Model Pro X', detail: 'Units: 1,420 · Days of supply: 38 · 0 stranded inventory' },
            { tag: 'BUY BOX WON', tagColor: 'green', title: 'Wireless ANC Headphones - Matte Black', detail: 'Current price: $149.99 · Buy box captured 98%' },
            { tag: 'PPC CAMPAIGN', tagColor: 'blue', title: 'Exact Match Sponsored Products Q4', detail: 'ACoS: 16.4% · Sales: $4,850 · ROAS: 6.1x' }
          ]
        },
        {
          badge: 'Seller Central · European Unified Store',
          title: 'Pan-EU FBA Multi-Marketplace Hub',
          metric1: { label: 'EU Revenue', val: '€8,430' },
          metric2: { label: 'VAT Status', val: 'Verified' },
          metric3: { label: 'IP Isolation', val: 'Frankfurt Res' },
          items: [
            { tag: 'DISPATCHED', tagColor: 'green', title: 'Pan-EU Inventory Distribution - Germany Center', detail: '210 orders shipped today · Zero transit delays' },
            { tag: 'PRICING', tagColor: 'blue', title: 'Automated Repricer - Amazon.de & Amazon.fr', detail: 'Optimized minimum margins maintained across catalog' },
            { tag: 'TRANSFER', tagColor: 'green', title: 'Bi-Weekly Disbursement Scheduled', detail: '€8,430 bank payout queued without velocity hold' }
          ]
        },
        {
          badge: 'Seller Central · Secondary Private Label',
          title: 'Private Label Brand Registry 2.0',
          metric1: { label: 'A+ Content', val: 'Active' },
          metric2: { label: 'Hijack Alert', val: '0 Threats' },
          metric3: { label: 'Review Score', val: '4.9 ★' },
          items: [
            { tag: 'BRAND RANK', tagColor: 'green', title: 'Organic Search Rank #1 - Primary Category Keyword', detail: 'Conversion rate: 24.8% · High velocity listing' },
            { tag: 'PROTECTED', tagColor: 'green', title: 'Brand Gating & Anti-Counterfeit Guard', detail: 'Zero unauthorized sellers on ASIN B09XYZ441' },
            { tag: 'REVIEWS', tagColor: 'green', title: 'Vine Voice Early Reviewer Program', detail: '28 authentic reviews captured with 4.9 average rating' }
          ]
        }
      ]
    },
    linkedin: {
      name: 'LinkedIn',
      icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="#0a66c2"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>`,
      url: 'https://www.linkedin.com/sales/lead-lists',
      proxy: 'DE-Datacenter IP · 28ms · TLS Greased',
      tabPrefix: 'LinkedIn profile',
      profiles: [
        {
          badge: 'Sales Navigator · Enterprise SDR Lead',
          title: 'Prospecting & High-Value B2B Outreach',
          metric1: { label: 'SSI Score', val: '88 / 100' },
          metric2: { label: 'InMail Acceptance', val: '46.5%' },
          metric3: { label: 'Warm Warmups', val: 'Active' },
          items: [
            { tag: 'RESPONDED', tagColor: 'green', title: 'VP of Technology at Fortune 500 Enterprise', detail: 'Interested in MAHI Browser deployment for 30 remote engineers' },
            { tag: 'CONNECTED', tagColor: 'blue', title: 'Head of Growth - High Scale E-Commerce Agency', detail: 'Accepted connection: "Let’s schedule a call this Thursday"' },
            { tag: 'SAVED LEAD', tagColor: 'green', title: 'Lead List: Top 500 Shopify Plus Agency Owners', detail: '142 verified decision makers with active profiles' }
          ]
        },
        {
          badge: 'Recruiter Corporate · Tech Talent Hub',
          title: 'Executive & Senior Engineering Recruitment',
          metric1: { label: 'Active Pipeline', val: '48 cand.' },
          metric2: { label: 'InMail Balance', val: '120 credits' },
          metric3: { label: 'Proxy Node', val: 'Berlin DC' },
          items: [
            { tag: 'INTERVIEW', tagColor: 'green', title: 'Lead Distributed Systems Engineer (Golang/Rust)', detail: 'Confirmed availability for round 2 technical assessment' },
            { tag: 'SOURCING', tagColor: 'blue', title: 'Project: Staff Frontend Architect (Remote)', detail: '18 high-match candidates imported to recruiting pipeline' },
            { tag: 'VERIFIED', tagColor: 'green', title: 'LinkedIn Recruiter Corporate Seat Verified', detail: 'Clean browser session · Zero restriction warnings' }
          ]
        },
        {
          badge: 'Founder Brand · Thought Leadership Account',
          title: 'Content Syndication & Founder Distribution',
          metric1: { label: 'Weekly Views', val: '84,200' },
          metric2: { label: 'Engagement', val: '6.4%' },
          metric3: { label: 'Followers', val: '24.1K' },
          items: [
            { tag: 'VIRAL', tagColor: 'green', title: 'Post: How Modern Antidetect Browsers Beat Fingerprinting', detail: '720 reactions · 94 comments · 112 reposts' },
            { tag: 'DM INBOX', tagColor: 'blue', title: 'Inbound Partnership Request - Proxy Infrastructure', detail: 'Proposing direct API integration with MAHI Browser' },
            { tag: 'HEALTH', tagColor: 'green', title: 'Profile Health: Pristine Algorithmic Distribution', detail: 'Zero reach throttling · Normal human interaction pattern' }
          ]
        }
      ]
    },
    ebay: {
      name: 'eBay',
      icon: `<span style="font-weight: 800; font-size: 0.75rem; letter-spacing: -0.02em;"><span style="color:#e53238">e</span><span style="color:#0064d2">b</span><span style="color:#f5af02">a</span><span style="color:#86b817">y</span></span>`,
      url: 'https://www.ebay.com/sh/ovw',
      proxy: 'US-Residential IP · 39ms · Isolated Storage',
      tabPrefix: 'eBay profile',
      profiles: [
        {
          badge: 'Seller Hub · Top Rated Plus Storefront',
          title: 'High-Volume Consumer Electronics & Collectibles',
          metric1: { label: '30-Day Sales', val: '$68,450' },
          metric2: { label: 'Feedback', val: '99.8% (2.4k)' },
          metric3: { label: 'Selling Limit', val: '$500,000' },
          items: [
            { tag: 'READY TO SHIP', tagColor: 'green', title: 'Sony Alpha A7 IV Camera Body - Priority Mail', detail: 'Paid: $2,150.00 · Tracking label generated · Ship by today' },
            { tag: 'OFFER ACCEPTED', tagColor: 'blue', title: 'MacBook Pro 16" M2 Max - Counter Offer $2,400', detail: 'Buyer paid instantly · Clean escrow hold cleared' },
            { tag: 'TOP RATED', tagColor: 'green', title: 'eBay Top Rated Plus Seller Discount Applied', detail: '10% final value fee reduction on qualifying listings' }
          ]
        },
        {
          badge: 'Seller Hub · Secondary Niche Store',
          title: 'Certified Refurbished & Open-Box Goods',
          metric1: { label: 'Today Orders', val: '38 items' },
          metric2: { label: 'Defect Rate', val: '0.00%' },
          metric3: { label: 'Bank Payout', val: '$4,120.00' },
          items: [
            { tag: 'PAID', tagColor: 'green', title: 'Bose QuietComfort 45 Over-Ear Headphones', detail: 'Sold via Promoted Listings (ROAS: 7.2x) · 2 units left' },
            { tag: 'ACTIVE', tagColor: 'green', title: 'Promoted Listings Advanced Campaign', detail: 'Ad spend: $84.00 · Attributed sales: $940.00' },
            { tag: 'CLEAN', tagColor: 'green', title: 'Managed Payments Disbursement Initiated', detail: 'Direct deposit to isolated business bank account' }
          ]
        },
        {
          badge: 'Seller Hub · Vintage & Trading Cards Store',
          title: 'Rare Memorabilia & High-Ticket Auctions',
          metric1: { label: 'Active Bids', val: '$18,900' },
          metric2: { label: 'Watchers', val: '412 users' },
          metric3: { label: 'Fingerprint', val: 'Dedicated OS' },
          items: [
            { tag: 'AUCTION ENDING', tagColor: 'blue', title: '1999 Pokemon 1st Edition Charizard PSA 9', detail: 'Current bid: $6,450.00 · 3 hours remaining · 84 watchers' },
            { tag: 'OFFERS SENT', tagColor: 'blue', title: 'Special 10% Discount to 24 Interested Watchers', detail: 'Automated buyer conversion rule running cleanly' },
            { tag: 'SAFE', tagColor: 'green', title: 'Isolated Cookie & LocalStorage State Verified', detail: 'Zero linkage with store #1 or store #2' }
          ]
        }
      ]
    }
  };

  let currentPlatform = 'gmail';
  let currentTabIndex = 1;

  function renderPlatform(platformKey, tabIndex = 1) {
    const data = platformData[platformKey] || platformData.gmail;
    currentPlatform = platformKey;
    currentTabIndex = tabIndex;

    // 1. Update Platform Switcher Active Button
    platformButtons.forEach(btn => {
      const p = btn.getAttribute('data-platform');
      if (p === platformKey) {
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
      }
    });

    // 2. Update Browser Tabs (1, 2, 3)
    for (let i = 1; i <= 3; i++) {
      const iconEl = document.getElementById(`tab-icon-${i}`);
      const nameEl = document.getElementById(`tab-name-${i}`);
      if (iconEl) iconEl.innerHTML = data.icon;
      if (nameEl) nameEl.textContent = `${data.tabPrefix} ${i}`;
    }

    // 3. Highlight Active Tab
    tabsList.forEach(tab => {
      const idx = parseInt(tab.getAttribute('data-tab-index')) || 1;
      if (idx === currentTabIndex) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // 4. Update Address Bar URL and Proxy
    if (urlEl) urlEl.textContent = data.url;
    if (proxyEl) proxyEl.textContent = data.proxy;

    // 5. Render Viewport Content
    const profile = data.profiles[currentTabIndex - 1] || data.profiles[0];
    viewportEl.innerHTML = `
      <div class="viewport-layout-grid">
        <!-- Sidebar Navigation -->
        <div class="viewport-sidebar">
          <div class="sidebar-user-pill">
            <div class="sidebar-avatar">${escapeHtml(data.name[0])}</div>
            <div class="sidebar-user-info">
              <strong>${escapeHtml(data.tabPrefix)} ${currentTabIndex}</strong>
              <span>Active Session</span>
            </div>
          </div>
          <div class="sidebar-nav-item active" data-nav="overview">
            <span>📊 Overview</span>
          </div>
          <div class="sidebar-nav-item" data-nav="feeds">
            <span>⚡ Live Feeds</span>
          </div>
          <div class="sidebar-nav-item" data-nav="fingerprint">
            <span>🛡️ Fingerprint</span>
          </div>
          <div class="sidebar-nav-item" data-nav="settings">
            <span>⚙️ Settings</span>
          </div>
        </div>

        <!-- Main Feed Pane -->
        <div class="viewport-main-pane">
          <div class="viewport-feed-header">
            <div>
              <span class="viewport-feed-badge">${escapeHtml(profile.badge)}</span>
              <h4 class="viewport-feed-title">${escapeHtml(profile.title)}</h4>
            </div>
            <div class="viewport-metrics-row">
              <div class="metric-pill">
                <span class="metric-label">${escapeHtml(profile.metric1.label)}</span>
                <strong class="metric-val">${escapeHtml(profile.metric1.val)}</strong>
              </div>
              <div class="metric-pill">
                <span class="metric-label">${escapeHtml(profile.metric2.label)}</span>
                <strong class="metric-val">${escapeHtml(profile.metric2.val)}</strong>
              </div>
              <div class="metric-pill">
                <span class="metric-label">${escapeHtml(profile.metric3.label)}</span>
                <strong class="metric-val">${escapeHtml(profile.metric3.val)}</strong>
              </div>
            </div>
          </div>

          <div class="viewport-feed-list">
            ${profile.items.map(item => `
              <div class="viewport-feed-card">
                <div class="feed-tag tag-${escapeHtml(item.tagColor)}">${escapeHtml(item.tag)}</div>
                <div class="feed-content">
                  <strong>${escapeHtml(item.title)}</strong>
                  <p>${escapeHtml(item.detail)}</p>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    // 6. Synchronize active benefit card below
    const platformToBenefit = {
      gmail: 'bans',
      facebook: 'bans',
      amazon: 'location',
      ebay: 'location',
      linkedin: 'team'
    };
    const activeBenefit = platformToBenefit[platformKey] || 'bans';
    benefitCards.forEach(card => {
      if (card.getAttribute('data-benefit') === activeBenefit) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });

    // Wire internal sidebar item clicks
    viewportEl.querySelectorAll('.sidebar-nav-item').forEach(navItem => {
      navItem.addEventListener('click', () => {
        viewportEl.querySelectorAll('.sidebar-nav-item').forEach(n => n.classList.remove('active'));
        navItem.classList.add('active');
        const navName = navItem.textContent.trim();
        showToast(`${data.name} Profile ${currentTabIndex}: Navigated to ${navName}`, 'success', 2200);
      });
    });
  }

  // Bind Platform Button Click Handlers
  platformButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const platformKey = btn.getAttribute('data-platform');
      if (platformKey && platformData[platformKey]) {
        renderPlatform(platformKey, 1);
        showToast(`Switched active profile: ${platformData[platformKey].name} (Profile 1)`, 'success', 2500);
      }
    });
  });

  // Bind Browser Tab Pill Click Handlers
  tabsList.forEach(tab => {
    tab.addEventListener('click', (e) => {
      if (e.target.classList.contains('mockup-tab-close')) {
        e.stopPropagation();
        showToast('Profile tab archived cleanly. Encryption key preserved.', 'success', 2500);
        return;
      }
      const idx = parseInt(tab.getAttribute('data-tab-index')) || 1;
      renderPlatform(currentPlatform, idx);
      const data = platformData[currentPlatform];
      showToast(`Switched tab: ${data.name} Profile ${idx}`, 'success', 2200);
    });
  });

  // Bind Add Tab Button Click
  if (addTabBtn) {
    addTabBtn.addEventListener('click', () => {
      showToast('New isolated profile instance launched! Independent fingerprint generated.', 'success', 3000);
    });
  }

  // Bind Benefit Cards Below (Bidirectional selection)
  benefitCards.forEach(card => {
    card.addEventListener('click', () => {
      benefitCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const benefitType = card.getAttribute('data-benefit');
      const benefitToPlatform = {
        'bans': 'gmail',
        'location': 'amazon',
        'team': 'linkedin'
      };
      if (benefitToPlatform[benefitType]) {
        renderPlatform(benefitToPlatform[benefitType], 1);
      }
      const messages = {
        'bans': 'No Bans: Independent Canvas 2D, WebGL & AudioContext noise active for profiles.',
        'location': 'Any Location: Residential proxy binding with automatic timezone & WebRTC sync.',
        'team': 'Team Sharing: Encrypted cloud synchronization active without sharing passwords.'
      };
      showToast(messages[benefitType] || 'Feature highlighted', 'success', 3000);
    });
  });

  // Initialize with Gmail (matching default markup)
  renderPlatform('gmail', 1);
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

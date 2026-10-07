/**
 * MAHI BROWSER — LANDING PAGE ENGINE
 * Minimal, zero external dependencies, accessible, high performance.
 */

document.addEventListener('DOMContentLoaded', () => {
  initSpotlightNavbar();
  initMobileDrawer();
  initFaqAccordion();
  fetchDynamicContent();
  initSmoothScroll();
});

/**
 * 1. Spotlight Navbar cursor tracker & scroll effects
 */
function initSpotlightNavbar() {
  const navbar = document.querySelector('.navbar');
  const navItems = document.querySelectorAll('.nav-links a, .nav-actions .btn');

  // Sticky shrink on scroll
  window.addEventListener('scroll', () => {
    if (window.scrollY > 30) {
      navbar?.classList.add('is-scrolled');
    } else {
      navbar?.classList.remove('is-scrolled');
    }
  }, { passive: true });

  // Radial glow mouse movement
  navItems.forEach(item => {
    item.addEventListener('mousemove', (e) => {
      const rect = item.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      item.style.setProperty('--x', `${x}px`);
      item.style.setProperty('--y', `${y}px`);
    });
  });
}

/**
 * 2. Mobile slide-out drawer
 */
function initMobileDrawer() {
  const menuBtn = document.querySelector('.mobile-menu-btn');
  const drawer = document.querySelector('.mobile-drawer');
  const overlay = document.querySelector('.drawer-overlay');
  const closeBtn = document.querySelector('.drawer-close-btn');
  const drawerLinks = document.querySelectorAll('.drawer-links a');

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

  menuBtn?.addEventListener('click', openDrawer);
  closeBtn?.addEventListener('click', closeDrawer);
  overlay?.addEventListener('click', closeDrawer);

  drawerLinks.forEach(link => {
    link.addEventListener('click', closeDrawer);
  });
}

/**
 * 3. FAQ Accordion (accessible, smooth height)
 */
function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const questionBtn = item.querySelector('.faq-question');
    questionBtn?.addEventListener('click', () => {
      const isActive = item.classList.contains('active');

      // Close other active items
      faqItems.forEach(other => {
        if (other !== item) {
          other.classList.remove('active');
          const otherBtn = other.querySelector('.faq-question');
          if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
        }
      });

      // Toggle current item
      if (isActive) {
        item.classList.remove('active');
        questionBtn.setAttribute('aria-expanded', 'false');
      } else {
        item.classList.add('active');
        questionBtn.setAttribute('aria-expanded', 'true');
      }
    });
  });
}

/**
 * 4. Runtime content.json loader (Pricing, WhatsApp, Testimonials)
 */
async function fetchDynamicContent() {
  try {
    const res = await fetch('/content.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();

    // 1. Update Pricing (Fallback defaults: 599 INR, 7 USDT)
    const priceInr = data.price_inr !== undefined ? data.price_inr : (data.pricing?.price_inr ?? 599);
    const priceUsd = data.price_usd_trc20 !== undefined ? data.price_usd_trc20 : (data.pricing?.price_usdt ?? 7);

    const inrElements = document.querySelectorAll('.dynamic-price-inr');
    inrElements.forEach(el => {
      el.textContent = `₹${priceInr}`;
    });

    const usdElements = document.querySelectorAll('.dynamic-price-usd');
    usdElements.forEach(el => {
      el.textContent = `$${priceUsd}`;
    });

    // 2. Update WhatsApp links
    const whatsappNum = data.whatsapp_number || (data.whatsapp?.display || (data.whatsapp?.number ? `+${data.whatsapp.number}` : '+91-9876543210'));

    const cleanWaNum = whatsappNum.replace(/[^0-9]/g, '');
    const defaultMsg = encodeURIComponent("Hi, I want to inquire about MAHI Browser PRO subscription.");
    const waUrl = `https://wa.me/${cleanWaNum}?text=${defaultMsg}`;

    const waLinks = document.querySelectorAll('.dynamic-whatsapp-link');
    waLinks.forEach(link => {
      link.setAttribute('href', waUrl);
    });

    const waTexts = document.querySelectorAll('.dynamic-whatsapp-text');
    waTexts.forEach(el => {
      el.textContent = whatsappNum;
    });

    // 3. Update Email
    const email = data.email || 'support@mahibrowser.com';
    const emailLinks = document.querySelectorAll('.dynamic-email-link');
    emailLinks.forEach(link => {
      link.setAttribute('href', `mailto:${email}`);
    });
    const emailTexts = document.querySelectorAll('.dynamic-email-text');
    emailTexts.forEach(el => {
      el.textContent = email;
    });

    // 4. Testimonials (Strict Honesty: Hidden unless non-empty array exists)
    const testSection = document.getElementById('testimonials-section');
    const testContainer = document.getElementById('testimonials-container');

    if (testSection && testContainer && Array.isArray(data.testimonials) && data.testimonials.length > 0) {
      testContainer.innerHTML = '';
      data.testimonials.forEach(t => {
        const card = document.createElement('div');
        card.className = 'testimonial-card';
        card.innerHTML = `
          <p class="testimonial-text">"${escapeHtml(t.text || '')}"</p>
          <div class="testimonial-author">
            <div class="testimonial-avatar">${escapeHtml((t.author || 'M')[0].toUpperCase())}</div>
            <div class="testimonial-info">
              <h4>${escapeHtml(t.author || 'Verified User')}</h4>
              <p>${escapeHtml(t.role || 'Member')}</p>
            </div>
            ${t.tag ? `<span class="testimonial-badge">${escapeHtml(t.tag)}</span>` : ''}
          </div>
        `;
        testContainer.appendChild(card);
      });
      testSection.style.display = 'block';
    } else if (testSection) {
      testSection.style.display = 'none';
    }

  } catch (err) {
    console.warn('Note: content.json fetch failed or using defaults:', err.message);
  }
}

/**
 * 5. Smooth Anchor Scrolling
 */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#' || targetId === '') return;
      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        const headerOffset = 80;
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

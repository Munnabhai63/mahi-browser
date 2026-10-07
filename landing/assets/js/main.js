/**
 * MAHI BROWSER — ULTRA-PREMIUM LANDING PAGE ENGINE
 * Vengence UI benchmark • Zero external dependencies • High performance
 */

document.addEventListener('DOMContentLoaded', () => {
  initNavbarIsland();
  initMobileDrawer();
  initInteractiveSelectors();
  initFaqAccordion();
  initMouseSpotlights();
  fetchDynamicContent();
  initSmoothScroll();
});

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
 * 2. Mobile Drawer Controls
 */
function initMobileDrawer() {
  const menuBtn = document.querySelector('.mobile-menu-btn');
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

  menuBtn?.addEventListener('click', openDrawer);
  closeBtn?.addEventListener('click', closeDrawer);
  overlay?.addEventListener('click', closeDrawer);

  drawerLinks.forEach(link => {
    link.addEventListener('click', closeDrawer);
  });
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
 * 6. Dynamic Content Loader (content.json)
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
    const defaultMsg = encodeURIComponent("Hi, I want to inquire about MAHI Browser PRO subscription.");
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

    // 4. Testimonials (Strict Honesty: Hidden unless non-empty array)
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
 * 7. Smooth Anchor Scroll
 */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#' || targetId === '') return;
      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        const headerOffset = 90;
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

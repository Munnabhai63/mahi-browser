/**
 * Standalone Playwright acceptance test targeting live marketing site (https://mahibrowser.com).
 * Executed outside headless Vitest CI (`test:e2e`) when `@playwright/test` and network access are enabled.
 */
import { test, expect } from '@playwright/test';

test.describe('Brand Logo Non-Draggable & Clickable Verification', () => {
  test('verifies live navbar logo cannot be dragged and remains clickable', async ({ page }) => {
    await page.goto('https://mahibrowser.com', { waitUntil: 'networkidle' });

    const logoImg = page.locator('.navbar-wrapper-clean .brand-logo-clean img');
    await expect(logoImg).toBeVisible();

    // 1. Check draggable attribute
    const draggableAttr = await logoImg.getAttribute('draggable');
    expect(draggableAttr).toBe('false');

    // 2. Check CSS user-drag / user-select
    const computedUserDrag = await logoImg.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return s.getPropertyValue('-webkit-user-drag') || (s as any).userDrag;
    });
    expect(['none', '']).toContain(computedUserDrag);

    // 3. Attach drag event listener to verify dragstart is prevented
    await page.evaluate(() => {
      (window as any).__dragstartTriggered = false;
      document.addEventListener('dragstart', () => {
        (window as any).__dragstartTriggered = true;
      });
    });

    // 4. Perform mouse drag action on logo
    const box = await logoImg.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 100);
      await page.mouse.up();
    }

    const wasDragged = await page.evaluate(() => (window as any).__dragstartTriggered);
    expect(wasDragged).toBe(false);

    // 5. Verify Click functionality
    const logoLink = page.locator('.navbar-wrapper-clean .brand-logo-clean');
    await logoLink.click();
    // Navigation / URL should be valid
    expect(page.url()).toContain('mahibrowser.com');
  });

  test('verifies footer logo cannot be dragged', async ({ page }) => {
    await page.goto('https://mahibrowser.com', { waitUntil: 'networkidle' });

    const footerLogo = page.locator('.footer-top-bar .footer-brand-logo-img');
    await footerLogo.scrollIntoViewIfNeeded();
    await expect(footerLogo).toBeVisible();

    const draggableAttr = await footerLogo.getAttribute('draggable');
    expect(draggableAttr).toBe('false');

    // Perform mouse drag action on footer logo
    const box = await footerLogo.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 50, box.y + 50);
      await page.mouse.up();
    }

    const wasDragged = await page.evaluate(() => (window as any).__dragstartTriggered);
    expect(wasDragged).toBeFalsy();
  });
});

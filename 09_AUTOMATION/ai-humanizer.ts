/**
 * AI Humanizer Engine
 * 
 * Provides organic, non-linear human motion simulation for mouse movements and keystrokes.
 * Prevents behavioral heuristics detection by modern anti-bot systems (Datadome, Cloudflare Turnstile,
 * Akamai Bot Manager, Kasada, PerimeterX) that monitor mouse velocity vectors, linear movement,
 * and unnatural zero-millisecond click intervals.
 */

export interface Point {
  x: number;
  y: number;
}

export interface HumanizerOptions {
  steps?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  jitterStrength?: number;
}

/**
 * Calculates a point along a cubic Bezier curve for a given parameter t (0 <= t <= 1)
 */
function cubicBezierPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

/**
 * Generates an organic trajectory of Points between start and end using random Bezier control points.
 */
export function generateHumanPath(start: Point, end: Point, steps = 25, jitter = 2): Point[] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Generate randomized control points with human arc deviation
  const deviation = Math.min(distance * 0.35, 120);
  const sign = Math.random() > 0.5 ? 1 : -1;

  const cp1: Point = {
    x: start.x + dx * 0.25 + sign * (Math.random() * deviation),
    y: start.y + dy * 0.25 - sign * (Math.random() * deviation),
  };

  const cp2: Point = {
    x: start.x + dx * 0.75 - sign * (Math.random() * deviation * 0.5),
    y: start.y + dy * 0.75 + sign * (Math.random() * deviation * 0.5),
  };

  const path: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    // Non-linear easing (smooth acceleration and deceleration)
    const t = i / steps;
    // Ease in-out sine
    const easedT = -(Math.cos(Math.PI * t) - 1) / 2;
    const pt = cubicBezierPoint(start, cp1, cp2, end, easedT);

    // Apply micro-jitter (tremors in human muscle control)
    if (i > 0 && i < steps) {
      pt.x += (Math.random() - 0.5) * jitter;
      pt.y += (Math.random() - 0.5) * jitter;
    }

    path.push({ x: Math.round(pt.x), y: Math.round(pt.y) });
  }

  return path;
}

/**
 * Simulates a humanized mouse move and click on a target selector using Playwright Page
 */
export async function humanClick(page: any, selector: string, options?: HumanizerOptions): Promise<void> {
  const element = await page.waitForSelector(selector, { state: 'visible', timeout: 15000 });
  const box = await element.boundingBox();
  if (!box) {
    await page.click(selector);
    return;
  }

  // Pick a natural point inside the bounding box (not always dead center)
  const targetX = box.x + box.width * (0.3 + Math.random() * 0.4);
  const targetY = box.y + box.height * (0.3 + Math.random() * 0.4);

  // Current or initial mouse position
  const currentPos: Point = {
    x: Math.round(box.x + (Math.random() - 0.5) * 400),
    y: Math.round(box.y + (Math.random() - 0.5) * 300),
  };

  const trajectory = generateHumanPath(currentPos, { x: targetX, y: targetY }, options?.steps || 30, options?.jitterStrength || 1.5);

  // Move along the trajectory
  for (const pt of trajectory) {
    await page.mouse.move(pt.x, pt.y);
    // Variable micro-delay between points
    const stepDelay = Math.floor(Math.random() * 6) + 4;
    await new Promise((r) => setTimeout(r, stepDelay));
  }

  // Pre-click hesitation (50ms - 140ms)
  await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 90) + 50));

  await page.mouse.down();
  // Hold click for realistic human duration (60ms - 120ms)
  await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 60) + 60));
  await page.mouse.up();
}

/**
 * Simulates organic human typing into an input field with variable speed and micro-pauses
 */
export async function humanType(page: any, selector: string, text: string, options?: { minDelay?: number; maxDelay?: number }): Promise<void> {
  await humanClick(page, selector);

  const min = options?.minDelay || 45;
  const max = options?.maxDelay || 140;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    await page.keyboard.press(char);

    // Natural keystroke delay with normal distribution
    let delay = Math.floor(min + Math.random() * (max - min));

    // Simulate occasional human pauses (thinking or space bar)
    if (char === ' ' || Math.random() < 0.08) {
      delay += Math.floor(Math.random() * 180) + 100;
    }

    await new Promise((r) => setTimeout(r, delay));
  }
}

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
 * Generates an organic trajectory of Points between start and end using random Bezier control points,
 * enhanced with ghost-cursor style Fitts's Law ballistic movement and overshoot micro-corrections.
 */
export function generateHumanPath(start: Point, end: Point, steps = 25, jitter = 2): Point[] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < 1) {
    return [{ x: Math.round(end.x), y: Math.round(end.y) }];
  }

  // Fitts's Law: For longer movements (distance > 70px), humans produce a ballistic
  // initial impulse with a slight overshoot (2% - 5%), followed by a corrective phase.
  const hasOvershoot = distance > 70 && steps >= 12;
  const overshootMag = hasOvershoot ? Math.min(distance * 0.04, 12) : 0;
  const overshootAngle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.2;
  const intermediateTarget: Point = hasOvershoot
    ? {
        x: end.x + Math.cos(overshootAngle) * overshootMag,
        y: end.y + Math.sin(overshootAngle) * overshootMag,
      }
    : end;

  // Arc deviation
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

  const ballisticSteps = hasOvershoot ? Math.floor(steps * 0.8) : steps;
  const path: Point[] = [];

  for (let i = 0; i <= ballisticSteps; i++) {
    const t = i / ballisticSteps;
    // Asymmetric human acceleration profile: fast ballistic acceleration, gradual deceleration
    const easedT = t < 0.4
      ? 2.5 * t * t
      : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const clampedT = Math.max(0, Math.min(1, easedT));
    const pt = cubicBezierPoint(start, cp1, cp2, intermediateTarget, clampedT);

    if (i > 0 && i < ballisticSteps) {
      pt.x += (Math.random() - 0.5) * jitter;
      pt.y += (Math.random() - 0.5) * jitter;
    }

    path.push({ x: Math.round(pt.x), y: Math.round(pt.y) });
  }

  // Corrective phase: micro-correction from intermediateTarget to actual end
  if (hasOvershoot) {
    const correctionSteps = steps - ballisticSteps;
    const correctionStart = path[path.length - 1];
    for (let j = 1; j <= correctionSteps; j++) {
      const ct = j / correctionSteps;
      const easedCt = -(Math.cos(Math.PI * ct) - 1) / 2; // smooth settle
      const cx = correctionStart.x + (end.x - correctionStart.x) * easedCt;
      const cy = correctionStart.y + (end.y - correctionStart.y) * easedCt;
      path.push({
        x: Math.round(cx + (j < correctionSteps ? (Math.random() - 0.5) * (jitter * 0.5) : 0)),
        y: Math.round(cy + (j < correctionSteps ? (Math.random() - 0.5) * (jitter * 0.5) : 0)),
      });
    }
  }

  // Ensure exact final coordinate matches destination end
  path[path.length - 1] = { x: Math.round(end.x), y: Math.round(end.y) };

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

  // Pre-click hover dwell & hesitation (ghost-cursor cognitive settling: 80ms - 180ms)
  await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 100) + 80));

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

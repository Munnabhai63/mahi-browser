/**
 * MAHI Browser — Multi-Window Grid Tiler & Screen Layout Calculator
 * Reverse-Engineered from MostLogin's Desktop Qunkong (群控) Window Layout System
 * 
 * Automatically calculates optimal grid arrangements (2x2, 3x2, 3x3, 4x3, 4x4)
 * to tile multiple isolated browser profiles side-by-side across the user's desktop
 * for live multi-window synchronization.
 */

export interface ScreenDimensions {
  width: number;
  height: number;
  taskbarHeight?: number;
}

export interface WindowLayout {
  index: number;
  total: number;
  columns: number;
  rows: number;
  x: number;
  y: number;
  width: number;
  height: number;
  launchArgs: string[];
}

export interface GridTilingOptions {
  screenWidth?: number;
  screenHeight?: number;
  taskbarHeight?: number;
  margin?: number;
  customColumns?: number;
  customRows?: number;
}

const DEFAULT_SCREEN_WIDTH = 1920;
const DEFAULT_SCREEN_HEIGHT = 1080;
const DEFAULT_TASKBAR_HEIGHT = 40; // Windows default taskbar height
const DEFAULT_MARGIN = 2; // Pixel gap between windows

/**
 * Calculates optimal grid dimensions (columns, rows) for a given count of windows.
 */
export function calculateOptimalGrid(total: number, customCols?: number, customRows?: number): { columns: number; rows: number } {
  if (customCols && customRows) {
    return { columns: customCols, rows: customRows };
  }
  if (total <= 1) return { columns: 1, rows: 1 };
  if (total === 2) return { columns: 2, rows: 1 };
  if (total <= 4) return { columns: 2, rows: 2 };
  if (total <= 6) return { columns: 3, rows: 2 };
  if (total <= 9) return { columns: 3, rows: 3 };
  if (total <= 12) return { columns: 4, rows: 3 };
  if (total <= 16) return { columns: 4, rows: 4 };

  // For massive batches (e.g. 20+ profiles in farm mode), compute square aspect ratio
  const columns = Math.ceil(Math.sqrt(total * (16 / 9)));
  const rows = Math.ceil(total / columns);
  return { columns, rows };
}

/**
 * Computes exact pixel placement (x, y, width, height) and Chromium launch flags
 * for profile window at index `windowIndex` out of `totalWindows`.
 */
export function calculateWindowLayout(
  windowIndex: number,
  totalWindows: number,
  options: GridTilingOptions = {}
): WindowLayout {
  const screenW = options.screenWidth || DEFAULT_SCREEN_WIDTH;
  const screenH = (options.screenHeight || DEFAULT_SCREEN_HEIGHT) - (options.taskbarHeight ?? DEFAULT_TASKBAR_HEIGHT);
  const margin = options.margin ?? DEFAULT_MARGIN;

  const { columns, rows } = calculateOptimalGrid(totalWindows, options.customColumns, options.customRows);

  const colIndex = windowIndex % columns;
  const rowIndex = Math.floor(windowIndex / columns);

  // Compute cell width and height with margin offsets
  const totalMarginW = (columns + 1) * margin;
  const totalMarginH = (rows + 1) * margin;

  const winW = Math.max(320, Math.floor((screenW - totalMarginW) / columns));
  const winH = Math.max(240, Math.floor((screenH - totalMarginH) / rows));

  const winX = margin + colIndex * (winW + margin);
  const winY = margin + rowIndex * (winH + margin);

  const launchArgs = [
    `--window-position=${winX},${winY}`,
    `--window-size=${winW},${winH}`,
  ];

  return {
    index: windowIndex,
    total: totalWindows,
    columns,
    rows,
    x: winX,
    y: winY,
    width: winW,
    height: winH,
    launchArgs,
  };
}

/**
 * Generates full multi-window layout array for batch profile launching.
 */
export function generateBatchWindowLayouts(
  totalWindows: number,
  options: GridTilingOptions = {}
): WindowLayout[] {
  const layouts: WindowLayout[] = [];
  for (let i = 0; i < totalWindows; i++) {
    layouts.push(calculateWindowLayout(i, totalWindows, options));
  }
  return layouts;
}

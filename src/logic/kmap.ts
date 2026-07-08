import type { BooleanExpression, KMapCell, KMapGroup, PrimeImplicant } from './types';
import { getActiveMinterms } from './quine-mccluskey';

const GROUP_COLORS = [
  { stroke: 'var(--group-1)', fill: 'var(--group-1-bg)' },
  { stroke: 'var(--group-2)', fill: 'var(--group-2-bg)' },
  { stroke: 'var(--group-3)', fill: 'var(--group-3-bg)' },
  { stroke: 'var(--group-4)', fill: 'var(--group-4-bg)' },
  { stroke: 'var(--group-5)', fill: 'var(--group-5-bg)' },
  { stroke: 'var(--group-6)', fill: 'var(--group-6-bg)' },
];

/** Gray code sequences */
const GRAY_2 = ['0', '1'];
const GRAY_4 = ['00', '01', '11', '10'];

/**
 * Get K-Map grid dimensions and gray code labels.
 */
export function getKMapLayout(varCount: number): {
  rows: number;
  cols: number;
  rowCodes: string[];
  colCodes: string[];
  rowVars: string;
  colVars: string;
} {
  switch (varCount) {
    case 2:
      return {
        rows: 2,
        cols: 2,
        rowCodes: GRAY_2,
        colCodes: GRAY_2,
        rowVars: 'A',
        colVars: 'B',
      };
    case 3:
      return {
        rows: 2,
        cols: 4,
        rowCodes: GRAY_2,
        colCodes: GRAY_4,
        rowVars: 'A',
        colVars: 'BC',
      };
    case 4:
      return {
        rows: 4,
        cols: 4,
        rowCodes: GRAY_4,
        colCodes: GRAY_4,
        rowVars: 'AB',
        colVars: 'CD',
      };
    default:
      throw new Error(`Unsupported variable count: ${varCount}`);
  }
}

/**
 * Map a minterm index to its K-Map (row, col) position.
 */
export function mintermToKMapPos(index: number, varCount: number): { row: number; col: number } {
  const layout = getKMapLayout(varCount);
  const binary = index.toString(2).padStart(varCount, '0');

  let rowBits: string;
  let colBits: string;

  switch (varCount) {
    case 2:
      rowBits = binary[0];
      colBits = binary[1];
      break;
    case 3:
      rowBits = binary[0];
      colBits = binary.substring(1);
      break;
    case 4:
      rowBits = binary.substring(0, 2);
      colBits = binary.substring(2);
      break;
    default:
      throw new Error(`Unsupported variable count: ${varCount}`);
  }

  const row = layout.rowCodes.indexOf(rowBits);
  const col = layout.colCodes.indexOf(colBits);

  return { row, col };
}

/**
 * Generate K-Map grid from a boolean expression.
 */
export function generateKMap(expr: BooleanExpression): KMapCell[][] {
  const layout = getKMapLayout(expr.varCount);
  const { minterms, dontCares } = getActiveMinterms(expr);
  const mintermSet = new Set(minterms);
  const dcSet = new Set(dontCares);

  const grid: KMapCell[][] = [];

  for (let r = 0; r < layout.rows; r++) {
    const row: KMapCell[] = [];
    for (let c = 0; c < layout.cols; c++) {
      // Find the minterm index for this cell
      const rowBits = layout.rowCodes[r];
      const colBits = layout.colCodes[c];
      const binary = rowBits + colBits;
      const index = parseInt(binary, 2);

      let value: 0 | 1 | 'x';
      if (dcSet.has(index)) {
        value = 'x';
      } else if (mintermSet.has(index)) {
        value = 1;
      } else {
        value = 0;
      }

      row.push({ index, row: r, col: c, value, groups: [] });
    }
    grid.push(row);
  }

  return grid;
}

/**
 * Generate K-Map groups from selected prime implicants.
 */
export function generateKMapGroups(
  selectedImplicants: PrimeImplicant[]
): KMapGroup[] {
  return selectedImplicants.map((pi, i) => {
    const colorIdx = i % GROUP_COLORS.length;
    const cells = pi.coveredMinterms.map((m) => m);

    return {
      cells,
      expression: pi.expression,
      color: GROUP_COLORS[colorIdx].stroke,
      colorBg: GROUP_COLORS[colorIdx].fill,
      implicant: pi,
    };
  });
}

/**
 * Get the (row, col) positions for a list of minterm indices.
 */
export function getCellPositions(
  minterms: number[],
  varCount: number,
): { row: number; col: number }[] {
  return minterms.map((m) => mintermToKMapPos(m, varCount));
}

/**
 * Find the bounding rectangles for a K-Map group, accounting for wrap-around.
 * Returns one or more rectangles { minRow, maxRow, minCol, maxCol }.
 */
export function getGroupRectangles(
  minterms: number[],
  varCount: number,
): { minRow: number; maxRow: number; minCol: number; maxCol: number }[] {
  const layout = getKMapLayout(varCount);
  const positions = getCellPositions(minterms, varCount);

  if (positions.length === 0) return [];

  const rows = [...new Set(positions.map((p) => p.row))].sort((a, b) => a - b);
  const cols = [...new Set(positions.map((p) => p.col))].sort((a, b) => a - b);

  // Check if group wraps around rows
  const rowWraps = checkWrapAround(rows, layout.rows);
  // Check if group wraps around columns
  const colWraps = checkWrapAround(cols, layout.cols);

  if (!rowWraps && !colWraps) {
    return [
      {
        minRow: Math.min(...rows),
        maxRow: Math.max(...rows),
        minCol: Math.min(...cols),
        maxCol: Math.max(...cols),
      },
    ];
  }

  if (rowWraps && !colWraps) {
    // Split into top and bottom rectangles
    const { low, high } = splitWrap(rows);
    return [
      {
        minRow: Math.min(...high),
        maxRow: layout.rows - 1,
        minCol: Math.min(...cols),
        maxCol: Math.max(...cols),
      },
      { minRow: 0, maxRow: Math.max(...low), minCol: Math.min(...cols), maxCol: Math.max(...cols) },
    ];
  }

  if (!rowWraps && colWraps) {
    const { low, high } = splitWrap(cols);
    return [
      {
        minRow: Math.min(...rows),
        maxRow: Math.max(...rows),
        minCol: Math.min(...high),
        maxCol: layout.cols - 1,
      },
      { minRow: Math.min(...rows), maxRow: Math.max(...rows), minCol: 0, maxCol: Math.max(...low) },
    ];
  }

  // Both wrap
  const { low: lowR, high: highR } = splitWrap(rows);
  const { low: lowC, high: highC } = splitWrap(cols);
  return [
    {
      minRow: Math.min(...highR),
      maxRow: layout.rows - 1,
      minCol: Math.min(...highC),
      maxCol: layout.cols - 1,
    },
    { minRow: Math.min(...highR), maxRow: layout.rows - 1, minCol: 0, maxCol: Math.max(...lowC) },
    { minRow: 0, maxRow: Math.max(...lowR), minCol: Math.min(...highC), maxCol: layout.cols - 1 },
    { minRow: 0, maxRow: Math.max(...lowR), minCol: 0, maxCol: Math.max(...lowC) },
  ];
}

/**
 * Check if a sorted array of indices wraps around a given size.
 * e.g. [0, 3] in size 4 wraps because they are adjacent mod 4.
 */
function checkWrapAround(sorted: number[], size: number): boolean {
  if (sorted.length <= 1) return false;
  if (sorted.length === size) return false; // covers all

  // Check if there's a gap larger than 1 in the sorted array
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] > 1) {
      // There's a gap -- could be wrap-around
      // Check if first and last are adjacent mod size
      return sorted[0] === 0 && sorted[sorted.length - 1] === size - 1;
    }
  }

  return false;
}

/**
 * Split a wrapping group into low (near 0) and high (near size-1) parts.
 */
function splitWrap(sorted: number[]): { low: number[]; high: number[] } {
  // Find the gap
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] > 1) {
      return {
        low: sorted.slice(0, i),
        high: sorted.slice(i),
      };
    }
  }
  return { low: sorted, high: [] };
}

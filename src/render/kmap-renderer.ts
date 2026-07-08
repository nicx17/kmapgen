import type { KMapCell, KMapGroup } from '../logic/types';
import { getKMapLayout, getGroupRectangles } from '../logic/kmap';
import { svgEl } from './gate-symbols';

const CELL_SIZE = 72;
const HEADER_SIZE = 56;
const LABEL_SIZE = 34;
const FONT = 'var(--font-mono)';

/**
 * Render a K-Map grid as an SVG.
 */
export function renderKMap(
  grid: KMapCell[][],
  groups: KMapGroup[],
  varCount: number,
): SVGSVGElement {
  const layout = getKMapLayout(varCount);
  const { rows, cols, rowCodes, colCodes, rowVars, colVars } = layout;

  const totalWidth = LABEL_SIZE + HEADER_SIZE + cols * CELL_SIZE + 20;
  const totalHeight = LABEL_SIZE + HEADER_SIZE + rows * CELL_SIZE + 20;

  const svg = svgEl('svg', {
    viewBox: `0 0 ${totalWidth} ${totalHeight}`,
    width: '100%',
    height: 'auto',
    style: `max-width: ${Math.max(totalWidth + 40, 360)}px;`,
  }) as SVGSVGElement;

  const offsetX = LABEL_SIZE + HEADER_SIZE;
  const offsetY = LABEL_SIZE + HEADER_SIZE;

  // Variable labels
  // Column variables label
  const colVarLabel = svgEl('text', {
    x: offsetX + (cols * CELL_SIZE) / 2,
    y: LABEL_SIZE / 2 + 4,
    'text-anchor': 'middle',
    'font-size': 14,
    'font-family': FONT,
    'font-weight': 700,
    fill: 'var(--color-accent)',
  });
  colVarLabel.textContent = colVars;
  svg.appendChild(colVarLabel);

  // Row variables label
  const rowVarLabel = svgEl('text', {
    x: LABEL_SIZE / 2,
    y: offsetY + (rows * CELL_SIZE) / 2,
    'text-anchor': 'middle',
    'font-size': 14,
    'font-family': FONT,
    'font-weight': 700,
    fill: 'var(--color-accent)',
    transform: `rotate(-90, ${LABEL_SIZE / 2}, ${offsetY + (rows * CELL_SIZE) / 2})`,
  });
  rowVarLabel.textContent = rowVars;
  svg.appendChild(rowVarLabel);

  // Column headers (gray codes)
  for (let c = 0; c < cols; c++) {
    const text = svgEl('text', {
      x: offsetX + c * CELL_SIZE + CELL_SIZE / 2,
      y: offsetY - 12,
      'text-anchor': 'middle',
      'font-size': 12,
      'font-family': FONT,
      'font-weight': 500,
      fill: 'var(--color-text-secondary)',
    });
    text.textContent = colCodes[c];
    svg.appendChild(text);
  }

  // Row headers (gray codes)
  for (let r = 0; r < rows; r++) {
    const text = svgEl('text', {
      x: offsetX - 12,
      y: offsetY + r * CELL_SIZE + CELL_SIZE / 2 + 4,
      'text-anchor': 'end',
      'font-size': 12,
      'font-family': FONT,
      'font-weight': 500,
      fill: 'var(--color-text-secondary)',
    });
    text.textContent = rowCodes[r];
    svg.appendChild(text);
  }

  // Grid cells
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      const x = offsetX + c * CELL_SIZE;
      const y = offsetY + r * CELL_SIZE;

      // Cell background
      let fillColor = 'transparent';
      if (cell.value === 1) fillColor = 'var(--color-kmap-cell-on)';
      else if (cell.value === 'x') fillColor = 'var(--color-kmap-cell-dc)';

      const rect = svgEl('rect', {
        x,
        y,
        width: CELL_SIZE,
        height: CELL_SIZE,
        fill: fillColor,
        stroke: 'var(--color-border)',
        'stroke-width': 1,
      });
      svg.appendChild(rect);

      // Cell value
      const valueText = svgEl('text', {
        x: x + CELL_SIZE / 2,
        y: y + CELL_SIZE / 2 + 5,
        'text-anchor': 'middle',
        'font-size': 16,
        'font-family': FONT,
        'font-weight': cell.value === 1 ? 700 : 400,
        fill:
          cell.value === 1
            ? 'var(--color-accent)'
            : cell.value === 'x'
              ? 'var(--color-warning)'
              : 'var(--color-text-muted)',
      });
      valueText.textContent = cell.value === 'x' ? 'X' : String(cell.value);
      svg.appendChild(valueText);

      // Small index label
      const indexText = svgEl('text', {
        x: x + 5,
        y: y + 12,
        'font-size': 8,
        'font-family': FONT,
        fill: 'var(--color-text-muted)',
      });
      indexText.textContent = String(cell.index);
      svg.appendChild(indexText);
    }
  }

  // Group rectangles (drawn on top with semi-transparency)
  const groupsG = svgEl('g', { class: 'kmap-groups' });
  svg.appendChild(groupsG);

  for (const group of groups) {
    const rects = getGroupRectangles(group.cells, varCount);
    const pad = 4;

    for (const rect of rects) {
      const x = offsetX + rect.minCol * CELL_SIZE - pad;
      const y = offsetY + rect.minRow * CELL_SIZE - pad;
      const w = (rect.maxCol - rect.minCol + 1) * CELL_SIZE + pad * 2;
      const h = (rect.maxRow - rect.minRow + 1) * CELL_SIZE + pad * 2;

      const groupRect = svgEl('rect', {
        x,
        y,
        width: w,
        height: h,
        rx: 0,
        ry: 0,
        fill: group.colorBg,
        stroke: group.color,
        'stroke-width': 2.5,
        'stroke-dasharray': 'none',
      });
      groupsG.appendChild(groupRect);
    }
  }

  return svg;
}

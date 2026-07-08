/**
 * SVG path data for standard logic gate symbols.
 * All gates are drawn in a 60x40 bounding box with inputs on the left, output on the right.
 */

export const GATE_WIDTH = 60;
export const GATE_HEIGHT = 40;
export const BUBBLE_R = 4;

/** AND gate body path -- flat left, semicircular right reaching x=60 */
export function andGatePath(): string {
  // Flat left side 0->40, semicircular right side from (40,0) to (40,40) with r=20 reaching x=60
  return 'M 0,0 L 40,0 A 20,20 0 0,1 40,40 L 0,40 Z';
}

/** OR gate body path */
export function orGatePath(): string {
  return 'M 0,0 Q 15,0 35,0 Q 55,10 60,20 Q 55,30 35,40 Q 15,40 0,40 Q 10,20 0,0 Z';
}

/** NOT gate (triangle) path -- narrower, 40x30 */
export function notGatePath(): string {
  return 'M 0,0 L 36,15 L 0,30 Z';
}

/** NAND = AND body (bubble added separately) */
export const nandGatePath = andGatePath;

/** NOR = OR body (bubble added separately) */
export const norGatePath = orGatePath;

/** Create an SVG element with proper namespace */
export function svgEl(tag: string, attrs: Record<string, string | number> = {}): SVGElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, String(v));
  }
  return el;
}

/** Render a gate symbol SVG group at (x, y). */
export function renderGateSymbol(
  type: 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR',
  x: number,
  y: number,
  label: string,
): SVGGElement {
  const g = svgEl('g', { transform: `translate(${x}, ${y})` }) as SVGGElement;

  let pathD: string;
  let width = GATE_WIDTH;
  let height = GATE_HEIGHT;
  let outputX = GATE_WIDTH;
  const hasBubble = type === 'NAND' || type === 'NOR' || type === 'NOT';

  switch (type) {
    case 'AND':
    case 'NAND':
      pathD = andGatePath();
      break;
    case 'OR':
    case 'NOR':
      pathD = orGatePath();
      break;
    case 'NOT':
      pathD = notGatePath();
      width = 40;
      height = 30;
      outputX = 44;
      break;
  }

  // Gate body
  const path = svgEl('path', {
    d: pathD!,
    fill: 'var(--color-surface-2)',
    stroke: 'var(--color-text)',
    'stroke-width': 1.5,
  });
  g.appendChild(path);

  // Bubble for NAND/NOR/NOT
  if (hasBubble) {
    const bubbleX = type === 'NOT' ? 36 + BUBBLE_R : GATE_WIDTH + BUBBLE_R;
    const bubbleY = type === 'NOT' ? 15 : height / 2;
    const bubble = svgEl('circle', {
      cx: bubbleX,
      cy: bubbleY,
      r: BUBBLE_R,
      fill: 'var(--color-surface-2)',
      stroke: 'var(--color-text)',
      'stroke-width': 1.5,
    });
    g.appendChild(bubble);
    outputX = bubbleX + BUBBLE_R;
  }

  // Label
  const text = svgEl('text', {
    x: type === 'NOT' ? 12 : width / 2 - 2,
    y: (type === 'NOT' ? height : height) / 2 + 4,
    'text-anchor': 'middle',
    'font-size': type === 'NOT' ? 8 : 9,
    'font-family': 'var(--font-mono)',
    'font-weight': 600,
    fill: 'var(--color-text-secondary)',
  });
  text.textContent = label;
  g.appendChild(text);

  // Store output point as data attribute
  g.dataset.outputX = String(outputX);
  g.dataset.outputY = String((type === 'NOT' ? height : height) / 2);
  g.dataset.width = String(width);
  g.dataset.height = String(type === 'NOT' ? height : height);

  return g;
}

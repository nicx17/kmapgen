import type { GateNode } from '../logic/types';
import { svgEl, renderGateSymbol, GATE_WIDTH, GATE_HEIGHT } from './gate-symbols';

const LAYER_GAP = 160; // Horizontal gap between layers
const MIN_GAP_Y = 24; // Minimum vertical gap between any two nodes at the same layer
const INPUT_SPACING = 56; // Vertical spacing between input wires
const INPUT_WIDTH = 80; // Width reserved for input labels
const NOT_HEIGHT = 30; // Height of NOT gate
const WIRE_COLOR = 'var(--color-text-muted)';
const PADDING = 50;
const WIRE_CHANNEL_GAP = 14; // Gap between parallel wire channels

interface LayoutNode {
  id: string;
  node: GateNode;
  x: number;
  y: number;
  width: number;
  height: number;
  outputX: number;
  outputY: number;
}

/**
 * Render a gate tree as an SVG element.
 * Layout strategy:
 *  1. Assign each node a depth (INPUT=0, others=maxChildDepth+1).
 *  2. Position leaf nodes (INPUTs) with fixed even spacing.
 *  3. Position each subsequent depth by centering parents between their children.
 *  4. Run overlap resolution on each layer to push apart colliding nodes.
 */
export function renderCircuit(root: GateNode): SVGSVGElement {
  if (root.type === 'CONST' || (root.type === 'INPUT' && root.inputs.length === 0)) {
    return renderSimpleOutput(root);
  }

  const inputNodes = new Map<string, GateNode>();
  collectUniqueInputs(root, inputNodes);

  const depthMap = new Map<string, number>();
  computeDepth(root, depthMap, inputNodes);

  // Find max depth for layer-by-layer processing
  let maxDepth = 0;
  for (const d of depthMap.values()) maxDepth = Math.max(maxDepth, d);

  // Collect nodes per layer (depth)
  const nodesPerLayer = new Map<number, GateNode[]>();
  collectNodesPerLayer(root, depthMap, inputNodes, nodesPerLayer, new Set());

  // Phase 1: position leaf nodes (depth 0) with even spacing
  const layoutMap = new Map<string, LayoutNode>();
  const depth0Nodes = nodesPerLayer.get(0) ?? [];
  let currentY = 0;
  for (const node of depth0Nodes) {
    const id = canonId(node, inputNodes);
    if (layoutMap.has(id)) continue;
    const h = nodeHeight(node);
    layoutMap.set(id, makeLayout(id, node, 0, currentY, h));
    currentY += INPUT_SPACING;
  }

  // Phase 2: position each subsequent layer, centering parents between children
  for (let d = 1; d <= maxDepth; d++) {
    const layerNodes = nodesPerLayer.get(d) ?? [];
    for (const node of layerNodes) {
      const id = canonId(node, inputNodes);
      if (layoutMap.has(id)) continue;
      positionFromChildren(node, d, layoutMap, inputNodes);
    }

    // Phase 3: resolve overlaps within this layer
    resolveLayerOverlaps(layerNodes, layoutMap, inputNodes);
  }

  // Calculate SVG bounds
  const allLayouts = [...layoutMap.values()];
  if (allLayouts.length === 0) return renderSimpleOutput(root);

  const maxX = Math.max(...allLayouts.map((l) => l.outputX)) + 80;
  const maxY = Math.max(...allLayouts.map((l) => l.y + l.height + 20));
  const svgWidth = maxX + PADDING * 2;
  const svgHeight = Math.max(maxY + PADDING * 2, 120);

  const svg = svgEl('svg', {
    viewBox: `0 0 ${svgWidth} ${svgHeight}`,
    width: '100%',
    height: 'auto',
    style: `max-height: 700px; min-height: 120px;`,
  }) as SVGSVGElement;

  const mainG = svgEl('g', { transform: `translate(${PADDING}, ${PADDING})` });
  svg.appendChild(mainG);

  // Draw wires first (behind gates)
  const wiresG = svgEl('g');
  mainG.appendChild(wiresG);
  const drawnWires = new Set<string>();
  drawWires(root, layoutMap, wiresG, inputNodes, drawnWires);

  // Draw gates and labels on top
  const gatesG = svgEl('g');
  mainG.appendChild(gatesG);
  const drawnGates = new Set<string>();
  drawGates(root, layoutMap, gatesG, drawnGates, inputNodes);

  // Output wire and "F" label
  const rootLayout = layoutMap.get(root.id)!;
  const outLineX = rootLayout.outputX + 30;
  const outY = rootLayout.outputY;

  wiresG.appendChild(
    svgEl('line', {
      x1: rootLayout.outputX,
      y1: outY,
      x2: outLineX,
      y2: outY,
      stroke: 'var(--color-accent)',
      'stroke-width': 2,
    }),
  );

  const fLabel = svgEl('text', {
    x: outLineX + 8,
    y: outY + 5,
    'font-size': 15,
    'font-family': 'var(--font-mono)',
    'font-weight': 700,
    fill: 'var(--color-accent)',
  });
  fLabel.textContent = 'F';
  gatesG.appendChild(fLabel);

  return svg;
}

// ---- Helpers ----

function renderSimpleOutput(node: GateNode): SVGSVGElement {
  const svg = svgEl('svg', {
    viewBox: '0 0 200 60',
    width: '200',
    height: '60',
  }) as SVGSVGElement;
  const text = svgEl('text', {
    x: 20,
    y: 35,
    'font-size': 18,
    'font-family': 'var(--font-mono)',
    'font-weight': 600,
    fill: 'var(--color-text)',
  });
  text.textContent = `F = ${node.label}`;
  svg.appendChild(text);
  return svg;
}

function collectUniqueInputs(node: GateNode, map: Map<string, GateNode>): void {
  if (node.type === 'INPUT') {
    if (!map.has(node.label)) map.set(node.label, node);
    return;
  }
  for (const child of node.inputs) collectUniqueInputs(child, map);
}

function canonId(node: GateNode, inputNodes: Map<string, GateNode>): string {
  if (node.type === 'INPUT') return inputNodes.get(node.label)?.id ?? node.id;
  return node.id;
}

function computeDepth(
  node: GateNode,
  depthMap: Map<string, number>,
  inputNodes: Map<string, GateNode>,
): number {
  const id = canonId(node, inputNodes);
  if (depthMap.has(id)) return depthMap.get(id)!;
  if (node.type === 'INPUT' || node.type === 'CONST') {
    depthMap.set(id, 0);
    return 0;
  }
  let maxChild = 0;
  for (const child of node.inputs) {
    maxChild = Math.max(maxChild, computeDepth(child, depthMap, inputNodes));
  }
  const depth = maxChild + 1;
  depthMap.set(id, depth);
  return depth;
}

function nodeHeight(node: GateNode): number {
  if (node.type === 'INPUT' || node.type === 'CONST') return 24;
  if (node.type === 'NOT') return NOT_HEIGHT;
  return GATE_HEIGHT;
}

/** Collect all unique nodes per depth layer in top-to-bottom order */
function collectNodesPerLayer(
  node: GateNode,
  depthMap: Map<string, number>,
  inputNodes: Map<string, GateNode>,
  layers: Map<number, GateNode[]>,
  visited: Set<string>,
): void {
  const id = canonId(node, inputNodes);
  if (visited.has(id)) return;
  visited.add(id);

  // Process children first (so leaves are collected before parents)
  for (const child of node.inputs) {
    collectNodesPerLayer(child, depthMap, inputNodes, layers, visited);
  }

  const depth = depthMap.get(id) ?? 0;
  if (!layers.has(depth)) layers.set(depth, []);
  layers.get(depth)!.push(node);
}

/** Create a LayoutNode with correct output positions */
function makeLayout(id: string, node: GateNode, depth: number, y: number, h: number): LayoutNode {
  const x = depth * LAYER_GAP;
  let outputX: number, outputY: number, width: number;

  if (node.type === 'INPUT' || node.type === 'CONST') {
    width = INPUT_WIDTH;
    outputX = x + INPUT_WIDTH;
    outputY = y + 12;
  } else if (node.type === 'NOT') {
    width = 44;
    outputX = x + 44;
    outputY = y + NOT_HEIGHT / 2;
  } else if (node.type === 'NAND' || node.type === 'NOR') {
    width = GATE_WIDTH + 8;
    outputX = x + GATE_WIDTH + 8;
    outputY = y + GATE_HEIGHT / 2;
  } else {
    width = GATE_WIDTH;
    outputX = x + GATE_WIDTH;
    outputY = y + GATE_HEIGHT / 2;
  }

  return { id, node, x, y, width, height: h, outputX, outputY };
}

/** Position a node by centering it between its children */
function positionFromChildren(
  node: GateNode,
  depth: number,
  layoutMap: Map<string, LayoutNode>,
  inputNodes: Map<string, GateNode>,
): void {
  const id = canonId(node, inputNodes);
  if (layoutMap.has(id)) return;

  const h = nodeHeight(node);

  // Get children output Y positions
  const childYs: number[] = [];
  for (const child of node.inputs) {
    const childId = canonId(child, inputNodes);
    const childLayout = layoutMap.get(childId);
    if (childLayout) childYs.push(childLayout.outputY);
  }

  let y: number;
  if (childYs.length > 0) {
    const center = (Math.min(...childYs) + Math.max(...childYs)) / 2;
    y = center - h / 2;
  } else {
    y = 0;
  }

  y = Math.max(0, y);
  layoutMap.set(id, makeLayout(id, node, depth, y, h));
}

/**
 * Resolve overlaps within a single layer.
 * Sort nodes by Y, then push any overlapping node downward.
 */
function resolveLayerOverlaps(
  layerNodes: GateNode[],
  layoutMap: Map<string, LayoutNode>,
  inputNodes: Map<string, GateNode>,
): void {
  // Collect layouts for this layer
  const layouts: LayoutNode[] = [];
  const seen = new Set<string>();
  for (const node of layerNodes) {
    const id = canonId(node, inputNodes);
    if (seen.has(id)) continue;
    seen.add(id);
    const layout = layoutMap.get(id);
    if (layout) layouts.push(layout);
  }

  if (layouts.length < 2) return;

  // Sort by current Y position
  layouts.sort((a, b) => a.y - b.y);

  // Push apart any overlapping nodes
  for (let i = 1; i < layouts.length; i++) {
    const prev = layouts[i - 1];
    const curr = layouts[i];
    const minY = prev.y + prev.height + MIN_GAP_Y;

    if (curr.y < minY) {
      const shift = minY - curr.y;
      curr.y += shift;
      // Update output positions
      curr.outputY += shift;
    }
  }
}

// ---- Wire Drawing ----

function drawWires(
  node: GateNode,
  layoutMap: Map<string, LayoutNode>,
  container: SVGElement,
  inputNodes: Map<string, GateNode>,
  drawn: Set<string>,
): void {
  const id = canonId(node, inputNodes);
  if (drawn.has(id)) return;
  drawn.add(id);

  if (node.type === 'INPUT' || node.type === 'CONST') return;

  const parentLayout = layoutMap.get(id);
  if (!parentLayout) return;

  const gateH = parentLayout.height;
  const inputCount = node.inputs.length;

  for (let i = 0; i < inputCount; i++) {
    const child = node.inputs[i];
    const childId = canonId(child, inputNodes);
    const childLayout = layoutMap.get(childId);
    if (!childLayout) continue;

    const fromX = childLayout.outputX;
    const fromY = childLayout.outputY;
    const toX = parentLayout.x;
    const toY = parentLayout.y + (gateH / (inputCount + 1)) * (i + 1);

    // Orthogonal wire with channel offsets to avoid overlap
    const channelX = fromX + (toX - fromX) * 0.55 + (i - (inputCount - 1) / 2) * WIRE_CHANNEL_GAP;

    const wire = svgEl('path', {
      d: `M ${fromX} ${fromY} L ${channelX} ${fromY} L ${channelX} ${toY} L ${toX} ${toY}`,
      fill: 'none',
      stroke: WIRE_COLOR,
      'stroke-width': 1.4,
    });
    container.appendChild(wire);

    // Connection dot
    container.appendChild(
      svgEl('circle', {
        cx: toX,
        cy: toY,
        r: 2.5,
        fill: WIRE_COLOR,
      }),
    );

    drawWires(child, layoutMap, container, inputNodes, drawn);
  }
}

// ---- Gate Drawing ----

function drawGates(
  node: GateNode,
  layoutMap: Map<string, LayoutNode>,
  container: SVGElement,
  drawn: Set<string>,
  inputNodes: Map<string, GateNode>,
): void {
  const id = canonId(node, inputNodes);
  if (drawn.has(id)) return;
  drawn.add(id);

  const layout = layoutMap.get(id);
  if (!layout) return;

  for (const child of node.inputs) {
    drawGates(child, layoutMap, container, drawn, inputNodes);
  }

  if (node.type === 'INPUT') {
    const g = svgEl('g', { transform: `translate(${layout.x}, ${layout.y})` });

    g.appendChild(
      svgEl('line', {
        x1: 0,
        y1: 12,
        x2: INPUT_WIDTH,
        y2: 12,
        stroke: WIRE_COLOR,
        'stroke-width': 1.4,
      }),
    );

    const label = svgEl('text', {
      x: 0,
      y: 8,
      'font-size': 14,
      'font-family': 'var(--font-mono)',
      'font-weight': 600,
      fill: 'var(--color-text)',
    });
    label.textContent = node.label;
    g.appendChild(label);

    g.appendChild(
      svgEl('circle', {
        cx: INPUT_WIDTH,
        cy: 12,
        r: 3,
        fill: WIRE_COLOR,
      }),
    );

    container.appendChild(g);
  } else if (node.type === 'CONST') {
    const text = svgEl('text', {
      x: layout.x,
      y: layout.y + 16,
      'font-size': 15,
      'font-family': 'var(--font-mono)',
      'font-weight': 700,
      fill: 'var(--color-accent)',
    });
    text.textContent = node.label;
    container.appendChild(text);
  } else {
    const gateType = node.type as 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR';
    container.appendChild(renderGateSymbol(gateType, layout.x, layout.y, node.label));
  }
}

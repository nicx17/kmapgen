import type { BooleanExpression, ComputationResult, MintermEntry, GateStats } from '../logic/types';
import { parseExpression, validateTermsInput } from '../logic/parser';
import { generateEntries, getVarNames } from '../logic/minterm';
import { generateKMap, generateKMapGroups } from '../logic/kmap';
import { minimize } from '../logic/quine-mccluskey';
import { buildBasicGateTree, buildNandTree, buildNorTree, countGates } from '../logic/gate-tree';
import { renderKMap } from '../render/kmap-renderer';
import { renderCircuit } from '../render/circuit-renderer';
import { renderExpressionHTML, expressionToPlainText } from './expression-display';

interface Example {
  label: string;
  terms: string;
  dontCares: string;
  vars: number;
  type: 'sop' | 'pos';
}

const EXAMPLES: Example[] = [
  { label: '\u03A3m(1,3,5,7)', terms: '1,3,5,7', dontCares: '', vars: 3, type: 'sop' },
  {
    label: '\u03A3m(0,1,2,5,8,9,10)',
    terms: '0,1,2,5,8,9,10',
    dontCares: '',
    vars: 4,
    type: 'sop',
  },
  {
    label: '\u03A3m(1,3,4,6,9,11,15)',
    terms: '1,3,4,6,9,11,15',
    dontCares: '',
    vars: 4,
    type: 'sop',
  },
  { label: '\u03A3m(0,2,5,7)+d(8,10)', terms: '0,2,5,7', dontCares: '8,10', vars: 4, type: 'sop' },
  { label: '\u03A0M(0,2,4)', terms: '0,2,4', dontCares: '', vars: 3, type: 'pos' },
  {
    label: '\u03A3m(2,6,8,9,10,11,14)',
    terms: '2,6,8,9,10,11,14',
    dontCares: '',
    vars: 4,
    type: 'sop',
  },
];

export function initApp(): void {
  // DOM elements
  const varCountSelector = document.getElementById('var-count-selector')!;
  const exprTypeSelector = document.getElementById('expr-type-selector')!;
  const mintermsInput = document.getElementById('minterms-input') as HTMLInputElement;
  const dontCaresInput = document.getElementById('dontcares-input') as HTMLInputElement;
  const generateBtn = document.getElementById('generate-btn')!;
  const mintermsError = document.getElementById('minterms-error')!;
  const dontCaresError = document.getElementById('dontcares-error')!;
  const termsLabel = document.getElementById('terms-label')!;
  const termsHint = document.getElementById('terms-hint')!;
  const examplesGrid = document.getElementById('examples-grid')!;
  const resultsPanel = document.getElementById('results-panel')!;
  // Unified layout - no tabs needed
  const circuitTypeSelector = document.getElementById('circuit-type-selector')!;
  const exportPngBtn = document.getElementById('export-png-btn')!;
  const shareLinkBtn = document.getElementById('share-link-btn')!;

  let currentVarCount = 3;
  let currentType: 'sop' | 'pos' = 'sop';
  let currentResult: ComputationResult | null = null;

  // Segmented control handler
  function setupSegmentedControl(container: HTMLElement, onChange: (value: string) => void): void {
    const buttons = container.querySelectorAll('.seg-btn');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        buttons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        onChange((btn as HTMLElement).dataset.value!);
      });
    });
  }

  setupSegmentedControl(varCountSelector, (val) => {
    currentVarCount = parseInt(val, 10);
    updatePlaceholder();
  });

  setupSegmentedControl(exprTypeSelector, (val) => {
    currentType = val as 'sop' | 'pos';
    updateLabels();
  });

  function updateLabels(): void {
    if (currentType === 'sop') {
      termsLabel.textContent = 'Minterms';
      termsHint.innerHTML = 'e.g. 1,3,4,6 or &Sigma;m(1,3,4,6)';
    } else {
      termsLabel.textContent = 'Maxterms';
      termsHint.innerHTML = 'e.g. 0,2,5,7 or &Pi;M(0,2,5,7)';
    }
    updatePlaceholder();
  }

  function updatePlaceholder(): void {
    const maxIdx = (1 << currentVarCount) - 1;
    mintermsInput.placeholder = `0-${maxIdx}, e.g. 1, 3, 4, 6`;
    dontCaresInput.placeholder = `Optional, e.g. 5, 7`;
  }

  /**
   * Auto-detect the minimum number of variables needed based on the
   * largest index found across both input fields.
   */
  function autoDetectVarCount(): void {
    const maxIndex = getMaxIndexFromInputs(mintermsInput.value, dontCaresInput.value);
    if (maxIndex === null) return; // no valid numbers yet

    let needed: number;
    if (maxIndex >= 8) {
      needed = 4;
    } else if (maxIndex >= 4) {
      needed = 3;
    } else {
      needed = 2;
    }

    if (needed !== currentVarCount) {
      currentVarCount = needed;
      varCountSelector.querySelectorAll('.seg-btn').forEach((b) => {
        b.classList.toggle('active', (b as HTMLElement).dataset.value === String(needed));
      });
      updatePlaceholder();
    }
  }

  /**
   * Extract the largest numeric index from both input fields.
   * Returns null if no valid numbers are found.
   */
  function getMaxIndexFromInputs(...inputs: string[]): number | null {
    let max: number | null = null;

    for (const raw of inputs) {
      // Strip common notation wrappers
      let cleaned = raw.trim();
      if (!cleaned) continue;
      cleaned = cleaned.replace(/^[Σ∑]m\s*\(/i, '').replace(/\)$/, '');
      cleaned = cleaned.replace(/^[Π∏]M\s*\(/i, '').replace(/\)$/, '');
      cleaned = cleaned.replace(/^(sum|product|m|M)\s*\(/i, '').replace(/\)$/, '');

      const parts = cleaned.split(/[\s,]+/).filter((s) => s.length > 0);
      for (const p of parts) {
        const n = parseInt(p, 10);
        if (!isNaN(n) && n >= 0) {
          max = max === null ? n : Math.max(max, n);
        }
      }
    }

    return max;
  }

  // Auto-detect on every keystroke in either input
  mintermsInput.addEventListener('input', autoDetectVarCount);
  dontCaresInput.addEventListener('input', autoDetectVarCount);

  // Examples
  for (const ex of EXAMPLES) {
    const btn = document.createElement('button');
    btn.className = 'example-btn';
    btn.textContent = ex.label;
    btn.addEventListener('click', () => {
      // Set input values
      mintermsInput.value = ex.terms;
      dontCaresInput.value = ex.dontCares;

      // Set var count
      currentVarCount = ex.vars;
      varCountSelector.querySelectorAll('.seg-btn').forEach((b) => {
        b.classList.toggle('active', (b as HTMLElement).dataset.value === String(ex.vars));
      });

      // Set type
      currentType = ex.type;
      exprTypeSelector.querySelectorAll('.seg-btn').forEach((b) => {
        b.classList.toggle('active', (b as HTMLElement).dataset.value === ex.type);
      });

      updateLabels();
      clearErrors();
      compute();
    });
    examplesGrid.appendChild(btn);
  }

  // No tab navigation - unified layout

  // Circuit type selector (initial setup, will be replaced by updateCircuitTypeButtons on compute)
  setupSegmentedControl(circuitTypeSelector, (val) => {
    if (currentResult) {
      renderCircuitTab(currentResult, val as 'basic' | 'nand' | 'nor');
    }
  });

  // Generate button
  generateBtn.addEventListener('click', () => {
    clearErrors();
    compute();
  });

  // Enter key on inputs
  mintermsInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      clearErrors();
      compute();
    }
  });
  dontCaresInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      clearErrors();
      compute();
    }
  });

  // Export PNG
  exportPngBtn.addEventListener('click', () => {
    exportAsPng();
  });

  // Share link
  shareLinkBtn.addEventListener('click', () => {
    copyShareLink();
  });

  // Check URL params on load
  loadFromURL();
  updatePlaceholder();

  // ----- Core computation -----

  function compute(): void {
    const termsValidation = validateTermsInput(mintermsInput.value);
    if (termsValidation) {
      showError(mintermsError, mintermsInput, termsValidation);
      return;
    }

    let expr: BooleanExpression;
    try {
      expr = parseExpression(
        mintermsInput.value,
        dontCaresInput.value,
        currentVarCount,
        currentType,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid input';
      if (msg.includes("don't-care") || msg.toLowerCase().includes('dontcare')) {
        showError(dontCaresError, dontCaresInput, msg);
      } else {
        showError(mintermsError, mintermsInput, msg);
      }
      return;
    }

    // Generate all results
    const entries = generateEntries(expr);
    const kmap = generateKMap(expr);
    const minimization = minimize(expr);

    const selectedImplicants = minimization.selectedImplicants;
    const kmapGroups = generateKMapGroups(selectedImplicants);

    const basicGateTree = buildBasicGateTree(selectedImplicants, expr.varCount, expr.type);
    const nandGateTree = buildNandTree(selectedImplicants, expr.varCount, expr.type);
    const norGateTree = buildNorTree(selectedImplicants, expr.varCount, expr.type);

    const result: ComputationResult = {
      input: expr,
      entries,
      kmap,
      kmapGroups,
      minimization,
      basicGateTree,
      nandGateTree,
      norGateTree,
      basicGateStats: countGates(basicGateTree),
      nandGateStats: countGates(nandGateTree),
      norGateStats: countGates(norGateTree),
    };

    currentResult = result;
    displayResults(result);
  }

  function displayResults(result: ComputationResult): void {
    resultsPanel.classList.remove('hidden');

    // Update circuit type buttons: SOP -> NAND, POS -> NOR
    updateCircuitTypeButtons(result.input.type);

    renderTruthTable(result);
    renderKMapTab(result);
    renderExpressionTab(result);
    renderCircuitTab(result, 'basic');
  }

  function updateCircuitTypeButtons(type: 'sop' | 'pos'): void {
    const altType = type === 'sop' ? 'nand' : 'nor';
    const altLabel = type === 'sop' ? 'NAND Only' : 'NOR Only';

    circuitTypeSelector.innerHTML = `
      <button class="seg-btn active" data-value="basic">Basic Gates</button>
      <button class="seg-btn" data-value="${altType}">${altLabel}</button>
    `;

    // Re-attach event handler
    setupSegmentedControl(circuitTypeSelector, (val) => {
      if (currentResult) {
        renderCircuitTab(currentResult, val as 'basic' | 'nand' | 'nor');
      }
    });
  }

  // ----- Truth Table -----

  function renderTruthTable(result: ComputationResult): void {
    const container = document.getElementById('truth-table-container')!;
    const varNames = getVarNames(result.input.varCount);

    let html = '<table class="truth-table">';
    html += '<thead><tr>';
    html += '<th>#</th>';
    for (const v of varNames) {
      html += `<th>${v}</th>`;
    }
    html += '<th>Binary</th>';
    html += '<th>Term</th>';
    html += '<th>F</th>';
    html += '</tr></thead>';
    html += '<tbody>';

    for (const entry of result.entries) {
      const rowClass =
        entry.value === 1 ? 'minterm-row' : entry.value === 'x' ? 'dontcare-row' : '';

      html += `<tr class="${rowClass}">`;
      html += `<td>${entry.index}</td>`;
      for (const bit of entry.binary) {
        html += `<td>${bit}</td>`;
      }
      html += `<td>${entry.binary}</td>`;
      html += `<td>${renderAlphabeticCell(entry)}</td>`;
      html += `<td class="value-cell">${entry.value === 'x' ? 'X' : entry.value}</td>`;
      html += '</tr>';
    }

    html += '</tbody></table>';
    container.innerHTML = html;
  }

  function renderAlphabeticCell(entry: MintermEntry): string {
    let result = '';
    const vars = getVarNames(entry.binary.length);

    for (let i = 0; i < entry.binary.length; i++) {
      if (entry.binary[i] === '0') {
        result += `${vars[i]}'`;
      } else {
        result += vars[i];
      }
    }

    return result;
  }

  // ----- K-Map Tab -----

  function renderKMapTab(result: ComputationResult): void {
    const container = document.getElementById('kmap-container')!;
    const legend = document.getElementById('kmap-legend')!;

    container.innerHTML = '';
    const svg = renderKMap(result.kmap, result.kmapGroups, result.input.varCount);
    container.appendChild(svg);

    // Legend
    let legendHtml = '';
    for (const group of result.kmapGroups) {
      legendHtml += `
        <div class="legend-item">
          <div class="legend-swatch" style="background: ${group.colorBg}; border-color: ${group.color};"></div>
          <span class="mono" style="font-size: var(--text-xs);">${renderProductTermInline(group.expression)}</span>
        </div>
      `;
    }
    legend.innerHTML = legendHtml;
  }

  function renderProductTermInline(term: string): string {
    let result = '';
    let i = 0;

    while (i < term.length) {
      if (/[A-Z]/.test(term[i])) {
        if (i + 1 < term.length && term[i + 1] === "'") {
          result += `<span class="overline">${term[i]}</span>`;
          i += 2;
        } else {
          result += term[i];
          i++;
        }
      } else if (term[i] === '+') {
        result += ' + ';
        i++;
      } else if (term[i] === '(' || term[i] === ')') {
        result += term[i];
        i++;
      } else {
        result += term[i];
        i++;
      }
    }

    return result;
  }

  // ----- Expression Tab -----

  function renderExpressionTab(result: ComputationResult): void {
    const section = document.getElementById('expression-section')!;

    const isSOP = result.input.type === 'sop';

    const minimizedHtml = renderExpressionHTML(result.minimization.minimizedExpression, isSOP);

    // Selected implicants
    let implicantsHtml = '';
    for (const pi of result.minimization.selectedImplicants) {
      implicantsHtml += `<div style="padding: 2px 0; font-size: var(--text-sm);">
        <span class="mono">${pi.pattern}</span>
        <span style="color: var(--color-text-muted);"> -> </span>
        <span class="mono">${renderProductTermInline(pi.expression)}</span>
        <span style="color: var(--color-text-muted); font-size: var(--text-xs);"> covers {${pi.coveredMinterms.join(',')}}</span>
      </div>`;
    }

    section.innerHTML = `
      <div class="expression-block">
        <div class="expression-block-title">Minimized Expression</div>
        <div style="margin-bottom: var(--sp-3);">F = ${minimizedHtml}</div>
        <button class="expression-copy-btn" id="copy-expr-btn">Copy Expression</button>
      </div>

      <div class="expression-block">
        <div class="expression-block-title">Selected Prime Implicants</div>
        ${implicantsHtml || '<div style="color: var(--color-text-muted);">None</div>'}
      </div>
    `;

    // Wire up copy button
    const copyBtn = document.getElementById('copy-expr-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const text = expressionToPlainText(result.minimization.minimizedExpression);
        navigator.clipboard.writeText(`F = ${text}`).then(() => {
          showToast('Expression copied to clipboard');
        });
      });
    }
  }

  // ----- Circuit Tab -----

  function renderCircuitTab(result: ComputationResult, type: 'basic' | 'nand' | 'nor'): void {
    const container = document.getElementById('circuit-container')!;
    const statsContainer = document.getElementById('gate-stats')!;

    container.innerHTML = '';

    let tree;
    let stats: GateStats;

    switch (type) {
      case 'basic':
        tree = result.basicGateTree;
        stats = result.basicGateStats;
        break;
      case 'nand':
        tree = result.nandGateTree;
        stats = result.nandGateStats;
        break;
      case 'nor':
        tree = result.norGateTree;
        stats = result.norGateStats;
        break;
    }

    const svg = renderCircuit(tree);
    container.appendChild(svg);

    // Stats
    const statItems: string[] = [];
    if (stats.and > 0)
      statItems.push(
        `<span class="gate-stat"><span class="gate-stat-count">${stats.and}</span> AND</span>`,
      );
    if (stats.or > 0)
      statItems.push(
        `<span class="gate-stat"><span class="gate-stat-count">${stats.or}</span> OR</span>`,
      );
    if (stats.not > 0)
      statItems.push(
        `<span class="gate-stat"><span class="gate-stat-count">${stats.not}</span> NOT</span>`,
      );
    if (stats.nand > 0)
      statItems.push(
        `<span class="gate-stat"><span class="gate-stat-count">${stats.nand}</span> NAND</span>`,
      );
    if (stats.nor > 0)
      statItems.push(
        `<span class="gate-stat"><span class="gate-stat-count">${stats.nor}</span> NOR</span>`,
      );
    statItems.push(
      `<span class="gate-stat"><span class="gate-stat-count">${stats.total}</span> Total</span>`,
    );

    statsContainer.innerHTML = statItems.join('');
  }

  // ----- Export PNG -----

  function exportAsPng(): void {
    if (!currentResult) return;

    // Use canvas-based SVG rendering for the K-Map
    const kmapSvg = document.querySelector('#kmap-container svg') as SVGSVGElement;
    if (!kmapSvg) {
      showToast('Nothing to export yet');
      return;
    }

    const svgData = new XMLSerializer().serializeToString(kmapSvg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = 2; // 2x for retina
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(scale, scale);

      // Fill background
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      ctx.fillStyle = isDark ? '#0a0a0f' : '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'kmap.png';
        a.click();
        URL.revokeObjectURL(a.href);
        showToast('K-Map exported as PNG');
      }, 'image/png');
    };
    img.src = url;
  }

  // ----- Share Link -----

  function copyShareLink(): void {
    if (!currentResult) return;

    const params = new URLSearchParams();
    params.set('terms', currentResult.input.terms.join(','));
    if (currentResult.input.dontCares.length > 0) {
      params.set('dc', currentResult.input.dontCares.join(','));
    }
    params.set('vars', String(currentResult.input.varCount));
    params.set('type', currentResult.input.type);

    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    navigator.clipboard.writeText(url).then(() => {
      showToast('Share link copied to clipboard');
    });
  }

  function loadFromURL(): void {
    const params = new URLSearchParams(window.location.search);
    const terms = params.get('terms');
    const dc = params.get('dc');
    const vars = params.get('vars');
    const type = params.get('type');

    if (terms && vars) {
      currentVarCount = parseInt(vars, 10);
      currentType = type === 'pos' ? 'pos' : 'sop';

      // Set UI state
      varCountSelector.querySelectorAll('.seg-btn').forEach((b) => {
        b.classList.toggle('active', (b as HTMLElement).dataset.value === vars);
      });
      exprTypeSelector.querySelectorAll('.seg-btn').forEach((b) => {
        b.classList.toggle('active', (b as HTMLElement).dataset.value === currentType);
      });

      mintermsInput.value = terms;
      if (dc) dontCaresInput.value = dc;

      updateLabels();
      compute();
    }
  }

  // ----- Helpers -----

  function showError(errorEl: HTMLElement, inputEl: HTMLInputElement, message: string): void {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
    inputEl.classList.add('error');
  }

  function clearErrors(): void {
    mintermsError.classList.add('hidden');
    dontCaresError.classList.add('hidden');
    mintermsInput.classList.remove('error');
    dontCaresInput.classList.remove('error');
  }
}

function showToast(message: string): void {
  const toast = document.getElementById('toast')!;
  toast.textContent = message;
  toast.classList.remove('hidden');
  toast.classList.add('visible');

  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.classList.add('hidden'), 200);
  }, 2000);
}

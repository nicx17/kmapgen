import type {
  BooleanExpression,
  MinimizationResult,
  PrimeImplicant,
  QMStep,
  QMGroup,
  QMImplicant,
} from './types';

const VAR_NAMES = ['A', 'B', 'C', 'D'];

/**
 * Full Quine-McCluskey minimization.
 */
export function minimize(expr: BooleanExpression): MinimizationResult {
  const varCount = expr.varCount;

  // For SOP: minterms are where output is 1
  // For POS: we convert maxterms to the complementary minterms
  let minterms: number[];
  let dontCares: number[];

  if (expr.type === 'sop') {
    minterms = [...expr.terms];
    dontCares = [...expr.dontCares];
  } else {
    // POS: minimize the maxterms directly (where F=0).
    // The QM algorithm finds prime implicants of the maxterm set,
    // and patternToExpression converts them to sum terms.
    minterms = [...expr.terms];
    dontCares = [...expr.dontCares];
  }

  // Handle edge cases
  if (minterms.length === 0 && dontCares.length === 0) {
    return {
      primeImplicants: [],
      essentialPrimeImplicants: [],
      selectedImplicants: [],
      minimizedExpression: expr.type === 'sop' ? '0' : '1',
      steps: [],
    };
  }

  const allTerms = [...minterms, ...dontCares].sort((a, b) => a - b);

  if (minterms.length === 1 << varCount) {
    return {
      primeImplicants: [],
      essentialPrimeImplicants: [],
      selectedImplicants: [],
      minimizedExpression: expr.type === 'sop' ? '1' : '0',
      steps: [],
    };
  }

  // Step 1: Initial grouping by number of 1s
  const steps: QMStep[] = [];
  let currentImplicants: QMImplicant[] = allTerms.map((t) => ({
    pattern: t.toString(2).padStart(varCount, '0'),
    coveredMinterms: [t],
    combined: false,
  }));

  let round = 0;

  // Record initial step
  steps.push({
    round: 0,
    groups: groupByOnes(currentImplicants),
  });

  // Step 2: Iteratively combine
  const primeImplicants: QMImplicant[] = [];

  while (true) {
    round++;
    const groups = groupByOnes(currentImplicants);
    const nextImplicants: QMImplicant[] = [];
    const combinedSet = new Set<string>();

    for (let g = 0; g < groups.length - 1; g++) {
      const group1 = groups[g];
      const group2 = groups[g + 1];

      if (!group1 || !group2) continue;

      for (const imp1 of group1.implicants) {
        for (const imp2 of group2.implicants) {
          const combined = combinePatterns(imp1.pattern, imp2.pattern);
          if (combined) {
            const newMinterms = [
              ...new Set([...imp1.coveredMinterms, ...imp2.coveredMinterms]),
            ].sort((a, b) => a - b);
            const key = combined + ':' + newMinterms.join(',');

            if (!combinedSet.has(key)) {
              combinedSet.add(key);
              nextImplicants.push({
                pattern: combined,
                coveredMinterms: newMinterms,
                combined: false,
              });
            }

            imp1.combined = true;
            imp2.combined = true;
          }
        }
      }
    }

    // Collect uncombined as prime implicants
    for (const imp of currentImplicants) {
      if (!imp.combined) {
        // Check if this pattern is already in primeImplicants
        const exists = primeImplicants.some((p) => p.pattern === imp.pattern);
        if (!exists) {
          primeImplicants.push(imp);
        }
      }
    }

    if (nextImplicants.length === 0) {
      // Record final step
      steps.push({
        round,
        groups: groupByOnes(currentImplicants),
      });
      break;
    }

    steps.push({
      round,
      groups: groupByOnes(currentImplicants),
    });

    currentImplicants = nextImplicants;
  }

  // Step 3: Select essential prime implicants using a coverage table
  const dontCareSet = new Set(dontCares);
  const requiredMinterms = minterms.filter((m) => !dontCareSet.has(m));

  const selected = selectPrimeImplicants(primeImplicants, requiredMinterms);

  // Build minimized expression
  const minimizedExpression = buildExpression(selected, varCount, expr.type);

  // Assign group indices and build PrimeImplicant objects
  const piResults: PrimeImplicant[] = primeImplicants.map((pi, i) => ({
    pattern: pi.pattern,
    coveredMinterms: pi.coveredMinterms,
    expression: patternToExpression(pi.pattern, varCount, expr.type),
    isEssential: selected.some((s) => s.pattern === pi.pattern),
    groupIndex: i,
  }));

  const essentialResults = piResults.filter((p) => p.isEssential);
  const selectedResults = selected.map((s, i) => ({
    pattern: s.pattern,
    coveredMinterms: s.coveredMinterms,
    expression: patternToExpression(s.pattern, varCount, expr.type),
    isEssential: true,
    groupIndex: i,
  }));

  return {
    primeImplicants: piResults,
    essentialPrimeImplicants: essentialResults,
    selectedImplicants: selectedResults,
    minimizedExpression,
    steps,
  };
}

/**
 * Group implicants by number of 1s in their pattern (ignoring dashes).
 */
function groupByOnes(implicants: QMImplicant[]): QMGroup[] {
  const groupMap = new Map<number, QMImplicant[]>();

  for (const imp of implicants) {
    const ones = countOnes(imp.pattern);
    if (!groupMap.has(ones)) {
      groupMap.set(ones, []);
    }
    groupMap.get(ones)!.push(imp);
  }

  const groups: QMGroup[] = [];
  const sortedKeys = [...groupMap.keys()].sort((a, b) => a - b);

  for (const key of sortedKeys) {
    groups.push({
      onesCount: key,
      implicants: groupMap.get(key)!,
    });
  }

  return groups;
}

function countOnes(pattern: string): number {
  return pattern.split('').filter((c) => c === '1').length;
}

/**
 * Try to combine two patterns that differ in exactly one bit.
 * Returns the combined pattern (with '-' for the differing bit) or null.
 */
function combinePatterns(p1: string, p2: string): string | null {
  let diffCount = 0;
  let diffPos = -1;

  for (let i = 0; i < p1.length; i++) {
    if (p1[i] !== p2[i]) {
      diffCount++;
      diffPos = i;
      if (diffCount > 1) return null;
    }
  }

  if (diffCount !== 1) return null;

  return p1.substring(0, diffPos) + '-' + p1.substring(diffPos + 1);
}

/**
 * Select minimum set of prime implicants to cover all required minterms.
 * Uses essential prime implicant detection + greedy cover for remaining.
 */
function selectPrimeImplicants(
  primeImplicants: QMImplicant[],
  requiredMinterms: number[]
): QMImplicant[] {
  if (requiredMinterms.length === 0) return [];

  const selected: QMImplicant[] = [];
  const uncovered = new Set(requiredMinterms);

  // Find essential prime implicants (those that uniquely cover a minterm)
  for (const minterm of requiredMinterms) {
    const coveringPIs = primeImplicants.filter((pi) => pi.coveredMinterms.includes(minterm));
    if (coveringPIs.length === 1) {
      const epi = coveringPIs[0];
      if (!selected.includes(epi)) {
        selected.push(epi);
        for (const m of epi.coveredMinterms) {
          uncovered.delete(m);
        }
      }
    }
  }

  // Greedy cover for remaining minterms
  while (uncovered.size > 0) {
    let bestPI: QMImplicant | null = null;
    let bestCover = 0;

    for (const pi of primeImplicants) {
      if (selected.includes(pi)) continue;
      const coverCount = pi.coveredMinterms.filter((m) => uncovered.has(m)).length;
      if (coverCount > bestCover) {
        bestCover = coverCount;
        bestPI = pi;
      }
    }

    if (bestPI) {
      selected.push(bestPI);
      for (const m of bestPI.coveredMinterms) {
        uncovered.delete(m);
      }
    } else {
      break;
    }
  }

  return selected;
}

/**
 * Convert pattern to algebraic expression term.
 * SOP: product term (AND of literals)
 * POS: sum term (OR of literals)
 */
function patternToExpression(pattern: string, varCount: number, type: 'sop' | 'pos'): string {
  const vars = VAR_NAMES.slice(0, varCount);
  const literals: string[] = [];

  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '-') continue;

    if (type === 'sop') {
      // SOP: 1 = variable, 0 = complement
      literals.push(pattern[i] === '1' ? vars[i] : `${vars[i]}'`);
    } else {
      // POS: 0 = variable, 1 = complement (De Morgan's)
      literals.push(pattern[i] === '0' ? vars[i] : `${vars[i]}'`);
    }
  }

  if (literals.length === 0) {
    return type === 'sop' ? '1' : '0';
  }

  return type === 'sop' ? literals.join('') : `(${literals.join(' + ')})`;
}

/**
 * Build the full minimized expression from selected implicants.
 */
function buildExpression(selected: QMImplicant[], varCount: number, type: 'sop' | 'pos'): string {
  if (selected.length === 0) {
    return type === 'sop' ? '0' : '1';
  }

  const terms = selected.map((pi) => patternToExpression(pi.pattern, varCount, type));

  if (type === 'sop') {
    return terms.join(' + ');
  } else {
    return terms.join('');
  }
}

/**
 * Get the minterms (where output = 1) from the expression,
 * including don't-cares for K-Map cell value rendering.
 */
export function getActiveMinterms(expr: BooleanExpression): {
  minterms: number[];
  dontCares: number[];
} {
  if (expr.type === 'sop') {
    return { minterms: expr.terms, dontCares: expr.dontCares };
  } else {
    // POS: expr.terms are maxterms (where F=0)
    // Minterms of F (where F=1) are everything else
    const allIndices = Array.from({ length: 1 << expr.varCount }, (_, i) => i);
    const excludeSet = new Set([...expr.terms, ...expr.dontCares]);
    return {
      minterms: allIndices.filter((i) => !excludeSet.has(i)),
      dontCares: expr.dontCares,
    };
  }
}

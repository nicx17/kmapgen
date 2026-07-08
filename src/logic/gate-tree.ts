import type { GateNode, GateStats, PrimeImplicant } from './types';

const VAR_NAMES = ['A', 'B', 'C', 'D'];
let idCounter = 0;

function nextId(): string {
  return `gate_${idCounter++}`;
}

/** Reset the counter (call before building a new tree) */
function resetIds(): void {
  idCounter = 0;
}

/**
 * Build a basic gate tree (AND, OR, NOT) from selected prime implicants.
 * SOP form: OR of AND terms; POS form: AND of OR terms.
 */
export function buildBasicGateTree(
  implicants: PrimeImplicant[],
  varCount: number,
  type: 'sop' | 'pos',
): GateNode {
  resetIds();

  if (implicants.length === 0) {
    return {
      type: 'CONST',
      label: type === 'sop' ? '0' : '1',
      inputs: [],
      id: nextId(),
    };
  }

  const productTerms = implicants.map((pi) => buildTermGate(pi.pattern, varCount, type));

  if (productTerms.length === 1) {
    return productTerms[0];
  }

  const topGateType: 'OR' | 'AND' = type === 'sop' ? 'OR' : 'AND';
  return {
    type: topGateType,
    label: topGateType,
    inputs: productTerms,
    id: nextId(),
  };
}

/**
 * Build a single product/sum term gate.
 */
function buildTermGate(pattern: string, varCount: number, type: 'sop' | 'pos'): GateNode {
  const vars = VAR_NAMES.slice(0, varCount);
  const literals: GateNode[] = [];

  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '-') continue;

    const varNode: GateNode = {
      type: 'INPUT',
      label: vars[i],
      inputs: [],
      id: nextId(),
    };

    const needComplement = type === 'sop' ? pattern[i] === '0' : pattern[i] === '1';

    if (needComplement) {
      literals.push({
        type: 'NOT',
        label: 'NOT',
        inputs: [varNode],
        id: nextId(),
      });
    } else {
      literals.push(varNode);
    }
  }

  if (literals.length === 0) {
    return { type: 'CONST', label: type === 'sop' ? '1' : '0', inputs: [], id: nextId() };
  }

  if (literals.length === 1) {
    return literals[0];
  }

  const gateType: 'AND' | 'OR' = type === 'sop' ? 'AND' : 'OR';
  return {
    type: gateType,
    label: gateType,
    inputs: literals,
    id: nextId(),
  };
}

/**
 * Convert a basic gate tree to NAND-only.
 * Uses the double-negation / De Morgan conversion:
 *   AND(a,b) = NAND(NAND(a,b)) -- but we push the inversions
 *   OR(a,b) = NAND(NOT(a), NOT(b))
 *   NOT(a) = NAND(a, a)
 *
 * Optimized SOP approach:
 *   F = sum of products = OR(AND terms)
 *   = NAND(NAND(term1), NAND(term2), ...)
 *   where each AND term is directly a NAND (with inverted output handled by top NAND)
 */
export function buildNandTree(
  implicants: PrimeImplicant[],
  varCount: number,
  type: 'sop' | 'pos',
): GateNode {
  resetIds();

  if (implicants.length === 0) {
    return { type: 'CONST', label: type === 'sop' ? '0' : '1', inputs: [], id: nextId() };
  }

  if (type === 'sop') {
    return buildNandSOP(implicants, varCount);
  } else {
    return buildNandPOS(implicants, varCount);
  }
}

function buildNandSOP(implicants: PrimeImplicant[], varCount: number): GateNode {
  const vars = VAR_NAMES.slice(0, varCount);

  // Each AND term becomes a NAND gate
  // Top OR becomes a NAND of the NAND outputs
  // F = OR(AND1, AND2) = NAND(NAND(AND1), NAND(AND2)) = NAND(NAND(a,b), NAND(c,d))
  const nandTerms = implicants.map((pi) => {
    const literals = getLiterals(pi.pattern, vars, 'sop');

    if (literals.length === 0) {
      return { type: 'CONST' as const, label: '1', inputs: [] as GateNode[], id: nextId() };
    }

    if (literals.length === 1) {
      // Single literal -- need to invert it for the top NAND to work
      // NAND(a, a) = NOT(a), so we need NAND(NOT(lit), NOT(lit)) = lit
      // Actually, for single literal in SOP, the top NAND handles the inversion
      // We need to pass NOT(literal) to the top NAND
      // NAND(NOT(a)) isn't valid, we need NAND(NOT(a), NOT(a))
      // Simpler: wrap in NAND(lit, lit) = NOT(lit), then top NAND inverts back... no
      // For single-term SOP: F = a, which is just the input
      // For multi-term with single literal per term: F = a + b = NAND(a', b') = NAND(NAND(a,a), NAND(b,b))
      return makeNandNot(literals[0]);
    }

    // Multi-literal AND term becomes NAND
    return {
      type: 'NAND' as const,
      label: 'NAND',
      inputs: literals,
      id: nextId(),
    };
  });

  if (nandTerms.length === 1) {
    // Single term: F = AND(literals)
    // NAND gives NOT(AND), so we need to invert: NAND(NAND(a,b), NAND(a,b))
    const pi = implicants[0];
    const lits = getLiterals(pi.pattern, vars, 'sop');
    if (lits.length <= 1) {
      return lits.length === 0 ? { type: 'CONST', label: '1', inputs: [], id: nextId() } : lits[0];
    }
    const nandGate: GateNode = { type: 'NAND', label: 'NAND', inputs: lits, id: nextId() };
    return {
      type: 'NAND',
      label: 'NAND',
      inputs: [nandGate, nandGate],
      id: nextId(),
    };
  }

  // Multiple terms: NAND of NANDs
  return {
    type: 'NAND',
    label: 'NAND',
    inputs: nandTerms,
    id: nextId(),
  };
}

function buildNandPOS(implicants: PrimeImplicant[], varCount: number): GateNode {
  const vars = VAR_NAMES.slice(0, varCount);

  // POS: F = product of sums = AND(OR terms)
  // AND(a,b) = NAND(a,b)'' = NAND(NAND(a,b), NAND(a,b))... not great
  // Better: each OR term -> NAND(NOT(a), NOT(b)) which = OR(a,b) but using NAND
  // Then AND of those OR terms -> NAND(NAND(or1, or2, ...))

  const orTerms = implicants.map((pi) => {
    const literals = getLiterals(pi.pattern, vars, 'pos');

    if (literals.length <= 1) {
      return literals.length === 0
        ? { type: 'CONST' as const, label: '0', inputs: [] as GateNode[], id: nextId() }
        : literals[0];
    }

    // OR(a,b) = NAND(NOT(a), NOT(b))
    const invertedLits = literals.map((l) => makeNandNot(l));
    return {
      type: 'NAND' as const,
      label: 'NAND',
      inputs: invertedLits,
      id: nextId(),
    };
  });

  if (orTerms.length === 1) return orTerms[0];

  // AND of OR terms using NAND:
  // Need double NAND: NAND(NAND(all_or_terms))
  const innerNand: GateNode = {
    type: 'NAND',
    label: 'NAND',
    inputs: orTerms,
    id: nextId(),
  };

  return {
    type: 'NAND',
    label: 'NAND',
    inputs: [innerNand, innerNand],
    id: nextId(),
  };
}

/**
 * Convert a basic gate tree to NOR-only.
 * NOR(a,b) = NOT(OR(a,b))
 *
 * For POS: F = AND(OR terms) = NOR(NOR(term1), NOR(term2), ...)
 * For SOP: Each AND(a,b) = NOR(NOT(a), NOT(b)) = NOR(NOR(a,a), NOR(b,b))
 */
export function buildNorTree(
  implicants: PrimeImplicant[],
  varCount: number,
  type: 'sop' | 'pos',
): GateNode {
  resetIds();

  if (implicants.length === 0) {
    return { type: 'CONST', label: type === 'sop' ? '0' : '1', inputs: [], id: nextId() };
  }

  if (type === 'pos') {
    return buildNorPOS(implicants, varCount);
  } else {
    return buildNorSOP(implicants, varCount);
  }
}

function buildNorPOS(implicants: PrimeImplicant[], varCount: number): GateNode {
  const vars = VAR_NAMES.slice(0, varCount);

  // POS: F = AND(OR1, OR2, ...)
  // Each OR term becomes a NOR gate (inverted output)
  // Top AND becomes NOR of NOR outputs (De Morgan)
  const norTerms = implicants.map((pi) => {
    const literals = getLiterals(pi.pattern, vars, 'pos');

    if (literals.length <= 1) {
      return literals.length === 0
        ? { type: 'CONST' as const, label: '0', inputs: [] as GateNode[], id: nextId() }
        : makeNorNot(literals[0]);
    }

    return {
      type: 'NOR' as const,
      label: 'NOR',
      inputs: literals,
      id: nextId(),
    };
  });

  if (norTerms.length === 1) {
    // Single OR term: NOR gives NOT(OR), so double-NOR to get OR
    const pi = implicants[0];
    const lits = getLiterals(pi.pattern, vars, 'pos');
    if (lits.length <= 1) {
      return lits.length === 0 ? { type: 'CONST', label: '0', inputs: [], id: nextId() } : lits[0];
    }
    const norGate: GateNode = { type: 'NOR', label: 'NOR', inputs: lits, id: nextId() };
    return { type: 'NOR', label: 'NOR', inputs: [norGate, norGate], id: nextId() };
  }

  return {
    type: 'NOR',
    label: 'NOR',
    inputs: norTerms,
    id: nextId(),
  };
}

function buildNorSOP(implicants: PrimeImplicant[], varCount: number): GateNode {
  const vars = VAR_NAMES.slice(0, varCount);

  // SOP: F = OR(AND1, AND2, ...)
  // Each AND(a,b) = NOR(NOT(a), NOT(b)) = NOR(NOR(a,a), NOR(b,b))
  const andTerms = implicants.map((pi) => {
    const literals = getLiterals(pi.pattern, vars, 'sop');

    if (literals.length <= 1) {
      return literals.length === 0
        ? { type: 'CONST' as const, label: '1', inputs: [] as GateNode[], id: nextId() }
        : literals[0];
    }

    // AND(a,b) using NOR: NOR(NOT(a), NOT(b))
    const invertedLits = literals.map((l) => makeNorNot(l));
    return {
      type: 'NOR' as const,
      label: 'NOR',
      inputs: invertedLits,
      id: nextId(),
    };
  });

  if (andTerms.length === 1) return andTerms[0];

  // OR of AND terms using NOR: NOR(NOR(all_and_terms))
  const innerNor: GateNode = {
    type: 'NOR',
    label: 'NOR',
    inputs: andTerms,
    id: nextId(),
  };

  return {
    type: 'NOR',
    label: 'NOR',
    inputs: [innerNor, innerNor],
    id: nextId(),
  };
}

/** Create NOT using NAND: NAND(a, a) */
function makeNandNot(input: GateNode): GateNode {
  if (input.type === 'NOT' && input.inputs.length === 1) {
    // NOT of NOT cancels
    return input.inputs[0];
  }
  return {
    type: 'NAND',
    label: 'NAND',
    inputs: [input, input],
    id: nextId(),
  };
}

/** Create NOT using NOR: NOR(a, a) */
function makeNorNot(input: GateNode): GateNode {
  if (input.type === 'NOT' && input.inputs.length === 1) {
    return input.inputs[0];
  }
  return {
    type: 'NOR',
    label: 'NOR',
    inputs: [input, input],
    id: nextId(),
  };
}

/** Get literal GateNodes for a pattern. */
function getLiterals(pattern: string, vars: string[], type: 'sop' | 'pos'): GateNode[] {
  const literals: GateNode[] = [];

  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '-') continue;

    const varNode: GateNode = {
      type: 'INPUT',
      label: vars[i],
      inputs: [],
      id: nextId(),
    };

    const needComplement = type === 'sop' ? pattern[i] === '0' : pattern[i] === '1';

    if (needComplement) {
      literals.push({
        type: 'NOT',
        label: 'NOT',
        inputs: [varNode],
        id: nextId(),
      });
    } else {
      literals.push(varNode);
    }
  }

  return literals;
}

/**
 * Count gates in a tree.
 */
export function countGates(node: GateNode): GateStats {
  const stats: GateStats = { and: 0, or: 0, not: 0, nand: 0, nor: 0, total: 0 };
  const visited = new Set<string>();

  function walk(n: GateNode): void {
    if (visited.has(n.id)) return;
    visited.add(n.id);

    switch (n.type) {
      case 'AND':
        stats.and++;
        stats.total++;
        break;
      case 'OR':
        stats.or++;
        stats.total++;
        break;
      case 'NOT':
        stats.not++;
        stats.total++;
        break;
      case 'NAND':
        stats.nand++;
        stats.total++;
        break;
      case 'NOR':
        stats.nor++;
        stats.total++;
        break;
    }

    for (const input of n.inputs) {
      walk(input);
    }
  }

  walk(node);
  return stats;
}

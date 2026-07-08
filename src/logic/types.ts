/** Parsed user input */
export interface BooleanExpression {
  terms: number[];
  dontCares: number[];
  varCount: number;
  type: 'sop' | 'pos';
}

/** A single minterm/maxterm entry */
export interface MintermEntry {
  index: number;
  binary: string;
  alphabetic: string;
  value: 0 | 1 | 'x';
}

/** Cell in the K-Map grid */
export interface KMapCell {
  index: number;
  row: number;
  col: number;
  value: 0 | 1 | 'x';
  groups: number[];
}

/** A prime implicant from Quine-McCluskey */
export interface PrimeImplicant {
  pattern: string; // e.g. "1-01" where - is don't care
  coveredMinterms: number[];
  expression: string; // e.g. "AC'D"
  isEssential: boolean;
  groupIndex: number;
}

/** Result of minimization */
export interface MinimizationResult {
  primeImplicants: PrimeImplicant[];
  essentialPrimeImplicants: PrimeImplicant[];
  selectedImplicants: PrimeImplicant[];
  minimizedExpression: string;
  steps: QMStep[];
}

/** A step in the Quine-McCluskey process */
export interface QMStep {
  round: number;
  groups: QMGroup[];
}

export interface QMGroup {
  onesCount: number;
  implicants: QMImplicant[];
}

export interface QMImplicant {
  pattern: string;
  coveredMinterms: number[];
  combined: boolean;
}

/** K-Map grouping */
export interface KMapGroup {
  cells: number[];
  expression: string;
  color: string;
  colorBg: string;
  implicant: PrimeImplicant;
}

/** Gate types */
export type GateType = 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'INPUT' | 'CONST';

/** A node in the gate tree */
export interface GateNode {
  type: GateType;
  label: string;
  inputs: GateNode[];
  id: string;
  /** layout info */
  x?: number;
  y?: number;
  layer?: number;
}

/** Gate count statistics */
export interface GateStats {
  and: number;
  or: number;
  not: number;
  nand: number;
  nor: number;
  total: number;
}

/** Complete result set for display */
export interface ComputationResult {
  input: BooleanExpression;
  entries: MintermEntry[];
  kmap: KMapCell[][];
  kmapGroups: KMapGroup[];
  minimization: MinimizationResult;
  basicGateTree: GateNode;
  nandGateTree: GateNode;
  norGateTree: GateNode;
  basicGateStats: GateStats;
  nandGateStats: GateStats;
  norGateStats: GateStats;
}

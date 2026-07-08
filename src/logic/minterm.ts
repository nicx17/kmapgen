import type { MintermEntry, BooleanExpression } from './types';

const VAR_NAMES = ['A', 'B', 'C', 'D'];

/**
 * Convert index to binary string of given length.
 */
export function indexToBinary(index: number, varCount: number): string {
  return index.toString(2).padStart(varCount, '0');
}

/**
 * Convert a binary string to alphabetic representation.
 * e.g., "0110" with 4 vars -> "A'BC'D"  (complement uses prime ')
 * For display, we'll use overline, but the raw string uses '.
 */
export function binaryToAlphabetic(binary: string, varCount: number): string {
  const vars = VAR_NAMES.slice(0, varCount);
  return vars.map((v, i) => (binary[i] === '1' ? v : `${v}'`)).join('');
}

/**
 * Generate all minterm entries for a boolean expression.
 */
export function generateEntries(expr: BooleanExpression): MintermEntry[] {
  const totalTerms = 1 << expr.varCount;
  const entries: MintermEntry[] = [];

  for (let i = 0; i < totalTerms; i++) {
    const binary = indexToBinary(i, expr.varCount);
    const alphabetic = binaryToAlphabetic(binary, expr.varCount);

    let value: 0 | 1 | 'x';
    if (expr.dontCares.includes(i)) {
      value = 'x';
    } else if (expr.type === 'sop') {
      value = expr.terms.includes(i) ? 1 : 0;
    } else {
      // POS: maxterms are where output is 0
      value = expr.terms.includes(i) ? 0 : 1;
    }

    entries.push({ index: i, binary, alphabetic, value });
  }

  return entries;
}

/**
 * Get the variable names for a given count.
 */
export function getVarNames(varCount: number): string[] {
  return VAR_NAMES.slice(0, varCount);
}

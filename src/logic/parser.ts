import type { BooleanExpression } from './types';

/**
 * Parse user input into a BooleanExpression.
 * Accepts formats:
 *   "1,3,4,6"
 *   "Σm(1,3,4,6)"
 *   "ΠM(0,2,5,7)"
 *   "sum(1,3,4,6)"
 *   "product(0,2,5,7)"
 * Don't-cares provided separately.
 */

export function parseExpression(
  termsInput: string,
  dontCaresInput: string,
  varCount: number,
  type: 'sop' | 'pos',
): BooleanExpression {
  const maxIndex = (1 << varCount) - 1;

  const terms = parseIndices(termsInput, maxIndex);
  const dontCares = parseIndices(dontCaresInput, maxIndex);

  // Check for overlap
  const overlap = terms.filter((t) => dontCares.includes(t));
  if (overlap.length > 0) {
    throw new Error(`Terms and don't-cares overlap at: ${overlap.join(', ')}`);
  }

  return { terms, dontCares, varCount, type };
}

function parseIndices(input: string, maxIndex: number): number[] {
  let cleaned = input.trim();
  if (!cleaned) return [];

  // Remove common wrappers: Σm(...), ΠM(...), sum(...), product(...), m(...), M(...)
  cleaned = cleaned.replace(/^[Σ∑]m\s*\(/i, '').replace(/\)$/, '');
  cleaned = cleaned.replace(/^[Π∏]M\s*\(/i, '').replace(/\)$/, '');
  cleaned = cleaned.replace(/^sum\s*\(/i, '').replace(/\)$/, '');
  cleaned = cleaned.replace(/^product\s*\(/i, '').replace(/\)$/, '');
  cleaned = cleaned.replace(/^m\s*\(/i, '').replace(/\)$/, '');
  cleaned = cleaned.replace(/^M\s*\(/i, '').replace(/\)$/, '');

  // Split by comma or space
  const parts = cleaned.split(/[\s,]+/).filter((s) => s.length > 0);
  const indices: number[] = [];

  for (const part of parts) {
    const num = parseInt(part, 10);
    if (isNaN(num)) {
      throw new Error(`Invalid index: "${part}"`);
    }
    if (num < 0 || num > maxIndex) {
      throw new Error(
        `Index ${num} out of range (0-${maxIndex}) for ${Math.log2(maxIndex + 1)} variables`,
      );
    }
    if (indices.includes(num)) {
      throw new Error(`Duplicate index: ${num}`);
    }
    indices.push(num);
  }

  return indices.sort((a, b) => a - b);
}

/** Validate that terms input is not empty */
export function validateTermsInput(input: string): string | null {
  const cleaned = input.trim();
  if (!cleaned) return 'Please enter at least one term index.';
  return null;
}

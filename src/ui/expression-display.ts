/**
 * Boolean expression display with overline notation for complements.
 */

/**
 * Render an algebraic expression as HTML with proper formatting.
 * Complements shown with overline, operators highlighted.
 */
export function renderExpressionHTML(expression: string, isSOP: boolean): string {
  if (expression === '0' || expression === '1') {
    return `<span class="expression-text expression-minimized">${expression}</span>`;
  }

  let html: string;

  if (isSOP) {
    // SOP: terms separated by +
    const terms = expression.split(' + ');
    const termHtmls = terms.map((term) => renderProductTerm(term));
    html = termHtmls.join('<span class="op"> + </span>');
  } else {
    // POS: terms are (A + B')(C + D)...
    html = renderPOSExpression(expression);
  }

  return `<span class="expression-text expression-minimized">${html}</span>`;
}

function renderProductTerm(term: string): string {
  let result = '';
  let i = 0;

  while (i < term.length) {
    const ch = term[i];

    if (ch === '(' || ch === ')') {
      result += ch;
      i++;
      continue;
    }

    // Variable letter
    if (/[A-Z]/.test(ch)) {
      // Check if next char is prime (complement)
      if (i + 1 < term.length && term[i + 1] === "'") {
        result += `<span class="overline">${ch}</span>`;
        i += 2;
      } else {
        result += ch;
        i++;
      }
    } else if (ch === ' ' || ch === '+') {
      result += `<span class="op">${ch === '+' ? ' + ' : ch}</span>`;
      i++;
    } else {
      result += ch;
      i++;
    }
  }

  return result;
}

function renderPOSExpression(expression: string): string {
  // POS terms are like (A + B')(C + D)
  let result = '';
  let i = 0;

  while (i < expression.length) {
    const ch = expression[i];

    if (ch === '(') {
      result += '(';
      i++;
      continue;
    }

    if (ch === ')') {
      result += ')';
      i++;
      continue;
    }

    if (/[A-Z]/.test(ch)) {
      if (i + 1 < expression.length && expression[i + 1] === "'") {
        result += `<span class="overline">${ch}</span>`;
        i += 2;
      } else {
        result += ch;
        i++;
      }
    } else if (ch === '+') {
      result += '<span class="op"> + </span>';
      i++;
    } else if (ch === ' ') {
      i++;
    } else {
      result += ch;
      i++;
    }
  }

  return result;
}

/**
 * Convert expression to plain text for clipboard.
 */
export function expressionToPlainText(expression: string): string {
  return expression;
}

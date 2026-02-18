/**
 * Receipt validation: reconcile totals and line items, return issues and suggested fields to review.
 */
import type { ParsedReceipt, ParsedTotals, ParsedLineItem } from './ocr/types.js';

const TOLERANCE = 0.02;

function approx(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOLERANCE;
}

export interface ValidationResult {
  isValid: boolean;
  issues: string[];
  suggestedFieldsToReview: string[];
}

export function validateReceipt(receipt: {
  totals: ParsedTotals;
  lineItems: ParsedLineItem[];
}): ValidationResult {
  const issues: string[] = [];
  const suggestedFieldsToReview: string[] = [];
  const { totals, lineItems } = receipt;

  const subtotal = totals.subtotal ?? 0;
  const tax = totals.tax ?? 0;
  const tip = totals.tip ?? 0;
  const total = totals.total ?? 0;

  const sumItems = lineItems.reduce((s, i) => s + i.price, 0);

  console.log('[Receipt] validateReceipt input:', {
    subtotal,
    tax,
    tip,
    total,
    sumItems,
    lineItemCount: lineItems.length,
  });

  // subtotal + tax + tip ≈ total
  const computedTotal = subtotal + tax + tip;
  if (!approx(computedTotal, total)) {
    issues.push(`Totals don't reconcile: subtotal + tax + tip = ${computedTotal.toFixed(2)}, total = ${total.toFixed(2)}`);
    suggestedFieldsToReview.push('total', 'subtotal', 'tax', 'tip');
  }

  // sum(lineItems) ≈ subtotal
  if (!approx(sumItems, subtotal)) {
    issues.push(`Line items sum (${sumItems.toFixed(2)}) doesn't match subtotal (${subtotal.toFixed(2)})`);
    suggestedFieldsToReview.push('subtotal');
    lineItems.forEach((_, i) => suggestedFieldsToReview.push(`lineItems[${i}].price`));
  }

  // Total should be the largest / bottom-most amount
  const maxAmount = Math.max(subtotal, tax, tip, total, sumItems);
  if (total > 0 && maxAmount > total + TOLERANCE) {
    issues.push(`Total (${total.toFixed(2)}) is less than expected max amount (${maxAmount.toFixed(2)})`);
    if (!suggestedFieldsToReview.includes('total')) suggestedFieldsToReview.push('total');
  }

  const isValid = issues.length === 0;
  const result = {
    isValid,
    issues,
    suggestedFieldsToReview: [...new Set(suggestedFieldsToReview)],
  };
  console.log('[Receipt] validateReceipt result:', result);
  return result;
}

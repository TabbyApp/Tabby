/**
 * Client-side receipt validation (mirrors server logic for live UI feedback).
 */
import type { ParsedReceipt } from './api';

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
  totals: ParsedReceipt['totals'];
  lineItems: ParsedReceipt['lineItems'];
}): ValidationResult {
  const issues: string[] = [];
  const suggestedFieldsToReview: string[] = [];
  const { totals, lineItems } = receipt;

  const subtotal = totals.subtotal ?? 0;
  const tax = totals.tax ?? 0;
  const tip = totals.tip ?? 0;
  const total = totals.total ?? 0;

  const sumItems = lineItems.reduce((s, i) => s + i.price, 0);

  const computedTotal = subtotal + tax + tip;
  if (!approx(computedTotal, total)) {
    issues.push(`Totals don't reconcile: subtotal + tax + tip = ${computedTotal.toFixed(2)}, total = ${total.toFixed(2)}`);
    suggestedFieldsToReview.push('total', 'subtotal', 'tax', 'tip');
  }

  if (!approx(sumItems, subtotal)) {
    issues.push(`Line items sum (${sumItems.toFixed(2)}) doesn't match subtotal (${subtotal.toFixed(2)})`);
    suggestedFieldsToReview.push('subtotal');
    lineItems.forEach((_, i) => suggestedFieldsToReview.push(`lineItems[${i}].price`));
  }

  const maxAmount = Math.max(subtotal, tax, tip, total, sumItems);
  if (total > 0 && maxAmount > total + TOLERANCE) {
    issues.push(`Total (${total.toFixed(2)}) is less than expected max amount (${maxAmount.toFixed(2)})`);
    if (!suggestedFieldsToReview.includes('total')) suggestedFieldsToReview.push('total');
  }

  return {
    isValid: issues.length === 0,
    issues,
    suggestedFieldsToReview: [...new Set(suggestedFieldsToReview)],
  };
}

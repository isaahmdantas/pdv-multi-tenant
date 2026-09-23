import { describe, it, expect } from 'vitest';
import { resolvePayments } from '@/components/pdv/types';

describe('resolvePayments', () => {
  const empty = { CASH: '', PIX: '', CREDIT: '', DEBIT: '', VOUCHER: '' };

  it('completes with a single payment method equal to total', () => {
    const result = resolvePayments(80, { ...empty, CASH: '80' });
    expect(result.complete).toBe(true);
    expect(result.allocs).toEqual([{ methodCode: 'CASH', amount: 80 }]);
    expect(result.change).toBe(0);
    expect(result.remaining).toBe(0);
  });

  it('splits total across multiple methods', () => {
    const result = resolvePayments(80, { ...empty, PIX: '50', CREDIT: '25', DEBIT: '5' });
    expect(result.complete).toBe(true);
    expect(result.paid).toBe(80);
    expect(result.allocs).toEqual([
      { methodCode: 'PIX', amount: 50 },
      { methodCode: 'CREDIT', amount: 25 },
      { methodCode: 'DEBIT', amount: 5 },
    ]);
  });

  it('is incomplete when total not reached', () => {
    const result = resolvePayments(80, { ...empty, CASH: '30' });
    expect(result.complete).toBe(false);
    expect(result.remaining).toBe(50);
    expect(result.change).toBe(0);
  });

  it('computes change only from CASH surplus and trims recorded cash', () => {
    const result = resolvePayments(80, { ...empty, CASH: '100' });
    expect(result.change).toBe(20);
    expect(result.complete).toBe(true);
    expect(result.allocs).toEqual([{ methodCode: 'CASH', amount: 80 }]);
  });

  it('returns change in cash over split payments', () => {
    const result = resolvePayments(80, { ...empty, PIX: '30', CASH: '100' });
    expect(result.paid).toBe(130);
    expect(result.change).toBe(50);
    expect(result.complete).toBe(true);
    expect(result.allocs).toEqual([
      { methodCode: 'CASH', amount: 50 },
      { methodCode: 'PIX', amount: 30 },
    ]);
  });

  it('rejects non-cash overpayment as incomplete', () => {
    const result = resolvePayments(80, { ...empty, CREDIT: '90' });
    expect(result.change).toBe(0);
    expect(result.complete).toBe(false);
    expect(result.allocs).toEqual([{ methodCode: 'CREDIT', amount: 90 }]);
  });

  it('is incomplete when no payment is set', () => {
    const result = resolvePayments(80, empty);
    expect(result.complete).toBe(false);
    expect(result.allocs).toEqual([]);
  });

  it('tolerates comma decimal separator and floating rounding', () => {
    const result = resolvePayments(33.33, { ...empty, PIX: '33,33' });
    expect(result.complete).toBe(true);
    expect(result.allocs).toEqual([{ methodCode: 'PIX', amount: 33.33 }]);
  });
});
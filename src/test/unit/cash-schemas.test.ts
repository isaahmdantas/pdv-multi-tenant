import { describe, it, expect } from 'vitest';
import {
  openCashSessionSchema,
  supplySchema,
  withdrawSchema,
  closeCashSessionSchema,
  cashSessionQuerySchema,
} from '@/modules/cash/schemas';
import { AUDIT_ACTIONS } from '@/modules/audit/types';

describe('cash schemas', () => {
  describe('openCashSessionSchema', () => {
    it('accepts valid input with required fields', () => {
      const result = openCashSessionSchema.safeParse({
        cashRegisterId: 'clx1234567890abcdef',
        openingAmount: '100.00',
        notes: 'Abertura do dia',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.openingAmount).toBe('100.00');
      }
    });

    it('defaults openingAmount to 0', () => {
      const result = openCashSessionSchema.safeParse({
        cashRegisterId: 'clx1234567890abcdef',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.openingAmount).toBe('0');
      }
    });

    it('rejects invalid cashRegisterId', () => {
      const result = openCashSessionSchema.safeParse({
        cashRegisterId: 'invalid-id',
        openingAmount: '100',
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative openingAmount', () => {
      const result = openCashSessionSchema.safeParse({
        cashRegisterId: 'clx1234567890abcdef',
        openingAmount: '-50',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('supplySchema', () => {
    it('accepts valid supply', () => {
      const result = supplySchema.safeParse({
        amount: '50.00',
        methodCode: 'PIX',
        notes: 'Suprimento via PIX',
      });
      expect(result.success).toBe(true);
    });

    it('defaults methodCode to CASH', () => {
      const result = supplySchema.safeParse({ amount: '50' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.methodCode).toBe('CASH');
    });

    it('rejects zero amount', () => {
      const result = supplySchema.safeParse({ amount: '0' });
      expect(result.success).toBe(false);
    });
  });

  describe('withdrawSchema', () => {
    it('accepts valid withdraw', () => {
      const result = withdrawSchema.safeParse({
        amount: '30.00',
        methodCode: 'CASH',
        notes: 'Sangria para cofre',
      });
      expect(result.success).toBe(true);
    });

    it('defaults methodCode to CASH', () => {
      const result = withdrawSchema.safeParse({ amount: '30' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.methodCode).toBe('CASH');
    });
  });

  describe('closeCashSessionSchema', () => {
    it('accepts countedByMethod with at least one method', () => {
      const result = closeCashSessionSchema.safeParse({
        countedByMethod: { CASH: '150.00', PIX: '200.00' },
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty countedByMethod', () => {
      const result = closeCashSessionSchema.safeParse({ countedByMethod: {} });
      expect(result.success).toBe(false);
    });

    it('accepts string numbers for amounts', () => {
      const result = closeCashSessionSchema.safeParse({
        countedByMethod: { CASH: '150', PIX: '200.50' },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('cashSessionQuerySchema', () => {
    it('accepts valid query params', () => {
      const result = cashSessionQuerySchema.safeParse({
        storeId: 'clx1234567890abcdef',
        status: 'OPEN',
        cashRegisterId: 'clx1234567890abcde1',
        fromDate: new Date('2024-01-01'),
        toDate: new Date('2024-12-31'),
      });
      expect(result.success).toBe(true);
    });

    it('coerces date strings to Date', () => {
      const result = cashSessionQuerySchema.safeParse({
        fromDate: '2024-01-01',
        toDate: '2024-12-31',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fromDate).toBeInstanceOf(Date);
        expect(result.data.toDate).toBeInstanceOf(Date);
      }
    });
  });

  describe('AUDIT_ACTIONS', () => {
    it('contains cash actions', () => {
      expect(AUDIT_ACTIONS).toContain('CASH_OPENED');
      expect(AUDIT_ACTIONS).toContain('CASH_CLOSED');
      expect(AUDIT_ACTIONS).toContain('CASH_WITHDRAWAL');
      expect(AUDIT_ACTIONS).toContain('CASH_SUPPLY');
    });
  });
});
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent';

interface CashRegisterOption {
  id: string;
  label: string;
}

interface OpenCashSessionFormProps {
  cashRegisters: CashRegisterOption[];
}

export function OpenCashSessionForm({ cashRegisters }: OpenCashSessionFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cashRegisterId, setCashRegisterId] = useState('');
  const [openingAmount, setOpeningAmount] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/v1/cash-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cashRegisterId,
          openingAmount: openingAmount || '0',
          notes: notes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Erro ao abrir caixa');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-card">
      <h3 className="text-lg font-semibold">Abrir Caixa</h3>
      {error && <div className="text-sm text-destructive">{error}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cashRegisterId" className="block text-sm font-medium mb-1">
            Caixa *
          </label>
          <select
            id="cashRegisterId"
            value={cashRegisterId}
            onChange={(e) => setCashRegisterId(e.target.value)}
            className={inputClass}
            required
          >
            <option value="">Selecione o caixa</option>
            {cashRegisters.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="openingAmount" className="block text-sm font-medium mb-1">
            Valor Inicial (R$)
          </label>
          <input
            id="openingAmount"
            type="number"
            step="0.01"
            min="0"
            value={openingAmount}
            onChange={(e) => setOpeningAmount(e.target.value)}
            className={inputClass}
            placeholder="0,00"
          />
        </div>
      </div>
      <div>
        <label htmlFor="notes" className="block text-sm font-medium mb-1">
          Observações
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputClass}
          rows={2}
          placeholder="Observações da abertura"
        />
      </div>
      <Button type="submit" disabled={loading || !cashRegisterId} className="w-full sm:w-auto">
        {loading ? 'Abrindo...' : 'Abrir Caixa'}
      </Button>
    </form>
  );
}
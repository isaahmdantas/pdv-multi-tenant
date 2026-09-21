'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent';

interface CashActionButtonProps {
  sessionId: string;
  action: 'supply' | 'withdraw';
  label: string;
  methodCodes: string[];
}

export function CashActionButton({ sessionId, action, label, methodCodes }: CashActionButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [methodCode, setMethodCode] = useState(methodCodes[0]);
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/v1/cash-sessions/${sessionId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, methodCode, notes: notes || undefined }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Erro ao ${action === 'supply' ? 'suprir' : 'sangrar'}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 border rounded-lg bg-card w-full sm:w-80">
      <h4 className="font-medium">{label}</h4>
      {error && <div className="text-sm text-destructive">{error}</div>}
      <div className="grid gap-2">
        <div>
          <label className="block text-sm font-medium mb-1">Valor (R$)</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass}
            required
            placeholder="0,00"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Forma</label>
          <select value={methodCode} onChange={(e) => setMethodCode(e.target.value)} className={inputClass}>
            {methodCodes.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Observações</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} rows={2} />
        </div>
      </div>
      <Button type="submit" disabled={loading || !amount} className="w-full">
        {loading ? 'Processando...' : label}
      </Button>
    </form>
  );
}
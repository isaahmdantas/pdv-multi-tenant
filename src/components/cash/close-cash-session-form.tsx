'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent';

interface CloseCashSessionFormProps {
  sessionId: string;
  expectedByMethod: Record<string, string>;
  onClose: () => void;
}

const DEFAULT_METHODS = ['CASH', 'PIX', 'CREDIT', 'DEBIT', 'VOUCHER'];

function initialCountedByMethod(expectedByMethod: Record<string, string>): Record<string, string> {
  const initial: Record<string, string> = {};
  for (const method of DEFAULT_METHODS) {
    initial[method] = expectedByMethod[method] || '0';
  }
  return initial;
}

export function CloseCashSessionForm({ sessionId, expectedByMethod, onClose }: CloseCashSessionFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countedByMethod, setCountedByMethod] = useState<Record<string, string>>(() => initialCountedByMethod(expectedByMethod));

  const handleChange = (method: string, value: string) => {
    setCountedByMethod((prev) => ({ ...prev, [method]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/v1/cash-sessions/${sessionId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countedByMethod }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Erro ao fechar caixa');
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  const totalExpected = Object.values(expectedByMethod).reduce((sum, v) => sum + Number(v), 0);
  const totalCounted = Object.values(countedByMethod).reduce((sum, v) => sum + Number(v), 0);
  const difference = totalCounted - totalExpected;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-card">
      <h3 className="text-lg font-semibold">Fechar Caixa</h3>
      {error && <div className="text-sm text-destructive">{error}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        {DEFAULT_METHODS.map((method) => (
          <div key={method} className="space-y-1">
            <label className="block text-sm font-medium">{method}</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <span className="block text-xs text-muted-foreground mb-1">Esperado</span>
                <input type="text" value={Number(expectedByMethod[method] || 0).toFixed(2)} readOnly className={inputClass + ' bg-muted' } />
              </div>
              <div className="flex-1">
                <span className="block text-xs text-muted-foreground mb-1">Contado</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={countedByMethod[method] || '0'}
                  onChange={(e) => handleChange(method, e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-3 text-sm">
        <div className="font-medium">Total Esperado: R$ {totalExpected.toFixed(2)}</div>
        <div className="font-medium">Total Contado: R$ {totalCounted.toFixed(2)}</div>
        <div className={`font-medium ${difference > 0 ? 'text-emerald-600' : difference < 0 ? 'text-destructive' : ''}`}>
          Diferença: R$ {difference.toFixed(2)} {difference > 0 ? '(Sobra)' : difference < 0 ? '(Falta)' : '(Exato)'}
        </div>
      </div>
      <Button type="submit" disabled={loading} className="w-full sm:w-auto">
        {loading ? 'Fechando...' : 'Fechar Caixa'}
      </Button>
    </form>
  );
}
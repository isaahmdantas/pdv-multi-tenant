'use client';

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CashMovement {
  id: string;
  type: string;
  methodCode: string | null;
  amount: string | number;
  notes: string | null;
  referenceType: string | null;
  referenceId: string | null;
  createdBy: string;
  createdAt: string;
}

const typeLabels: Record<string, string> = {
  OPENING: 'Abertura',
  SALE: 'Venda',
  SUPPLY: 'Suprimento',
  WITHDRAW: 'Sangria',
  CLOSING: 'Fechamento',
  ADJUSTMENT: 'Ajuste',
  REFUND: 'Estorno',
};

const typeColors: Record<string, string> = {
  OPENING: 'bg-blue-100 text-blue-800',
  SALE: 'bg-emerald-100 text-emerald-800',
  SUPPLY: 'bg-indigo-100 text-indigo-800',
  WITHDRAW: 'bg-amber-100 text-amber-800',
  CLOSING: 'bg-purple-100 text-purple-800',
  ADJUSTMENT: 'bg-gray-100 text-gray-800',
  REFUND: 'bg-rose-100 text-rose-800',
};

interface MovementsListProps {
  movements: CashMovement[];
}

export function MovementsList({ movements }: MovementsListProps) {
  if (!movements.length) return <p className="text-sm text-muted-foreground text-center py-4">Nenhuma movimentação</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 pr-4">Data/Hora</th>
            <th className="pb-2 pr-4">Tipo</th>
            <th className="pb-2 pr-4">Forma</th>
            <th className="pb-2 pr-4 text-right">Valor</th>
            <th className="pb-2 pr-4">Observações</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((m) => (
            <tr key={m.id} className="border-b last:border-0">
              <td className="py-2 pr-4">{format(new Date(m.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</td>
              <td className="py-2 pr-4">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[m.type] || 'bg-gray-100 text-gray-800'}`}>
                  {typeLabels[m.type] || m.type}
                </span>
              </td>
              <td className="py-2 pr-4">{m.methodCode || '-'}</td>
              <td className="py-2 pr-4 text-right tabular-nums">R$ {Number(m.amount).toFixed(2)}</td>
              <td className="py-2 pr-4 text-muted-foreground">{m.notes || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
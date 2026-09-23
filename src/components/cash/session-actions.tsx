'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CloseCashSessionForm } from '@/components/cash/close-cash-session-form';
import { CashActionButton } from '@/components/cash/cash-action-button';

const DEFAULT_METHODS = ['CASH', 'PIX', 'CREDIT', 'DEBIT', 'VOUCHER'];

interface SessionActionsProps {
  sessionId: string;
  cashRegisterName: string;
  storeName: string;
  status: string;
  expectedByMethod: Record<string, string>;
  canSupply: boolean;
  canWithdraw: boolean;
  canClose: boolean;
}

export function SessionActions({
  sessionId,
  cashRegisterName,
  storeName,
  status,
  expectedByMethod,
  canSupply,
  canWithdraw,
  canClose,
}: SessionActionsProps) {
  const router = useRouter();
  const [showClose, setShowClose] = useState(false);
  const [showSupply, setShowSupply] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  const handleClose = () => {
    setShowClose(false);
    router.refresh();
  };

  const handleSupply = () => {
    setShowSupply(false);
    router.refresh();
  };

  const handleWithdraw = () => {
    setShowWithdraw(false);
    router.refresh();
  };

  if (status !== 'OPEN') return null;

  return (
    <div className="flex flex-wrap gap-2">
      {canSupply && (
        <CashActionButton
          sessionId={sessionId}
          action="supply"
          label="Suprir"
          methodCodes={DEFAULT_METHODS}
        />
      )}
      {canWithdraw && (
        <CashActionButton
          sessionId={sessionId}
          action="withdraw"
          label="Sangrar"
          methodCodes={DEFAULT_METHODS}
        />
      )}
      {canClose && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowClose(true)}
            className="gap-1.5"
          >
            Fechar
          </Button>
          {showClose && (
            <CloseCashSessionForm
              sessionId={sessionId}
              expectedByMethod={expectedByMethod}
              onClose={handleClose}
            />
          )}
        </>
      )}
    </div>
  );
}
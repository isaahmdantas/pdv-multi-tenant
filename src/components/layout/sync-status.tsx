'use client'

import { useSyncStatus, type SyncStatus } from '@/components/layout/sync-status-provider'

const STATUS_META: Record<SyncStatus, { label: string; dot: string }> = {
  ONLINE: {
    label: 'Online',
    dot: 'bg-success',
  },
  OFFLINE: {
    label: 'Offline',
    dot: 'bg-destructive',
  },
  SYNCING: {
    label: 'Sincronizando…',
    dot: 'bg-info',
  },
  PENDING: {
    label: 'Pendências de sincronização',
    dot: 'bg-warning',
  },
  ERROR: {
    label: 'Erro de sincronização',
    dot: 'bg-destructive',
  },
}

export function SyncStatusIndicator({
  showLabel = true,
}: {
  showLabel?: boolean
}) {
  const { status } = useSyncStatus()
  const meta = STATUS_META[status]

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span aria-hidden className={`size-2 rounded-full ${meta.dot} ring-1 ring-foreground/10`} />
      {showLabel ? <span>{meta.label}</span> : null}
      <span className="sr-only">{meta.label}</span>
    </span>
  )
}
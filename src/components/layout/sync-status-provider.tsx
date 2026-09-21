'use client'

import { createContext, useContext, useSyncExternalStore } from 'react'

export type SyncStatus =
  | 'ONLINE'
  | 'OFFLINE'
  | 'SYNCING'
  | 'PENDING'
  | 'ERROR'

export interface SyncState {
  status: SyncStatus
  pending: number
}

// FASE 10.5: apenas ONLINE/OFFLINE refletem estado real (navigator.onLine).
// SYNCING/PENDING/ERROR são o contrato visual consumido pela FASE 13.
const SyncContext = createContext<SyncState>({ status: 'ONLINE', pending: 0 })

export function useSyncStatus(): SyncState {
  return useContext(SyncContext)
}

const subscribe = (onStoreChange: () => void) => {
  window.addEventListener('online', onStoreChange)
  window.addEventListener('offline', onStoreChange)
  return () => {
    window.removeEventListener('online', onStoreChange)
    window.removeEventListener('offline', onStoreChange)
  }
}

const getSnapshot = () => navigator.onLine
// Snapshot usada no SSR/hidratação: página nasce Online e acompanha o
// estado real assim que o navegador notifica os eventos online/offline.
const getServerSnapshot = () => true

export function SyncStatusProvider({ children }: { children: React.ReactNode }) {
  const online = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const state: SyncState = { status: online ? 'ONLINE' : 'OFFLINE', pending: 0 }

  return <SyncContext.Provider value={state}>{children}</SyncContext.Provider>
}
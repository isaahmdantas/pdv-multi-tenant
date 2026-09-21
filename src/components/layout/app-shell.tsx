import type { NavSection } from '@/lib/navigation'
import { DesktopSidebar } from '@/components/layout/app-sidebar'
import { AppHeader } from '@/components/layout/app-header'
import { SyncStatusProvider } from '@/components/layout/sync-status-provider'
import { Toaster } from '@/components/ui/toast'

export interface AppShellProps {
  sections: NavSection[]
  stores: { storeId: string; name: string; code: string }[]
  currentStoreId: string | null
  userName: string | null
  userEmail: string
  children: React.ReactNode
}

export function AppShell({
  sections,
  stores,
  currentStoreId,
  userName,
  userEmail,
  children,
}: AppShellProps) {
  return (
    <SyncStatusProvider>
      <div className="flex min-h-dvh w-full">
        <DesktopSidebar sections={sections} />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader
            sections={sections}
            stores={stores}
            currentStoreId={currentStoreId}
            userName={userName}
            userEmail={userEmail}
          />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
      <Toaster />
    </SyncStatusProvider>
  )
}
import type { NavSection } from '@/lib/navigation'
import { AppTitle } from '@/components/layout/app-title'
import { MobileNav } from '@/components/layout/mobile-nav'
import { SyncStatusIndicator } from '@/components/layout/sync-status'
import { UnitSwitcher, type UnitSwitcherStore } from '@/components/layout/unit-switcher'
import { UserMenu } from '@/components/layout/user-menu'

export interface AppHeaderProps {
  sections: NavSection[]
  stores: UnitSwitcherStore[]
  currentStoreId: string | null
  userName: string | null
  userEmail: string
}

export function AppHeader({
  sections,
  stores,
  currentStoreId,
  userName,
  userEmail,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
      <MobileNav sections={sections} />
      <AppTitle sections={sections} />
      <div className="flex items-center gap-2 sm:gap-3">
        <UnitSwitcher stores={stores} currentStoreId={currentStoreId} />
        <span className="hidden h-6 w-px bg-border sm:block" aria-hidden />
        <SyncStatusIndicator />
        <span className="hidden h-6 w-px bg-border sm:block" aria-hidden />
        <UserMenu name={userName} email={userEmail} />
      </div>
    </header>
  )
}
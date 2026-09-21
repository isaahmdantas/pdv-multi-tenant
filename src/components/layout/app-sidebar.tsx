import Link from 'next/link'
import { Store } from 'lucide-react'
import type { NavSection } from '@/lib/navigation'
import { SidebarNav } from '@/components/layout/sidebar-nav'

export function SidebarBrand() {
  return (
    <div className="flex h-16 shrink-0 items-center gap-2.5 px-5">
      <Link
        href="/dashboard"
        className="flex min-w-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        aria-label="Ir para o dashboard"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
          <Store className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold text-sidebar-foreground">PDV Multi-tenant</span>
          <span className="block truncate text-[0.6875rem] text-sidebar-foreground/50">Gestão de vendas</span>
        </span>
      </Link>
    </div>
  )
}

export function AppSidebarContent({ sections }: { sections: NavSection[] }) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <SidebarBrand />
      <SidebarNav sections={sections} />
    </div>
  )
}

export function DesktopSidebar({ sections }: { sections: NavSection[] }) {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-sidebar-border lg:block">
      <div className="fixed inset-y-0 left-0 w-60 border-r border-sidebar-border bg-sidebar">
        <AppSidebarContent sections={sections} />
      </div>
    </aside>
  )
}
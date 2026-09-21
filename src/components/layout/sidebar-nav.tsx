'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { NavSection } from '@/lib/navigation'
import { NAV_ICONS } from '@/components/layout/nav-icons'
import { cn } from 'cn'

function isActive(href: string, activeOn: string[] | undefined, pathname: string): boolean {
  if (pathname === href) return true
  if (activeOn?.includes(pathname)) return true
  if (href !== '/dashboard' && pathname.startsWith(`${href}/`)) return true
  return false
}

export function SidebarNav({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-6">
      {sections.map((section) => {
        if (section.items.length === 0) return null
        return (
          <div key={section.label} className="flex flex-col gap-0.5">
            <p className="px-3 pt-5 pb-1.5 text-[0.6875rem] font-semibold tracking-wider text-sidebar-foreground/45 uppercase">
              {section.label}
            </p>
            {section.items.map((item) => {
              const active = isActive(item.href, item.activeOn, pathname)
              const Icon = NAV_ICONS[item.icon]

              if (item.soon) {
                return (
                  <span
                    key={item.href}
                    aria-disabled="true"
                    title="Em breve"
                    className="flex h-8 cursor-not-allowed items-center gap-2.5 rounded-md px-3 text-sm text-sidebar-foreground/40"
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="flex-1 truncate">{item.label}</span>
                    <span className="rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[0.625rem] font-medium text-sidebar-accent-foreground/70">
                      Em breve
                    </span>
                  </span>
                )
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-8 items-center gap-2.5 rounded-md px-3 text-sm font-medium transition-colors outline-none',
                    'focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
                    active
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{item.label}</span>
                </Link>
              )
            })}
          </div>
        )
      })}
    </nav>
  )
}
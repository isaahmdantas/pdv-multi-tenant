'use client'

import { usePathname } from 'next/navigation'
import type { NavSection } from '@/lib/navigation'

export function AppTitle({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname()

  for (const section of sections) {
    for (const item of section.items) {
      const match =
        pathname === item.href ||
        item.activeOn?.includes(pathname) ||
        (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`))
      if (match && !item.soon) {
        return (
          <span className="flex min-w-0 flex-1 items-baseline gap-1.5 text-sm sm:text-base">
            <span className="hidden shrink-0 text-muted-foreground sm:inline">{section.label}</span>
            <span className="hidden text-muted-foreground/50 sm:inline" aria-hidden>
              /
            </span>
            <span className="truncate font-semibold text-foreground">{item.label}</span>
          </span>
        )
      }
    }
  }

  return (
    <span className="truncate text-base font-semibold text-foreground sm:text-lg">PDV Multi-tenant</span>
  )
}
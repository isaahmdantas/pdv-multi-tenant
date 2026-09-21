'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import type { NavSection } from '@/lib/navigation'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { AppSidebarContent } from '@/components/layout/app-sidebar'

export function MobileNav({ sections }: { sections: NavSection[] }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="lg:hidden">
      <Drawer open={open} onOpenChange={setOpen} modal swipeDirection="left">
        <DrawerTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label="Abrir menu de navegação" className="lg:hidden">
              {open ? <X className="size-4" /> : <Menu className="size-4" />}
            </Button>
          }
        />
        <DrawerContent className="h-dvh max-w-[85vw] bg-sidebar text-sidebar-foreground border-sidebar-border">
          <DrawerTitle className="sr-only">Menu de navegação</DrawerTitle>
          <AppSidebarContent sections={sections} />
        </DrawerContent>
      </Drawer>
    </div>
  )
}
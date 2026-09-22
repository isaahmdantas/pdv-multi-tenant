'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Loader2 } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function initials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? '?'
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return `${first}${last}`.toUpperCase()
}

export function UserMenu({
  name,
  email,
}: {
  name: string | null
  email: string
}) {
  const router = useRouter()
  const [leaving, setLeaving] = useState(false)

  async function onSignOut() {
    setLeaving(true)
    await fetch('/api/v1/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Menu do usuário" className="rounded-full">
            <Avatar className="size-7 bg-secondary text-secondary-foreground">
              <AvatarFallback className="text-xs font-semibold">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="truncate text-sm font-medium text-foreground">{name ?? 'Usuário'}</span>
              <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
<DropdownMenuItem variant="destructive" onClick={onSignOut} disabled={leaving}>
            {leaving ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
            {leaving ? 'Saindo…' : 'Sair'}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
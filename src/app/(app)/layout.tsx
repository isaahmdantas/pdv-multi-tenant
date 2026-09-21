import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { filterNavSections } from '@/lib/navigation'
import { StoreSwitchService } from '@/modules/iam/services/store-switch-service'
import { AppShell } from '@/components/layout/app-shell'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const user = session.user
  if (!user.tenantId) redirect('/login')

  const storeService = new StoreSwitchService(prisma)
  const stores = user.storeId
    ? await storeService.listAccessibleStores(user.tenantId, user.id)
    : []

  const currentStoreId = user.storeId
  const sections = filterNavSections(user.permissions)

  return (
    <AppShell
      sections={sections}
      stores={stores}
      currentStoreId={currentStoreId}
      userName={user.name ?? user.email ?? 'Usuário'}
      userEmail={user.email ?? ''}
    >
      {children}
    </AppShell>
  )
}
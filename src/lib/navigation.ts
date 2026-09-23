export type NavIconName =
  | 'dashboard'
  | 'pdv'
  | 'caixa'
  | 'produtos'
  | 'clientes'
  | 'categorias'
  | 'precos'
  | 'estoque'
  | 'compras'
  | 'unidades'
  | 'unidades-medida'
  | 'caixas'
  | 'vendas'

export type NavItem = {
  href: string
  label: string
  icon: NavIconName
  /** Qualquer uma destas permissões revela o item; vazio/ausente = sempre visível */
  permissions?: string[]
  /** Item de rota futura, renderizado desabilitado como "Em breve" */
  soon?: boolean
  /** Paths adicionais que devem marcar o item como ativo */
  activeOn?: string[]
}

export type NavSection = {
  label: string
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Operação',
    items: [
      { href: '/pdv', label: 'PDV', icon: 'pdv', permissions: ['sales.create'] },
      {
        href: '/caixa',
        label: 'Caixa',
        icon: 'caixa',
        permissions: ['cash.open', 'cash.close', 'cash.withdraw', 'cash.supply'],
      },
      {
        href: '/vendas',
        label: 'Vendas',
        icon: 'vendas',
        permissions: ['reports.view'],
      },
    ],
  },
  {
    label: 'Cadastros',
    items: [
      {
        href: '/produtos',
        label: 'Produtos',
        icon: 'produtos',
        permissions: ['products.create', 'products.update', 'products.delete'],
      },
      {
        href: '/produtos/categorias',
        label: 'Categorias de produto',
        icon: 'categorias',
        permissions: ['products.create'],
      },
      {
        href: '/produtos/unidades-medida',
        label: 'Unidades de medida',
        icon: 'unidades-medida',
        permissions: ['products.create'],
      },
      {
        href: '/clientes',
        label: 'Clientes',
        icon: 'clientes',
        permissions: ['customers.manage'],
        activeOn: ['/clientes/categorias'],
      },
      {
        href: '/clientes/categorias',
        label: 'Categorias de cliente',
        icon: 'categorias',
        permissions: ['customers.manage'],
      },
      {
        href: '/precos',
        label: 'Preços',
        icon: 'precos',
        permissions: ['sales.discount', 'pricing.manage'],
      },
    ],
  },
  {
    label: 'Estoque',
    items: [
      {
        href: '/estoque',
        label: 'Estoque',
        icon: 'estoque',
        permissions: ['inventory.adjust', 'inventory.transfer'],
      },
    ],
  },
  {
    label: 'Compras',
    items: [
      {
        href: '/compras',
        label: 'Compras',
        icon: 'compras',
        permissions: ['purchases.manage'],
      },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    ],
  },
  {
    label: 'Administração',
    items: [
      {
        href: '/unidades',
        label: 'Unidades',
        icon: 'unidades',
        permissions: ['settings.manage'],
      },
      {
        href: '/caixas',
        label: 'Caixas',
        icon: 'caixas',
        permissions: ['settings.manage'],
      },
    ],
  },
]

export function filterNavSections(permissions: string[]): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    label: section.label,
    items: section.items.filter((item) => {
      if (!item.permissions || item.permissions.length === 0) return true
      return item.permissions.some((p) => permissions.includes(p))
    }),
  })).filter((section) => section.items.length > 0)
}
'use client'

import {
  Building2,
  Boxes,
  Calculator,
  CircleDollarSign,
  LayoutDashboard,
  Package,
  ShoppingBasket,
  ShoppingCart,
  Tags,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { NavIconName } from '@/lib/navigation'

export const NAV_ICONS: Record<NavIconName, LucideIcon> = {
  dashboard: LayoutDashboard,
  pdv: ShoppingCart,
  caixa: Calculator,
  produtos: Package,
  clientes: Users,
  categorias: Tags,
  precos: CircleDollarSign,
  estoque: Boxes,
  compras: ShoppingBasket,
  unidades: Building2,
}
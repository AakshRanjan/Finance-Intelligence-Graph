import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'

export interface FigSubModule {
  id: string
  title: string
  description?: string
  path: string
  icon: LucideIcon
  Component: ComponentType
}

export interface FigModule {
  id: string
  title: string
  description: string
  path: string
  icon: LucideIcon
  children: FigSubModule[]
}

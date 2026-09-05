import { historicalDataModule } from '@/modules/historical-data'
import type { FigModule, FigSubModule } from '@/modules/types'

export type { FigModule, FigSubModule } from '@/modules/types'

export const modules: FigModule[] = [historicalDataModule]

export function moduleForPath(pathname: string): FigModule | undefined {
  return modules.find(
    (mod) => pathname === mod.path || pathname.startsWith(`${mod.path}/`),
  )
}

export function subModuleForPath(
  mod: FigModule | undefined,
  pathname: string,
): FigSubModule | undefined {
  if (mod === undefined) {
    return undefined
  }
  return mod.children.find(
    (child) => pathname === `${mod.path}/${child.path}`,
  )
}

export function childHref(mod: FigModule, child: FigSubModule): string {
  return `${mod.path}/${child.path}`
}

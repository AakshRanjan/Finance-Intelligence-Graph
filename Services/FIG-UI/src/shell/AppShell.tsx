import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { moduleForPath, subModuleForPath } from '@/modules/registry'
import { AppHeader } from '@/shell/AppHeader'
import { AppSidebar } from '@/shell/AppSidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

function pageTitle(
  moduleTitle: string | undefined,
  subModuleTitle: string | undefined,
): string {
  if (moduleTitle && subModuleTitle) {
    return `FIG · ${moduleTitle} · ${subModuleTitle}`
  }
  if (moduleTitle) {
    return `FIG · ${moduleTitle}`
  }
  return 'FIG'
}

export function HomeShell() {
  useEffect(() => {
    document.title = 'FIG'
  }, [])

  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader module={undefined} />
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        <Outlet />
      </div>
    </div>
  )
}

export function ModuleShell() {
  const location = useLocation()
  const current = moduleForPath(location.pathname)
  const subModule = subModuleForPath(current, location.pathname)

  useEffect(() => {
    document.title = pageTitle(current?.title, subModule?.title)
  }, [current, subModule])

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="overflow-hidden">
        <AppHeader module={current} subModule={subModule} showSidebar />
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

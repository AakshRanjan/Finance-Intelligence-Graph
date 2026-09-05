import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { House } from 'lucide-react'

import { childHref, moduleForPath } from '@/modules/registry'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'

export function AppSidebar() {
  const location = useLocation()
  const { setOpenMobile } = useSidebar()
  const current = moduleForPath(location.pathname)

  useEffect(() => {
    setOpenMobile(false)
  }, [location.pathname, setOpenMobile])

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <span className="text-sm font-semibold tracking-tight">FIG</span>
          <span className="truncate text-xs text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
            {current?.title ?? 'Finance Intelligence'}
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link to="/" />}
                  tooltip="Home"
                >
                  <House />
                  <span>Home</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {current ? (
          <SidebarGroup>
            <SidebarGroupLabel>{current.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {current.children.map((child) => {
                  const href = childHref(current, child)
                  return (
                    <SidebarMenuItem key={child.id}>
                      <SidebarMenuButton
                        render={<Link to={href} />}
                        isActive={location.pathname === href}
                        tooltip={child.title}
                      >
                        <child.icon />
                        <span>{child.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}

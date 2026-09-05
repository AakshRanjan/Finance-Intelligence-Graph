import { ModeToggle } from '@/components/ModeToggle'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import type { FigModule, FigSubModule } from '@/modules/types'

export function AppHeader({
  module,
  subModule,
  showSidebar = false,
}: {
  module: FigModule | undefined
  subModule?: FigSubModule
  showSidebar?: boolean
}) {
  const title = module?.title ?? 'FIG'
  const description = subModule
    ? (subModule.description ?? subModule.title)
    : module
      ? module.description
      : 'Finance Intelligence Graph'

  return (
    <header className="flex min-h-14 shrink-0 items-center gap-2 border-b px-4 py-2">
      {showSidebar ? (
        <>
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-vertical:h-4" />
        </>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <h1 className="truncate text-sm font-semibold tracking-tight">
          {title}
        </h1>
        {description ? (
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <ModeToggle />
    </header>
  )
}

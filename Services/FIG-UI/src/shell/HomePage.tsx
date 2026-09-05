import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { modules } from '@/modules/registry'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function HomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-3xl flex-col items-center gap-8 text-center">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold tracking-tight">Modules</h2>
          <p className="text-sm text-muted-foreground">
            Choose a module to get started.
          </p>
        </div>
        <div className="grid w-full justify-center gap-5 [grid-template-columns:repeat(auto-fit,minmax(16rem,18rem))]">
          {modules.map((mod) => (
            <Link
              key={mod.id}
              to={mod.path}
              className="block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full text-left transition-all hover:-translate-y-0.5 hover:bg-muted/50 hover:ring-foreground/20">
                <CardHeader>
                  <div className="mb-2 flex size-12 items-center justify-center rounded-lg bg-muted">
                    <mod.icon className="size-6 text-foreground" aria-hidden />
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle>{mod.title}</CardTitle>
                    <ChevronRight
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  </div>
                  <CardDescription>{mod.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

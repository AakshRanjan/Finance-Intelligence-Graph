import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { modules } from '@/modules/registry'
import { HomeShell, ModuleShell } from '@/shell/AppShell'
import { HomePage } from '@/shell/HomePage'
import { NotFoundPage } from '@/shell/NotFoundPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<HomeShell />}>
          <Route path="/" element={<HomePage />} />
        </Route>
        {modules.map((mod) => {
          const first = mod.children[0]
          return (
            <Route key={mod.id} path={mod.path} element={<ModuleShell />}>
              {first ? (
                <Route
                  index
                  element={<Navigate to={first.path} replace />}
                />
              ) : null}
              {mod.children.map((child) => (
                <Route
                  key={child.id}
                  path={child.path}
                  element={<child.Component />}
                />
              ))}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          )
        })}
        <Route element={<HomeShell />}>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/scan')({ component: ScanLayout })

function ScanLayout() {
  return <Outlet />
}

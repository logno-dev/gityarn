import { createFileRoute } from '@tanstack/react-router'

import { ScanUtility } from '#/components/scan-utility'

export const Route = createFileRoute('/scan')({ component: ScanPage })

function ScanPage() {
  return (
    <section className="page-stack page-narrow">
      <ScanUtility showFab={false} />
    </section>
  )
}

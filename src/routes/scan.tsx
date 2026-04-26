import { createFileRoute } from '@tanstack/react-router'

import { ScanUtility } from '#/components/scan-utility'

export const Route = createFileRoute('/scan')({ component: ScanPage })

function ScanPage() {
  return (
    <section className="page-stack page-narrow">
      <header className="page-header">
        <h1>Barcode Scan</h1>
        <p>
          Scan a barcode to resolve existing associations, add yarn to inventory, submit corrections, or create new
          catalog items.
        </p>
      </header>

      <ScanUtility showFab={false} />
    </section>
  )
}

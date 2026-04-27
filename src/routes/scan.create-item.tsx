import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'

export const Route = createFileRoute('/scan/create-item')({
  validateSearch: (search: Record<string, unknown>) => ({
    barcode: typeof search.barcode === 'string' ? search.barcode : '',
    q: typeof search.q === 'string' ? search.q : '',
  }),
  component: ScanCreateItemPage,
})

function ScanCreateItemPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()

  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    manufacturerName: '',
    lineName: search.q,
    colorwayName: '',
    colorCode: '',
    weightClass: '',
    fiberContent: '',
    yardageMeters: '',
    productUrl: '',
  })

  const hasBarcode = useMemo(() => Boolean(search.barcode.trim()), [search.barcode])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!hasBarcode) {
      setStatus('Missing barcode. Return to scanner and re-run search flow.')
      return
    }

    setSaving(true)

    const createResponse = await fetch('/api/scan/create-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barcodeValue: search.barcode,
        manufacturerName: form.manufacturerName,
        lineName: form.lineName,
        colorwayName: form.colorwayName || null,
        colorCode: form.colorCode || null,
        weightClass: form.weightClass || null,
        fiberContent: form.fiberContent || null,
        yardageMeters: form.yardageMeters ? Number(form.yardageMeters) : null,
        productUrl: form.productUrl || null,
      }),
    })

    const createPayload = (await createResponse.json()) as {
      message?: string
      lineId?: string
      colorwayId?: string | null
    }

    if (!createResponse.ok || !createPayload.lineId) {
      setStatus(createPayload.message ?? 'Could not create item.')
      setSaving(false)
      return
    }

    await fetch('/api/scan/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lineId: createPayload.lineId,
        colorwayId: createPayload.colorwayId ?? null,
      }),
    })

    setStatus('Item created, barcode linked, and added to inventory.')
    setSaving(false)
  }

  return (
    <section className="page-stack page-narrow">
      <article className="soft-panel">
        <p>
          Barcode: <strong>{search.barcode || 'Not provided'}</strong>
        </p>
        <form className="stack-form" onSubmit={submit}>
          <label>
            Manufacturer name
            <input
              onChange={(event) => setForm((current) => ({ ...current, manufacturerName: event.target.value }))}
              required
              type="text"
              value={form.manufacturerName}
            />
          </label>
          <label>
            Yarn line name
            <input
              onChange={(event) => setForm((current) => ({ ...current, lineName: event.target.value }))}
              required
              type="text"
              value={form.lineName}
            />
          </label>
          <label>
            Colorway name (optional)
            <input
              onChange={(event) => setForm((current) => ({ ...current, colorwayName: event.target.value }))}
              type="text"
              value={form.colorwayName}
            />
          </label>
          <label>
            Color code (optional)
            <input
              onChange={(event) => setForm((current) => ({ ...current, colorCode: event.target.value }))}
              type="text"
              value={form.colorCode}
            />
          </label>
          <label>
            Weight class (optional)
            <input
              onChange={(event) => setForm((current) => ({ ...current, weightClass: event.target.value }))}
              type="text"
              value={form.weightClass}
            />
          </label>
          <label>
            Fiber content (optional)
            <input
              onChange={(event) => setForm((current) => ({ ...current, fiberContent: event.target.value }))}
              type="text"
              value={form.fiberContent}
            />
          </label>
          <label>
            Yardage meters (optional)
            <input
              onChange={(event) => setForm((current) => ({ ...current, yardageMeters: event.target.value }))}
              min={1}
              type="number"
              value={form.yardageMeters}
            />
          </label>
          <label>
            Manufacturer page URL (optional)
            <input
              onChange={(event) => setForm((current) => ({ ...current, productUrl: event.target.value }))}
              placeholder="https://..."
              type="url"
              value={form.productUrl}
            />
          </label>
          <div className="hero-actions">
            <button className="button button-primary" disabled={saving} type="submit">
              Create + associate + add
            </button>
            <button className="button" onClick={() => navigate({ to: '/scan' })} type="button">
              Back to scanner
            </button>
          </div>
        </form>
        {status ? <p>{status}</p> : null}
      </article>
    </section>
  )
}

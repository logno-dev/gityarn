import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

const normalizeSearchText = (value: unknown) => {
  if (typeof value !== 'string') {
    return ''
  }

  const trimmed = value.trim()
  const unwrapped = trimmed.replace(/^"(.+)"$/, '$1')
  return unwrapped.trim()
}

export const Route = createFileRoute('/scan/create-item')({
  validateSearch: (search: Record<string, unknown>) => ({
    barcode: normalizeSearchText(search.barcode),
    q: normalizeSearchText(search.q),
  }),
  component: ScanCreateItemPage,
})

function ScanCreateItemPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const [fallbackSearch, setFallbackSearch] = useState({ barcode: '', q: '' })

  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [manufacturerSuggestions, setManufacturerSuggestions] = useState<Array<{ id: string; name: string; yarnLineCount: number }>>([])
  const [form, setForm] = useState({
    manufacturerName: '',
    lineName: search.q || fallbackSearch.q,
    colorwayName: '',
    colorCode: '',
    weightClass: '',
    fiberContent: '',
    yardageMeters: '',
    productUrl: '',
  })

  const barcodeValue = useMemo(() => search.barcode || fallbackSearch.barcode, [search.barcode, fallbackSearch.barcode])
  const hasBarcode = useMemo(() => Boolean(barcodeValue.trim()), [barcodeValue])

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem('scan-create-item-draft')
      if (!raw) {
        return
      }

      const parsed = JSON.parse(raw) as { barcode?: unknown; q?: unknown }
      setFallbackSearch({
        barcode: normalizeSearchText(parsed.barcode),
        q: normalizeSearchText(parsed.q),
      })
    } catch {
      setFallbackSearch({ barcode: '', q: '' })
    }
  }, [])

  useEffect(() => {
    if (!search.q && fallbackSearch.q) {
      setForm((current) => ({ ...current, lineName: current.lineName || fallbackSearch.q }))
    }
  }, [search.q, fallbackSearch.q])

  useEffect(() => {
    const manufacturerQuery = form.manufacturerName.trim()
    if (!manufacturerQuery) {
      setManufacturerSuggestions([])
      return
    }

    const timer = window.setTimeout(() => {
      fetch(`/api/catalog/manufacturers?query=${encodeURIComponent(manufacturerQuery)}&limit=8`)
        .then((response) => response.json() as Promise<{ manufacturers?: Array<{ id: string; name: string; yarnLineCount: number }> }>)
        .then((payload) => {
          setManufacturerSuggestions(payload.manufacturers ?? [])
        })
        .catch(() => {
          setManufacturerSuggestions([])
        })
    }, 180)

    return () => window.clearTimeout(timer)
  }, [form.manufacturerName])

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
        barcodeValue,
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
          Barcode: <strong>{barcodeValue || 'Not provided'}</strong>
        </p>
        <form className="stack-form" onSubmit={submit}>
          <label>
            Barcode
            <input readOnly type="text" value={barcodeValue} />
          </label>
          <label>
            Manufacturer name
            <input
              list="scan-create-item-manufacturer-suggestions"
              onChange={(event) => setForm((current) => ({ ...current, manufacturerName: event.target.value }))}
              required
              type="text"
              value={form.manufacturerName}
            />
          </label>
          <datalist id="scan-create-item-manufacturer-suggestions">
            {manufacturerSuggestions.map((manufacturer) => (
              <option key={manufacturer.id} value={manufacturer.name}>
                {manufacturer.name}
              </option>
            ))}
          </datalist>
          {manufacturerSuggestions.length ? (
            <p>
              Suggestions:{' '}
              {manufacturerSuggestions.map((manufacturer) => `${manufacturer.name} (${manufacturer.yarnLineCount} lines)`).join(', ')}
            </p>
          ) : null}
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

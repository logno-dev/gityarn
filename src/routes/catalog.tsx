import { Outlet, createFileRoute, useNavigate, useRouterState } from '@tanstack/react-router'
import { Building2, Link2, Palette, ScanSearch, Search, SwatchBook } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

export const Route = createFileRoute('/catalog')({ component: CatalogPage })

type CatalogResponse = {
  summary: {
    manufacturers: number
    yarnLines: number
    colorways: number
    barcodes: number
  }
  filterOptions: {
    weightClasses: string[]
  }
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    hasPreviousPage: boolean
    hasNextPage: boolean
  }
  lines: Array<{
    id: string
    name: string
    manufacturerName: string
    weightClass: string | null
    fiberContent: string | null
    yardageMeters: number | null
    productUrl: string | null
    colorwayCount: number
    barcodeCount: number
  }>
}

function CatalogPage() {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [weightClassFilter, setWeightClassFilter] = useState('all')
  const [hasBarcodeFilter, setHasBarcodeFilter] = useState<'any' | 'yes' | 'no'>('any')
  const [data, setData] = useState<CatalogResponse | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addStatus, setAddStatus] = useState('')
  const [adding, setAdding] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [addDraft, setAddDraft] = useState({
    manufacturerName: '',
    lineName: '',
    colorwayName: '',
    colorCode: '',
    hexReference: '',
    weightClass: '',
    fiberContent: '',
    yardageMeters: '',
    productUrl: '',
  })
  const [manufacturerSuggestions, setManufacturerSuggestions] = useState<Array<{ id: string; name: string; yarnLineCount: number }>>([])

  if (pathname !== '/catalog') {
    return <Outlet />
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(
      `/api/catalog?limit=80&page=${page}&query=${encodeURIComponent(query)}&weightClass=${encodeURIComponent(weightClassFilter)}&hasBarcodes=${hasBarcodeFilter}`,
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error((await response.json()).message ?? 'Catalog request failed.')
        }
        return response.json() as Promise<CatalogResponse>
      })
      .then((payload) => {
        if (!cancelled) {
          setData(payload)
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setError((fetchError as Error).message)
          setData(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [query, weightClassFilter, hasBarcodeFilter, page, reloadToken])

  useEffect(() => {
    setPage(1)
  }, [query, weightClassFilter, hasBarcodeFilter])

  useEffect(() => {
    if (!showAddForm) {
      return
    }
    const manufacturerQuery = addDraft.manufacturerName.trim()
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
  }, [addDraft.manufacturerName, showAddForm])

  const statCards = useMemo(
    () => [
      {
        icon: Building2,
        title: 'Manufacturers',
        value: data?.summary.manufacturers ?? 0,
      },
      {
        icon: SwatchBook,
        title: 'Yarn Lines',
        value: data?.summary.yarnLines ?? 0,
      },
      {
        icon: Palette,
        title: 'Colorways',
        value: data?.summary.colorways ?? 0,
      },
      {
        icon: ScanSearch,
        title: 'Barcodes',
        value: data?.summary.barcodes ?? 0,
      },
    ],
    [data],
  )

  const onSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setQuery(queryInput.trim())
    setPage(1)
  }

  const onAddCatalogEntry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (adding) {
      return
    }

    setAdding(true)
    setAddStatus('Saving catalog entry...')
    const response = await fetch('/api/catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        manufacturerName: addDraft.manufacturerName,
        lineName: addDraft.lineName || null,
        colorwayName: addDraft.colorwayName || null,
        colorCode: addDraft.colorCode || null,
        hexReference: addDraft.hexReference || null,
        weightClass: addDraft.weightClass || null,
        fiberContent: addDraft.fiberContent || null,
        yardageMeters: addDraft.yardageMeters ? Number(addDraft.yardageMeters) : null,
        productUrl: addDraft.productUrl || null,
      }),
    })
    const payload = (await response.json()) as { message?: string }
    if (!response.ok) {
      setAddStatus(payload.message ?? 'Could not add catalog entry.')
      setAdding(false)
      return
    }

    setAddStatus(payload.message ?? 'Catalog entry saved.')
    setAddDraft({
      manufacturerName: '',
      lineName: '',
      colorwayName: '',
      colorCode: '',
      hexReference: '',
      weightClass: '',
      fiberContent: '',
      yardageMeters: '',
      productUrl: '',
    })
    setReloadToken((current) => current + 1)
    setAdding(false)
  }

  const pageStart = data ? (data.pagination.page - 1) * data.pagination.pageSize + (data.lines.length ? 1 : 0) : 0
  const pageEnd = data ? (data.pagination.page - 1) * data.pagination.pageSize + data.lines.length : 0

  return (
    <section className="page-stack">
      <form className="catalog-search" onSubmit={onSearch}>
        <label>
          Search lines, manufacturers, or fiber
          <input
            onChange={(event) => setQueryInput(event.target.value)}
            placeholder="ex: merino, premier, dk"
            type="text"
            value={queryInput}
          />
        </label>
        <button className="button button-primary" type="submit">
          <Search size={16} /> Search
        </button>
        <label>
          Weight class
          <select onChange={(event) => setWeightClassFilter(event.target.value)} value={weightClassFilter}>
            <option value="all">All weights</option>
            {(data?.filterOptions.weightClasses ?? []).map((weightClass) => (
              <option key={weightClass} value={weightClass}>
                {weightClass}
              </option>
            ))}
          </select>
        </label>
        <label>
          Has barcode
          <select
            onChange={(event) => setHasBarcodeFilter(event.target.value as 'any' | 'yes' | 'no')}
            value={hasBarcodeFilter}
          >
            <option value="any">Any</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
      </form>

      <article className="soft-panel">
        <div className="hero-actions" style={{ justifyContent: 'space-between' }}>
          <div>
            <strong>Can&apos;t find a brand or line?</strong>
            <p>Add a manufacturer, then optionally add a line and colorway in one step.</p>
          </div>
          <button className="button" onClick={() => setShowAddForm((current) => !current)} type="button">
            {showAddForm ? 'Close form' : 'Add to catalog'}
          </button>
        </div>
        {showAddForm ? (
          <form className="stack-form" onSubmit={onAddCatalogEntry}>
            <label>
              Manufacturer name *
              <input
                list="catalog-manufacturer-suggestions"
                onChange={(event) => setAddDraft((current) => ({ ...current, manufacturerName: event.target.value }))}
                placeholder="ex: Hobbii"
                required
                type="text"
                value={addDraft.manufacturerName}
              />
            </label>
            <datalist id="catalog-manufacturer-suggestions">
              {manufacturerSuggestions.map((manufacturer) => (
                <option key={manufacturer.id} value={manufacturer.name}>
                  {manufacturer.name}
                </option>
              ))}
            </datalist>
            {manufacturerSuggestions.length ? (
              <p>
                Suggestions: {manufacturerSuggestions.map((manufacturer) => `${manufacturer.name} (${manufacturer.yarnLineCount} lines)`).join(', ')}
              </p>
            ) : null}
            <label>
              Yarn line name
              <input
                onChange={(event) => setAddDraft((current) => ({ ...current, lineName: event.target.value }))}
                placeholder="ex: Rainbow Cotton 8/8"
                type="text"
                value={addDraft.lineName}
              />
            </label>
            <label>
              Colorway name
              <input
                onChange={(event) => setAddDraft((current) => ({ ...current, colorwayName: event.target.value }))}
                placeholder="ex: Dusty Rose"
                type="text"
                value={addDraft.colorwayName}
              />
            </label>
            <div className="inventory-row">
              <label>
                Color code
                <input
                  onChange={(event) => setAddDraft((current) => ({ ...current, colorCode: event.target.value }))}
                  placeholder="ex: 047"
                  type="text"
                  value={addDraft.colorCode}
                />
              </label>
              <label>
                Hex reference
                <input
                  onChange={(event) => setAddDraft((current) => ({ ...current, hexReference: event.target.value }))}
                  placeholder="ex: #b76d7f"
                  type="text"
                  value={addDraft.hexReference}
                />
              </label>
            </div>
            <div className="inventory-row">
              <label>
                Weight class
                <input
                  onChange={(event) => setAddDraft((current) => ({ ...current, weightClass: event.target.value }))}
                  placeholder="ex: DK"
                  type="text"
                  value={addDraft.weightClass}
                />
              </label>
              <label>
                Fiber content
                <input
                  onChange={(event) => setAddDraft((current) => ({ ...current, fiberContent: event.target.value }))}
                  placeholder="ex: 100% cotton"
                  type="text"
                  value={addDraft.fiberContent}
                />
              </label>
            </div>
            <div className="inventory-row">
              <label>
                Yardage (meters)
                <input
                  min={0}
                  onChange={(event) => setAddDraft((current) => ({ ...current, yardageMeters: event.target.value }))}
                  type="number"
                  value={addDraft.yardageMeters}
                />
              </label>
              <label>
                Product URL
                <input
                  onChange={(event) => setAddDraft((current) => ({ ...current, productUrl: event.target.value }))}
                  placeholder="https://..."
                  type="url"
                  value={addDraft.productUrl}
                />
              </label>
            </div>
            <div className="hero-actions">
              <button className="button button-primary" disabled={adding} type="submit">
                {adding ? 'Saving...' : 'Save catalog entry'}
              </button>
              {addStatus ? <span>{addStatus}</span> : null}
            </div>
          </form>
        ) : null}
      </article>

      <div className="catalog-stat-grid">
        {statCards.map((card) => (
          <article className="catalog-stat" key={card.title}>
            <card.icon size={18} />
            <strong>{card.value.toLocaleString()}</strong>
            <span>{card.title}</span>
          </article>
        ))}
      </div>

      <section className="catalog-list-shell" aria-label="Catalog lines">
        <div className="catalog-list-head">
          <span>Line</span>
          <span>Manufacturer</span>
          <span>Weight / Fiber</span>
          <span>Variants</span>
          <span>Product</span>
        </div>

        {loading ? <p>Loading catalog...</p> : null}
        {error ? <p>{error}</p> : null}

        {!loading && !error && data?.lines.length === 0 ? <p>No results found for this query.</p> : null}

        {!loading && !error && data ? (
          <div className="catalog-pagination">
            <span>
              Showing {pageStart.toLocaleString()}-{pageEnd.toLocaleString()} of {data.pagination.totalItems.toLocaleString()}
            </span>
            <div className="catalog-pagination-actions">
              <button
                className="button"
                disabled={!data.pagination.hasPreviousPage}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                type="button"
              >
                Previous
              </button>
              <span>
                Page {data.pagination.page} of {data.pagination.totalPages}
              </span>
              <button
                className="button"
                disabled={!data.pagination.hasNextPage}
                onClick={() => setPage((current) => current + 1)}
                type="button"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}

        {!loading && !error
          ? data?.lines.map((line) => (
              <article className="catalog-row" key={line.id}>
                <div>
                  <button
                    className="catalog-line-link"
                    onClick={() => navigate({ to: '/catalog/$lineId', params: { lineId: line.id } })}
                    type="button"
                  >
                    {line.name}
                  </button>
                  <button
                    className="catalog-detail-link"
                    onClick={() => navigate({ to: '/catalog/$lineId', params: { lineId: line.id } })}
                    type="button"
                  >
                    View details
                  </button>
                </div>
                <span>{line.manufacturerName}</span>
                <span>
                  {(line.weightClass ?? 'Unknown weight') + ' / ' + (line.fiberContent ?? 'Unknown fiber')}
                  {line.yardageMeters ? ` / ${line.yardageMeters}m` : ''}
                </span>
                <div>
                  <span>{line.colorwayCount} colors / {line.barcodeCount} barcodes</span>
                </div>
                <span>
                  {line.productUrl ? (
                    <a href={line.productUrl} rel="noreferrer" target="_blank">
                      <Link2 size={13} /> Product page
                    </a>
                  ) : (
                    'No link'
                  )}
                </span>
              </article>
            ))
          : null}
      </section>
    </section>
  )
}

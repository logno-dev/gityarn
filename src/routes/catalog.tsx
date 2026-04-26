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
  }, [query, weightClassFilter, hasBarcodeFilter, page])

  useEffect(() => {
    setPage(1)
  }, [query, weightClassFilter, hasBarcodeFilter])

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

  const pageStart = data ? (data.pagination.page - 1) * data.pagination.pageSize + (data.lines.length ? 1 : 0) : 0
  const pageEnd = data ? (data.pagination.page - 1) * data.pagination.pageSize + data.lines.length : 0

  return (
    <section className="page-stack">
      <header className="page-header">
        <h1>Yarn Catalog</h1>
        <p>Build an internal source of truth for manufacturers, yarn lines, colorways, and barcodes.</p>
      </header>

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

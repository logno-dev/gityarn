import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

type StartServerEntry = { fetch: (request: Request) => Promise<Response> }

async function getStartServerEntry(): Promise<StartServerEntry> {
  // @ts-expect-error Built at deploy time by `pnpm build`.
  const mod = await import('../dist/server/server.js')
  return mod.default as StartServerEntry
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const protocol = (req.headers['x-forwarded-proto'] as string | undefined) ?? 'https'
  const host = req.headers.host ?? 'localhost'
  const requestPath = req.url ?? '/'
  const url = `${protocol}://${host}${requestPath}`

  const staticHit = await tryServeStaticAsset(requestPath, res)
  if (staticHit) {
    return
  }

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'undefined') {
      continue
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item)
      }
      continue
    }
    headers.set(key, value)
  }

  const requestInit: RequestInit & { duplex?: 'half' } = {
    method: req.method,
    headers,
  }
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    requestInit.body = req as unknown as BodyInit
    requestInit.duplex = 'half'
  }

  const request = new Request(url, requestInit)
  const app = await getStartServerEntry()
  const response = await app.fetch(request)

  res.status(response.status)

  const setCookieValues = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.()
  if (setCookieValues?.length) {
    res.setHeader('set-cookie', setCookieValues)
  }
  response.headers.forEach((value: string, key: string) => {
    if (key.toLowerCase() === 'set-cookie') {
      return
    }
    res.setHeader(key, value)
  })

  const body = Buffer.from(await response.arrayBuffer())
  res.send(body)
}

async function tryServeStaticAsset(requestPath: string, res: VercelResponse) {
  const pathname = requestPath.split('?')[0] ?? '/'
  if (pathname === '/' || pathname.startsWith('/api/')) {
    return false
  }

  const normalized = pathname.replace(/^\/+/, '')
  const resolvedPath = path.resolve(process.cwd(), 'dist', 'client', normalized)
  const clientRoot = path.resolve(process.cwd(), 'dist', 'client')
  if (!resolvedPath.startsWith(clientRoot)) {
    return false
  }

  try {
    const fileBuffer = await readFile(resolvedPath)
    const contentType = detectContentType(resolvedPath)
    if (contentType) {
      res.setHeader('content-type', contentType)
    }
    if (normalized.startsWith('assets/')) {
      res.setHeader('cache-control', 'public, max-age=31536000, immutable')
    }
    res.status(200).send(fileBuffer)
    return true
  } catch {
    return false
  }
}

function detectContentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.css') return 'text/css; charset=utf-8'
  if (ext === '.js' || ext === '.mjs') return 'text/javascript; charset=utf-8'
  if (ext === '.json') return 'application/json; charset=utf-8'
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.svg') return 'image/svg+xml'
  if (ext === '.ico') return 'image/x-icon'
  if (ext === '.txt') return 'text/plain; charset=utf-8'
  return null
}

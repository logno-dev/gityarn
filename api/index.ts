import type { VercelRequest, VercelResponse } from '@vercel/node'

type StartServerEntry = { fetch: (request: Request) => Promise<Response> }

async function getStartServerEntry(): Promise<StartServerEntry> {
  // @ts-expect-error Built at deploy time by `pnpm build`.
  const mod = await import('../dist/server/server.js')
  return mod.default as StartServerEntry
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const protocol = (req.headers['x-forwarded-proto'] as string | undefined) ?? 'https'
  const host = req.headers.host ?? 'localhost'
  const url = `${protocol}://${host}${req.url ?? '/'}`

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

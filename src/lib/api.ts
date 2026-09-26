// ── Tiny typed fetch client for the app ──

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    cache: 'no-store',
  })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // no body
  }
  if (!res.ok) {
    const msg =
      (body as { error?: string } | null)?.error ||
      `Request failed (${res.status})`
    throw new ApiError(msg, res.status)
  }
  return body as T
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, data?: unknown) =>
    request<T>(url, { method: 'POST', body: JSON.stringify(data ?? {}) }),
  put: <T>(url: string, data?: unknown) =>
    request<T>(url, { method: 'PUT', body: JSON.stringify(data ?? {}) }),
  patch: <T>(url: string, data?: unknown) =>
    request<T>(url, { method: 'PATCH', body: JSON.stringify(data ?? {}) }),
  del: <T>(url: string) => request<T>(url, { method: 'DELETE' }),
}

export function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') u.set(k, String(v))
  }
  const s = u.toString()
  return s ? `?${s}` : ''
}

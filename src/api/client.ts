export class ApiError extends Error {
  status: number

  constructor(
    message: string,
    status: number,
  ) {
    super(message)
    this.status = status
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const runtimeHost = (globalThis as any).__APP_CONFIG__?.backend as string | undefined
  const host = runtimeHost ?? (import.meta.env.VITE_BACKEND_HOST as string | undefined) ?? ''
  const prefix = host ? host.replace(/\/$/, '') : ''
  const url = prefix ? `${prefix}/api${path}` : `/api${path}`
  // Debug: log resolved API url for troubleshooting runtime vs build-time host
  // eslint-disable-next-line no-console
  console.debug('API request', { method: options.method ?? 'GET', url })
  const response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
  // eslint-disable-next-line no-console
  console.debug('API response', { url, status: response.status })
  if (!response.ok) {
    let message = 'Ocurrió un error inesperado'
    try {
      const body = (await response.json()) as { message?: string | string[] }
      message = Array.isArray(body.message) ? body.message.join(', ') : body.message || message
    } catch {
      // Keep the friendly fallback for non-JSON errors.
    }
    throw new ApiError(message, response.status)
  }
  return response.json() as Promise<T>
}

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
  const response = await fetch(`/api${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
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

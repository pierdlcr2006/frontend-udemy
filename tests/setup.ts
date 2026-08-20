import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
})

class ObserverMock {
  observe() { return undefined }
  unobserve() { return undefined }
  disconnect() { return undefined }
}

Object.defineProperty(window, 'ResizeObserver', { writable: true, value: ObserverMock })
Object.defineProperty(window, 'IntersectionObserver', { writable: true, value: ObserverMock })

afterEach(cleanup)

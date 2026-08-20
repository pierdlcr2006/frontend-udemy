import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { PlaybackProvider } from './context/PlaybackContext'
import { ToastProvider } from './context/ToastContext'
import { UploadProvider } from './context/UploadContext'
import './index.css'
import './toast.css'
import './upload.css'
import './premium.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider><ToastProvider><UploadProvider><PlaybackProvider><App /></PlaybackProvider></UploadProvider></ToastProvider></AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)

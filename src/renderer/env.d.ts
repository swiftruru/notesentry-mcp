/// <reference types="vite/client" />
import type { NoteSentryApi } from '@shared/types'

declare global {
  interface Window {
    api: NoteSentryApi
  }
}

export {}

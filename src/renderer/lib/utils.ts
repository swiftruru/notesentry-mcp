import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** i18n t 函式的最小型別（綁定到 common namespace）。 */
type TFn = (key: string, opts?: Record<string, unknown>) => string

/** 相對時間（剛剛 / N 分鐘前 …），文字由 i18n 提供（common:time.*）。 */
export function formatRelative(ts: number, t: TFn): string {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return t('time.justNow')
  if (min < 60) return t('time.minutesAgo', { count: min })
  const hr = Math.floor(min / 60)
  if (hr < 24) return t('time.hoursAgo', { count: hr })
  const day = Math.floor(hr / 24)
  if (day < 7) return t('time.daysAgo', { count: day })
  const d = new Date(ts)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

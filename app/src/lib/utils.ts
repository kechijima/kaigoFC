export const uid = (prefix = '') =>
  prefix + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4)

// デモの「今日」。実日付を使う
export const today = () => toDate(new Date())

export const toDate = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const addDays = (date: string, days: number) => {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return toDate(d)
}

export const diffDays = (a: string, b: string) =>
  Math.round((new Date(a + 'T00:00:00').getTime() - new Date(b + 'T00:00:00').getTime()) / 86400000)

export const nowIso = () => new Date().toISOString()

export const fmtDate = (s?: string) => (s ? s.slice(0, 10).replaceAll('-', '/') : '-')
export const fmtDateTime = (s?: string) => {
  if (!s) return '-'
  const d = new Date(s)
  return `${toDate(d).replaceAll('-', '/')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const yen = (n: number) => '¥' + Math.round(n).toLocaleString('ja-JP')

export async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function downloadText(filename: string, text: string, mime = 'text/csv') {
  const blob = new Blob(['﻿' + text], { type: `${mime};charset=utf-8` })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

// 全コレクションを購読して画面に配る。現在のログインユーザー（ロール切替）もここで持つ。
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { db, isLocalEmpty } from './db'
import { COLLECTIONS, type Collections, type CollectionName, type User } from './types'
import { buildSeed } from './seed'
import { migratePartnerData } from './partnerActions'

type Data = { [K in CollectionName]: Collections[K][] }
const empty = Object.fromEntries(COLLECTIONS.map((c) => [c, []])) as unknown as Data

interface Ctx {
  data: Data
  loaded: boolean
  me: User | undefined
  setMeId: (id: string) => void
  toast: (msg: string) => void
}

const DataContext = createContext<Ctx>(null as unknown as Ctx)
const ME_KEY = 'kaigoFC-me'

export async function resetSeed() {
  await db.replaceAll(await buildSeed())
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>(empty)
  const [loadedCols, setLoadedCols] = useState<Set<string>>(new Set())
  const [meId, setMeIdState] = useState<string>(() => {
    try { return sessionStorage.getItem(ME_KEY) ?? 'u_yamada' } catch { return 'u_yamada' }
  })
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let seeding = false
    if (isLocalEmpty()) { seeding = true; resetSeed() } // 初回は自動でダミーデータを投入
    const unsubs = COLLECTIONS.map((col) =>
      db.subscribe(col, (docs) => {
        // Firestore が空の場合も初回だけダミーデータを投入
        if (col === 'users' && docs.length === 0 && !seeding && db.mode !== 'local') {
          seeding = true
          resetSeed().catch((e) => setError(String(e)))
        }
        setData((d) => ({ ...d, [col]: docs }))
        setLoadedCols((s) => (s.has(col) ? s : new Set(s).add(col)))
      }, (e) => setError(e.message)),
    )
    return () => unsubs.forEach((u) => u())
  }, [])

  // 提携先機能の追加前に作られたデータには、協会関連のダミーデータを一度だけ追加する
  const loaded = loadedCols.size === COLLECTIONS.length
  const migrated = useRef(false)
  useEffect(() => {
    if (!loaded || migrated.current || !data.users.length || data.products.length) return
    migrated.current = true
    migratePartnerData(data).catch((e) => setError(String(e)))
  }, [loaded, data])

  if (error) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <div className="card border-rose-300">
          <h1 className="mb-2 font-bold text-rose-700">データベースに接続できません</h1>
          <p className="text-sm text-slate-600">Firestore の作成・ルール設定が完了しているか確認してください。</p>
          <pre className="mt-3 whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs text-slate-500">{error}</pre>
        </div>
      </div>
    )
  }

  const setMeId = (id: string) => {
    setMeIdState(id)
    try { sessionStorage.setItem(ME_KEY, id) } catch { /* ignore */ }
  }
  const toast = (msg: string) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, msg }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000)
  }

  const me = data.users.find((u) => u.id === meId)
  return (
    <DataContext.Provider value={{ data, loaded, me, setMeId, toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="max-w-sm whitespace-pre-wrap rounded-md bg-slate-800 px-4 py-3 text-sm text-white shadow-lg">{t.msg}</div>
        ))}
      </div>
    </DataContext.Provider>
  )
}

export const useData = () => useContext(DataContext)

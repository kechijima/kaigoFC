// データ層: Firebase(Firestore) 設定があれば Firestore、無ければ localStorage を使う。
// どちらも同じインターフェースで、画面側はどちらで動いているかを意識しない。
import { initializeApp } from 'firebase/app'
import {
  initializeFirestore, connectFirestoreEmulator, collection, doc, onSnapshot,
  setDoc, updateDoc, deleteDoc, writeBatch, getDocs, deleteField, type Firestore,
} from 'firebase/firestore'
import { COLLECTIONS, type CollectionName, type Collections } from './types'

type Listener = (docs: unknown[]) => void

export interface DataStore {
  mode: 'firestore' | 'emulator' | 'local'
  subscribe<K extends CollectionName>(col: K, cb: (docs: Collections[K][]) => void, onError?: (e: Error) => void): () => void
  set<K extends CollectionName>(col: K, id: string, data: Collections[K]): Promise<void>
  update<K extends CollectionName>(col: K, id: string, data: Partial<Collections[K]>): Promise<void>
  remove(col: CollectionName, id: string): Promise<void>
  replaceAll(data: { [K in CollectionName]?: Collections[K][] }): Promise<void>
}

// ---------- Firestore ----------
function createFirestoreStore(): DataStore | null {
  const env = import.meta.env
  if (!env.VITE_FIREBASE_PROJECT_ID) return null
  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  })
  const fs: Firestore = initializeFirestore(app, { ignoreUndefinedProperties: true })
  const useEmulator = env.VITE_USE_FIREBASE_EMULATOR === 'true'
  if (useEmulator) connectFirestoreEmulator(fs, '127.0.0.1', 8080)

  return {
    mode: useEmulator ? 'emulator' : 'firestore',
    subscribe(col, cb, onError) {
      return onSnapshot(collection(fs, col), (snap) => {
        cb(snap.docs.map((d) => ({ ...d.data(), id: d.id })) as never)
      }, (e) => onError?.(e))
    },
    async set(col, id, data) { await setDoc(doc(fs, col, id), data as object) },
    async update(col, id, data) {
      // undefined を渡した項目はフィールド削除として扱う（localStorage 版と挙動を合わせる）
      const patch = Object.fromEntries(Object.entries(data as object).map(([k, v]) => [k, v === undefined ? deleteField() : v]))
      await updateDoc(doc(fs, col, id), patch)
    },
    async remove(col, id) { await deleteDoc(doc(fs, col, id)) },
    async replaceAll(data) {
      // 既存データを削除してから投入（450件ずつバッチ）
      const ops: Array<(b: ReturnType<typeof writeBatch>) => void> = []
      for (const col of COLLECTIONS) {
        const snap = await getDocs(collection(fs, col))
        snap.docs.forEach((d) => ops.push((b) => b.delete(d.ref)))
      }
      for (const col of COLLECTIONS) {
        for (const item of (data[col] ?? []) as Array<{ id: string }>) {
          ops.push((b) => b.set(doc(fs, col, item.id), item))
        }
      }
      for (let i = 0; i < ops.length; i += 450) {
        const b = writeBatch(fs)
        ops.slice(i, i + 450).forEach((op) => op(b))
        await b.commit()
      }
    },
  }
}

// ---------- localStorage ----------
const LS_KEY = 'kaigoFC-mock-db-v1'

function createLocalStore(): DataStore {
  let state: Record<string, Record<string, unknown>> = {}
  try { state = JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') } catch { state = {} }
  const listeners: Record<string, Set<Listener>> = {}

  const persist = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(state)) } catch { /* 容量超過等は無視 */ } }
  const emit = (col: string) => {
    const docs = Object.values(state[col] ?? {})
    listeners[col]?.forEach((l) => l(docs))
  }
  const change = (col: string) => { persist(); setTimeout(() => emit(col), 0) }

  // 別タブでの変更も反映（本部タブと加盟店タブを並べてデモできる）
  window.addEventListener('storage', (e) => {
    if (e.key !== LS_KEY || !e.newValue) return
    state = JSON.parse(e.newValue)
    COLLECTIONS.forEach(emit)
  })

  return {
    mode: 'local',
    subscribe(col, cb) {
      const l = cb as Listener
      ;(listeners[col] ??= new Set()).add(l)
      setTimeout(() => l(Object.values(state[col] ?? {})), 0)
      return () => listeners[col].delete(l)
    },
    async set(col, id, data) { (state[col] ??= {})[id] = structuredClone(data); change(col) },
    async update(col, id, data) {
      const cur = (state[col] ?? {})[id] as object | undefined
      if (!cur) throw new Error(`${col}/${id} が存在しません`)
      state[col][id] = { ...cur, ...structuredClone(data) }
      change(col)
    },
    async remove(col, id) { delete (state[col] ?? {})[id]; change(col) },
    async replaceAll(data) {
      state = {}
      for (const col of COLLECTIONS) {
        state[col] = {}
        for (const item of (data[col] ?? []) as Array<{ id: string }>) state[col][item.id] = item
      }
      persist()
      COLLECTIONS.forEach(emit)
    },
  }
}

export const db: DataStore = createFirestoreStore() ?? createLocalStore()

export const isLocalEmpty = () => {
  if (db.mode !== 'local') return false
  try { return !localStorage.getItem(LS_KEY) } catch { return true }
}

import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useData } from '../lib/store'
import { db } from '../lib/db'
import { HQ_ROLE_LABEL } from '../lib/workflow'
import type { User } from '../lib/types'

interface NavItem { to: string; label: string; icon: string; end?: boolean; openedOnly?: boolean; managerOnly?: boolean }

const NAV: Record<User['kind'], NavItem[]> = {
  hq: [
    { to: '/hq', label: 'ダッシュボード', icon: '📊', end: true },
    { to: '/hq/tasks', label: 'マイタスク', icon: '✅' },
    { to: '/hq/deals', label: 'FC進捗', icon: '🗂️' },
    { to: '/hq/contracts', label: '電子契約', icon: '✍️' },
    { to: '/hq/invoices', label: '請求・入金', icon: '💴' },
    { to: '/hq/stores', label: '店舗・月次実績', icon: '🏠' },
    { to: '/hq/analyses', label: 'AI分析', icon: '🦶' },
    { to: '/hq/orders', label: '備品発注', icon: '📦' },
    { to: '/hq/videos', label: '教育動画', icon: '🎬' },
    { to: '/hq/distribution', label: '分配精算', icon: '🤝' },
    { to: '/hq/notices', label: 'お知らせ', icon: '📢' },
    { to: '/hq/settings', label: '設定・データ', icon: '⚙️' },
  ],
  fc: [
    { to: '/fc', label: 'ホーム', icon: '🏠', end: true },
    { to: '/fc/workflow', label: '開業までの手続き', icon: '🗂️' },
    { to: '/fc/contracts', label: '契約書', icon: '✍️' },
    { to: '/fc/invoices', label: '請求・お支払い', icon: '💴' },
    { to: '/fc/report', label: '月次実績報告', icon: '📈', openedOnly: true },
    { to: '/fc/analyses', label: 'AI分析レポート', icon: '🦶', openedOnly: true },
    { to: '/fc/orders', label: '備品発注', icon: '📦', openedOnly: true },
    { to: '/fc/videos', label: '教育動画', icon: '🎬', openedOnly: true },
    { to: '/fc/notices', label: 'お知らせ', icon: '📢' },
  ],
  field: [
    { to: '/field', label: '今日の訪問', icon: '🚶', end: true },
    { to: '/field/schedule', label: 'スケジュール', icon: '📅' },
    { to: '/field/analyses', label: '歩行分析', icon: '🦶' },
    { to: '/field/videos', label: '研修動画', icon: '🎬' },
    { to: '/field/clients', label: '利用者', icon: '👥' },
    { to: '/field/orders', label: '備品発注', icon: '📦', managerOnly: true },
    { to: '/field/summary', label: '実績', icon: '📈' },
  ],
  partner: [
    { to: '/partner', label: 'ダッシュボード', icon: '📊', end: true },
    { to: '/partner/analyses', label: 'AI分析レポート', icon: '🦶' },
    { to: '/partner/orders', label: 'インソール受注', icon: '📦' },
    { to: '/partner/videos', label: '教育動画', icon: '🎬' },
    { to: '/partner/distribution', label: '分配明細', icon: '🤝' },
  ],
}

export const homeOf = (u: User) => ({ hq: '/hq', fc: '/fc', field: '/field', partner: '/partner' })[u.kind]
const KIND_LABEL = { hq: '① 本部管理画面', fc: '② 加盟店管理画面', field: '③ 業務システム', partner: '④ 協会（提携先）画面' }
const KIND_COLOR = { hq: 'bg-slate-800', fc: 'bg-orange-700', field: 'bg-teal-700', partner: 'bg-indigo-800' }
const FIELD_ROLE = { manager: '管理者', sp: 'サ責', helper: 'ヘルパー' }

export function Layout() {
  const { data, me, setMeId } = useData()
  const nav = useNavigate()
  const loc = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => setMenuOpen(false), [loc.pathname])
  if (!me) return <div className="p-8 text-slate-500">読み込み中…</div>
  const deal = me.dealId ? data.deals.find((d) => d.id === me.dealId) : undefined
  const items = NAV[me.kind]
    .filter((i) => !i.openedOnly || deal?.status === 'opened')
    .filter((i) => !i.managerOnly || me.fieldRole !== 'helper')
  const isField = me.kind === 'field'
  const bottomItems = items.slice(0, 5) // スマホ下部タブに出す項目。残りは ☰ メニュー
  const menuItems = isField ? items.slice(5) : items

  const switchTo = (id: string) => {
    const u = data.users.find((x) => x.id === id)
    if (!u) return
    setMeId(id)
    setMenuOpen(false)
    nav(homeOf(u))
  }
  const fcUsers = data.users.filter((u) => u.kind === 'fc').sort((a, b) => (a.dealId ?? '').localeCompare(b.dealId ?? ''))
  const fieldUsers = data.users.filter((u) => u.kind === 'field').sort((a, b) => a.id.localeCompare(b.id))
  const dealLabel = (u: User) => {
    const d = data.deals.find((x) => x.id === u.dealId)
    if (!d) return u.name
    const st = d.status === 'opened' ? '運営中' : d.status === 'withdrawn' ? '辞退' : `P${d.phase}`
    return `${u.name}（${d.companyName || '個人'}・${st}）`
  }
  const meLabel = me.kind === 'hq' ? HQ_ROLE_LABEL[me.hqRole!] : me.kind === 'field' ? FIELD_ROLE[me.fieldRole!] : me.kind === 'partner' ? '協会' : '加盟者'

  const userSelect = (
    <select aria-label="ログインユーザー切替" className="w-full rounded bg-white px-2 py-1.5 text-base text-slate-800 md:max-w-[340px] md:py-1 md:text-sm" value={me.id} onChange={(e) => switchTo(e.target.value)}>
      <optgroup label="① 本部">
        {data.users.filter((u) => u.kind === 'hq').map((u) => <option key={u.id} value={u.id}>{u.name}（{HQ_ROLE_LABEL[u.hqRole!]}）</option>)}
      </optgroup>
      <optgroup label="② 加盟希望者・オーナー">
        {fcUsers.map((u) => <option key={u.id} value={u.id}>{dealLabel(u)}</option>)}
      </optgroup>
      <optgroup label="③ 店舗スタッフ">
        {fieldUsers.map((u) => <option key={u.id} value={u.id}>{data.stores.find((s) => s.id === u.storeId)?.name} {u.name}（{FIELD_ROLE[u.fieldRole!]}）</option>)}
      </optgroup>
      <optgroup label="④ 転倒予防防止協会">
        {data.users.filter((u) => u.kind === 'partner').map((u) => <option key={u.id} value={u.id}>{u.name}（協会）</option>)}
      </optgroup>
    </select>
  )

  return (
    <div className="min-h-screen">
      <header className={`${KIND_COLOR[me.kind]} sticky top-0 z-30 text-white md:static`}>
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2 md:px-4">
          <div className="min-w-0 font-bold">
            サクラFC <span className="ml-1 text-xs font-normal opacity-80">{KIND_LABEL[me.kind]}</span>
          </div>
          <span className="badge hidden bg-white/15 text-white lg:inline-block">DB: {db.mode === 'local' ? 'ローカル（ブラウザ）' : db.mode === 'emulator' ? 'Firestore エミュレータ' : 'Firestore'}</span>
          <div className="ml-auto hidden items-center gap-2 text-sm md:flex">
            <span className="opacity-80">ログイン中:</span>
            {userSelect}
          </div>
          {/* スマホ: ユーザー名とメニューボタン */}
          <button className="ml-auto flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-white/10 md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label="メニュー">
            <span className="max-w-[9rem] truncate">{me.name}<span className="ml-1 text-xs opacity-75">{meLabel}</span></span>
            <span className="text-xl leading-none">{menuOpen ? '✕' : '☰'}</span>
          </button>
        </div>
        {/* タブレット以上: タブ */}
        <nav className="mx-auto hidden max-w-7xl gap-1 overflow-x-auto px-4 md:flex">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => `whitespace-nowrap rounded-t-md px-3 py-2 text-sm ${isActive ? 'bg-slate-50 font-semibold text-slate-800' : 'text-white/85 hover:bg-white/10'}`}>
              {i.label}
            </NavLink>
          ))}
        </nav>
        {/* スマホ: メニュー */}
        {menuOpen && (
          <div className="border-t border-white/15 px-3 pb-3 md:hidden">
            {menuItems.length > 0 && (
              <nav className="grid grid-cols-2 gap-1 py-2">
                {menuItems.map((i) => (
                  <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => `flex items-center gap-2 rounded-md px-3 py-2.5 text-sm ${isActive ? 'bg-white font-semibold text-slate-800' : 'bg-white/10'}`}>
                    <span>{i.icon}</span>{i.label}
                  </NavLink>
                ))}
              </nav>
            )}
            <div className="pt-2 text-xs opacity-80">ログインユーザーの切り替え（デモ用）</div>
            <div className="mt-1">{userSelect}</div>
            <div className="mt-2 text-[11px] opacity-70">DB: {db.mode === 'local' ? 'ローカル' : 'Firestore'}</div>
          </div>
        )}
      </header>

      <main className={`mx-auto max-w-7xl px-3 py-4 md:px-4 md:py-6 ${isField ? 'pb-24 md:pb-6' : ''}`}>
        <Outlet />
      </main>

      {/* 店舗スタッフ: スマホは下部タブバー */}
      {isField && (
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
          {bottomItems.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[11px] ${isActive ? 'font-semibold text-teal-700' : 'text-slate-500'}`}>
              <span className="text-xl leading-none">{i.icon}</span>{i.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}

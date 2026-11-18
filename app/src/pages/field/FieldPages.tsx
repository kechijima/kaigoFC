// ③ 加盟店業務システム（訪問介護）: 画面イメージ＋最低限の動き
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useData } from '../../lib/store'
import { addVisit, saveVisitRecord } from '../../lib/actions'
import { Empty, Field, Modal, PageTitle, Stat } from '../../components/ui'
import { addDays, fmtDate, today, yen } from '../../lib/utils'
import { revenueOf } from '../../lib/billing'
import type { ServiceType, Visit, VisitRecord } from '../../lib/types'

const SERVICE_COLOR: Record<ServiceType, string> = { 身体介護: 'bg-rose-100 text-rose-700', 生活援助: 'bg-sky-100 text-sky-700', '身体・生活': 'bg-violet-100 text-violet-700' }
const VISIT_STATUS = { scheduled: ['予定', 'bg-slate-100 text-slate-600'], in_progress: ['訪問中', 'bg-amber-100 text-amber-800'], done: ['記録済', 'bg-emerald-100 text-emerald-700'], cancelled: ['キャンセル', 'bg-slate-100 text-slate-400'] } as const
const WEEK = ['日', '月', '火', '水', '木', '金', '土']
const dow = (d: string) => WEEK[new Date(d + 'T00:00:00').getDay()]

function useStore() {
  const { data, me } = useData()
  const store = data.stores.find((s) => s.id === me?.storeId)
  const helper = data.helpers.find((h) => h.userId === me?.id)
  return { store, helper, isManager: me?.fieldRole !== 'helper' }
}

export function FieldToday() {
  const { data } = useData()
  const { store, helper, isManager } = useStore()
  const [date, setDate] = useState(today())
  const [mineOnly, setMineOnly] = useState(!isManager)
  if (!store) return <Empty>店舗情報がありません</Empty>
  const visits = data.visits.filter((v) => v.storeId === store.id && v.date === date && (!mineOnly || v.helperId === helper?.id)).sort((a, b) => a.start.localeCompare(b.start))
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <PageTitle sub={store.name}>訪問予定</PageTitle>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-secondary px-4 py-2" aria-label="前日" onClick={() => setDate(addDays(date, -1))}>←</button>
        <input type="date" className="input w-auto flex-1 sm:w-40 sm:flex-none" value={date} onChange={(e) => setDate(e.target.value)} />
        <span className="text-sm">（{dow(date)}）</span>
        <button className="btn-secondary px-4 py-2" aria-label="翌日" onClick={() => setDate(addDays(date, 1))}>→</button>
        {date !== today() && <button className="btn-secondary py-2" onClick={() => setDate(today())}>今日</button>}
        <label className="flex w-full items-center gap-2 py-1 text-sm sm:ml-auto sm:w-auto"><input type="checkbox" className="h-5 w-5" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />自分の担当のみ</label>
      </div>
      <div className="text-xs text-slate-500">{visits.length}件（完了 {visits.filter((v) => v.status === 'done').length}）</div>
      {visits.map((v) => <VisitCard key={v.id} v={v} />)}
      {!visits.length && <Empty>訪問予定はありません</Empty>}
    </div>
  )
}

function VisitCard({ v }: { v: Visit }) {
  const { data } = useData()
  const client = data.clients.find((c) => c.id === v.clientId)
  const helper = data.helpers.find((h) => h.id === v.helperId)
  const st = VISIT_STATUS[v.status]
  return (
    <Link to={`/field/visits/${v.id}`} className="card flex items-center gap-3 p-3 hover:border-teal-400 active:bg-slate-50 sm:p-4">
      <div className="w-14 shrink-0 text-center sm:w-20"><div className="text-lg font-bold">{v.start}</div><div className="text-xs text-slate-400">〜{v.end}</div></div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{client?.name} 様 <span className="text-xs font-normal text-slate-500">{client?.careLevel}</span></div>
        <div className="truncate text-xs text-slate-500">{client?.address}</div>
        <div className="text-xs text-slate-500">担当 {helper?.name}</div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
        <span className={`badge ${SERVICE_COLOR[v.service]}`}>{v.service}</span>
        <span className={`badge ${st[1]}`}>{st[0]}</span>
      </div>
      <span className="text-slate-300">›</span>
    </Link>
  )
}

const CARE_ITEMS = ['排泄介助', '食事介助', '入浴介助', '清拭', '更衣介助', '移乗・移動介助', '服薬確認', '掃除', '洗濯', '調理', '買い物', '見守り']

export function FieldVisit() {
  const { id } = useParams()
  const { data, me, toast } = useData()
  const nav = useNavigate()
  const v = data.visits.find((x) => x.id === id)
  const [rec, setRec] = useState<VisitRecord>(() => v?.record ?? { items: [] })
  if (!v || !me) return <Empty>訪問が見つかりません</Empty>
  const client = data.clients.find((c) => c.id === v.clientId)
  const helper = data.helpers.find((h) => h.id === v.helperId)
  const now = () => new Date().toTimeString().slice(0, 5)
  const toggle = (it: string) => setRec({ ...rec, items: rec.items.includes(it) ? rec.items.filter((x) => x !== it) : [...rec.items, it] })
  const save = async (status: Visit['status'], r = rec) => { await saveVisitRecord(v, r, status, me); toast(status === 'done' ? '記録を保存しました' : '保存しました') }

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <button className="text-sm text-teal-700" onClick={() => nav(-1)}>← 戻る</button>
      <div className="card">
        <div className="text-xs text-slate-500">{fmtDate(v.date)}（{dow(v.date)}） {v.start}〜{v.end}・担当 {helper?.name}</div>
        <h1 className="text-xl font-bold">{client?.name} 様</h1>
        <div className="text-sm text-slate-600">{client?.careLevel}・{client?.address}</div>
        <div className="text-xs text-slate-500">ケアマネ: {client?.careManager}</div>
        <span className={`badge mt-2 ${SERVICE_COLOR[v.service]}`}>{v.service}</span>
      </div>
      {v.status === 'cancelled' ? <div className="card text-sm text-slate-500">この訪問はキャンセルされました。</div> : (
        <div className="card space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-primary justify-center py-3" disabled={!!rec.checkIn} onClick={() => { const r = { ...rec, checkIn: now() }; setRec(r); save('in_progress', r) }}>{rec.checkIn ? `開始 ${rec.checkIn}` : 'サービス開始'}</button>
            <button className="btn-primary justify-center py-3" disabled={!rec.checkIn || !!rec.checkOut} onClick={() => setRec({ ...rec, checkOut: now() })}>{rec.checkOut ? `終了 ${rec.checkOut}` : 'サービス終了'}</button>
          </div>
          <div>
            <div className="mb-1 text-sm font-semibold">実施内容</div>
            <div className="flex flex-wrap gap-2">{CARE_ITEMS.map((it) => (
              <button key={it} onClick={() => toggle(it)} className={`rounded-full border px-3.5 py-2 text-sm ${rec.items.includes(it) ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300 bg-white'}`}>{it}</button>
            ))}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="体温"><input className="input" inputMode="decimal" value={rec.temperature ?? ''} onChange={(e) => setRec({ ...rec, temperature: e.target.value })} /></Field>
            <Field label="血圧"><input className="input" placeholder="120/80" value={rec.bloodPressure ?? ''} onChange={(e) => setRec({ ...rec, bloodPressure: e.target.value })} /></Field>
          </div>
          <Field label="特記事項・申し送り"><textarea className="input" rows={3} value={rec.note ?? ''} onChange={(e) => setRec({ ...rec, note: e.target.value })} /></Field>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button className="btn-primary justify-center py-3 sm:py-1.5" disabled={!rec.checkIn || !rec.checkOut || !rec.items.length} onClick={() => save('done')}>記録を確定</button>
            {v.status === 'scheduled' && <button className="btn-danger justify-center py-3 sm:py-1.5" onClick={() => save('cancelled')}>キャンセルにする</button>}
          </div>
        </div>
      )}
    </div>
  )
}

export function FieldSchedule() {
  const { data } = useData()
  const { store, isManager } = useStore()
  const [start, setStart] = useState(() => { const t = today(); const d = new Date(t + 'T00:00:00').getDay(); return addDays(t, d === 0 ? -6 : 1 - d) })
  const [adding, setAdding] = useState<string | null>(null)
  const [day, setDay] = useState(today())
  if (!store) return null
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const helpers = data.helpers.filter((h) => h.storeId === store.id)
  const moveWeek = (n: number) => { setStart(addDays(start, n)); setDay(addDays(day, n)) }
  return (
    <div className="space-y-3">
      <PageTitle sub="ヘルパー別のスケジュール" actions={<>
        <button className="btn-secondary py-2" onClick={() => moveWeek(-7)}>← 前週</button>
        <button className="btn-secondary py-2" onClick={() => moveWeek(7)}>翌週 →</button>
      </>}>訪問スケジュール</PageTitle>

      {/* スマホ: 曜日を選んでヘルパー別に一覧 */}
      <div className="md:hidden">
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => (
            <button key={d} onClick={() => setDay(d)} className={`rounded-md py-1.5 text-center text-xs ${d === day ? 'bg-teal-600 text-white' : d === today() ? 'bg-teal-50 text-teal-700' : 'bg-white text-slate-600'}`}>
              <div>{dow(d)}</div><div className="text-sm font-semibold">{Number(d.slice(8))}</div>
            </button>
          ))}
        </div>
        <div className="mt-3 space-y-3">
          {helpers.map((h) => {
            const list = data.visits.filter((v) => v.helperId === h.id && v.date === day).sort((a, b) => a.start.localeCompare(b.start))
            return (
              <div key={h.id} className="card p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div><span className="font-medium">{h.name}</span> <span className="text-[11px] text-slate-400">{h.employment}</span></div>
                  {isManager && <button className="btn-secondary py-1.5" onClick={() => setAdding(`${h.id}|${day}`)}>＋ 追加</button>}
                </div>
                <div className="space-y-1">
                  {list.map((v) => (
                    <Link key={v.id} to={`/field/visits/${v.id}`} className={`flex items-center gap-2 rounded px-2 py-2 text-sm ${v.status === 'cancelled' ? 'bg-slate-100 text-slate-400 line-through' : SERVICE_COLOR[v.service]}`}>
                      <span className="font-semibold">{v.start}〜{v.end}</span>
                      <span className="flex-1 truncate">{data.clients.find((c) => c.id === v.clientId)?.name} 様</span>
                      <span className="text-xs">{VISIT_STATUS[v.status][0]}</span>
                    </Link>
                  ))}
                  {!list.length && <div className="text-xs text-slate-400">予定なし</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* タブレット以上: 週間表 */}
      <div className="card hidden overflow-x-auto p-0 md:block">
        <table className="w-full min-w-[720px] table-fixed">
          <thead className="bg-slate-50"><tr><th className="th w-32">ヘルパー</th>{days.map((d) => <th key={d} className={`th ${d === today() ? 'bg-teal-50 text-teal-700' : ''}`}>{d.slice(5).replace('-', '/')}（{dow(d)}）</th>)}</tr></thead>
          <tbody>{helpers.map((h) => (
            <tr key={h.id}>
              <td className="td align-top"><div className="font-medium">{h.name}</div><div className="text-[11px] text-slate-400">{h.qualification}・{h.employment}</div></td>
              {days.map((d) => (
                <td key={d} className="td space-y-1 align-top">
                  {data.visits.filter((v) => v.helperId === h.id && v.date === d).sort((a, b) => a.start.localeCompare(b.start)).map((v) => (
                    <Link key={v.id} to={`/field/visits/${v.id}`} className={`block rounded px-1.5 py-1 text-[11px] ${v.status === 'cancelled' ? 'bg-slate-100 text-slate-400 line-through' : SERVICE_COLOR[v.service]}`}>
                      {v.start} {data.clients.find((c) => c.id === v.clientId)?.name.split(' ')[0]}
                    </Link>
                  ))}
                  {isManager && <button className="w-full rounded text-[11px] text-slate-300 hover:bg-slate-50 hover:text-teal-600" onClick={() => setAdding(`${h.id}|${d}`)}>＋</button>}
                </td>
              ))}
            </tr>
          ))}</tbody>
        </table>
      </div>
      {adding && <AddVisitModal storeId={store.id} helperId={adding.split('|')[0]} date={adding.split('|')[1]} onClose={() => setAdding(null)} />}
    </div>
  )
}

function AddVisitModal({ storeId, helperId, date, onClose }: { storeId: string; helperId: string; date: string; onClose: () => void }) {
  const { data, toast } = useData()
  const clients = data.clients.filter((c) => c.storeId === storeId)
  const [f, setF] = useState({ clientId: clients[0]?.id ?? '', start: '10:00', end: '11:00', service: '身体介護' as ServiceType })
  return (
    <Modal title={`訪問予定の追加（${fmtDate(date)}・${data.helpers.find((h) => h.id === helperId)?.name}）`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Field label="利用者"><select className="input" value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value })}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}（{c.careLevel}）</option>)}</select></Field></div>
        <Field label="開始"><input className="input" type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
        <Field label="終了"><input className="input" type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>
        <Field label="サービス"><select className="input" value={f.service} onChange={(e) => setF({ ...f, service: e.target.value as ServiceType })}>{(['身体介護', '生活援助', '身体・生活'] as const).map((s) => <option key={s}>{s}</option>)}</select></Field>
      </div>
      <div className="mt-4 flex justify-end"><button className="btn-primary" onClick={async () => { await addVisit({ storeId, helperId, date, ...f, status: 'scheduled' }); toast('訪問予定を追加しました'); onClose() }}>追加</button></div>
    </Modal>
  )
}

export function FieldClients() {
  const { data } = useData()
  const { store } = useStore()
  if (!store) return null
  const clients = data.clients.filter((c) => c.storeId === store.id)
  return (
    <div className="space-y-3">
      <PageTitle sub={`${clients.length}名`}>利用者一覧</PageTitle>
      {/* スマホ: カード表示 */}
      <div className="space-y-2 md:hidden">
        {clients.map((c) => (
          <div key={c.id} className="card p-3">
            <div className="flex items-center justify-between"><span className="font-medium">{c.name} 様</span><span className="badge bg-slate-100 text-slate-600">{c.careLevel}</span></div>
            <div className="mt-1 text-xs text-slate-500">{c.address}</div>
            <div className="text-xs text-slate-500">{c.careManager}</div>
            <div className="mt-1 text-xs">今月の訪問 {data.visits.filter((v) => v.clientId === c.id && v.date.startsWith(today().slice(0, 7)) && v.status !== 'cancelled').length}件</div>
          </div>
        ))}
      </div>
      <div className="card hidden overflow-x-auto p-0 md:block">
        <table className="w-full">
          <thead className="bg-slate-50"><tr><th className="th">氏名</th><th className="th">要介護度</th><th className="th">住所</th><th className="th">担当ケアマネ</th><th className="th text-right">今月の訪問</th></tr></thead>
          <tbody>{clients.map((c) => (
            <tr key={c.id}><td className="td font-medium">{c.name} 様</td><td className="td">{c.careLevel}</td><td className="td">{c.address}</td><td className="td text-xs">{c.careManager}</td>
              <td className="td text-right">{data.visits.filter((v) => v.clientId === c.id && v.date.startsWith(today().slice(0, 7)) && v.status !== 'cancelled').length}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}

export function FieldSummary() {
  const { data } = useData()
  const { store } = useStore()
  if (!store) return null
  const month = today().slice(0, 7)
  const vs = data.visits.filter((v) => v.storeId === store.id && v.date.startsWith(month))
  const done = vs.filter((v) => v.status === 'done')
  const byHelper = data.helpers.filter((h) => h.storeId === store.id).map((h) => ({ h, n: done.filter((v) => v.helperId === h.id).length }))
  return (
    <div className="space-y-3">
      <PageTitle sub={`${month} の提供実績（本部への報告は加盟店管理画面の「月次実績報告」から）`}>実績</PageTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="訪問 完了" value={done.length} tone="teal" />
        <Stat label="訪問 予定" value={vs.filter((v) => v.status === 'scheduled').length} />
        <Stat label="キャンセル" value={vs.filter((v) => v.status === 'cancelled').length} />
        <Stat label="売上（概算）" value={yen(done.reduce((s, v) => s + revenueOf(v), 0))} />
      </div>
      <div className="card"><h2 className="mb-2 font-semibold">ヘルパー別 訪問件数</h2>
        {byHelper.map(({ h, n }) => (
          <div key={h.id} className="flex items-center gap-2 py-1 text-sm"><span className="w-28">{h.name}</span><div className="h-3 rounded bg-teal-500" style={{ width: `${n * 8}px` }} /><span className="text-slate-500">{n}件</span></div>
        ))}
      </div>
    </div>
  )
}

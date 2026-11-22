// インソール備品の発注（加盟店）／受注・発送（協会）／一覧（本部）
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useData } from '../../lib/store'
import { ORDER_STATUS, orderTotal } from '../../lib/partner'
import { acceptOrder, cancelOrder, deliverOrder, placeOrder, shipOrder } from '../../lib/partnerActions'
import { Empty, Field, PageTitle, Stat } from '../../components/ui'
import { fmtDate, fmtDateTime, today, yen } from '../../lib/utils'
import type { Order, OrderLine } from '../../lib/types'

export const OrderStatusBadge = ({ s }: { s: Order['status'] }) => <span className={`badge ${ORDER_STATUS[s][1]}`}>{ORDER_STATUS[s][0]}</span>

/** 加盟店側: 商品を選んで発注 ＋ 自店の発注履歴 */
export function StoreOrders() {
  const { data, me, toast } = useData()
  const [params] = useSearchParams()
  const analysis = data.analyses.find((a) => a.id === params.get('analysis'))
  const [cart, setCart] = useState<OrderLine[]>([])
  const [note, setNote] = useState(analysis ? 'AI分析レポートの推奨によるご注文' : '')
  const [sel, setSel] = useState<Record<string, { size: string; clientIds: string[]; qty: number }>>({})
  const store = data.stores.find((s) => s.id === me?.storeId)
  if (!me || !store) return <Empty>開業後に利用できます</Empty>
  const clients = data.clients.filter((c) => c.storeId === store.id)
  const orders = data.orders.filter((o) => o.storeId === store.id).sort((a, b) => b.orderedAt.localeCompare(a.orderedAt))
  const cartTotal = cart.reduce((s, l) => s + l.price * l.qty, 0)
  const recClient = analysis ? clients.find((c) => c.id === analysis.clientId) : undefined

  const defaultSel = (pid: string) => {
    const p = data.products.find((x) => x.id === pid)!
    return { size: p.sizes?.[0] ?? '', clientIds: recClient && p.category === 'insole' ? [recClient.id] : [], qty: 1 }
  }
  /** 利用者を複数選んだ場合は、利用者ごとに1行ずつ（各 数量 分）カートに入れる */
  const add = (pid: string) => {
    const p = data.products.find((x) => x.id === pid)!
    const s = sel[pid] ?? defaultSel(pid)
    const base = { productId: p.id, name: p.name, size: s.size || undefined, qty: s.qty, price: p.price }
    const lines: OrderLine[] = s.clientIds.length ? s.clientIds.map((clientId) => ({ ...base, clientId })) : [base]
    setCart([...cart, ...lines])
    setSel({ ...sel, [pid]: { ...s, clientIds: [] } })
    toast(`${p.name} をカートに追加しました（${lines.length > 1 ? `${lines.length}名分・` : ''}${lines.length * s.qty}点）`)
  }
  const submit = async () => {
    const o = await placeOrder(store, cart, note, me, data.orders, analysis?.id)
    setCart([])
    toast(`発注しました（${o.number}）。協会からの発送をお待ちください`)
  }

  return (
    <div className="space-y-4">
      <PageTitle sub={`${store.name}・発注先: 転倒予防防止協会（請求は本部から）`}>備品発注</PageTitle>
      {analysis && recClient && (
        <div className="rounded-md border border-teal-300 bg-teal-50 p-3 text-sm">
          AI分析レポート（{recClient.name} 様・{fmtDate(analysis.shotAt)}）で <b>転倒予防インソール</b> が推奨されています。利用者は自動で選択されています。
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-3 sm:grid-cols-2">
          {data.products.map((p) => {
            const s = sel[p.id] ?? defaultSel(p.id)
            const set = (patch: Partial<typeof s>) => setSel({ ...sel, [p.id]: { ...s, ...patch } })
            const toggleClient = (cid: string) => set({ clientIds: s.clientIds.includes(cid) ? s.clientIds.filter((x) => x !== cid) : [...s.clientIds, cid] })
            const allChecked = clients.length > 0 && s.clientIds.length === clients.length
            const points = Math.max(1, s.clientIds.length) * s.qty
            return (
              <div key={p.id} className="card flex flex-col gap-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium">{p.name}</div>
                  <span className="badge shrink-0 bg-slate-100 text-slate-600">{p.category === 'insole' ? 'インソール' : '備品'}</span>
                </div>
                <div className="text-xs text-slate-500">{p.description}</div>
                <div className="text-lg font-bold">{yen(p.price)}<span className="text-xs font-normal text-slate-500">（税抜）</span></div>
                {p.sizes && <Field label="サイズ"><select className="input" value={s.size} onChange={(e) => set({ size: e.target.value })}>{p.sizes.map((z) => <option key={z}>{z}</option>)}</select></Field>}
                {p.category === 'insole' && (
                  <div className="text-sm">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">利用者（任意・複数選択可）{s.clientIds.length > 0 && <b className="ml-1 text-teal-700">{s.clientIds.length}名選択中</b>}</span>
                      <button type="button" className="text-xs text-teal-700 underline" onClick={() => set({ clientIds: allChecked ? [] : clients.map((c) => c.id) })}>{allChecked ? 'すべて解除' : 'すべて選択'}</button>
                    </div>
                    <div className="max-h-44 overflow-y-auto rounded-md border border-slate-300">
                      {clients.map((c) => (
                        <label key={c.id} className={`flex cursor-pointer items-center gap-2 border-b border-slate-100 px-2 py-2 last:border-b-0 ${s.clientIds.includes(c.id) ? 'bg-teal-50' : 'hover:bg-slate-50'}`}>
                          <input type="checkbox" className="h-5 w-5 shrink-0" checked={s.clientIds.includes(c.id)} onChange={() => toggleClient(c.id)} />
                          <span className="flex-1">{c.name} 様</span>
                          <span className="text-xs text-slate-400">{c.careLevel}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-auto flex items-end gap-2">
                  <Field label={s.clientIds.length > 1 ? '1人あたりの数量' : '数量'}><input className="input w-20" type="number" min={1} value={s.qty} onChange={(e) => set({ qty: Math.max(1, Number(e.target.value)) })} /></Field>
                  <button className="btn-primary ml-auto py-2" onClick={() => add(p.id)}>カートに追加{points > 1 && `（${points}点）`}</button>
                </div>
              </div>
            )
          })}
        </div>
        <div className="card h-fit space-y-3 lg:sticky lg:top-4">
          <h2 className="font-semibold">カート（{cart.reduce((n, l) => n + l.qty, 0)}点）</h2>
          {cart.map((l, i) => (
            <div key={i} className="flex items-start gap-2 border-t border-slate-100 pt-2 text-sm">
              <div className="flex-1">
                <div>{l.name}</div>
                <div className="text-xs text-slate-500">{l.size}{l.clientId && `・${clients.find((c) => c.id === l.clientId)?.name} 様`}・{l.qty}点</div>
              </div>
              <div>{yen(l.price * l.qty)}</div>
              <button className="text-slate-400 hover:text-rose-600" aria-label="削除" onClick={() => setCart(cart.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          {!cart.length && <Empty>商品を追加してください</Empty>}
          <div className="flex justify-between border-t border-slate-200 pt-2 font-bold"><span>合計（税抜）</span><span>{yen(cartTotal)}</span></div>
          <textarea className="input" rows={2} placeholder="備考" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn-primary w-full justify-center py-2.5" disabled={!cart.length} onClick={submit}>発注する</button>
        </div>
      </div>
      <OrderTable orders={orders} />
    </div>
  )
}

/** 協会・本部側: 全加盟店の発注 */
export function OrdersAdmin() {
  const { data, me } = useData()
  const [status, setStatus] = useState('')
  if (!me) return null
  const list = data.orders.filter((o) => !status || o.status === status).sort((a, b) => b.orderedAt.localeCompare(a.orderedAt))
  const isPartner = me.kind === 'partner'
  return (
    <div className="space-y-4">
      <PageTitle sub={isPartner ? '加盟店からのインソール・備品の発注。受注確認 → 発送で本部から加盟店へ請求が作成されます' : '全加盟店の備品発注（受注・発送は協会が行います）'}
        actions={<select className="input w-full sm:w-48" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">すべての状態</option>{Object.entries(ORDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select>}>
        {isPartner ? 'インソール受注' : '備品発注'}
      </PageTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="受注待ち" value={data.orders.filter((o) => o.status === 'ordered').length} tone="amber" />
        <Stat label="発送準備中" value={data.orders.filter((o) => o.status === 'accepted').length} tone="amber" />
        <Stat label="発送済（納品待ち）" value={data.orders.filter((o) => o.status === 'shipped').length} />
        <Stat label="今月の発注額（税抜）" value={yen(data.orders.filter((o) => o.status !== 'cancelled' && o.orderedAt.startsWith(today().slice(0, 7))).reduce((s, o) => s + orderTotal(o), 0))} tone="teal" />
      </div>
      <OrderTable orders={list} showStore />
    </div>
  )
}

function OrderTable({ orders, showStore }: { orders: Order[]; showStore?: boolean }) {
  const { data } = useData()
  return (
    <div className="space-y-2">
      <h2 className="font-semibold">発注一覧</h2>
      {orders.map((o) => <OrderCard key={o.id} o={o} storeName={showStore ? data.stores.find((s) => s.id === o.storeId)?.name : undefined} />)}
      {!orders.length && <Empty>発注はありません</Empty>}
    </div>
  )
}

function OrderCard({ o, storeName }: { o: Order; storeName?: string }) {
  const { data, me, toast } = useData()
  const [tracking, setTracking] = useState('')
  const [open, setOpen] = useState(false)
  if (!me) return null
  const store = data.stores.find((s) => s.id === o.storeId)!
  const isPartner = me.kind === 'partner'
  const isStore = me.storeId === o.storeId && me.kind !== 'partner'
  const inv = data.invoices.find((i) => i.id === o.invoiceId)
  const run = async (fn: () => Promise<unknown>, msg: string) => { await fn(); toast(msg) }
  return (
    <div className="card p-3">
      <button className="flex w-full flex-wrap items-center gap-2 text-left" onClick={() => setOpen(!open)}>
        <span className="font-medium">{o.number}</span>
        <OrderStatusBadge s={o.status} />
        {storeName && <span className="text-sm text-slate-600">{storeName}</span>}
        <span className="text-xs text-slate-500">{fmtDateTime(o.orderedAt)}</span>
        <span className="ml-auto font-semibold">{yen(orderTotal(o))}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2 border-t border-slate-100 pt-2 text-sm">
          <ul className="space-y-1">
            {o.lines.map((l, i) => <li key={i} className="flex justify-between gap-2"><span>{l.name} {l.size && <span className="text-slate-500">／{l.size}</span>}{l.clientId && <span className="text-slate-500">／{data.clients.find((c) => c.id === l.clientId)?.name} 様</span>} × {l.qty}</span><span>{yen(l.price * l.qty)}</span></li>)}
          </ul>
          {o.note && <div className="text-xs text-slate-500">備考: {o.note}</div>}
          {o.analysisId && <div className="text-xs text-teal-700">AI分析レポートの推奨による発注</div>}
          <div className="text-xs text-slate-500">
            {o.acceptedAt && <>受注確認 {fmtDate(o.acceptedAt)}　</>}
            {o.shippedAt && <>発送 {fmtDate(o.shippedAt)}（追跡番号 {o.trackingNo}）　</>}
            {o.deliveredAt && <>納品 {fmtDate(o.deliveredAt)}　</>}
            {inv && <>請求 {inv.number}（{inv.status === 'paid' ? '入金済' : '未入金'}）</>}
          </div>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {isPartner && o.status === 'ordered' && <button className="btn-primary" onClick={() => run(() => acceptOrder(o, me), '受注を確認しました')}>受注を確認</button>}
        {isPartner && o.status === 'accepted' && (
          <div className="flex w-full gap-2 sm:w-auto">
            <input className="input sm:w-48" placeholder="追跡番号" value={tracking} onChange={(e) => setTracking(e.target.value)} />
            <button className="btn-primary shrink-0" disabled={!tracking} onClick={() => run(() => shipOrder(o, tracking, me, store, data.invoices), '発送済みにし、本部から加盟店への請求書を作成しました')}>発送済みにする</button>
          </div>
        )}
        {isStore && o.status === 'shipped' && <button className="btn-primary" onClick={() => run(() => deliverOrder(o, me), '納品を確認しました')}>納品を確認</button>}
        {isStore && o.status === 'ordered' && <button className="btn-danger" onClick={() => run(() => cancelOrder(o, me), '発注を取り消しました')}>発注を取消</button>}
        {o.analysisId && (isStore || isPartner) && <Link className="btn-secondary" to={`${me.kind === 'partner' ? '/partner' : me.kind === 'fc' ? '/fc' : '/field'}/analyses/${o.analysisId}`}>元のレポート</Link>}
      </div>
    </div>
  )
}

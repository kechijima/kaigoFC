// ロイヤリティ等から社団法人（協会）への分配: ルール設定・月次精算（本部）／分配明細（協会）
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../../lib/store'
import { FEE_LABEL, PARTNER_NAME, computeSettlementLines, freeeExpenseCsv, prevMonth } from '../../lib/partner'
import { confirmSettlement, markSettlementPaid, updateRule } from '../../lib/partnerActions'
import { Empty, PageTitle, Stat } from '../../components/ui'
import { downloadText, fmtDate, today, yen } from '../../lib/utils'
import type { FeeCategory, Settlement, SettlementLine } from '../../lib/types'

const ST_STATUS: Record<Settlement['status'], [string, string]> = {
  draft: ['未確定', 'bg-slate-100 text-slate-600'],
  confirmed: ['確定・支払待ち', 'bg-amber-100 text-amber-800'],
  paid: ['支払済', 'bg-emerald-100 text-emerald-700'],
}

function Lines({ lines }: { lines: SettlementLine[] }) {
  const byCat = new Map<FeeCategory, number>()
  lines.forEach((l) => byCat.set(l.category, (byCat.get(l.category) ?? 0) + l.amount))
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">{[...byCat].map(([c, v]) => <span key={c} className="rounded bg-slate-100 px-2 py-1 text-sm">{FEE_LABEL[c]}: <b>{yen(v)}</b></span>)}</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead className="bg-slate-50"><tr><th className="th">請求番号</th><th className="th">請求先</th><th className="th">費目</th><th className="th text-right">対象額(税抜)</th><th className="th text-right">分配率</th><th className="th text-right">分配額</th></tr></thead>
          <tbody>{lines.map((l, i) => (
            <tr key={i}><td className="td">{l.invoiceNumber}</td><td className="td">{l.billToName}</td><td className="td">{FEE_LABEL[l.category]}</td><td className="td text-right">{yen(l.base)}</td><td className="td text-right">{l.rate}%</td><td className="td text-right font-medium">{yen(l.amount)}</td></tr>
          ))}</tbody>
        </table>
      </div>
      {!lines.length && <Empty>対象となる入金はありません</Empty>}
    </div>
  )
}

/** 本部: 分配ルールと月次精算 */
export function DistributionAdmin() {
  const { data, me, toast } = useData()
  const [month, setMonth] = useState(prevMonth(today().slice(0, 7)))
  if (!me) return null
  const canEdit = me.hqRole === 'admin' || me.hqRole === 'accounting'
  const rules = [...data.distributionRules].sort((a, b) => Number(b.enabled) - Number(a.enabled))
  const settled = data.settlements.find((s) => s.month === month)
  const live = computeSettlementLines(month, data.invoices, data.distributionRules)
  const lines = settled ? settled.lines : live
  const total = lines.reduce((s, l) => s + l.amount, 0)
  const history = [...data.settlements].sort((a, b) => b.month.localeCompare(a.month))

  return (
    <div className="space-y-4">
      <PageTitle sub={`入金済みの請求から、費目ごとの分配率で ${PARTNER_NAME} への分配額を計算します`}
        actions={<button className="btn-secondary" disabled={!history.length} onClick={() => { downloadText(`freee_分配金支払_${today()}.csv`, freeeExpenseCsv(history)); toast('freee取込用CSV（支出）を出力しました') }}>freee取込用CSV（支出）</button>}>
        分配設定・精算
      </PageTitle>

      <div className="card">
        <h2 className="mb-2 font-semibold">分配ルール</h2>
        <p className="mb-3 text-xs text-slate-500">比率はモック用の仮の値です（要確認 §11.7 P2）。{!canEdit && '変更は本部長・経理のみ可能です。'}</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rules.map((r) => (
            <div key={r.id} className={`flex items-center gap-2 rounded-md border p-3 ${r.enabled ? 'border-teal-300 bg-teal-50/40' : 'border-slate-200'}`}>
              <label className="flex flex-1 items-center gap-2 text-sm">
                <input type="checkbox" className="h-5 w-5" checked={r.enabled} disabled={!canEdit} onChange={(e) => updateRule(r, { enabled: e.target.checked }, me)} />
                {r.label}
              </label>
              <input className="input w-20 text-right" type="number" min={0} max={100} value={r.rate} disabled={!canEdit || !r.enabled}
                onChange={(e) => updateRule(r, { rate: Math.max(0, Math.min(100, Number(e.target.value))) }, me)} />
              <span className="text-sm">%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">月次精算</h2>
          <input className="input w-auto" type="month" value={month} max={today().slice(0, 7)} onChange={(e) => setMonth(e.target.value)} />
          <span className={`badge ${ST_STATUS[settled?.status ?? 'draft'][1]}`}>{ST_STATUS[settled?.status ?? 'draft'][0]}</span>
          <span className="ml-auto text-lg font-bold">分配額 {yen(total)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {!settled && <button className="btn-primary" disabled={!canEdit || !live.length} onClick={async () => { await confirmSettlement(month, data.invoices, data.distributionRules, me); toast('分配額を確定し、協会へ支払通知を送りました（モック）') }}>この内容で確定・支払通知</button>}
          {settled?.status === 'confirmed' && <button className="btn-primary" disabled={!canEdit} onClick={async () => { await markSettlementPaid(settled, me); toast('支払完了を記録しました') }}>支払完了を記録</button>}
          {settled && <span className="text-xs text-slate-500">確定 {fmtDate(settled.confirmedAt)}{settled.paidAt && `・支払 ${fmtDate(settled.paidAt)}`}（確定後は明細が固定されます）</span>}
          {!settled && <span className="text-xs text-slate-500">未確定のため、入金や分配ルールの変更が即時に反映されます</span>}
        </div>
        <Lines lines={lines} />
      </div>

      <SettlementHistory history={history} />
    </div>
  )
}

function SettlementHistory({ history }: { history: Settlement[] }) {
  return (
    <div className="card p-0">
      <h2 className="px-4 pt-3 font-semibold">精算履歴</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50"><tr><th className="th">対象月（入金月）</th><th className="th text-right">分配額</th><th className="th">状態</th><th className="th">確定日</th><th className="th">支払日</th></tr></thead>
          <tbody>{history.map((s) => (
            <tr key={s.id}><td className="td">{s.month}</td><td className="td text-right font-medium">{yen(s.total)}</td><td className="td"><span className={`badge ${ST_STATUS[s.status][1]}`}>{ST_STATUS[s.status][0]}</span></td><td className="td">{fmtDate(s.confirmedAt)}</td><td className="td">{fmtDate(s.paidAt)}</td></tr>
          ))}</tbody>
        </table>
      </div>
      {!history.length && <Empty>精算履歴はありません</Empty>}
    </div>
  )
}

/** 協会: 分配明細（閲覧のみ） */
export function PartnerDistribution() {
  const { data } = useData()
  const history = [...data.settlements].sort((a, b) => b.month.localeCompare(a.month))
  const [sel, setSel] = useState<string>(history[0]?.id ?? '')
  const s = history.find((x) => x.id === sel)
  return (
    <div className="space-y-4">
      <PageTitle sub="株式会社サクラコーポレーションからの分配金の明細">分配明細</PageTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="支払待ち" value={yen(history.filter((x) => x.status === 'confirmed').reduce((a, x) => a + x.total, 0))} tone="amber" />
        <Stat label="累計受取額" value={yen(history.filter((x) => x.status === 'paid').reduce((a, x) => a + x.total, 0))} tone="teal" />
        <Stat label="分配率（ロイヤリティ）" value={`${data.distributionRules.find((r) => r.id === 'royalty')?.rate ?? 0}%`} />
      </div>
      <SettlementHistory history={history} />
      {history.length > 0 && (
        <div className="card space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">明細</h2>
            <select className="input w-auto" value={sel} onChange={(e) => setSel(e.target.value)}>{history.map((x) => <option key={x.id} value={x.id}>{x.month}</option>)}</select>
            {s && <span className="ml-auto text-lg font-bold">{yen(s.total)}</span>}
          </div>
          {s && <Lines lines={s.lines} />}
        </div>
      )}
    </div>
  )
}

/** 協会ダッシュボード */
export function PartnerDashboard() {
  const { data, me } = useData()
  const review = data.analyses.filter((a) => a.status === 'review' || a.status === 'analyzing')
  const toAccept = data.orders.filter((o) => o.status === 'ordered')
  const toShip = data.orders.filter((o) => o.status === 'accepted')
  const pay = data.settlements.filter((s) => s.status === 'confirmed').reduce((a, s) => a + s.total, 0)
  // 利用者ごとの最新レポートで判定
  const latest = new Map<string, (typeof data.analyses)[number]>()
  for (const a of data.analyses.filter((x) => x.status === 'published')) {
    const cur = latest.get(a.clientId)
    if (!cur || cur.shotAt < a.shotAt) latest.set(a.clientId, a)
  }
  const highRisk = [...latest.values()].filter((a) => a.riskLevel === 'high').sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0))
  const storeName = (id: string) => data.stores.find((s) => s.id === id)?.name
  const clientName = (id: string) => data.clients.find((c) => c.id === id)?.name
  return (
    <div className="space-y-5">
      <PageTitle sub={PARTNER_NAME}>{me?.name} 様　ダッシュボード</PageTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="レポート確認待ち" value={review.length} tone="amber" />
        <Stat label="インソール受注待ち" value={toAccept.length} tone="amber" />
        <Stat label="発送待ち" value={toShip.length} />
        <Stat label="分配金（支払待ち）" value={yen(pay)} tone="teal" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-2 font-semibold">AI分析 レポート確認待ち</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {review.map((a) => <li key={a.id} className="py-2"><Link className="hover:underline" to={`/partner/analyses/${a.id}`}>{storeName(a.storeId)} — {clientName(a.clientId)} 様（撮影 {fmtDate(a.shotAt)}）</Link></li>)}
            {!review.length && <Empty>ありません</Empty>}
          </ul>
        </div>
        <div className="card">
          <h2 className="mb-2 font-semibold">インソール 受注・発送待ち</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {[...toAccept, ...toShip].map((o) => <li key={o.id} className="py-2"><Link className="hover:underline" to="/partner/orders">{o.number} — {storeName(o.storeId)}（{o.status === 'ordered' ? '受注待ち' : '発送待ち'}）</Link></li>)}
            {!toAccept.length && !toShip.length && <Empty>ありません</Empty>}
          </ul>
        </div>
      </div>
      <div className="card">
        <h2 className="mb-2 font-semibold text-rose-700">転倒リスクが高い利用者（発行済レポート）</h2>
        <ul className="divide-y divide-slate-100 text-sm">
          {highRisk.map((a) => <li key={a.id} className="py-2"><Link className="hover:underline" to={`/partner/analyses/${a.id}`}>{storeName(a.storeId)} — {clientName(a.clientId)} 様　スコア {a.riskScore}（{fmtDate(a.shotAt)}）</Link></li>)}
          {!highRisk.length && <Empty>ありません</Empty>}
        </ul>
      </div>
    </div>
  )
}

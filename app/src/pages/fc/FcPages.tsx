import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../../lib/store'
import { PHASES, isAvailable, isClosed } from '../../lib/workflow'
import { TaskItem } from '../../components/TaskItem'
import { WorkflowView } from '../../components/WorkflowView'
import { Empty, InvoiceStatusBadge, PageTitle, PhaseStepper, Stat } from '../../components/ui'
import { InvoiceModal } from '../hq/Invoices'
import { invoiceTotals } from '../../lib/billing'
import { buildMonthlyReport, reportPayment, submitMonthlyReport } from '../../lib/actions'
import { addDays, fmtDate, today, yen, diffDays } from '../../lib/utils'
import type { Invoice } from '../../lib/types'

function useMyDeal() {
  const { data, me } = useData()
  return data.deals.find((d) => d.id === me?.dealId)
}

export function FcHome() {
  const { data, me } = useData()
  const deal = useMyDeal()
  if (!me || !deal) return <Empty>案件情報がありません</Empty>
  const tasks = data.tasks.filter((t) => t.dealId === deal.id && !t.hqOnly)
  const todo = tasks.filter((t) => t.assignee === 'fc' && !isClosed(t) && t.status !== 'in_review' && isAvailable(t, tasks, deal)).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const waiting = tasks.filter((t) => !isClosed(t) && isAvailable(t, tasks, deal) && (t.assignee === 'hq' || t.status === 'in_review'))
  const notices = data.notices.filter((n) => !n.readBy.includes(me.id) && (n.target === 'all' || (n.target === 'stores') === (deal.status === 'opened')))
  const unpaid = data.invoices.filter((i) => i.dealId === deal.id && i.status === 'issued')

  if (deal.status === 'opened') {
    const store = data.stores.find((s) => s.id === deal.storeId)
    const month = today().slice(0, 7)
    const cur = buildMonthlyReport(deal.storeId!, month, data.visits)
    return (
      <div className="space-y-4">
        <PageTitle sub={`${store?.companyName}・開業 ${fmtDate(store?.openDate)}`}>{store?.name} オーナー画面</PageTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="今月の訪問件数（実績）" value={cur.visitCount} tone="teal" />
          <Stat label="今月の売上（概算）" value={yen(cur.revenue)} />
          <Stat label="利用者数" value={data.clients.filter((c) => c.storeId === store?.id).length} />
          <Stat label="未払いの請求" value={unpaid.length} tone={unpaid.length ? 'amber' : 'slate'} />
        </div>
        <div className="card text-sm">
          <h2 className="mb-2 font-semibold">お知らせ（未読 {notices.length}）</h2>
          {notices.map((n) => <div key={n.id} className="border-t border-slate-100 py-2"><Link to="/fc/notices" className="hover:underline">{n.title}</Link></div>)}
          {!notices.length && <Empty>未読のお知らせはありません</Empty>}
        </div>
        <div className="flex gap-2"><Link to="/fc/report" className="btn-primary">月次実績を報告する</Link><Link to="/fc/invoices" className="btn-secondary">請求を確認</Link></div>
      </div>
    )
  }

  const left = diffDays(deal.targetOpenDate, today())
  return (
    <div className="space-y-4">
      <PageTitle sub={`開業希望日 ${fmtDate(deal.targetOpenDate)}（あと${left}日）`}>{deal.applicantName} 様　開業準備の状況</PageTitle>
      {deal.status !== 'active' && <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">現在この案件は{deal.status === 'on_hold' ? '保留中' : '終了'}です。</div>}
      <div className="card">
        <PhaseStepper phase={deal.phase} status={deal.status} />
        <div className="mt-2 text-center text-sm">現在のステップ: <b>{PHASES[deal.phase]?.name}</b></div>
      </div>
      <section className="space-y-2">
        <h2 className="font-semibold">あなたがやること <span className="text-slate-400">{todo.length}</span></h2>
        {todo.map((t) => <TaskItem key={t.id} task={t} deal={deal} defaultOpen={todo.length <= 3} />)}
        {!todo.length && <Empty>今やることはありません。本部の対応をお待ちください。</Empty>}
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold">本部が対応中 <span className="text-slate-400">{waiting.length}</span></h2>
        {waiting.map((t) => <TaskItem key={t.id} task={t} deal={deal} />)}
      </section>
      {notices.length > 0 && (
        <div className="card text-sm"><h2 className="mb-2 font-semibold">未読のお知らせ</h2>{notices.map((n) => <div key={n.id} className="border-t border-slate-100 py-2"><Link to="/fc/notices" className="hover:underline">{n.title}</Link></div>)}</div>
      )}
    </div>
  )
}

export function FcWorkflow() {
  const deal = useMyDeal()
  if (!deal) return <Empty>案件情報がありません</Empty>
  return (
    <div className="space-y-4">
      <PageTitle sub="問い合わせから開業までのすべての手続き">開業までの手続き</PageTitle>
      <div className="card"><PhaseStepper phase={deal.phase} status={deal.status} /></div>
      <WorkflowView deal={deal} />
    </div>
  )
}

export function FcInvoices() {
  const { data, me, toast } = useData()
  const deal = useMyDeal()
  const [view, setView] = useState<Invoice | null>(null)
  const [note, setNote] = useState<Record<string, string>>({})
  if (!me || !deal) return null
  const list = data.invoices.filter((i) => i.dealId === deal.id).sort((a, b) => b.issueDate.localeCompare(a.issueDate))
  return (
    <div className="space-y-4">
      <PageTitle>請求・お支払い</PageTitle>
      {/* スマホ: カード表示 */}
      <div className="space-y-2 md:hidden">
        {list.map((i) => (
          <div key={i.id} className="card space-y-2 p-3">
            <div className="flex items-start justify-between gap-2">
              <button className="text-left font-medium text-teal-700" onClick={() => setView(i)}>{i.title}</button>
              <InvoiceStatusBadge s={i.status} due={i.dueDate} />
            </div>
            <div className="flex items-end justify-between text-sm">
              <span className="text-xs text-slate-500">{i.number}<br />期限 {fmtDate(i.dueDate)}</span>
              <span className="text-lg font-bold">{yen(invoiceTotals(i).total)}</span>
            </div>
            {i.status === 'issued' ? (
              <div className="flex gap-2">
                <input className="input" placeholder="振込日・名義など" value={note[i.id] ?? ''} onChange={(e) => setNote({ ...note, [i.id]: e.target.value })} />
                <button className="btn-primary shrink-0" onClick={async () => { await reportPayment(i, note[i.id] ?? '', me); toast('入金を報告しました') }}>入金を報告</button>
              </div>
            ) : <div className="text-xs text-slate-500">{i.status === 'reported' ? '本部で入金を確認中です' : `${fmtDate(i.paidAt)} 入金確認済み`}</div>}
          </div>
        ))}
        {!list.length && <Empty>請求はありません</Empty>}
      </div>
      <div className="card hidden overflow-x-auto p-0 md:block">
        <table className="w-full">
          <thead className="bg-slate-50"><tr><th className="th">請求番号</th><th className="th">件名</th><th className="th text-right">金額(税込)</th><th className="th">お支払期限</th><th className="th">状態</th><th className="th">入金の報告</th></tr></thead>
          <tbody>{list.map((i) => (
            <tr key={i.id}>
              <td className="td"><button className="text-teal-700 hover:underline" onClick={() => setView(i)}>{i.number}</button></td>
              <td className="td">{i.title}</td>
              <td className="td text-right">{yen(invoiceTotals(i).total)}</td>
              <td className="td">{fmtDate(i.dueDate)}</td>
              <td className="td"><InvoiceStatusBadge s={i.status} due={i.dueDate} /></td>
              <td className="td">{i.status === 'issued' ? (
                <div className="flex gap-1">
                  <input className="input w-44" placeholder="振込日・名義など" value={note[i.id] ?? ''} onChange={(e) => setNote({ ...note, [i.id]: e.target.value })} />
                  <button className="btn-secondary shrink-0" onClick={async () => { await reportPayment(i, note[i.id] ?? '', me); toast('入金を報告しました') }}>報告</button>
                </div>
              ) : i.status === 'reported' ? <span className="text-xs text-slate-500">本部確認中</span> : <span className="text-xs text-slate-500">{fmtDate(i.paidAt)} 入金確認</span>}</td>
            </tr>
          ))}</tbody>
        </table>
        {!list.length && <Empty>請求はありません</Empty>}
      </div>
      {view && <InvoiceModal inv={view} onClose={() => setView(null)} />}
    </div>
  )
}

export function FcReport() {
  const { data, me, toast } = useData()
  const deal = useMyDeal()
  const lastMonth = addDays(today().slice(0, 7) + '-01', -1).slice(0, 7)
  const [month, setMonth] = useState(lastMonth)
  if (!me || !deal?.storeId) return <Empty>開業後に利用できます</Empty>
  const store = data.stores.find((s) => s.id === deal.storeId)!
  const existing = data.monthlyReports.find((r) => r.storeId === store.id && r.month === month)
  // 業務システムの訪問実績から集計（シードの過去月は集計値をそのまま使う）
  const calc = buildMonthlyReport(store.id, month, data.visits, existing)
  const rep = existing && existing.status !== 'draft' ? existing : existing && calc.visitCount === 0 ? existing : calc
  const history = data.monthlyReports.filter((r) => r.storeId === store.id).sort((a, b) => b.month.localeCompare(a.month))
  return (
    <div className="space-y-4">
      <PageTitle sub="業務システム（③）の訪問記録から自動集計し、本部へ報告します">月次実績報告</PageTitle>
      <div className="card space-y-3">
        <div className="flex items-center gap-2"><span className="text-sm">対象月</span><input className="input w-40" type="month" value={month} max={today().slice(0, 7)} onChange={(e) => setMonth(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="訪問件数（完了）" value={rep.visitCount} />
          <Stat label="利用者数" value={rep.clientCount} />
          <Stat label="月間売上（概算）" value={yen(rep.revenue)} hint={`ロイヤリティ ${store.royaltyRate}% = ${yen((rep.revenue * store.royaltyRate) / 100)}`} />
        </div>
        {rep.status === 'draft' ? (
          <button className="btn-primary w-full justify-center py-2.5 sm:w-auto" disabled={rep.visitCount === 0} onClick={async () => { await submitMonthlyReport(rep, me); toast('本部へ報告しました') }}>この内容で本部へ報告する</button>
        ) : <div className="text-sm text-emerald-700">✓ {rep.status === 'invoiced' ? '報告済み・請求書発行済み' : '報告済み（本部が請求書を発行します）'}</div>}
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full"><thead className="bg-slate-50"><tr><th className="th">月</th><th className="th text-right">訪問件数</th><th className="th text-right">売上</th><th className="th">状態</th></tr></thead>
          <tbody>{history.map((r) => <tr key={r.id}><td className="td">{r.month}</td><td className="td text-right">{r.visitCount}</td><td className="td text-right">{yen(r.revenue)}</td><td className="td">{{ draft: '未報告', submitted: '報告済', invoiced: '請求済' }[r.status]}</td></tr>)}</tbody></table>
      </div>
    </div>
  )
}

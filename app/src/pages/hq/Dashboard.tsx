import { Link } from 'react-router-dom'
import { useData } from '../../lib/store'
import { PHASES, isAvailable, isClosed } from '../../lib/workflow'
import { DueLabel, Empty, PageTitle, Stat } from '../../components/ui'
import { fmtDateTime, today, yen } from '../../lib/utils'
import { invoiceTotals } from '../../lib/billing'

export default function Dashboard() {
  const { data } = useData()
  const active = data.deals.filter((d) => d.status === 'active')
  const openTasks = data.tasks.filter((t) => {
    const d = active.find((x) => x.id === t.dealId)
    return d && !isClosed(t) && isAvailable(t, data.tasks.filter((x) => x.dealId === d.id), d)
  })
  const overdue = openTasks.filter((t) => t.dueDate < today()).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const reviews = openTasks.filter((t) => t.status === 'in_review' || (t.type === 'approve' && t.status !== 'done'))
  const pendingContracts = data.contracts.filter((c) => c.status === 'pending_approval' || c.status === 'fc_signed')
  const reported = data.invoices.filter((i) => i.status === 'reported')
  const unpaid = data.invoices.filter((i) => i.status !== 'paid')
  const reportsToBill = data.monthlyReports.filter((r) => r.status === 'submitted')
  const dealName = (id: string) => { const d = data.deals.find((x) => x.id === id); return d ? d.companyName || d.applicantName : '' }

  return (
    <div className="space-y-6">
      <PageTitle sub={`${today().replaceAll('-', '/')} 時点`}>本部ダッシュボード</PageTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Stat label="進行中のFC進捗" value={active.length} tone="teal" />
        <Stat label="運営中の店舗" value={data.stores.length} />
        <Stat label="期限超過タスク" value={overdue.length} tone={overdue.length ? 'rose' : 'slate'} />
        <Stat label="本部の確認・承認待ち" value={reviews.length + pendingContracts.length} tone="amber" />
        <Stat label="入金確認待ち" value={reported.length} tone="amber" />
        <Stat label="未入金額" value={yen(unpaid.reduce((s, i) => s + invoiceTotals(i).total, 0))} hint={`${unpaid.length}件`} />
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">加盟パイプライン</h2>
        <div className="grid grid-cols-4 gap-2 md:grid-cols-8">
          {PHASES.map((p) => {
            const n = active.filter((d) => d.phase === p.no)
            return (
              <Link key={p.no} to={`/hq/deals?phase=${p.no}`} className="rounded-md bg-slate-50 p-3 text-center hover:bg-teal-50">
                <div className="text-xs text-slate-500">P{p.no} {p.short}</div>
                <div className="text-2xl font-bold">{n.length}</div>
              </Link>
            )
          })}
          <Link to="/hq/stores" className="rounded-md bg-emerald-50 p-3 text-center hover:bg-emerald-100">
            <div className="text-xs text-emerald-700">運営中</div>
            <div className="text-2xl font-bold text-emerald-700">{data.stores.length}</div>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-2 font-semibold">本部の対応待ち</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {pendingContracts.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 py-2"><span className="badge bg-amber-100 text-amber-800">契約</span><Link className="flex-1 hover:underline" to={`/hq/contracts/${c.id}`}>{dealName(c.dealId)} — {c.title}（{c.status === 'pending_approval' ? '社内承認待ち' : '本部署名待ち'}）</Link></li>
            ))}
            {reviews.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 py-2"><span className="badge bg-amber-100 text-amber-800">{t.type === 'approve' ? '承認' : '書類確認'}</span><Link className="flex-1 hover:underline" to={`/hq/deals/${t.dealId}`}>{dealName(t.dealId)} — {t.code} {t.title}</Link><DueLabel task={t} /></li>
            ))}
            {reported.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2 py-2"><span className="badge bg-amber-100 text-amber-800">入金</span><Link className="flex-1 hover:underline" to="/hq/invoices">{i.billToName} — {i.number} {yen(invoiceTotals(i).total)} の入金報告</Link></li>
            ))}
            {reportsToBill.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 py-2"><span className="badge bg-sky-100 text-sky-700">月次</span><Link className="flex-1 hover:underline" to="/hq/stores">{data.stores.find((s) => s.id === r.storeId)?.name} — {r.month} 実績報告（ロイヤリティ未請求）</Link></li>
            ))}
            {!pendingContracts.length && !reviews.length && !reported.length && !reportsToBill.length && <Empty>対応待ちはありません</Empty>}
          </ul>
        </div>
        <div className="card">
          <h2 className="mb-2 font-semibold text-rose-700">期限超過タスク</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {overdue.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className={`badge ${t.assignee === 'hq' ? 'bg-indigo-50 text-indigo-700' : 'bg-orange-50 text-orange-700'}`}>{t.assignee === 'hq' ? '本部' : '加盟者'}</span>
                <Link className="flex-1 hover:underline" to={`/hq/deals/${t.dealId}`}>{dealName(t.dealId)} — {t.code} {t.title}</Link>
                <DueLabel task={t} />
              </li>
            ))}
            {!overdue.length && <Empty>期限超過はありません</Empty>}
          </ul>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-2 font-semibold">最近の操作</h2>
        <ul className="space-y-1 text-sm">
          {[...data.auditLogs].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10).map((l) => (
            <li key={l.id} className="flex flex-wrap gap-x-2"><span className="w-32 shrink-0 text-xs text-slate-400">{fmtDateTime(l.at)}</span><span className="w-24 shrink-0 text-slate-600">{l.userName}</span>{l.dealId && <span className="text-slate-500">[{dealName(l.dealId)}]</span>}<span>{l.action}</span></li>
          ))}
        </ul>
      </div>
    </div>
  )
}

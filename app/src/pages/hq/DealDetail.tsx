import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useData } from '../../lib/store'
import { WorkflowView } from '../../components/WorkflowView'
import { ContractStatusBadge, DealStatusBadge, Empty, InvoiceStatusBadge, PageTitle, PhaseStepper } from '../../components/ui'
import { PHASES } from '../../lib/workflow'
import { setDealStatus } from '../../lib/actions'
import { invoiceTotals } from '../../lib/billing'
import { fmtDate, fmtDateTime, yen } from '../../lib/utils'

export default function DealDetail() {
  const { id } = useParams()
  const { data, me, toast } = useData()
  const [tab, setTab] = useState<'wf' | 'contract' | 'invoice' | 'log' | 'info'>('wf')
  const deal = data.deals.find((d) => d.id === id)
  if (!deal || !me) return <Empty>FC進捗が見つかりません</Empty>
  const contracts = data.contracts.filter((c) => c.dealId === deal.id)
  const invoices = data.invoices.filter((i) => i.dealId === deal.id)
  const logs = data.auditLogs.filter((l) => l.dealId === deal.id).sort((a, b) => b.at.localeCompare(a.at))
  const store = data.stores.find((s) => s.dealId === deal.id)
  const userName = (uid: string) => data.users.find((u) => u.id === uid)?.name ?? '-'

  const withdraw = async () => {
    const reason = prompt('辞退・失注の理由を入力してください')
    if (reason) { await setDealStatus(deal, 'withdrawn', me, reason); toast('辞退・失注として記録しました') }
  }

  return (
    <div className="space-y-4">
      <PageTitle
        sub={<>{deal.applicantName}・{deal.area}・開業希望 {fmtDate(deal.targetOpenDate)}・開発担当 {userName(deal.salesUserId)}・SV {userName(deal.svUserId)}</>}
        actions={deal.status === 'active' ? <>
          <button className="btn-secondary" onClick={() => setDealStatus(deal, 'on_hold', me)}>保留</button>
          <button className="btn-danger" onClick={withdraw}>辞退・失注</button>
        </> : deal.status !== 'opened' ? <button className="btn-secondary" onClick={() => setDealStatus(deal, 'active', me)}>進行中に戻す</button> : store && <Link className="btn-secondary" to="/hq/stores">店舗を見る</Link>}
      >
        <Link to="/hq/deals" className="mr-2 text-sm font-normal text-teal-700">← 一覧</Link>
        {deal.companyName || deal.applicantName} <DealStatusBadge d={deal} />
      </PageTitle>
      {deal.status === 'withdrawn' && <div className="rounded-md bg-slate-100 p-3 text-sm">辞退・失注理由: {deal.withdrawReason}</div>}
      <div className="card"><PhaseStepper phase={deal.phase} status={deal.status} />
        <div className="mt-2 text-center text-sm text-slate-600">{deal.phase <= 6 ? <>現在: <b>P{deal.phase} {PHASES[deal.phase].name}</b>（必須タスクがすべて完了すると次のフェーズへ自動で進みます）</> : <b className="text-emerald-700">開業済み</b>}</div>
      </div>

      <div className="-mx-3 flex gap-1 overflow-x-auto border-b border-slate-200 px-3 md:mx-0 md:px-0">
        {([['wf', 'ワークフロー'], ['contract', `契約 (${contracts.length})`], ['invoice', `請求 (${invoices.length})`], ['log', '操作ログ'], ['info', '基本情報']] as const).map(([k, l]) => (
          <button key={k} className={`whitespace-nowrap px-4 py-2 text-sm ${tab === k ? 'border-b-2 border-teal-600 font-semibold text-teal-700' : 'text-slate-500'}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'wf' && <WorkflowView deal={deal} />}
      {tab === 'contract' && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full"><thead className="bg-slate-50"><tr><th className="th">契約書</th><th className="th">版</th><th className="th">状態</th><th className="th">作成</th><th className="th">締結</th></tr></thead>
            <tbody>{contracts.map((c) => (
              <tr key={c.id}><td className="td"><Link className="text-teal-700 hover:underline" to={`/hq/contracts/${c.id}`}>{c.title}</Link></td><td className="td">第{c.version}版</td><td className="td"><ContractStatusBadge s={c.status} /></td><td className="td">{fmtDate(c.createdAt)}</td><td className="td">{fmtDate(c.completedAt)}</td></tr>
            ))}</tbody></table>
          {!contracts.length && <Empty>契約書はまだありません</Empty>}
        </div>
      )}
      {tab === 'invoice' && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full"><thead className="bg-slate-50"><tr><th className="th">請求番号</th><th className="th">件名</th><th className="th">金額(税込)</th><th className="th">期限</th><th className="th">状態</th></tr></thead>
            <tbody>{invoices.map((i) => (
              <tr key={i.id}><td className="td">{i.number}</td><td className="td">{i.title}</td><td className="td">{yen(invoiceTotals(i).total)}</td><td className="td">{fmtDate(i.dueDate)}</td><td className="td"><InvoiceStatusBadge s={i.status} due={i.dueDate} /></td></tr>
            ))}</tbody></table>
          {!invoices.length && <Empty>請求はまだありません</Empty>}
        </div>
      )}
      {tab === 'log' && (
        <div className="card">
          <ul className="space-y-1 text-sm">{logs.map((l) => <li key={l.id} className="flex flex-wrap gap-x-3"><span className="w-32 shrink-0 text-xs text-slate-400">{fmtDateTime(l.at)}</span><span className="w-24 shrink-0">{l.userName}</span><span>{l.action}</span></li>)}</ul>
        </div>
      )}
      {tab === 'info' && (
        <div className="card text-sm">
          <dl className="grid grid-cols-[96px_1fr] gap-y-2 sm:grid-cols-[140px_1fr]">
            <dt className="text-slate-500">氏名</dt><dd>{deal.applicantName}</dd>
            <dt className="text-slate-500">法人名</dt><dd>{deal.companyName || '（未設立）'}</dd>
            <dt className="text-slate-500">メール</dt><dd>{deal.email}</dd>
            <dt className="text-slate-500">電話</dt><dd>{deal.phone}</dd>
            <dt className="text-slate-500">候補エリア</dt><dd>{deal.area}</dd>
            <dt className="text-slate-500">登録日</dt><dd>{fmtDate(deal.createdAt)}</dd>
            <dt className="text-slate-500">本部内部メモ</dt><dd className="whitespace-pre-wrap">{deal.memo || '-'}</dd>
          </dl>
        </div>
      )}
    </div>
  )
}

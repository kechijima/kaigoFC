import { useState } from 'react'
import { useData } from '../../lib/store'
import { freeeCsv, invoiceTotals } from '../../lib/billing'
import { reconcileInvoice } from '../../lib/actions'
import { Empty, InvoiceStatusBadge, Modal, PageTitle, Stat } from '../../components/ui'
import { downloadText, fmtDate, today, yen } from '../../lib/utils'
import type { Invoice } from '../../lib/types'

export default function Invoices() {
  const { data, me, toast } = useData()
  const [status, setStatus] = useState('')
  const [kind, setKind] = useState('')
  const [month, setMonth] = useState('')
  const [view, setView] = useState<Invoice | null>(null)
  if (!me) return null
  const canReconcile = me.hqRole === 'accounting' || me.hqRole === 'admin'
  const list = data.invoices
    .filter((i) => !status || i.status === status)
    .filter((i) => !kind || i.kind === kind)
    .filter((i) => !month || i.issueDate.startsWith(month))
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate))
  const sum = (arr: Invoice[]) => arr.reduce((s, i) => s + invoiceTotals(i).total, 0)

  const exportCsv = () => {
    downloadText(`freee_取引インポート_${today()}.csv`, freeeCsv(list))
    toast(`freee取込用CSVを出力しました（${list.length}件）`)
  }

  return (
    <div className="space-y-4">
      <PageTitle sub="加盟金・保証金・ロイヤリティの請求と入金消込"
        actions={<button className="btn-primary" onClick={exportCsv}>freee取込用CSVを出力（表示中 {list.length}件）</button>}>請求・入金管理</PageTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="入金報告あり（要消込）" value={data.invoices.filter((i) => i.status === 'reported').length} tone="amber" />
        <Stat label="未入金" value={yen(sum(data.invoices.filter((i) => i.status !== 'paid')))} />
        <Stat label="期限超過" value={data.invoices.filter((i) => i.status === 'issued' && i.dueDate < today()).length} tone="rose" />
        <Stat label="今月の入金済" value={yen(sum(data.invoices.filter((i) => i.paidAt?.startsWith(today().slice(0, 7)))))} tone="teal" />
      </div>
      <div className="flex flex-wrap gap-2">
        <select className="input w-40" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">すべての状態</option><option value="issued">未入金</option><option value="reported">入金報告あり</option><option value="paid">入金済</option></select>
        <select className="input w-40" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">すべての種別</option><option value="initial">加盟時（加盟金等）</option><option value="royalty">ロイヤリティ</option><option value="order">備品発注</option></select>
        <input className="input w-40" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="bg-slate-50"><tr><th className="th">請求番号</th><th className="th">請求先</th><th className="th">件名</th><th className="th text-right">金額(税込)</th><th className="th">発行日</th><th className="th">期限</th><th className="th">状態</th><th className="th"></th></tr></thead>
          <tbody>{list.map((i) => (
            <tr key={i.id}>
              <td className="td"><button className="text-teal-700 hover:underline" onClick={() => setView(i)}>{i.number}</button></td>
              <td className="td">{i.billToName}</td>
              <td className="td">{i.title}{i.reportedNote && i.status === 'reported' && <div className="text-xs text-amber-700">報告: {i.reportedNote}</div>}</td>
              <td className="td text-right">{yen(invoiceTotals(i).total)}</td>
              <td className="td">{fmtDate(i.issueDate)}</td>
              <td className="td">{fmtDate(i.dueDate)}</td>
              <td className="td"><InvoiceStatusBadge s={i.status} due={i.dueDate} /></td>
              <td className="td">{i.status !== 'paid' && <button className="btn-secondary" disabled={!canReconcile} title={canReconcile ? '' : '経理または本部長のみ'} onClick={async () => { await reconcileInvoice(i, me, data.tasks, data.deals); toast('入金を消込しました') }}>消込</button>}</td>
            </tr>
          ))}</tbody>
        </table>
        {!list.length && <Empty>該当する請求はありません</Empty>}
      </div>
      {view && <InvoiceModal inv={view} onClose={() => setView(null)} />}
    </div>
  )
}

export function InvoiceModal({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  const t = invoiceTotals(inv)
  return (
    <Modal title={`請求書 ${inv.number}`} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between"><div><div className="text-lg font-bold">{inv.billToName} 御中</div><div className="text-slate-500">{inv.title}</div></div><div className="text-right text-xs text-slate-500">発行日 {fmtDate(inv.issueDate)}<br />お支払期限 {fmtDate(inv.dueDate)}<br />株式会社サクラコーポレーション<br />登録番号 T0000000000000（モック）</div></div>
        <table className="w-full"><thead><tr className="border-b"><th className="py-1 text-left">品目</th><th className="py-1 text-right">税率</th><th className="py-1 text-right">金額(税抜)</th></tr></thead>
          <tbody>{inv.items.map((it, i) => <tr key={i} className="border-b border-slate-100"><td className="py-1">{it.name}</td><td className="py-1 text-right">{it.taxRate ? '10%' : '非課税'}</td><td className="py-1 text-right">{yen(it.amount)}</td></tr>)}</tbody></table>
        <div className="ml-auto w-48 space-y-0.5 text-right"><div>小計 {yen(t.subtotal)}</div><div>消費税 {yen(t.tax)}</div><div className="text-lg font-bold">合計 {yen(t.total)}</div></div>
        <div className="rounded bg-slate-50 p-2 text-xs text-slate-500">振込先: ○○銀行 本店営業部 普通 0000000 カ）サクラコーポレーション（モック）</div>
      </div>
    </Modal>
  )
}

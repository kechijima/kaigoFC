import { useData } from '../../lib/store'
import { issueRoyaltyInvoice } from '../../lib/actions'
import { Empty, PageTitle } from '../../components/ui'
import { fmtDate, yen } from '../../lib/utils'

export default function Stores() {
  const { data, me, toast } = useData()
  if (!me) return null
  return (
    <div className="space-y-4">
      <PageTitle sub="開業済み店舗と月次実績（業務システムから報告された実績をもとにロイヤリティを請求）">店舗・月次実績</PageTitle>
      {data.stores.map((s) => {
        const reports = data.monthlyReports.filter((r) => r.storeId === s.id).sort((a, b) => b.month.localeCompare(a.month))
        const owner = data.users.find((u) => u.id === s.ownerUserId)
        const helpers = data.helpers.filter((h) => h.storeId === s.id)
        const clients = data.clients.filter((c) => c.storeId === s.id)
        return (
          <div key={s.id} className="card">
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="text-lg font-bold">{s.name}</h2>
              <span className="badge bg-emerald-100 text-emerald-700">運営中</span>
              <span className="text-sm text-slate-500">{s.companyName}・オーナー {owner?.name}・開業 {fmtDate(s.openDate)}</span>
            </div>
            <div className="mt-1 text-xs text-slate-500">{s.address}・指定事業所番号 {s.officeNumber}・スタッフ {helpers.length}名・利用者 {clients.length}名・ロイヤリティ {s.royaltyRate}% + システム料 {yen(s.systemFee)}/月</div>
            <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[680px]">
              <thead className="bg-slate-50"><tr><th className="th">対象月</th><th className="th text-right">訪問件数</th><th className="th text-right">利用者数</th><th className="th text-right">月間売上(概算)</th><th className="th text-right">ロイヤリティ</th><th className="th">状態</th><th className="th"></th></tr></thead>
              <tbody>{reports.map((r) => (
                <tr key={r.id}>
                  <td className="td">{r.month}</td>
                  <td className="td text-right">{r.visitCount}</td>
                  <td className="td text-right">{r.clientCount}</td>
                  <td className="td text-right">{yen(r.revenue)}</td>
                  <td className="td text-right">{yen((r.revenue * s.royaltyRate) / 100)}</td>
                  <td className="td">{{ draft: <span className="badge bg-slate-100 text-slate-500">未報告</span>, submitted: <span className="badge bg-amber-100 text-amber-800">報告済・未請求</span>, invoiced: <span className="badge bg-emerald-100 text-emerald-700">請求済</span> }[r.status]}</td>
                  <td className="td">{r.status === 'submitted' && <button className="btn-primary" onClick={async () => { await issueRoyaltyInvoice(r, s, data.invoices, me, data.analyses.filter((a) => a.storeId === s.id && a.status === 'published' && a.publishedAt?.startsWith(r.month)).length); toast('ロイヤリティ請求書を発行しました') }}>ロイヤリティ請求を発行</button>}</td>
                </tr>
              ))}</tbody>
            </table></div>
            {!reports.length && <Empty>月次実績はまだありません</Empty>}
          </div>
        )
      })}
      {!data.stores.length && <Empty>運営中の店舗はありません</Empty>}
    </div>
  )
}

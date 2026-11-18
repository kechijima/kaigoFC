// 本部・加盟店で共通の画面（契約一覧・契約詳細・お知らせ）
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useData } from '../lib/store'
import { ContractView } from '../components/ContractView'
import { ContractStatusBadge, Empty, Field, PageTitle } from '../components/ui'
import { fmtDate, fmtDateTime, uid, nowIso } from '../lib/utils'
import { db } from '../lib/db'
import type { Notice } from '../lib/types'

export function ContractList() {
  const { data, me } = useData()
  const isHq = me?.kind === 'hq'
  const [status, setStatus] = useState('')
  const list = data.contracts
    .filter((c) => isHq || c.dealId === me?.dealId)
    .filter((c) => isHq || c.status !== 'draft' && c.status !== 'pending_approval')
    .filter((c) => !status || c.status === status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const dealName = (id: string) => { const d = data.deals.find((x) => x.id === id); return d ? d.companyName || d.applicantName : '' }
  return (
    <div>
      <PageTitle sub={isHq ? 'システム内で作成・承認・署名・締結まで完結します' : '本部との契約書'}
        actions={isHq && <select className="input w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">すべての状態</option><option value="draft">下書き</option><option value="pending_approval">社内承認待ち</option><option value="sent">加盟者署名待ち</option><option value="fc_signed">本部署名待ち</option><option value="completed">締結完了</option><option value="cancelled">取消</option>
        </select>}>
        {isHq ? '電子契約' : '契約書'}
      </PageTitle>
      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="bg-slate-50"><tr>{isHq && <th className="th">相手方</th>}<th className="th">契約書</th><th className="th">版</th><th className="th">状態</th><th className="th">署名期限</th><th className="th">締結日</th></tr></thead>
          <tbody>{list.map((c) => (
            <tr key={c.id}>
              {isHq && <td className="td">{dealName(c.dealId)}</td>}
              <td className="td"><Link className="text-teal-700 hover:underline" to={`${isHq ? '/hq' : '/fc'}/contracts/${c.id}`}>{c.title}</Link></td>
              <td className="td">第{c.version}版</td>
              <td className="td"><ContractStatusBadge s={c.status} /></td>
              <td className="td">{c.status === 'completed' ? '-' : fmtDate(c.signDueDate)}</td>
              <td className="td">{fmtDate(c.completedAt)}</td>
            </tr>
          ))}</tbody>
        </table>
        {!list.length && <Empty>契約書はありません</Empty>}
      </div>
    </div>
  )
}

export function ContractPage() {
  const { id } = useParams()
  const { data, me } = useData()
  const c = data.contracts.find((x) => x.id === id)
  if (!c || (me?.kind !== 'hq' && c.dealId !== me?.dealId)) return <Empty>契約書が見つかりません</Empty>
  return <ContractView contract={c} />
}

export function NoticeList() {
  const { data, me, toast } = useData()
  const [f, setF] = useState({ title: '', body: '', target: 'all' as Notice['target'] })
  if (!me) return null
  const isHq = me.kind === 'hq'
  const deal = data.deals.find((d) => d.id === me.dealId)
  const visible = data.notices.filter((n) => isHq || n.target === 'all' || (n.target === 'stores' ? deal?.status === 'opened' : deal?.status !== 'opened'))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const fcCount = (n: Notice) => data.users.filter((u) => u.kind === 'fc').filter((u) => {
    const d = data.deals.find((x) => x.id === u.dealId)
    return n.target === 'all' || (n.target === 'stores' ? d?.status === 'opened' : d?.status !== 'opened')
  }).length
  const post = async () => {
    const id = uid('n_')
    await db.set('notices', id, { id, ...f, createdAt: nowIso(), createdBy: me.id, readBy: [] })
    setF({ title: '', body: '', target: 'all' })
    toast('お知らせを配信しました')
  }
  return (
    <div className="space-y-4">
      <PageTitle>お知らせ</PageTitle>
      {isHq && (
        <div className="card space-y-2">
          <h2 className="font-semibold">新規配信</h2>
          <Field label="件名"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="本文"><textarea className="input" rows={3} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
          <div className="flex items-end gap-2">
            <Field label="配信先"><select className="input" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value as Notice['target'] })}><option value="all">全員</option><option value="stores">運営中の店舗</option><option value="fc_applicants">開業準備中の加盟者</option></select></Field>
            <button className="btn-primary" disabled={!f.title} onClick={post}>配信</button>
          </div>
        </div>
      )}
      {visible.map((n) => {
        const read = n.readBy.includes(me.id)
        return (
          <div key={n.id} className={`card ${!isHq && !read ? 'border-teal-300' : ''}`}>
            <div className="flex flex-wrap items-center gap-2">
              {!isHq && !read && <span className="badge bg-teal-600 text-white">未読</span>}
              <h3 className="font-semibold">{n.title}</h3>
              <span className="ml-auto text-xs text-slate-400">{fmtDateTime(n.createdAt)}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{n.body}</p>
            <div className="mt-2 text-xs text-slate-500">
              {isHq ? `配信先: ${{ all: '全員', stores: '運営中の店舗', fc_applicants: '開業準備中の加盟者' }[n.target]}・既読 ${n.readBy.length}/${fcCount(n)}` :
                !read && <button className="btn-secondary" onClick={() => db.update('notices', n.id, { readBy: [...n.readBy, me.id] })}>既読にする</button>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

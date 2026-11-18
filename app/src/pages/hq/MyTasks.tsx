import { useData } from '../../lib/store'
import { HQ_ROLE_LABEL, isAvailable, isClosed } from '../../lib/workflow'
import { TaskItem } from '../../components/TaskItem'
import { Empty, PageTitle } from '../../components/ui'
import { Link } from 'react-router-dom'
import type { Task } from '../../lib/types'

export default function MyTasks() {
  const { data, me } = useData()
  if (!me) return null
  const open = data.tasks.filter((t) => {
    const d = data.deals.find((x) => x.id === t.dealId)
    return d && d.status === 'active' && !isClosed(t) && isAvailable(t, data.tasks.filter((x) => x.dealId === d.id), d)
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const mine = open.filter((t) => t.assignee === 'hq' && t.hqRole === me.hqRole && t.status !== 'in_review')
  const reviews = open.filter((t) => t.status === 'in_review')
  const waitingFc = open.filter((t) => t.assignee === 'fc' && t.status !== 'in_review')

  const Group = ({ title, list, hint }: { title: string; list: Task[]; hint?: string }) => (
    <section className="space-y-2">
      <h2 className="font-semibold">{title} <span className="text-slate-400">{list.length}</span>{hint && <span className="ml-2 text-xs font-normal text-slate-500">{hint}</span>}</h2>
      {list.map((t) => {
        const d = data.deals.find((x) => x.id === t.dealId)!
        return (
          <div key={t.id}>
            <Link to={`/hq/deals/${d.id}`} className="text-xs text-teal-700 hover:underline">{d.companyName || d.applicantName}（P{d.phase}）</Link>
            <TaskItem task={t} deal={d} />
          </div>
        )
      })}
      {!list.length && <Empty>ありません</Empty>}
    </section>
  )

  return (
    <div className="space-y-6">
      <PageTitle sub={`${me.name}（${HQ_ROLE_LABEL[me.hqRole!]}）の担当分。ロールを切り替えると担当タスクが変わります。`}>マイタスク</PageTitle>
      <Group title="自分の担当タスク" list={mine} />
      <Group title="加盟者からの提出書類（確認待ち）" list={reviews} hint="内容を確認して「完了」または「差し戻し」" />
      <Group title="加盟者の対応待ち" list={waitingFc} hint="期限が近いものはフォローしてください" />
    </div>
  )
}

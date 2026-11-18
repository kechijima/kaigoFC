import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { useData } from '../../lib/store'
import { PHASES, isClosed } from '../../lib/workflow'
import { createDeal, moveDealPhase, phaseMoveImpact, setDealStatus } from '../../lib/actions'
import { DealStatusBadge, Field, Modal, PageTitle } from '../../components/ui'
import { addDays, fmtDate, today } from '../../lib/utils'
import type { Deal } from '../../lib/types'

// カンバンの列: フェーズ P0〜P6 ＋ 保留 ＋ 辞退・失注
type ColumnId = `phase-${number}` | 'hold' | 'withdrawn'
const COLUMNS: { id: ColumnId; title: string; tone: string }[] = [
  ...PHASES.map((p) => ({ id: `phase-${p.no}` as ColumnId, title: `P${p.no} ${p.name}`, tone: 'bg-slate-100' })),
  { id: 'hold', title: '保留', tone: 'bg-amber-50' },
  { id: 'withdrawn', title: '辞退・失注', tone: 'bg-slate-200/70' },
]
const columnOf = (d: Deal): ColumnId => (d.status === 'on_hold' ? 'hold' : d.status === 'withdrawn' ? 'withdrawn' : `phase-${d.phase}`)

interface PendingMove { deal: Deal; to: ColumnId }

export default function Deals() {
  const { data, me, toast } = useData()
  const [params] = useSearchParams()
  const [view, setView] = useState<'kanban' | 'table'>(params.get('phase') ? 'table' : 'kanban')
  const [q, setQ] = useState('')
  const [showClosed, setShowClosed] = useState(false)
  const [creating, setCreating] = useState(false)
  const [dragging, setDragging] = useState<Deal | null>(null)
  const [pending, setPending] = useState<PendingMove | null>(null)
  const justDragged = useRef(false)
  const phaseFilter = params.get('phase')
  const nav = useNavigate()

  // マウスは少し動かしたらドラッグ開始、タッチは長押しでドラッグ（通常のスワイプはスクロール）
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const deals = data.deals
    .filter((d) => d.status !== 'opened')
    .filter((d) => view === 'kanban' || showClosed || d.status !== 'withdrawn')
    .filter((d) => !phaseFilter || String(d.phase) === phaseFilter)
    .filter((d) => !q || `${d.applicantName}${d.companyName}${d.area}`.includes(q))
  const userName = (id: string) => data.users.find((u) => u.id === id)?.name ?? '-'
  const overdueCount = (d: Deal) => data.tasks.filter((t) => t.dealId === d.id && !isClosed(t) && t.phase <= d.phase && t.dueDate < today()).length

  const onDragStart = (e: DragStartEvent) => setDragging(data.deals.find((d) => d.id === e.active.id) ?? null)
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null)
    justDragged.current = true
    setTimeout(() => { justDragged.current = false }, 100)
    const deal = data.deals.find((d) => d.id === e.active.id)
    const to = e.over?.id as ColumnId | undefined
    if (!deal || !to || to === columnOf(deal)) return
    if (to === 'hold' && me) { setDealStatus(deal, 'on_hold', me).then(() => toast(`${deal.companyName || deal.applicantName} を保留にしました`)); return }
    setPending({ deal, to })
  }

  return (
    <div>
      <PageTitle
        sub={view === 'kanban' ? 'カードをドラッグしてフェーズ・状態を変更できます（スマホ・タブレットは長押しで移動）' : '問い合わせから開業までの進捗（開業済みは「店舗」）'}
        actions={<>
          <input className="input w-full sm:w-48" placeholder="名前・エリアで検索" value={q} onChange={(e) => setQ(e.target.value)} />
          {view === 'table' && <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />辞退を表示</label>}
          <div className="flex rounded-md border border-slate-300 bg-white text-sm">
            <button className={`px-3 py-1 ${view === 'kanban' ? 'bg-slate-800 text-white' : ''}`} onClick={() => setView('kanban')}>カンバン</button>
            <button className={`px-3 py-1 ${view === 'table' ? 'bg-slate-800 text-white' : ''}`} onClick={() => setView('table')}>一覧</button>
          </div>
          <button className="btn-primary" onClick={() => setCreating(true)}>＋ 新規リード登録</button>
        </>}
      >
        FC進捗{phaseFilter && <span className="ml-2 text-base font-normal text-slate-500">（P{phaseFilter} で絞込中 <Link to="/hq/deals" className="text-teal-700 underline">解除</Link>）</span>}
      </PageTitle>

      {view === 'kanban' ? (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
          <div className="-mx-3 flex snap-x gap-3 overflow-x-auto px-3 pb-4 md:mx-0 md:px-0">
            {COLUMNS.map((col) => {
              const list = deals.filter((d) => columnOf(d) === col.id)
              return (
                <KanbanColumn key={col.id} id={col.id} title={col.title} tone={col.tone} count={list.length}>
                  {list.map((d) => (
                    <DealCard key={d.id} deal={d} overdue={overdueCount(d)} salesName={userName(d.salesUserId)}
                      onOpen={() => { if (!justDragged.current) nav(`/hq/deals/${d.id}`) }} />
                  ))}
                </KanbanColumn>
              )
            })}
          </div>
          <DragOverlay>{dragging && <DealCardBody deal={dragging} overdue={overdueCount(dragging)} salesName={userName(dragging.salesUserId)} lifted />}</DragOverlay>
        </DndContext>
      ) : (
        <>
          {/* スマホ: カード表示 */}
          <div className="space-y-2 md:hidden">
            {deals.map((d) => (
              <Link key={d.id} to={`/hq/deals/${d.id}`} className="card block p-3">
                <div className="flex items-center justify-between gap-2"><span className="font-medium">{d.companyName || d.applicantName}</span><DealStatusBadge d={d} /></div>
                <div className="mt-1 text-xs text-slate-500">{d.applicantName}・{d.area}</div>
                <div className="mt-1 flex justify-between text-xs"><span>P{d.phase} {PHASES[d.phase]?.name}</span><span className="text-slate-500">開業希望 {fmtDate(d.targetOpenDate)}</span></div>
              </Link>
            ))}
          </div>
          {/* タブレット以上: 表 */}
          <div className="card hidden overflow-x-auto p-0 md:block">
            <table className="w-full">
              <thead className="bg-slate-50"><tr><th className="th">加盟希望者</th><th className="th">エリア</th><th className="th">フェーズ</th><th className="th">状態</th><th className="th">開業希望日</th><th className="th">担当</th><th className="th">期限超過</th></tr></thead>
              <tbody>
                {deals.map((d) => (
                  <tr key={d.id} className="cursor-pointer hover:bg-slate-50" onClick={() => nav(`/hq/deals/${d.id}`)}>
                    <td className="td"><div className="font-medium">{d.companyName || '（個人）'}</div><div className="text-xs text-slate-500">{d.applicantName}</div></td>
                    <td className="td">{d.area}</td>
                    <td className="td">P{d.phase} {PHASES[d.phase]?.name}</td>
                    <td className="td"><DealStatusBadge d={d} /></td>
                    <td className="td">{fmtDate(d.targetOpenDate)}</td>
                    <td className="td">{userName(d.salesUserId)}</td>
                    <td className="td">{overdueCount(d) || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {pending && me && <MoveConfirmModal pending={pending} onClose={() => setPending(null)} />}

      {creating && me && <NewDealModal onClose={() => setCreating(false)} onCreate={async (input) => {
        const id = await createDeal(input, me)
        toast('FC進捗に登録し、ワークフローを展開しました')
        setCreating(false)
        nav(`/hq/deals/${id}`)
      }} />}
    </div>
  )
}

function KanbanColumn({ id, title, tone, count, children }: { id: ColumnId; title: string; tone: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={`flex w-64 shrink-0 snap-start flex-col rounded-lg p-2 transition ${tone} ${isOver ? 'ring-2 ring-teal-500 ring-offset-1' : ''}`}>
      <div className="mb-2 px-1 text-sm font-semibold text-slate-600">{title} <span className="text-slate-400">{count}</span></div>
      <div className="min-h-24 flex-1 space-y-2">{children}</div>
    </div>
  )
}

function DealCard({ deal, overdue, salesName, onOpen }: { deal: Deal; overdue: number; salesName: string; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id })
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} onClick={onOpen}
      className={`cursor-grab touch-manipulation select-none active:cursor-grabbing ${isDragging ? 'opacity-30' : ''}`}>
      <DealCardBody deal={deal} overdue={overdue} salesName={salesName} />
    </div>
  )
}

function DealCardBody({ deal: d, overdue, salesName, lifted }: { deal: Deal; overdue: number; salesName: string; lifted?: boolean }) {
  return (
    <div className={`rounded-md border bg-white p-2.5 text-sm shadow-sm hover:border-teal-400 ${lifted ? 'rotate-2 border-teal-400 shadow-lg' : ''} ${d.status === 'withdrawn' ? 'opacity-60' : ''}`}>
      <div className="font-medium">{d.companyName || d.applicantName}</div>
      <div className="text-xs text-slate-500">{d.applicantName}・{d.area}</div>
      <div className="mt-1.5 flex items-center justify-between text-xs">
        <span className="text-slate-500">開業希望 {fmtDate(d.targetOpenDate)}</span>
        {d.status !== 'active' ? <span className="text-slate-500">P{d.phase}</span> : overdue > 0 && <span className="badge bg-rose-100 text-rose-700">超過{overdue}</span>}
      </div>
      <div className="mt-1 text-xs text-slate-400">担当 {salesName}</div>
    </div>
  )
}

function MoveConfirmModal({ pending, onClose }: { pending: PendingMove; onClose: () => void }) {
  const { data, me, toast } = useData()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const { deal, to } = pending
  const name = deal.companyName || deal.applicantName

  if (to === 'withdrawn') {
    return (
      <Modal title={`${name} を辞退・失注にする`} onClose={onClose}>
        <Field label="辞退・失注の理由 *"><textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>キャンセル</button>
          <button className="btn-danger" disabled={!reason || busy} onClick={async () => { setBusy(true); await setDealStatus(deal, 'withdrawn', me!, reason); toast('辞退・失注として記録しました'); onClose() }}>辞退・失注にする</button>
        </div>
      </Modal>
    )
  }

  const target = Number(to.replace('phase-', ''))
  const samePhase = target === deal.phase
  const impact = phaseMoveImpact(deal, target, data.tasks)
  const run = async () => {
    setBusy(true)
    try {
      if (!samePhase) await moveDealPhase(deal, target, data.tasks, me!)
      else await setDealStatus(deal, 'active', me!)
      toast(`${name} を P${target} ${PHASES[target].name} に移動しました`)
      onClose()
    } finally { setBusy(false) }
  }
  return (
    <Modal title={`${name} を P${target} ${PHASES[target].name} に移動`} onClose={onClose}>
      <div className="space-y-2 text-sm">
        {deal.status !== 'active' && <p>状態を「進行中」に戻します。</p>}
        {!samePhase && (impact.forward ? (
          <p>P{deal.phase} → P{target} に進めます。{impact.count > 0 ? <>前のフェーズの未完了タスク <b>{impact.count}件</b> は「スキップ」として記録されます。</> : '未完了のタスクはありません。'}</p>
        ) : (
          <p>P{deal.phase} → P{target} に戻します。{impact.count > 0 ? <>P{target} 以降の完了済みタスク <b>{impact.count}件</b> を未完了に戻します（契約・請求・入金のタスクはそのまま）。</> : ''}</p>
        ))}
        <p className="text-xs text-slate-500">操作は操作ログに残ります。</p>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>キャンセル</button>
        <button className="btn-primary" disabled={busy} onClick={run}>移動する</button>
      </div>
    </Modal>
  )
}

function NewDealModal({ onClose, onCreate }: { onClose: () => void; onCreate: (d: Pick<Deal, 'applicantName' | 'companyName' | 'email' | 'phone' | 'area' | 'prefecture' | 'targetOpenDate' | 'memo'>) => void }) {
  const [f, setF] = useState({ applicantName: '', companyName: '', email: '', phone: '', area: '', prefecture: '東京都', targetOpenDate: addDays(today(), 240), memo: '' })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  return (
    <Modal title="新規リード登録" onClose={onClose}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="氏名 *"><input className="input" value={f.applicantName} onChange={set('applicantName')} /></Field>
        <Field label="法人名（未設立なら空欄）"><input className="input" value={f.companyName} onChange={set('companyName')} /></Field>
        <Field label="メール"><input className="input" type="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="電話"><input className="input" type="tel" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="都道府県"><select className="input" value={f.prefecture} onChange={set('prefecture')}>{['東京都', '神奈川県', '埼玉県', '千葉県'].map((p) => <option key={p}>{p}</option>)}</select></Field>
        <Field label="候補エリア *"><input className="input" placeholder="例: 東京都中野区" value={f.area} onChange={set('area')} /></Field>
        <Field label="開業希望日"><input className="input" type="date" value={f.targetOpenDate} onChange={set('targetOpenDate')} /></Field>
        <div className="sm:col-span-2"><Field label="メモ（本部内部）"><textarea className="input" rows={2} value={f.memo} onChange={set('memo')} /></Field></div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>キャンセル</button>
        <button className="btn-primary" disabled={!f.applicantName || !f.area} onClick={() => onCreate({ ...f, email: f.email || `lead${Date.now() % 10000}@fc.example.jp` })}>登録してワークフローを開始</button>
      </div>
    </Modal>
  )
}

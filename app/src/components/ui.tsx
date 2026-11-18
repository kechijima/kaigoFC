import type { ReactNode } from 'react'
import type { ContractStatus, InvoiceStatus, TaskStatus, Task, Deal } from '../lib/types'
import { PHASES, isClosed } from '../lib/workflow'
import { today, diffDays } from '../lib/utils'

export function PageTitle({ children, actions, sub }: { children: ReactNode; actions?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 className="text-xl font-bold">{children}</h1>
        {sub && <div className="mt-0.5 text-sm text-slate-500">{sub}</div>}
      </div>
      {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{actions}</div>}
    </div>
  )
}

const TASK_STATUS: Record<TaskStatus, [string, string]> = {
  todo: ['未完了', 'bg-slate-100 text-slate-600'],
  in_review: ['確認待ち', 'bg-amber-100 text-amber-800'],
  rejected: ['差し戻し', 'bg-rose-100 text-rose-700'],
  done: ['完了', 'bg-emerald-100 text-emerald-700'],
  skipped: ['スキップ', 'bg-slate-100 text-slate-400'],
}
export const TaskStatusBadge = ({ s }: { s: TaskStatus }) => <span className={`badge ${TASK_STATUS[s][1]}`}>{TASK_STATUS[s][0]}</span>

export const CONTRACT_STATUS: Record<ContractStatus, [string, string]> = {
  draft: ['下書き', 'bg-slate-100 text-slate-600'],
  pending_approval: ['社内承認待ち', 'bg-amber-100 text-amber-800'],
  sent: ['署名待ち（加盟者）', 'bg-sky-100 text-sky-700'],
  fc_signed: ['署名待ち（本部）', 'bg-indigo-100 text-indigo-700'],
  completed: ['締結完了', 'bg-emerald-100 text-emerald-700'],
  cancelled: ['取消', 'bg-slate-100 text-slate-400'],
}
export const ContractStatusBadge = ({ s }: { s: ContractStatus }) => <span className={`badge ${CONTRACT_STATUS[s][1]}`}>{CONTRACT_STATUS[s][0]}</span>

const INV_STATUS: Record<InvoiceStatus, [string, string]> = {
  issued: ['未入金', 'bg-slate-100 text-slate-600'],
  reported: ['入金報告あり', 'bg-amber-100 text-amber-800'],
  paid: ['入金済', 'bg-emerald-100 text-emerald-700'],
}
export const InvoiceStatusBadge = ({ s, due }: { s: InvoiceStatus; due?: string }) =>
  s === 'issued' && due && due < today()
    ? <span className="badge bg-rose-100 text-rose-700">期限超過</span>
    : <span className={`badge ${INV_STATUS[s][1]}`}>{INV_STATUS[s][0]}</span>

export const DealStatusBadge = ({ d }: { d: Deal }) => {
  const m = { active: ['進行中', 'bg-sky-100 text-sky-700'], on_hold: ['保留', 'bg-amber-100 text-amber-800'], withdrawn: ['辞退・失注', 'bg-slate-200 text-slate-500'], opened: ['運営中', 'bg-emerald-100 text-emerald-700'] }[d.status]
  return <span className={`badge ${m[1]}`}>{m[0]}</span>
}

export function DueLabel({ task }: { task: Task }) {
  if (isClosed(task)) return <span className="text-xs text-slate-400">期限 {task.dueDate.slice(5).replace('-', '/')}</span>
  const d = diffDays(task.dueDate, today())
  const cls = d < 0 ? 'text-rose-600 font-semibold' : d <= 7 ? 'text-amber-600 font-semibold' : 'text-slate-500'
  return <span className={`text-xs ${cls}`}>期限 {task.dueDate.slice(5).replace('-', '/')}{d < 0 ? `（${-d}日超過）` : d <= 7 ? `（あと${d}日）` : ''}</span>
}

export function PhaseStepper({ phase, status, compact }: { phase: number; status?: Deal['status']; compact?: boolean }) {
  return (
    <ol className="flex w-full items-center">
      {PHASES.map((p, i) => {
        const done = phase > p.no
        const cur = phase === p.no && status !== 'withdrawn'
        return (
          <li key={p.no} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold sm:h-7 sm:w-7 ${done ? 'bg-teal-600 text-white' : cur ? 'bg-white text-teal-700 ring-2 ring-teal-600' : 'bg-slate-200 text-slate-500'}`}>
                {done ? '✓' : p.no}
              </div>
              {!compact && <div className={`whitespace-nowrap text-[11px] ${cur ? 'font-bold text-teal-700' : 'hidden text-slate-500 sm:block'}`}>{p.short}</div>}
            </div>
            {i < PHASES.length - 1 && <div className={`mx-0.5 h-0.5 flex-1 sm:mx-1 ${done ? 'bg-teal-600' : 'bg-slate-200'}`} />}
          </li>
        )
      })}
    </ol>
  )
}

export function Stat({ label, value, tone = 'slate', hint }: { label: string; value: ReactNode; tone?: 'slate' | 'rose' | 'amber' | 'teal'; hint?: string }) {
  const c = { slate: 'text-slate-800', rose: 'text-rose-600', amber: 'text-amber-600', teal: 'text-teal-700' }[tone]
  return (
    <div className="card">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${c}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  )
}

export function Modal({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center overflow-y-auto bg-black/30 p-0 sm:items-start sm:p-4" onClick={onClose}>
      <div className={`card w-full rounded-b-none pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mt-10 sm:rounded-b-lg sm:pb-4 ${wide ? 'max-w-3xl' : 'max-w-lg'}`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">{title}</h2>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block text-sm">
    <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
    {children}
  </label>
)

export const Empty = ({ children }: { children: ReactNode }) => <div className="py-6 text-center text-sm text-slate-400">{children}</div>

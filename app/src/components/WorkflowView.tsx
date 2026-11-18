import { useState } from 'react'
import type { Deal } from '../lib/types'
import { useData } from '../lib/store'
import { PHASES, phaseProgress } from '../lib/workflow'
import { TaskItem } from './TaskItem'

export function WorkflowView({ deal }: { deal: Deal }) {
  const { data, me } = useData()
  const isHq = me?.kind === 'hq'
  const tasks = data.tasks
    .filter((t) => t.dealId === deal.id && (isHq || !t.hqOnly))
    .sort((a, b) => a.order - b.order)
  const [openPhases, setOpenPhases] = useState<Set<number>>(new Set([Math.min(deal.phase, 6)]))
  const toggle = (n: number) => setOpenPhases((s) => { const x = new Set(s); if (x.has(n)) x.delete(n); else x.add(n); return x })

  return (
    <div className="space-y-2">
      {PHASES.map((p) => {
        const list = tasks.filter((t) => t.phase === p.no)
        const prog = phaseProgress(list, p.no)
        const cur = deal.phase === p.no
        const done = deal.phase > p.no
        return (
          <div key={p.no} className={`rounded-lg border ${cur ? 'border-teal-400' : 'border-slate-200'} bg-white`}>
            <button className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => toggle(p.no)}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${done ? 'bg-teal-600 text-white' : cur ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-500'}`}>{done ? '✓' : p.no}</span>
              <span className="flex-1 font-semibold">P{p.no} {p.name}{cur && <span className="ml-2 badge bg-teal-600 text-white">現在</span>}</span>
              <span className="text-xs text-slate-500">{prog.done}/{prog.total} 完了</span>
              <div className="h-1.5 w-24 rounded bg-slate-100"><div className="h-1.5 rounded bg-teal-500" style={{ width: `${prog.total ? (prog.done / prog.total) * 100 : 0}%` }} /></div>
              <span className="text-slate-400">{openPhases.has(p.no) ? '▲' : '▼'}</span>
            </button>
            {openPhases.has(p.no) && (
              <div className="space-y-1.5 px-3 pb-3">
                {list.map((t) => <TaskItem key={t.id} task={t} deal={deal} />)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

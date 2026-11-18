// ワークフローのタスク1件。本部・加盟店の両画面で使い、見ている人と状態に応じて操作ボタンを出し分ける。
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Deal, Task } from '../lib/types'
import { useData } from '../lib/store'
import { HQ_ROLE_LABEL, TASK_TYPE_LABEL, isAvailable, isClosed } from '../lib/workflow'
import * as A from '../lib/actions'
import { DEFAULT_TERMS } from '../lib/contracts'
import { invoiceTotals } from '../lib/billing'
import { ContractStatusBadge, DueLabel, InvoiceStatusBadge, TaskStatusBadge } from './ui'
import { fmtDateTime, yen } from '../lib/utils'

export function TaskItem({ task, deal, defaultOpen }: { task: Task; deal: Deal; defaultOpen?: boolean }) {
  const { data, me, toast } = useData()
  const [open, setOpen] = useState(!!defaultOpen)
  const [fileName, setFileName] = useState('')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  if (!me) return null
  const viewer = me.kind === 'hq' ? 'hq' : 'fc'
  const dealTasks = data.tasks.filter((t) => t.dealId === deal.id)
  const available = isAvailable(task, dealTasks, deal)
  const contract = data.contracts.find((c) => c.id === task.contractId)
  const invoice = data.invoices.find((i) => i.id === task.invoiceId)
  const mine = task.assignee === viewer
  const base = viewer === 'hq' ? '/hq' : '/fc'
  const blockers = task.dependsOn.map((c) => dealTasks.find((t) => t.code === c)).filter((t) => t && !isClosed(t)) as Task[]

  const run = async (fn: () => Promise<unknown>, msg?: string) => {
    setBusy(true)
    try { await fn(); if (msg) toast(msg) } catch (e) { toast('エラー: ' + (e as Error).message) } finally { setBusy(false) }
  }

  const actions: React.ReactNode[] = []
  if (available && !isClosed(task)) {
    const t = task.type
    if ((t === 'work' || t === 'confirm') && mine) {
      actions.push(<button key="c" className="btn-primary" disabled={busy} onClick={() => run(() => A.completeTask(task, deal, data.tasks, me), 'タスクを完了しました')}>{t === 'confirm' ? '確認しました（完了）' : '完了にする'}</button>)
    }
    if (t === 'submit') {
      if (viewer === 'fc' && task.status !== 'in_review') {
        actions.push(
          <div key="s" className="flex w-full flex-col gap-2 rounded-md bg-slate-50 p-3">
            <div className="text-xs text-slate-500">提出ファイル（モック: ファイル名のみ記録します）</div>
            <input type="file" className="text-sm" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')} />
            <textarea className="input" rows={2} placeholder="本部へのコメント（任意）" value={comment} onChange={(e) => setComment(e.target.value)} />
            <div><button className="btn-primary" disabled={busy || !fileName} onClick={() => run(async () => { await A.submitTask(task, fileName, comment, me); setFileName(''); setComment('') }, '提出しました。本部の確認をお待ちください')}>提出する</button></div>
          </div>,
        )
      }
      if (viewer === 'hq' && task.status === 'in_review') {
        actions.push(<button key="a" className="btn-primary" disabled={busy} onClick={() => run(() => A.completeTask(task, deal, data.tasks, me), '承認して完了にしました')}>内容OK（完了）</button>)
        actions.push(<button key="r" className="btn-danger" disabled={busy || !comment} onClick={() => run(async () => { await A.rejectTask(task, comment, me); setComment('') }, '差し戻しました')}>差し戻し</button>)
      }
    }
    if (t === 'approve' && viewer === 'hq') {
      const can = me.hqRole === 'admin'
      actions.push(<button key="a" className="btn-primary" disabled={busy || !can} title={can ? '' : '本部長のみ承認できます'} onClick={() => run(() => A.completeTask(task, deal, data.tasks, me), '承認しました')}>承認する</button>)
      actions.push(<button key="r" className="btn-danger" disabled={busy || !can || !comment} onClick={() => run(async () => { await A.rejectTask(task, comment, me); setComment('') }, '差し戻しました')}>差し戻し</button>)
      if (!can) actions.push(<span key="n" className="text-xs text-slate-500">※ 承認は本部長（山田）に切り替えて操作してください</span>)
    }
    if (t === 'sign') {
      if (!contract || contract.status === 'cancelled') {
        if (viewer === 'hq') actions.push(<button key="cc" className="btn-primary" disabled={busy} onClick={() => run(() => A.createContract(task, deal, me, { ...DEFAULT_TERMS, territory: deal.area }), '契約書の下書きを作成しました')}>契約書を作成</button>)
        else actions.push(<span key="w" className="text-sm text-slate-500">本部が契約書を準備中です</span>)
      } else {
        actions.push(<Link key="o" className="btn-primary" to={`${base}/contracts/${contract.id}`}>{viewer === 'fc' && contract.status === 'sent' ? '内容を確認して署名する' : '契約書を開く'}</Link>)
      }
    }
    if (t === 'invoice' && viewer === 'hq') {
      actions.push(<button key="i" className="btn-primary" disabled={busy} onClick={() => run(() => A.issueInitialInvoice(task, deal, data.contracts, data.invoices, data.tasks, me), '請求書を発行しました')}>契約条件から請求書を発行</button>)
    }
    if (t === 'payment' && invoice) {
      if (viewer === 'fc' && invoice.status === 'issued') {
        actions.push(
          <div key="p" className="flex w-full flex-col gap-2 rounded-md bg-slate-50 p-3">
            <input className="input" placeholder="振込日・振込名義など" value={comment} onChange={(e) => setComment(e.target.value)} />
            <div><button className="btn-primary" disabled={busy} onClick={() => run(async () => { await A.reportPayment(invoice, comment, me); setComment('') }, '入金を報告しました')}>入金を報告する</button></div>
          </div>,
        )
      }
      if (viewer === 'hq' && invoice.status !== 'paid') {
        actions.push(<button key="r" className="btn-primary" disabled={busy || me.hqRole !== 'accounting' && me.hqRole !== 'admin'} onClick={() => run(() => A.reconcileInvoice(invoice, me, data.tasks, data.deals), '入金を消込しました')}>入金を確認・消込</button>)
      }
    }
    if (viewer === 'hq' && !task.required) {
      actions.push(<button key="sk" className="btn-secondary" disabled={busy} onClick={() => run(() => A.skipTask(task, deal, data.tasks, me))}>不要（スキップ）</button>)
    }
  }
  if (viewer === 'hq' && isClosed(task) && me.hqRole === 'admin' && task.type !== 'sign' && task.type !== 'payment' && task.type !== 'invoice') {
    actions.push(<button key="re" className="btn-secondary" disabled={busy} onClick={() => run(() => A.reopenTask(task, deal, data.tasks, me))}>未完了に戻す</button>)
  }

  const needsAction = available && !isClosed(task) && (mine || (viewer === 'hq' && task.status === 'in_review'))
  return (
    <div className={`rounded-md border ${needsAction ? 'border-teal-300 bg-teal-50/40' : 'border-slate-200 bg-white'} ${!available && !isClosed(task) ? 'opacity-60' : ''}`}>
      <button className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left" onClick={() => setOpen(!open)}>
        <span className="w-9 text-xs text-slate-400">{task.code}</span>
        <TaskStatusBadge s={task.status} />
        <span className={`w-full text-sm sm:w-auto sm:flex-1 ${isClosed(task) ? 'text-slate-400 line-through' : 'font-medium'}`}>{task.title}{!task.required && <span className="ml-1 text-xs text-slate-400">（任意）</span>}</span>
        <span className="badge bg-white text-slate-500 ring-1 ring-slate-200">{TASK_TYPE_LABEL[task.type]}</span>
        <span className={`badge ${task.assignee === 'hq' ? 'bg-indigo-50 text-indigo-700' : 'bg-orange-50 text-orange-700'}`}>
          {task.assignee === 'hq' ? `本部${task.hqRole ? '・' + HQ_ROLE_LABEL[task.hqRole] : ''}` : '加盟者'}
        </span>
        {task.hqOnly && <span className="badge bg-slate-700 text-white">本部のみ</span>}
        <DueLabel task={task} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-slate-100 px-3 py-3 text-sm">
          {task.description && <p className="text-slate-600">{task.description}</p>}
          {!available && !isClosed(task) && (
            <p className="text-xs text-slate-500">
              {deal.phase < task.phase ? '前のフェーズが完了すると着手できます。' : `前提タスク待ち: ${blockers.map((b) => `${b.code} ${b.title}`).join(' / ')}`}
            </p>
          )}
          {contract && (
            <div className="flex items-center gap-2 text-xs"><span className="text-slate-500">契約書:</span>{contract.title} 第{contract.version}版 <ContractStatusBadge s={contract.status} /></div>
          )}
          {invoice && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500">請求:</span>{invoice.number} {yen(invoiceTotals(invoice).total)}（期限 {invoice.dueDate}）<InvoiceStatusBadge s={invoice.status} due={invoice.dueDate} />
              {invoice.reportedNote && <span className="text-slate-500">報告: {invoice.reportedNote}</span>}
            </div>
          )}
          {task.attachments.length > 0 && (
            <div className="text-xs"><span className="text-slate-500">提出ファイル: </span>{task.attachments.map((a, i) => <span key={i} className="mr-2 rounded bg-slate-100 px-1.5 py-0.5">📄 {a}</span>)}</div>
          )}
          {task.comments.length > 0 && (
            <ul className="space-y-1">
              {task.comments.map((c, i) => (
                <li key={i} className="rounded bg-slate-50 px-2 py-1 text-xs"><span className="font-medium">{c.userName}</span> <span className="text-slate-400">{fmtDateTime(c.at)}</span><div className="whitespace-pre-wrap">{c.text}</div></li>
              ))}
            </ul>
          )}
          {!isClosed(task) && task.type !== 'payment' && (task.type !== 'submit' || viewer === 'hq') && (
            <div className="flex gap-2">
              <input className="input" placeholder={viewer === 'hq' && (task.status === 'in_review' || task.type === 'approve') ? 'コメント（差し戻し時は必須）' : 'コメント・質問'} value={comment} onChange={(e) => setComment(e.target.value)} />
              <button className="btn-secondary shrink-0" disabled={!comment || busy} onClick={() => run(async () => { await A.addComment(task, comment, me); setComment('') })}>コメント</button>
            </div>
          )}
          {actions.length > 0 && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          {task.completedAt && <div className="text-xs text-slate-400">完了: {fmtDateTime(task.completedAt)} {data.users.find((u) => u.id === task.completedBy)?.name}</div>}
        </div>
      )}
    </div>
  )
}

// 業務操作。画面からはここの関数を呼ぶ。すべての操作は操作ログに残す。
import { db } from './db'
import type {
  Contract, ContractTerms, Deal, Helper, Invoice, MonthlyReport, StoreInfo, Task, User, Visit, VisitRecord,
} from './types'
import { computePhase, instantiateTasks } from './workflow'
import { CONTRACT_TEMPLATES, DEFAULT_TERMS, HQ_REP } from './contracts'
import { initialInvoiceItems, revenueOf } from './billing'
import { addDays, nowIso, sha256, today, uid } from './utils'

export async function log(me: User, action: string, dealId?: string) {
  const id = uid('log_')
  await db.set('auditLogs', id, { id, at: nowIso(), userId: me.id, userName: me.name, dealId, action })
}

const nextInvoiceNumber = (invoices: Invoice[]) => {
  const y = today().slice(0, 4)
  const max = invoices.filter((i) => i.number.startsWith(`INV-${y}`)).map((i) => Number(i.number.slice(-4))).reduce((a, b) => Math.max(a, b), 0)
  return `INV-${y}-${String(max + 1).padStart(4, '0')}`
}

// ---------- ワークフロー ----------

/** タスク更新後にフェーズを再計算。全完了なら開業処理 */
async function recalcDeal(deal: Deal, tasks: Task[], me: User) {
  const phase = computePhase(tasks)
  if (phase === 7 && deal.status === 'active') {
    await openStore(deal, me)
    return
  }
  if (phase !== deal.phase) {
    await db.update('deals', deal.id, { phase })
    if (phase > deal.phase) await log(me, `フェーズが「${phase}」に進みました`, deal.id)
  }
}

async function openStore(deal: Deal, me: User) {
  const storeId = `s_${deal.id}`
  const store: StoreInfo = {
    id: storeId, dealId: deal.id, name: `ケアリンク${deal.area.replace(/^.+?[都道府県]/, '').replace(/[市区町村].*$/, '')}`,
    companyName: deal.companyName || deal.applicantName, ownerUserId: deal.ownerUserId!, address: deal.area,
    prefecture: deal.prefecture, officeNumber: '（指定通知書の番号を登録）', openDate: today(), status: 'open',
    royaltyRate: DEFAULT_TERMS.royaltyRate, systemFee: DEFAULT_TERMS.systemFee,
  }
  await db.set('stores', storeId, store)
  await db.update('deals', deal.id, { status: 'opened', phase: 7, storeId })
  if (deal.ownerUserId) await db.update('users', deal.ownerUserId, { storeId })
  // 管理者アカウントを1件作成して業務システムを使えるようにする
  const helper: Helper = { id: `h_${storeId}_0`, storeId, name: deal.applicantName, qualification: '管理者', employment: '常勤', userId: `u_h_${storeId}_0` }
  await db.set('helpers', helper.id, helper)
  await db.set('users', helper.userId!, { id: helper.userId!, name: deal.applicantName, email: deal.email, kind: 'field', storeId, fieldRole: 'manager' })
  await log(me, `開業しました（店舗: ${store.name}）`, deal.id)
}

async function patchTask(task: Task, patch: Partial<Task>, deal: Deal, allTasks: Task[], me: User) {
  await db.update('tasks', task.id, patch)
  const next = allTasks.filter((t) => t.dealId === deal.id).map((t) => (t.id === task.id ? { ...t, ...patch } : t))
  await recalcDeal(deal, next, me)
}

export async function completeTask(task: Task, deal: Deal, allTasks: Task[], me: User) {
  await log(me, `タスク完了: ${task.code} ${task.title}`, deal.id)
  await patchTask(task, { status: 'done', completedAt: nowIso(), completedBy: me.id }, deal, allTasks, me)
}

export async function skipTask(task: Task, deal: Deal, allTasks: Task[], me: User) {
  await log(me, `タスクをスキップ: ${task.code} ${task.title}`, deal.id)
  await patchTask(task, { status: 'skipped', completedAt: nowIso(), completedBy: me.id }, deal, allTasks, me)
}

export async function reopenTask(task: Task, deal: Deal, allTasks: Task[], me: User) {
  await log(me, `タスクを未完了に戻す: ${task.code}`, deal.id)
  await patchTask(task, { status: 'todo', completedAt: undefined, completedBy: undefined }, deal, allTasks, me)
}

export async function submitTask(task: Task, fileName: string, comment: string, me: User) {
  const comments = comment ? [...task.comments, { at: nowIso(), userId: me.id, userName: me.name, text: comment }] : task.comments
  await db.update('tasks', task.id, { status: 'in_review', attachments: [...task.attachments, fileName], comments })
  await log(me, `書類を提出: ${task.code} ${fileName}`, task.dealId)
}

export async function rejectTask(task: Task, comment: string, me: User) {
  await db.update('tasks', task.id, {
    status: 'rejected',
    comments: [...task.comments, { at: nowIso(), userId: me.id, userName: me.name, text: `【差し戻し】${comment}` }],
  })
  await log(me, `差し戻し: ${task.code} ${comment}`, task.dealId)
}

export async function addComment(task: Task, text: string, me: User) {
  await db.update('tasks', task.id, { comments: [...task.comments, { at: nowIso(), userId: me.id, userName: me.name, text }] })
}

export async function createDeal(input: Pick<Deal, 'applicantName' | 'companyName' | 'email' | 'phone' | 'area' | 'prefecture' | 'targetOpenDate' | 'memo'>, me: User) {
  const id = uid('d_')
  const deal: Deal = {
    ...input, id, phase: 0, status: 'active', salesUserId: me.id, svUserId: 'u_takahashi',
    createdAt: nowIso(), ownerUserId: `u_fc_${id}`,
  }
  await db.set('deals', id, deal)
  await db.set('users', deal.ownerUserId!, { id: deal.ownerUserId!, name: deal.applicantName, email: deal.email, kind: 'fc', dealId: id })
  for (const t of instantiateTasks(deal)) await db.set('tasks', t.id, t)
  await log(me, 'FC進捗に登録', id)
  return id
}

export async function setDealStatus(deal: Deal, status: Deal['status'], me: User, reason?: string) {
  await db.update('deals', deal.id, { status, withdrawReason: reason })
  await log(me, status === 'withdrawn' ? `辞退・失注: ${reason}` : status === 'on_hold' ? '保留にしました' : '進行中に戻しました', deal.id)
}

// ---------- 電子契約 ----------

export async function createContract(task: Task, deal: Deal, me: User, terms: ContractTerms) {
  const tpl = CONTRACT_TEMPLATES[task.contractTemplateId!]
  const id = uid('c_')
  const c: Contract = {
    id, dealId: deal.id, templateId: task.contractTemplateId!, title: tpl.title, body: tpl.render(deal, terms),
    status: 'draft', version: 1, terms,
    signers: [{ party: 'fc', name: deal.applicantName, email: deal.email }, { party: 'hq', name: HQ_REP, email: 'yamada@hq.example.jp' }],
    history: [{ at: nowIso(), userName: me.name, action: '契約書を作成' }],
    createdAt: nowIso(), signDueDate: addDays(today(), 7),
  }
  await db.set('contracts', id, c)
  await db.update('tasks', task.id, { contractId: id })
  await log(me, `契約書を作成: ${tpl.title}`, deal.id)
  return id
}

export async function updateContractTerms(c: Contract, deal: Deal, terms: ContractTerms, me: User) {
  const body = CONTRACT_TEMPLATES[c.templateId].render(deal, terms)
  await db.update('contracts', c.id, {
    terms, body, version: c.version + 1,
    history: [...c.history, { at: nowIso(), userName: me.name, action: `条件を修正（第${c.version + 1}版）` }],
  })
}

export async function contractTransition(c: Contract, to: Contract['status'], me: User, action: string, note?: string) {
  await db.update('contracts', c.id, { status: to, history: [...c.history, { at: nowIso(), userName: me.name, action, note }] })
  await log(me, `${c.title}: ${action}${note ? `（${note}）` : ''}`, c.dealId)
}

/** メール認証コードを発行（モックでは送信せず画面に表示） */
export async function sendOtp(c: Contract, party: 'fc' | 'hq') {
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const signer = c.signers.find((s) => s.party === party)!
  await db.update('contracts', c.id, { pendingOtp: { code, email: signer.email, expiresAt: new Date(Date.now() + 10 * 60000).toISOString() } })
  return { code, email: signer.email }
}

export async function signContract(c: Contract, party: 'fc' | 'hq', signatureName: string, otp: string, me: User, tasks: Task[], deal: Deal) {
  if (!c.pendingOtp || c.pendingOtp.code !== otp) throw new Error('認証コードが正しくありません')
  if (new Date(c.pendingOtp.expiresAt) < new Date()) throw new Error('認証コードの有効期限が切れています')
  const at = nowIso()
  const signers = c.signers.map((s) =>
    s.party === party ? { ...s, otpVerifiedAt: at, signedAt: at, signatureName, userAgent: navigator.userAgent, ip: '（モック）127.0.0.1' } : s,
  )
  const done = signers.every((s) => s.signedAt)
  const patch: Partial<Contract> = {
    signers, pendingOtp: undefined,
    status: done ? 'completed' : 'fc_signed',
    history: [...c.history, { at, userName: me.name, action: party === 'fc' ? '加盟者が署名' : '本部が署名（締結完了）' }],
  }
  if (done) {
    patch.completedAt = at
    patch.hash = await sha256(c.body + JSON.stringify(signers))
  }
  await db.update('contracts', c.id, patch)
  await log(me, `${c.title}に署名${done ? '（締結完了）' : ''}`, c.dealId)
  if (done) {
    const task = tasks.find((t) => t.contractId === c.id)
    if (task) await completeTask(task, deal, tasks, me)
  }
}

// ---------- 請求・入金 ----------

export async function issueInitialInvoice(task: Task, deal: Deal, contracts: Contract[], invoices: Invoice[], tasks: Task[], me: User) {
  const fc = contracts.find((c) => c.dealId === deal.id && c.templateId === 'franchise' && c.status === 'completed')
  const terms = fc?.terms ?? DEFAULT_TERMS
  const id = uid('inv_')
  const inv: Invoice = {
    id, number: nextInvoiceNumber(invoices), dealId: deal.id, billToName: deal.companyName || deal.applicantName,
    kind: 'initial', title: '加盟金・保証金・開業研修費', items: initialInvoiceItems(terms),
    issueDate: today(), dueDate: addDays(today(), 14), status: 'issued',
  }
  await db.set('invoices', id, inv)
  const payTask = tasks.find((t) => t.dealId === deal.id && t.type === 'payment')
  if (payTask) await db.update('tasks', payTask.id, { invoiceId: id })
  await db.update('tasks', task.id, { invoiceId: id })
  await log(me, `請求書を発行: ${inv.number}`, deal.id)
  await completeTask({ ...task, invoiceId: id }, deal, tasks, me)
}

export async function reportPayment(inv: Invoice, note: string, me: User) {
  await db.update('invoices', inv.id, { status: 'reported', reportedAt: nowIso(), reportedNote: note })
  await log(me, `入金を報告: ${inv.number}`, inv.dealId)
}

export async function reconcileInvoice(inv: Invoice, me: User, tasks: Task[], deals: Deal[]) {
  await db.update('invoices', inv.id, { status: 'paid', paidAt: nowIso() })
  await log(me, `入金を消込: ${inv.number}`, inv.dealId)
  const task = tasks.find((t) => t.type === 'payment' && t.invoiceId === inv.id && t.status !== 'done')
  const deal = deals.find((d) => d.id === inv.dealId)
  if (task && deal) await completeTask(task, deal, tasks, me)
}

// ---------- 運営（業務システム・月次） ----------

export async function saveVisitRecord(v: Visit, record: VisitRecord, status: Visit['status'], me: User) {
  await db.update('visits', v.id, { record: { ...record, recordedBy: me.id }, status })
}

export async function addVisit(v: Omit<Visit, 'id'>) {
  const id = uid('v_')
  await db.set('visits', id, { ...v, id })
}

export function buildMonthlyReport(storeId: string, month: string, visits: Visit[], existing?: MonthlyReport): MonthlyReport {
  const list = visits.filter((v) => v.storeId === storeId && v.date.startsWith(month) && v.status === 'done')
  return {
    id: existing?.id ?? `mr_${storeId}_${month}`, storeId, month, status: existing?.status ?? 'draft',
    visitCount: list.length, clientCount: new Set(list.map((v) => v.clientId)).size,
    revenue: list.reduce((s, v) => s + revenueOf(v), 0),
  }
}

export async function submitMonthlyReport(rep: MonthlyReport, me: User) {
  await db.set('monthlyReports', rep.id, { ...rep, status: 'submitted', submittedAt: nowIso() })
  await log(me, `${rep.month} 月次実績を報告`)
}

export async function issueRoyaltyInvoice(rep: MonthlyReport, store: StoreInfo, invoices: Invoice[], me: User) {
  const id = uid('inv_')
  const inv: Invoice = {
    id, number: nextInvoiceNumber(invoices), storeId: store.id, dealId: store.dealId, billToName: store.companyName,
    kind: 'royalty', title: `${rep.month.replace('-', '年')}月分 ロイヤリティ・システム利用料`,
    items: [
      { name: `ロイヤリティ（月間売上 ${rep.revenue.toLocaleString()}円 × ${store.royaltyRate}%）`, amount: Math.round((rep.revenue * store.royaltyRate) / 100), taxRate: 10, account: '売上高' },
      { name: 'システム利用料', amount: store.systemFee, taxRate: 10, account: '売上高' },
    ],
    issueDate: today(), dueDate: addDays(today(), 25), status: 'issued', monthlyReportId: rep.id,
  }
  await db.set('invoices', id, inv)
  await db.update('monthlyReports', rep.id, { status: 'invoiced', invoiceId: id })
  await log(me, `ロイヤリティ請求を発行: ${store.name} ${rep.month}`, store.dealId)
}

// ---------- カンバンのドラッグ&ドロップ ----------

const AUTO_TYPES = new Set(['sign', 'invoice', 'payment']) // 契約・請求と連動するタスクは手動で戻さない

/**
 * フェーズを手動で移動する。
 * - 先へ進める: 移動先より前のフェーズの未完了タスクを「スキップ」扱いにする
 * - 前に戻す: 移動先以降のフェーズの完了タスク（契約・請求連動を除く）を未完了に戻す
 */
export async function moveDealPhase(deal: Deal, target: number, allTasks: Task[], me: User) {
  const tasks = allTasks.filter((t) => t.dealId === deal.id)
  const at = nowIso()
  if (target > deal.phase) {
    for (const t of tasks.filter((x) => x.phase < target && x.status !== 'done' && x.status !== 'skipped')) {
      await db.update('tasks', t.id, {
        status: 'skipped', completedAt: at, completedBy: me.id,
        comments: [...t.comments, { at, userId: me.id, userName: me.name, text: `【手動移動】P${target}へ移動したためスキップ` }],
      })
    }
  } else {
    for (const t of tasks.filter((x) => x.phase >= target && (x.status === 'done' || x.status === 'skipped') && !AUTO_TYPES.has(x.type))) {
      await db.update('tasks', t.id, { status: 'todo', completedAt: undefined, completedBy: undefined })
    }
  }
  await db.update('deals', deal.id, { phase: target, status: deal.status === 'opened' ? 'opened' : 'active' })
  await log(me, `フェーズを手動で P${deal.phase} → P${target} に移動`, deal.id)
}

export function phaseMoveImpact(deal: Deal, target: number, allTasks: Task[]) {
  const tasks = allTasks.filter((t) => t.dealId === deal.id)
  if (target > deal.phase) return { forward: true, count: tasks.filter((x) => x.phase < target && x.status !== 'done' && x.status !== 'skipped').length }
  return { forward: false, count: tasks.filter((x) => x.phase >= target && (x.status === 'done' || x.status === 'skipped') && !AUTO_TYPES.has(x.type)).length }
}

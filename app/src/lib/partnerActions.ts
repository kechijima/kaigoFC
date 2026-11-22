// 提携先連携機能の操作（発注・AI分析・教育動画・分配精算）
import { db } from './db'
import { log } from './actions'
import type {
  Analysis, Client, Collections, CollectionName, DistributionRule, Invoice, Order, OrderLine, Settlement, StoreInfo, User, Video, VideoView,
} from './types'
import { addDays, nowIso, today, uid } from './utils'
import { buildPartnerSeed, buildReport, computeSettlementLines, mockGaitMetrics, orderInvoiceItems } from './partner'

const nextNumber = (prefix: string, list: { number: string }[]) => {
  const y = today().slice(0, 4)
  const max = list.filter((x) => x.number.startsWith(`${prefix}-${y}`)).map((x) => Number(x.number.slice(-4))).reduce((a, b) => Math.max(a, b), 0)
  return `${prefix}-${y}-${String(max + 1).padStart(4, '0')}`
}

// ---------- インソール発注 ----------

export async function placeOrder(store: StoreInfo, lines: OrderLine[], note: string, me: User, orders: Order[], analysisId?: string) {
  const id = uid('od_')
  const o: Order = { id, number: nextNumber('ORD', orders), storeId: store.id, orderedBy: me.id, orderedAt: nowIso(), lines, status: 'ordered', note, analysisId }
  await db.set('orders', id, o)
  await log(me, `備品を発注: ${o.number}（${store.name}）`, store.dealId)
  return o
}

export async function acceptOrder(o: Order, me: User) {
  await db.update('orders', o.id, { status: 'accepted', acceptedAt: nowIso() })
  await log(me, `受注確認: ${o.number}`)
}

/** 発送 → 本部から加盟店への請求を自動作成 */
export async function shipOrder(o: Order, trackingNo: string, me: User, store: StoreInfo, invoices: Invoice[]) {
  const invId = uid('inv_')
  const inv: Invoice = {
    id: invId, number: nextNumber('INV', invoices), storeId: store.id, dealId: store.dealId, billToName: store.companyName,
    kind: 'order', orderId: o.id, title: `備品発注 ${o.number}`, items: orderInvoiceItems(o),
    issueDate: today(), dueDate: addDays(today(), 30), status: 'issued',
  }
  await db.set('invoices', invId, inv)
  await db.update('orders', o.id, { status: 'shipped', shippedAt: nowIso(), trackingNo, invoiceId: invId })
  await log(me, `発送: ${o.number}（追跡番号 ${trackingNo}）・請求書 ${inv.number} を作成`)
}

export async function deliverOrder(o: Order, me: User) {
  await db.update('orders', o.id, { status: 'delivered', deliveredAt: nowIso() })
  await log(me, `納品確認: ${o.number}`)
}

export async function cancelOrder(o: Order, me: User) {
  await db.update('orders', o.id, { status: 'cancelled' })
  await log(me, `発注取消: ${o.number}`)
}

// ---------- AI動画分析 ----------

export async function uploadAnalysis(client: Client, file: string, shotAt: string, me: User) {
  const id = uid('an_')
  const a: Analysis = { id, storeId: client.storeId, clientId: client.id, videoFile: file, shotAt, uploadedBy: me.id, uploadedAt: nowIso(), consent: true, status: 'analyzing' }
  await db.set('analyses', id, a)
  await log(me, `歩行動画をアップロード: ${client.name} 様`)
  return a
}

/** AI解析（モック）: 指標算出 → レポート下書きを自動作成し、協会のレビュー待ちにする */
export async function runAnalysis(a: Analysis, client: Client, all: Analysis[]) {
  const prev = all.filter((x) => x.clientId === a.clientId && x.id !== a.id && x.status === 'published' && x.shotAt < a.shotAt).sort((x, y) => y.shotAt.localeCompare(x.shotAt))[0]
  const metrics = mockGaitMetrics(client, a.shotAt, prev?.metrics)
  await db.update('analyses', a.id, { status: 'review', metrics, ...buildReport(metrics, client, prev) })
}

export async function saveAnalysisReview(a: Analysis, patch: Pick<Analysis, 'reviewerComment' | 'findings' | 'recommendations'>) {
  await db.update('analyses', a.id, patch)
}

export async function publishAnalysis(a: Analysis, me: User) {
  await db.update('analyses', a.id, { status: 'published', reviewedBy: me.id, publishedAt: nowIso() })
  await log(me, `AI分析レポートを発行: ${a.id}`)
}

// ---------- 教育動画 ----------

export async function saveVideo(v: Video, me: User) {
  await db.set('videos', v.id, v)
  await log(me, `教育動画を保存: ${v.title}`)
}

export async function toggleVideoStore(v: Video, storeId: string) {
  const storeIds = v.storeIds.includes(storeId) ? v.storeIds.filter((s) => s !== storeId) : [...v.storeIds, storeId]
  await db.update('videos', v.id, { storeIds })
}

export async function recordView(me: User, video: Video, progress: number, existing?: VideoView) {
  const id = `${me.id}_${video.id}`
  const p = Math.max(existing?.progress ?? 0, Math.min(100, progress))
  const view: VideoView = {
    id, userId: me.id, storeId: me.storeId!, videoId: video.id, progress: p, updatedAt: nowIso(),
    completedAt: p >= 100 ? existing?.completedAt ?? nowIso() : undefined,
  }
  await db.set('videoViews', id, view)
}

// ---------- 分配精算 ----------

export async function updateRule(r: DistributionRule, patch: Partial<DistributionRule>, me: User) {
  await db.update('distributionRules', r.id, patch)
  await log(me, `分配ルールを変更: ${r.label} ${patch.rate ?? r.rate}%${patch.enabled === false ? '（無効）' : ''}`)
}

export async function confirmSettlement(month: string, invoices: Invoice[], rules: DistributionRule[], me: User) {
  const lines = computeSettlementLines(month, invoices, rules)
  const s: Settlement = { id: `st_${month}`, month, lines, total: lines.reduce((a, l) => a + l.amount, 0), status: 'confirmed', confirmedAt: nowIso() }
  await db.set('settlements', s.id, s)
  await log(me, `${month} 分配金を確定（¥${s.total.toLocaleString()}）・協会へ支払通知`)
}

export async function markSettlementPaid(s: Settlement, me: User) {
  await db.update('settlements', s.id, { status: 'paid', paidAt: nowIso() })
  await log(me, `${s.month} 分配金の支払完了を記録`)
}

// ---------- 既存データへの追加（Firestore に旧データがある場合の一回限りの移行） ----------

export async function migratePartnerData(data: { [K in CollectionName]: Collections[K][] }) {
  const invoices = structuredClone(data.invoices)
  const ps = buildPartnerSeed({ stores: data.stores, clients: data.clients, helpers: data.helpers, users: data.users, invoices })
  for (const u of ps.users) await db.set('users', u.id, u)
  const sets: [CollectionName, { id: string }[]][] = [
    ['products', ps.products], ['distributionRules', ps.distributionRules], ['videos', ps.videos], ['videoViews', ps.videoViews],
    ['analyses', ps.analyses], ['orders', ps.orders], ['settlements', ps.settlements], ['invoices', ps.invoices],
  ]
  for (const [col, docs] of sets) for (const d of docs) await db.set(col, d.id, d as never)
  // AI分析料が追加されたロイヤリティ請求を更新
  for (const inv of invoices) {
    const before = data.invoices.find((x) => x.id === inv.id)
    if (before && before.items.length !== inv.items.length) await db.update('invoices', inv.id, { items: inv.items })
  }
}

// 提携先（一般社団法人 転倒予防防止協会）との連携機能のロジック
// - AI歩行分析（モック: 擬似的に指標を算出）とレポート文章の自動作成
// - 費目別の分配計算
// - ダミーデータ
import type {
  Analysis, Client, DistributionRule, FeeCategory, GaitMetrics, Helper, Invoice, InvoiceItem,
  Order, Product, Settlement, SettlementLine, StoreInfo, User, Video, VideoView,
} from './types'
import { addDays, today } from './utils'

export const PARTNER_NAME = '一般社団法人 転倒予防防止協会'
export const ANALYSIS_FEE = 3000 // AI動画分析料（1件・税抜）モック値

export const FEE_LABEL: Record<FeeCategory, string> = {
  joining: '加盟金', deposit: '保証金', training: '開業研修費', royalty: 'ロイヤリティ',
  system: 'システム利用料', insole: 'インソール・備品', analysis: 'AI動画分析料',
}

/** 請求明細の費目（古いデータは名称から推定） */
export function itemCategory(item: InvoiceItem): FeeCategory {
  if (item.category) return item.category
  const n = item.name
  if (n.includes('ロイヤリティ')) return 'royalty'
  if (n.includes('システム')) return 'system'
  if (n.includes('保証金')) return 'deposit'
  if (n.includes('研修')) return 'training'
  if (n.includes('加盟金')) return 'joining'
  if (n.includes('AI')) return 'analysis'
  return 'insole'
}

export const DEFAULT_RULES: DistributionRule[] = [
  { id: 'royalty', category: 'royalty', label: 'ロイヤリティ', rate: 20, enabled: true },
  { id: 'analysis', category: 'analysis', label: 'AI動画分析料', rate: 80, enabled: true },
  { id: 'insole', category: 'insole', label: 'インソール・備品', rate: 60, enabled: true },
  { id: 'system', category: 'system', label: 'システム利用料', rate: 0, enabled: false },
  { id: 'training', category: 'training', label: '開業研修費', rate: 10, enabled: false },
  { id: 'joining', category: 'joining', label: '加盟金', rate: 0, enabled: false },
]

/** 指定月に入金された請求から協会への分配額を計算 */
export function computeSettlementLines(month: string, invoices: Invoice[], rules: DistributionRule[]): SettlementLine[] {
  const lines: SettlementLine[] = []
  for (const inv of invoices) {
    if (inv.status !== 'paid' || !inv.paidAt?.startsWith(month)) continue
    for (const item of inv.items) {
      const cat = itemCategory(item)
      const rule = rules.find((r) => r.category === cat)
      if (!rule?.enabled || rule.rate <= 0) continue
      lines.push({ invoiceId: inv.id, invoiceNumber: inv.number, billToName: inv.billToName, category: cat, base: item.amount, rate: rule.rate, amount: Math.floor((item.amount * rule.rate) / 100) })
    }
  }
  return lines
}

/** freee「取引のインポート」向け 支出CSV（協会への分配金の支払） */
export function freeeExpenseCsv(settlements: Settlement[]) {
  const header = ['収支区分', '管理番号', '発生日', '決済期日', '取引先', '勘定科目', '税区分', '金額', '税計算区分', '税額', '備考', '品目', '決済日', '決済口座', '決済金額']
  const rows = settlements.map((s) => {
    const end = monthEnd(s.month)
    return ['支出', s.id, end.replaceAll('-', '/'), addDays(end, 10).replaceAll('-', '/'), PARTNER_NAME, '支払手数料', '対象外', String(s.total), '内税', '0',
      `${s.month} 分配金`, '提携分配金', s.paidAt ? s.paidAt.slice(0, 10).replaceAll('-', '/') : '', s.paidAt ? '本部普通預金' : '', s.paidAt ? String(s.total) : '']
  })
  return [header, ...rows].map((r) => r.join(',')).join('\r\n')
}

export const monthEnd = (month: string) => addDays(nextMonth(month) + '-01', -1)
export const nextMonth = (m: string) => { const [y, mo] = m.split('-').map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}` }
export const prevMonth = (m: string) => { const [y, mo] = m.split('-').map(Number); return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}` }

// ===================== AI歩行分析（モック） =====================

function hashRng(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  let x = h >>> 0 || 1
  return () => { x = (x * 16807) % 2147483647; return x / 2147483647 }
}

const CARE_FACTOR: Record<string, number> = { 要支援1: 0.1, 要支援2: 0.2, 要介護1: 0.35, 要介護2: 0.5, 要介護3: 0.65, 要介護4: 0.8, 要介護5: 0.9 }

/** 擬似AI: 利用者・撮影日から再現性のある指標を生成。前回があれば少し改善した値にする */
export function mockGaitMetrics(client: Client, shotAt: string, prev?: GaitMetrics): GaitMetrics {
  const r = hashRng(client.id + shotAt)
  const f = CARE_FACTOR[client.careLevel] ?? 0.5 // 0(良)〜1(悪)
  const j = (n: number) => (r() - 0.5) * n
  const base: GaitMetrics = {
    speed: +(1.25 - f * 0.75 + j(0.2)).toFixed(2),
    stride: Math.round(62 - f * 30 + j(8)),
    asymmetry: +(4 + f * 14 + j(5)).toFixed(1),
    sway: +(2 + f * 5 + j(1.5)).toFixed(1),
    toeClearance: +(2.6 - f * 1.8 + j(0.5)).toFixed(1),
    cadence: Math.round(112 - f * 30 + j(10)),
  }
  if (!prev) return base
  const imp = 0.04 + r() * 0.06 // 前回比 4〜10% 改善
  return {
    speed: +(prev.speed * (1 + imp)).toFixed(2), stride: Math.round(prev.stride * (1 + imp)),
    asymmetry: +(prev.asymmetry * (1 - imp)).toFixed(1), sway: +(prev.sway * (1 - imp)).toFixed(1),
    toeClearance: +(prev.toeClearance * (1 + imp)).toFixed(1), cadence: Math.round(prev.cadence * (1 + imp / 2)),
  }
}

type Level = 'ok' | 'caution' | 'risk'
interface MetricDef { key: keyof GaitMetrics; label: string; unit: string; higherIsBetter: boolean; caution: number; risk: number; weight: number }

/** 判定基準（モック用の参考値。本番では協会の基準に差し替える） */
export const METRIC_DEFS: MetricDef[] = [
  { key: 'speed', label: '歩行速度', unit: 'm/秒', higherIsBetter: true, caution: 1.0, risk: 0.8, weight: 25 },
  { key: 'stride', label: '歩幅', unit: 'cm', higherIsBetter: true, caution: 45, risk: 38, weight: 15 },
  { key: 'asymmetry', label: '左右差', unit: '%', higherIsBetter: false, caution: 10, risk: 15, weight: 20 },
  { key: 'sway', label: '体幹の揺れ', unit: 'cm', higherIsBetter: false, caution: 4, risk: 6, weight: 20 },
  { key: 'toeClearance', label: 'つま先の上がり', unit: 'cm', higherIsBetter: true, caution: 1.5, risk: 1.0, weight: 15 },
  { key: 'cadence', label: '歩行リズム', unit: '歩/分', higherIsBetter: true, caution: 95, risk: 85, weight: 5 },
]

export function metricLevel(d: MetricDef, v: number): Level {
  if (d.higherIsBetter) return v < d.risk ? 'risk' : v < d.caution ? 'caution' : 'ok'
  return v > d.risk ? 'risk' : v > d.caution ? 'caution' : 'ok'
}

/** 指標から転倒リスクスコアと所見・推奨を自動で文章化 */
export function buildReport(m: GaitMetrics, client: Client, prev?: Analysis) {
  let score = 0
  const findings: string[] = []
  const levels: Record<string, Level> = {}
  for (const d of METRIC_DEFS) {
    const v = m[d.key]
    const lv = metricLevel(d, v)
    levels[d.key] = lv
    score += d.weight * (lv === 'risk' ? 1 : lv === 'caution' ? 0.5 : 0.1)
  }
  score = Math.min(100, Math.round(score))
  const riskLevel: Analysis['riskLevel'] = score >= 60 ? 'high' : score >= 35 ? 'mid' : 'low'

  const T: Record<keyof GaitMetrics, Record<Level, string>> = {
    speed: { risk: `歩行速度が ${m.speed}m/秒 と遅く、横断歩道を渡り切るのが難しい水準です。`, caution: `歩行速度は ${m.speed}m/秒 でやや低下傾向です。`, ok: `歩行速度は ${m.speed}m/秒 で良好です。` },
    stride: { risk: `歩幅が ${m.stride}cm と小さく、すり足歩行の傾向があります。`, caution: `歩幅は ${m.stride}cm でやや小さめです。`, ok: `歩幅は ${m.stride}cm で安定しています。` },
    asymmetry: { risk: `左右差が ${m.asymmetry}% と大きく、片側への荷重の偏りが見られます。`, caution: `左右差が ${m.asymmetry}% あり、軽度の偏りがあります。`, ok: `左右のバランスは良好です（左右差 ${m.asymmetry}%）。` },
    sway: { risk: `体幹の揺れが ${m.sway}cm と大きく、ふらつきによる転倒の危険があります。`, caution: `体幹の揺れが ${m.sway}cm とやや大きめです。`, ok: `体幹は安定しています（揺れ ${m.sway}cm）。` },
    toeClearance: { risk: `つま先の上がりが ${m.toeClearance}cm と低く、段差や敷物でつまずきやすい状態です。`, caution: `つま先の上がりが ${m.toeClearance}cm とやや低めです。`, ok: `つま先は十分に上がっています（${m.toeClearance}cm）。` },
    cadence: { risk: `歩行リズムが ${m.cadence}歩/分 と遅めです。`, caution: `歩行リズムは ${m.cadence}歩/分 です。`, ok: `歩行リズムは ${m.cadence}歩/分 で良好です。` },
  }
  // 注意・リスクの項目を先に
  const order = [...METRIC_DEFS].sort((a, b) => rank(levels[b.key]) - rank(levels[a.key]))
  for (const d of order) findings.push(T[d.key][levels[d.key]])
  if (prev?.metrics && prev.riskScore != null) {
    const diff = prev.riskScore - score
    findings.unshift(diff > 0 ? `前回（${prev.shotAt.replaceAll('-', '/')}）と比べて転倒リスクスコアが ${diff} ポイント改善しました。` : diff < 0 ? `前回（${prev.shotAt.replaceAll('-', '/')}）と比べて転倒リスクスコアが ${-diff} ポイント悪化しています。` : '前回とほぼ同じ状態です。')
  }

  const rec: string[] = []
  const bad = (k: keyof GaitMetrics) => levels[k] !== 'ok'
  const insole = bad('asymmetry') || bad('toeClearance') || bad('sway')
  if (insole) rec.push('足底の荷重バランスを整えるため、転倒予防インソールの使用をおすすめします。')
  if (bad('toeClearance') || bad('stride')) rec.push('足首の背屈運動（つま先上げ）とももの前の筋力トレーニングを、1日2回・各10回から始めましょう。')
  if (bad('sway')) rec.push('椅子や手すりにつかまった片脚立ち（左右30秒ずつ）でバランス能力を高めましょう。')
  if (bad('speed')) rec.push('ヘルパーの付き添いのもと、1日10分程度の歩行練習を習慣にしましょう。')
  if (riskLevel !== 'low') rec.push('室内の段差・敷物・コード類を見直し、トイレや玄関に手すりの設置を検討してください（ケアマネジャーへ共有）。')
  rec.push(riskLevel === 'high' ? '1か月後を目安に再度撮影・分析を行い、変化を確認しましょう。' : '3か月後を目安に再度撮影・分析を行い、変化を確認しましょう。')
  if (client.careLevel.startsWith('要介護4') || client.careLevel.startsWith('要介護5')) rec.push('歩行時は必ず見守りを行い、福祉用具（歩行器等）の適合も確認してください。')

  return { riskScore: score, riskLevel, findings, recommendations: rec, insoleRecommended: insole }
}
const rank = (l: Level) => (l === 'risk' ? 2 : l === 'caution' ? 1 : 0)

export const RISK_LABEL = { low: ['転倒リスク 低', 'bg-emerald-100 text-emerald-700'], mid: ['転倒リスク 中', 'bg-amber-100 text-amber-800'], high: ['転倒リスク 高', 'bg-rose-100 text-rose-700'] } as const

// ===================== ダミーデータ =====================

export const PARTNER_USER: User = { id: 'u_yoshimi', name: '吉見', email: 'yoshimi@kyokai.example.jp', kind: 'partner' }

export const PRODUCTS: Product[] = [
  { id: 'p_insole_std', name: '転倒予防インソール（スタンダード）', category: 'insole', sizes: ['S (22-23cm)', 'M (23.5-24.5cm)', 'L (25-26cm)', 'LL (26.5-27.5cm)'], price: 4800, stock: 120, description: '土踏まずとかかとを支え、左右の荷重バランスを整える基本モデル' },
  { id: 'p_insole_soft', name: '転倒予防インソール（ソフト・つま先アップ）', category: 'insole', sizes: ['S (22-23cm)', 'M (23.5-24.5cm)', 'L (25-26cm)'], price: 5800, stock: 60, description: 'つま先の上がりを補助し、すり足によるつまずきを防ぐモデル' },
  { id: 'p_insole_slipper', name: '室内履き用インソール', category: 'insole', sizes: ['フリー'], price: 3200, stock: 80, description: '室内履き・上履きに入れて使う薄型タイプ' },
  { id: 'p_kit', name: '足型測定キット', category: 'kit', price: 2500, stock: 40, description: 'インソールのサイズ選定用（10回分）' },
  { id: 'p_marker', name: '歩行動画撮影用マーカーセット', category: 'kit', price: 1800, stock: 50, description: 'AI動画分析の精度を上げる貼付マーカー（20枚）' },
]

const VIDEO_SEED: Omit<Video, 'storeIds' | 'createdAt'>[] = [
  { id: 'vd01', title: '訪問介護の基本と接遇マナー', category: '基礎研修', provider: 'hq', minutes: 18, required: true, description: '訪問時のあいさつ、言葉づかい、個人情報の取り扱い' },
  { id: 'vd02', title: '身体介護の基本（移乗・体位変換）', category: '基礎研修', provider: 'hq', minutes: 24, required: true, description: 'ボディメカニクスを使った安全な介助方法' },
  { id: 'vd03', title: '感染症対策と標準予防策', category: '基礎研修', provider: 'hq', minutes: 15, required: true, description: '手指衛生、防護具の着脱、嘔吐物の処理' },
  { id: 'vd04', title: '転倒予防の基礎知識', category: '転倒予防', provider: 'partner', minutes: 20, required: true, description: '高齢者の転倒の原因と、訪問時にできる予防策' },
  { id: 'vd05', title: 'AI歩行分析のための動画の撮り方', category: '転倒予防', provider: 'partner', minutes: 8, required: true, description: 'スマホでの撮影位置・距離・明るさ、マーカーの貼り方' },
  { id: 'vd06', title: 'インソールの選び方と装着指導', category: '転倒予防', provider: 'partner', minutes: 12, required: false, description: 'サイズ測定、靴への入れ方、利用者への説明のポイント' },
  { id: 'vd07', title: '自宅でできる転倒予防体操', category: '転倒予防', provider: 'partner', minutes: 15, required: false, description: '利用者と一緒にできる5分間の体操（座位・立位）' },
  { id: 'vd08', title: 'サービス提供責任者の役割と記録', category: '職種別', provider: 'hq', minutes: 22, required: false, description: '訪問介護計画書の作成、モニタリング、記録の書き方' },
]

export function buildPartnerSeed(p: { stores: StoreInfo[]; clients: Client[]; helpers: Helper[]; users: User[]; invoices: Invoice[] }) {
  const T = today()
  const r = hashRng('partner-seed')
  const pick = <X,>(a: X[]) => a[Math.floor(r() * a.length)]

  // --- 教育動画 ---
  const videos: Video[] = VIDEO_SEED.map((v, i) => ({
    ...v,
    // 職種別の動画は世田谷のみ、他はすべての店舗に公開
    storeIds: v.id === 'vd08' ? p.stores.slice(0, 1).map((s) => s.id) : p.stores.map((s) => s.id),
    createdAt: addDays(T, -200 + i * 10) + 'T09:00:00.000Z',
  }))
  const videoViews: VideoView[] = []
  for (const h of p.helpers) {
    if (!h.userId) continue
    for (const v of videos.filter((x) => x.storeIds.includes(h.storeId))) {
      const x = r()
      if (x < 0.25) continue // 未視聴
      const progress = x > 0.55 ? 100 : Math.round(20 + r() * 70)
      videoViews.push({
        id: `${h.userId}_${v.id}`, userId: h.userId, storeId: h.storeId, videoId: v.id, progress,
        completedAt: progress === 100 ? addDays(T, -Math.round(r() * 60)) + 'T10:00:00.000Z' : undefined,
        updatedAt: addDays(T, -Math.round(r() * 30)) + 'T10:00:00.000Z',
      })
    }
  }

  // --- AI分析 ---
  const analyses: Analysis[] = []
  for (const s of p.stores) {
    const storeClients = p.clients.filter((c) => c.storeId === s.id).slice(0, 5)
    const manager = p.helpers.find((h) => h.storeId === s.id)
    storeClients.forEach((c, i) => {
      const times = i < 2 ? 2 : 1
      let prev: Analysis | undefined
      for (let k = 0; k < times; k++) {
        const shotAt = addDays(T, -(times - k) * 75 + Math.round(r() * 20) - 10 - i)
        const metrics = mockGaitMetrics(c, shotAt, prev?.metrics)
        const rep = buildReport(metrics, c, prev)
        const a: Analysis = {
          id: `an_${c.id}_${k}`, storeId: s.id, clientId: c.id, videoFile: `walk_${c.id}_${shotAt}.mp4`, shotAt,
          uploadedBy: manager?.userId ?? '', uploadedAt: shotAt + 'T15:00:00.000Z', consent: true,
          status: 'published', metrics, ...rep,
          reviewerComment: rep.riskLevel === 'high' ? 'ふらつきが目立ちます。ご家族にも共有のうえ、歩行時の見守りをお願いします。' : '日常の歩行は概ね安定しています。体操の継続をおすすめします。',
          reviewedBy: PARTNER_USER.id, publishedAt: addDays(shotAt, 3) + 'T11:00:00.000Z',
        }
        analyses.push(a)
        prev = a
      }
    })
    // 協会のレビュー待ち（各店舗1件）
    const c = p.clients.filter((x) => x.storeId === s.id)[5]
    if (c) {
      const shotAt = addDays(T, -2)
      const metrics = mockGaitMetrics(c, shotAt)
      analyses.push({
        id: `an_${c.id}_review`, storeId: s.id, clientId: c.id, videoFile: `walk_${c.id}_${shotAt}.mp4`, shotAt,
        uploadedBy: manager?.userId ?? '', uploadedAt: shotAt + 'T16:00:00.000Z', consent: true, status: 'review', metrics, ...buildReport(metrics, c),
      })
    }
  }

  // ロイヤリティ請求にAI分析料を追加（発行済みの分析件数分）
  for (const inv of p.invoices.filter((i) => i.kind === 'royalty' && i.storeId)) {
    const month = inv.title.match(/(\d{4})年(\d{2})月/)
    if (!month) continue
    const ym = `${month[1]}-${month[2]}`
    const n = analyses.filter((a) => a.storeId === inv.storeId && a.status === 'published' && a.publishedAt?.startsWith(ym)).length
    if (n) inv.items.push({ name: `AI動画分析料（${n}件 × ${ANALYSIS_FEE.toLocaleString()}円）`, amount: n * ANALYSIS_FEE, taxRate: 10, account: '売上高', category: 'analysis' })
  }

  // --- インソール発注 ---
  const orders: Order[] = []
  const invoices: Invoice[] = []
  let seq = 1
  p.stores.forEach((s, si) => {
    const owner = s.ownerUserId
    const storeClients = p.clients.filter((c) => c.storeId === s.id)
    const statuses: Order['status'][] = si === 0 ? ['delivered', 'delivered', 'shipped'] : si === 1 ? ['delivered', 'ordered'] : ['accepted']
    statuses.forEach((st, k) => {
      const orderedAt = addDays(T, -(statuses.length - k) * 25 - si * 3)
      const insole = pick(PRODUCTS.slice(0, 2))
      const lines = [
        { productId: insole.id, name: insole.name, size: pick(insole.sizes!), clientId: pick(storeClients).id, qty: 1, price: insole.price },
        { productId: insole.id, name: insole.name, size: pick(insole.sizes!), clientId: pick(storeClients).id, qty: 1, price: insole.price },
        ...(k === 0 ? [{ productId: 'p_kit', name: '足型測定キット', qty: 1, price: 2500 }] : []),
      ]
      const o: Order = {
        id: `od_${s.id}_${k}`, number: `ORD-${T.slice(0, 4)}-${String(seq++).padStart(4, '0')}`, storeId: s.id, orderedBy: owner,
        orderedAt: orderedAt + 'T10:00:00.000Z', lines, status: st,
        acceptedAt: st !== 'ordered' ? addDays(orderedAt, 1) + 'T10:00:00.000Z' : undefined,
        shippedAt: st === 'shipped' || st === 'delivered' ? addDays(orderedAt, 2) + 'T10:00:00.000Z' : undefined,
        trackingNo: st === 'shipped' || st === 'delivered' ? `1234-5678-${String(9000 + seq)}` : undefined,
        deliveredAt: st === 'delivered' ? addDays(orderedAt, 4) + 'T10:00:00.000Z' : undefined,
      }
      if (o.shippedAt) {
        const issue = o.shippedAt.slice(0, 10)
        const inv: Invoice = {
          id: `inv_${o.id}`, number: `INV-${T.slice(0, 4)}-${String(500 + seq).padStart(4, "0")}`, storeId: s.id, dealId: s.dealId, billToName: s.companyName,
          kind: 'order', orderId: o.id, title: `備品発注 ${o.number}`, items: orderInvoiceItems(o),
          issueDate: issue, dueDate: addDays(issue, 30), status: st === 'delivered' ? 'paid' : 'issued',
          paidAt: st === 'delivered' ? addDays(issue, 15) + 'T10:00:00.000Z' : undefined,
        }
        o.invoiceId = inv.id
        invoices.push(inv)
      }
      orders.push(o)
    })
  })

  // --- 分配精算（入金済み請求から過去2か月分を作成） ---
  const rules = DEFAULT_RULES
  const allInvoices = [...p.invoices, ...invoices]
  const settlements: Settlement[] = []
  const m1 = prevMonth(T.slice(0, 7))
  const m2 = prevMonth(m1)
  for (const [m, status] of [[m2, 'paid'], [m1, 'confirmed']] as const) {
    const lines = computeSettlementLines(m, allInvoices, rules)
    settlements.push({
      id: `st_${m}`, month: m, lines, total: lines.reduce((a, l) => a + l.amount, 0), status,
      confirmedAt: monthEnd(m) + 'T18:00:00.000Z', paidAt: status === 'paid' ? addDays(monthEnd(m), 10) + 'T10:00:00.000Z' : undefined,
    })
  }

  return { products: PRODUCTS, orders, invoices, distributionRules: rules, settlements, videos, videoViews, analyses, users: [PARTNER_USER] }
}

export function orderInvoiceItems(o: Order): InvoiceItem[] {
  const grouped = new Map<string, InvoiceItem>()
  for (const l of o.lines) {
    const key = l.name
    const cur = grouped.get(key)
    if (cur) cur.amount += l.price * l.qty
    else grouped.set(key, { name: l.name, amount: l.price * l.qty, taxRate: 10, account: '売上高', category: 'insole' })
  }
  return [...grouped.values()]
}

export const orderTotal = (o: Order) => o.lines.reduce((s, l) => s + l.price * l.qty, 0)

export const ORDER_STATUS: Record<Order['status'], [string, string]> = {
  ordered: ['発注済（受注待ち）', 'bg-sky-100 text-sky-700'],
  accepted: ['受注確認済（発送準備中）', 'bg-amber-100 text-amber-800'],
  shipped: ['発送済', 'bg-indigo-100 text-indigo-700'],
  delivered: ['納品済', 'bg-emerald-100 text-emerald-700'],
  cancelled: ['キャンセル', 'bg-slate-100 text-slate-400'],
}

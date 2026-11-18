// ダミーデータ生成。日付は「今日」を基準に相対的に作るので、いつ投入しても自然な状態になる。
import type {
  AuditLog, Client, Collections, CollectionName, Contract, Deal, Helper, Invoice, MonthlyReport,
  Notice, StoreInfo, Task, TaskStatus, User, Visit, ServiceType,
} from './types'
import { instantiateTasks } from './workflow'
import { CONTRACT_TEMPLATES, DEFAULT_TERMS, HQ_REP } from './contracts'
import { addDays, sha256, today } from './utils'
import { initialInvoiceItems } from './billing'

type SeedData = { [K in CollectionName]: Collections[K][] }

// 再現性のある乱数
function rng(seed: number) {
  let s = seed
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }
}

const HQ_USERS: User[] = [
  { id: 'u_yamada', name: '山田 一郎', email: 'yamada@hq.example.jp', kind: 'hq', hqRole: 'admin' },
  { id: 'u_sato', name: '佐藤 花子', email: 'sato@hq.example.jp', kind: 'hq', hqRole: 'sales' },
  { id: 'u_suzuki', name: '鈴木 大輝', email: 'suzuki@hq.example.jp', kind: 'hq', hqRole: 'sales' },
  { id: 'u_takahashi', name: '高橋 健太', email: 'takahashi@hq.example.jp', kind: 'hq', hqRole: 'sv' },
  { id: 'u_tanaka', name: '田中 理恵', email: 'tanaka@hq.example.jp', kind: 'hq', hqRole: 'accounting' },
]

interface DealSpec {
  id: string
  applicantName: string
  companyName: string
  area: string
  prefecture: string
  phase: number
  openOffset: number // 今日からの開業希望日
  sales: string
  status?: Deal['status']
  overrides?: Record<string, TaskStatus>
  withdrawReason?: string
  memo?: string
}

const DEAL_SPECS: DealSpec[] = [
  { id: 'd01', applicantName: '伊藤 健', companyName: '', area: '東京都練馬区', prefecture: '東京都', phase: 0, openOffset: 240, sales: 'u_sato', overrides: { '0-1': 'done' }, memo: 'Webフォームから問い合わせ。介護職10年の経験あり。' },
  { id: 'd02', applicantName: '渡辺 美咲', companyName: '株式会社ミサキケア', area: '神奈川県横浜市港北区', prefecture: '神奈川県', phase: 1, openOffset: 215, sales: 'u_sato', overrides: { '1-1': 'done' } },
  { id: 'd03', applicantName: '小林 誠', companyName: '合同会社コバヤシ', area: '埼玉県さいたま市浦和区', prefecture: '埼玉県', phase: 2, openOffset: 190, sales: 'u_suzuki', overrides: { '2-1': 'in_review' } },
  { id: 'd04', applicantName: '加藤 由美', companyName: '株式会社かとうライフ', area: '千葉県市川市', prefecture: '千葉県', phase: 3, openOffset: 165, sales: 'u_suzuki', overrides: { '3-1': 'done', '3-2': 'done' } },
  { id: 'd05', applicantName: '吉田 拓也', companyName: '株式会社よしだ福祉', area: '東京都町田市', prefecture: '東京都', phase: 4, openOffset: 150, sales: 'u_sato', overrides: { '4-1': 'done' } },
  {
    id: 'd06', applicantName: '山本 恵子', companyName: '株式会社やまもとケア', area: '神奈川県川崎市中原区', prefecture: '神奈川県', phase: 5, openOffset: 60, sales: 'u_sato',
    overrides: { '5-1': 'done', '5-2': 'done', '5-3': 'done', '5-4': 'done', '5-5': 'done', '5-6': 'rejected', '5-7': 'in_review', '5-12': 'done', '5-13': 'done', '5-15': 'done', '5-10': 'skipped' },
  },
  {
    id: 'd07', applicantName: '中村 翔', companyName: '株式会社なかむら', area: '東京都杉並区', prefecture: '東京都', phase: 5, openOffset: 25, sales: 'u_suzuki',
    overrides: { '5-1': 'done', '5-2': 'done', '5-3': 'done', '5-4': 'done', '5-5': 'done', '5-6': 'done', '5-7': 'done', '5-8': 'done', '5-10': 'in_review', '5-11': 'done', '5-12': 'done', '5-13': 'done', '5-14': 'done', '5-15': 'done' },
  },
  { id: 'd08', applicantName: '松本 直樹', companyName: '株式会社まつもとHC', area: '埼玉県川口市', prefecture: '埼玉県', phase: 6, openOffset: 3, sales: 'u_sato' },
  { id: 'd09', applicantName: '井上 亮', companyName: '', area: '東京都足立区', prefecture: '東京都', phase: 2, openOffset: 200, sales: 'u_suzuki', status: 'withdrawn', withdrawReason: '資金計画の見直しのため今回は辞退', overrides: { '2-1': 'done' } },
  { id: 'd10', applicantName: '木村 聡', companyName: '株式会社きむらケア', area: '東京都世田谷区', prefecture: '東京都', phase: 7, openOffset: -590, sales: 'u_sato', status: 'opened' },
  { id: 'd11', applicantName: '林 真由美', companyName: '株式会社はやしライフサポート', area: '神奈川県川崎市高津区', prefecture: '神奈川県', phase: 7, openOffset: -240, sales: 'u_suzuki', status: 'opened' },
  { id: 'd12', applicantName: '清水 大輔', companyName: '株式会社しみずケア', area: '千葉県船橋市', prefecture: '千葉県', phase: 7, openOffset: -170, sales: 'u_sato', status: 'opened' },
]

const STORE_NAMES: Record<string, { name: string; address: string; officeNumber: string }> = {
  d10: { name: 'ケアリンク世田谷', address: '東京都世田谷区三軒茶屋1-2-3', officeNumber: '1371200001' },
  d11: { name: 'ケアリンク川崎高津', address: '神奈川県川崎市高津区溝口2-3-4', officeNumber: '1471500002' },
  d12: { name: 'ケアリンク船橋', address: '千葉県船橋市本町3-4-5', officeNumber: '1270400003' },
}

const romaji: Record<string, string> = {
  d01: 'ito', d02: 'watanabe', d03: 'kobayashi', d04: 'kato', d05: 'yoshida', d06: 'yamamoto',
  d07: 'nakamura', d08: 'matsumoto', d09: 'inoue', d10: 'kimura', d11: 'hayashi', d12: 'shimizu',
}

let invoiceSeq = 1
const nextInvoiceNo = () => `INV-${today().slice(0, 4)}-${String(invoiceSeq++).padStart(4, '0')}`

async function completedContract(deal: Deal, templateId: string, signedAt: string): Promise<Contract> {
  const tpl = CONTRACT_TEMPLATES[templateId]
  const terms = { ...DEFAULT_TERMS, territory: deal.area }
  const body = tpl.render(deal, terms)
  const at = signedAt + 'T10:00:00.000Z'
  const c: Contract = {
    id: `c_${deal.id}_${templateId}`,
    dealId: deal.id,
    templateId,
    title: tpl.title,
    body,
    status: 'completed',
    version: 1,
    terms,
    signers: [
      { party: 'fc', name: deal.applicantName, email: deal.email, otpVerifiedAt: at, signedAt: at, signatureName: deal.applicantName, userAgent: 'Mozilla/5.0 (seed)', ip: '203.0.113.10' },
      { party: 'hq', name: HQ_REP, email: 'yamada@hq.example.jp', otpVerifiedAt: at, signedAt: at, signatureName: '山田 一郎', userAgent: 'Mozilla/5.0 (seed)', ip: '198.51.100.5' },
    ],
    history: [
      { at, userName: '佐藤 花子', action: '契約書を作成' },
      { at, userName: '山田 一郎', action: '社内承認' },
      { at, userName: deal.applicantName, action: '加盟者が署名' },
      { at, userName: '山田 一郎', action: '本部が署名（締結完了）' },
    ],
    createdAt: at,
    completedAt: at,
  }
  c.hash = await sha256(body + JSON.stringify(c.signers))
  return c
}

export async function buildSeed(): Promise<SeedData> {
  invoiceSeq = 1
  const T = today()
  const users: User[] = [...HQ_USERS]
  const deals: Deal[] = []
  const tasks: Task[] = []
  const contracts: Contract[] = []
  const invoices: Invoice[] = []
  const stores: StoreInfo[] = []
  const auditLogs: AuditLog[] = []

  for (const s of DEAL_SPECS) {
    const target = addDays(T, s.openOffset)
    const deal: Deal = {
      id: s.id,
      applicantName: s.applicantName,
      companyName: s.companyName,
      email: `${romaji[s.id]}@fc.example.jp`,
      phone: `090-0000-${s.id.slice(1).padStart(4, '0')}`,
      area: s.area,
      prefecture: s.prefecture,
      phase: Math.min(s.phase, 6),
      status: s.status ?? 'active',
      salesUserId: s.sales,
      svUserId: 'u_takahashi',
      targetOpenDate: target,
      createdAt: addDays(target, -250) + 'T09:00:00.000Z',
      ownerUserId: `u_fc_${s.id}`,
      withdrawReason: s.withdrawReason,
      memo: s.memo,
    }
    users.push({ id: `u_fc_${s.id}`, name: s.applicantName, email: deal.email, kind: 'fc', dealId: s.id })

    const dealTasks = instantiateTasks(deal)
    for (const t of dealTasks) {
      const st = s.overrides?.[t.code] ?? (t.phase < s.phase ? 'done' : 'todo')
      t.status = st
      if (st === 'done' || st === 'skipped') {
        t.completedAt = (t.dueDate < T ? t.dueDate : addDays(T, -1)) + 'T09:00:00.000Z'
        t.completedBy = t.assignee === 'hq' ? (t.hqRole === 'admin' ? 'u_yamada' : t.hqRole === 'accounting' ? 'u_tanaka' : t.hqRole === 'sv' ? 'u_takahashi' : s.sales) : deal.ownerUserId
      }
      if (t.type === 'submit' && (st === 'done' || st === 'in_review' || st === 'rejected')) {
        t.attachments = [`${t.title.replace(/[（(].*$/, '')}.pdf`]
      }
      if (st === 'rejected') {
        t.comments.push({ at: addDays(T, -2) + 'T15:00:00.000Z', userId: 'u_takahashi', userName: '高橋 健太', text: 'サービス提供責任者の資格証（実務者研修修了証）が添付されていません。追加で提出をお願いします。' })
      }
      if (st === 'in_review') {
        t.comments.push({ at: addDays(T, -1) + 'T11:00:00.000Z', userId: deal.ownerUserId!, userName: deal.applicantName, text: '提出しました。ご確認をお願いします。' })
      }
      // 完了済みの署名タスク → 締結済み契約
      if (t.type === 'sign' && st === 'done') {
        const c = await completedContract(deal, t.contractTemplateId!, t.completedAt!.slice(0, 10))
        contracts.push(c)
        t.contractId = c.id
      }
      tasks.push(t)
    }

    // 請求（4-1 完了済みの案件）
    const t41 = dealTasks.find((t) => t.code === '4-1')!
    const t42 = dealTasks.find((t) => t.code === '4-2')!
    if (t41.status === 'done') {
      const issue = t41.completedAt!.slice(0, 10)
      const paid = t42.status === 'done'
      const inv: Invoice = {
        id: `inv_${deal.id}_initial`,
        number: nextInvoiceNo(),
        dealId: deal.id,
        billToName: deal.companyName || deal.applicantName,
        kind: 'initial',
        title: '加盟金・保証金・開業研修費',
        items: initialInvoiceItems(DEFAULT_TERMS),
        issueDate: issue,
        dueDate: addDays(issue, 14),
        status: paid ? 'paid' : s.id === 'd05' ? 'reported' : 'issued',
        reportedAt: paid || s.id === 'd05' ? addDays(T, -1) + 'T10:00:00.000Z' : undefined,
        reportedNote: s.id === 'd05' ? '本日 〇〇銀行より振込済みです（振込名義: ヨシダフクシ）' : undefined,
        paidAt: paid ? t42.completedAt : undefined,
      }
      if (paid) inv.reportedAt = t42.completedAt
      invoices.push(inv)
      t41.invoiceId = inv.id
      t42.invoiceId = inv.id
    }

    // 進行中の契約（モックで操作できる状態を用意）
    if (s.id === 'd02') {
      const tpl = CONTRACT_TEMPLATES.nda
      const c: Contract = {
        id: `c_${deal.id}_nda`, dealId: deal.id, templateId: 'nda', title: tpl.title,
        body: tpl.render(deal, DEFAULT_TERMS), status: 'sent', version: 1, terms: { ...DEFAULT_TERMS, territory: deal.area },
        signers: [{ party: 'fc', name: deal.applicantName, email: deal.email }, { party: 'hq', name: HQ_REP, email: 'yamada@hq.example.jp' }],
        history: [{ at: addDays(T, -3) + 'T10:00:00.000Z', userName: '佐藤 花子', action: '契約書を作成' }, { at: addDays(T, -3) + 'T10:05:00.000Z', userName: '山田 一郎', action: '社内承認・送付' }],
        createdAt: addDays(T, -3) + 'T10:00:00.000Z', signDueDate: addDays(T, 4),
      }
      contracts.push(c)
      tasks.find((t) => t.id === 'd02_1-3')!.contractId = c.id
    }
    if (s.id === 'd04') {
      const tpl = CONTRACT_TEMPLATES.franchise
      const terms = { ...DEFAULT_TERMS, territory: deal.area }
      const c: Contract = {
        id: `c_${deal.id}_franchise`, dealId: deal.id, templateId: 'franchise', title: tpl.title,
        body: tpl.render(deal, terms), status: 'pending_approval', version: 1, terms,
        signers: [{ party: 'fc', name: deal.applicantName, email: deal.email }, { party: 'hq', name: HQ_REP, email: 'yamada@hq.example.jp' }],
        history: [{ at: addDays(T, -1) + 'T14:00:00.000Z', userName: '鈴木 大輝', action: '契約書を作成', note: 'テリトリー: 千葉県市川市' }],
        createdAt: addDays(T, -1) + 'T14:00:00.000Z', signDueDate: addDays(T, 10),
      }
      contracts.push(c)
      tasks.find((t) => t.id === 'd04_3-3')!.contractId = c.id
    }

    // 期限超過の例を作る
    if (s.id === 'd07') {
      const t = tasks.find((x) => x.id === 'd07_5-9')!
      t.dueDate = addDays(T, -2)
    }

    // 未完了タスクの期限が過去に偏りすぎないよう調整（期限超過のデモ用に一部だけ残す）
    const keepOverdue = new Set(['d06_5-6', 'd03_2-2', 'd07_5-9'])
    dealTasks.forEach((t, i) => {
      if (t.status !== 'done' && t.status !== 'skipped' && t.dueDate < T && !keepOverdue.has(t.id)) t.dueDate = addDays(T, 3 + (i % 10))
    })

    // 開業済み → 店舗
    if (deal.status === 'opened') {
      const info = STORE_NAMES[deal.id]
      const store: StoreInfo = {
        id: `s_${deal.id}`, dealId: deal.id, name: info.name, companyName: deal.companyName, ownerUserId: deal.ownerUserId!,
        address: info.address, prefecture: deal.prefecture, officeNumber: info.officeNumber, openDate: target, status: 'open',
        royaltyRate: DEFAULT_TERMS.royaltyRate, systemFee: DEFAULT_TERMS.systemFee,
      }
      stores.push(store)
      deal.storeId = store.id
      users.find((u) => u.id === deal.ownerUserId)!.storeId = store.id
    }
    deals.push(deal)
    auditLogs.push({ id: `log_${deal.id}_0`, at: deal.createdAt, userId: s.sales, userName: HQ_USERS.find((u) => u.id === s.sales)!.name, dealId: deal.id, action: 'FC進捗に登録' })
  }

  // ===== 店舗の運営データ =====
  const clients: Client[] = []
  const helpers: Helper[] = []
  const visits: Visit[] = []
  const monthlyReports: MonthlyReport[] = []
  const rand = rng(42)
  const pick = <X,>(a: X[]) => a[Math.floor(rand() * a.length)]
  const familyNames = ['青木', '石井', '上田', '岡本', '金子', '近藤', '斎藤', '坂本', '杉山', '高木', '中島', '西村', '野口', '原田', '藤田', '前田', '松井', '宮崎', '森', '和田']
  const givenF = ['トメ', 'ハナ', '和子', '幸子', '節子', '洋子', '京子', '光子']
  const givenM = ['茂', '勇', '正夫', '清', '実', '博', '進', '昭']
  const helperNames = ['大野 さくら', '小川 亮介', '菅原 千尋', '岩田 美穂', '片山 拓海', '浜田 由紀', '永井 修', '平野 あや', '星野 純', '荒木 恵']
  const careLevels = ['要支援2', '要介護1', '要介護1', '要介護2', '要介護2', '要介護3', '要介護4', '要介護5']
  const services: ServiceType[] = ['身体介護', '生活援助', '身体・生活', '身体介護']
  const slots = [['09:00', '10:00'], ['10:30', '11:30'], ['13:00', '13:45'], ['14:00', '15:00'], ['15:30', '16:30'], ['17:00', '17:45']]

  for (const store of stores) {
    const hCount = 5 + Math.floor(rand() * 2)
    const storeHelpers: Helper[] = []
    for (let i = 0; i < hCount; i++) {
      const h: Helper = {
        id: `h_${store.id}_${i}`, storeId: store.id, name: helperNames[(i + stores.indexOf(store) * 3) % helperNames.length],
        qualification: i === 0 ? '介護福祉士（管理者）' : i === 1 ? '介護福祉士（サ責）' : pick(['介護職員初任者研修', '実務者研修', '介護福祉士']),
        employment: i < 3 ? '常勤' : '非常勤',
      }
      const u: User = {
        id: `u_${h.id}`, name: h.name, email: `${h.id}@store.example.jp`, kind: 'field', storeId: store.id,
        fieldRole: i === 0 ? 'manager' : i === 1 ? 'sp' : 'helper',
      }
      h.userId = u.id
      users.push(u)
      helpers.push(h)
      storeHelpers.push(h)
    }
    const cCount = 8 + Math.floor(rand() * 4)
    const storeClients: Client[] = []
    for (let i = 0; i < cCount; i++) {
      const female = rand() < 0.65
      const c: Client = {
        id: `cl_${store.id}_${i}`, storeId: store.id,
        name: `${pick(familyNames)} ${female ? pick(givenF) : pick(givenM)}`, kana: '',
        careLevel: pick(careLevels), address: store.address.replace(/\d.*$/, '') + `${i + 1}-${(i * 7) % 20 + 1}`,
        careManager: `${pick(['ひまわり', 'さくら', 'あおぞら', 'みどり'])}居宅介護支援事業所 ${pick(familyNames)}CM`,
      }
      clients.push(c)
      storeClients.push(c)
    }
    // 過去14日〜今後7日の訪問
    for (let d = -14; d <= 7; d++) {
      const date = addDays(T, d)
      const dow = new Date(date + 'T00:00:00').getDay()
      if (dow === 0) continue
      const n = 4 + Math.floor(rand() * 4)
      const used = new Set<string>()
      for (let k = 0; k < n; k++) {
        const slot = slots[k % slots.length]
        const helper = storeHelpers[(k + d + 20) % storeHelpers.length]
        const client = pick(storeClients)
        const key = `${client.id}`
        if (used.has(key)) continue
        used.add(key)
        const v: Visit = {
          id: `v_${store.id}_${date}_${k}`, storeId: store.id, date, start: slot[0], end: slot[1],
          clientId: client.id, helperId: helper.id, service: pick(services), status: d < 0 ? 'done' : 'scheduled',
        }
        if (d < 0) {
          if (rand() < 0.05) v.status = 'cancelled'
          else v.record = {
            checkIn: slot[0], checkOut: slot[1],
            items: v.service === '生活援助' ? ['掃除', '洗濯', '調理'] : v.service === '身体介護' ? ['排泄介助', '更衣介助', '服薬確認'] : ['入浴介助', '掃除', '服薬確認'],
            temperature: (36 + rand() * 0.9).toFixed(1), bloodPressure: `${118 + Math.floor(rand() * 25)}/${70 + Math.floor(rand() * 15)}`,
            note: pick(['特変なし。', '食欲あり、表情穏やか。', '右膝の痛みの訴えあり。家族に報告済み。', '水分摂取を促した。']),
            recordedBy: helper.userId,
          }
        }
        visits.push(v)
      }
    }
    // 月次報告: 開業月から先月まで
    const monthsSinceOpen: string[] = []
    const thisMonth = T.slice(0, 7)
    let m = store.openDate.slice(0, 7)
    while (m < thisMonth) {
      monthsSinceOpen.push(m)
      const [y, mm] = m.split('-').map(Number)
      m = mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, '0')}`
    }
    monthsSinceOpen.slice(-6).forEach((month, idx, arr) => {
      const isLast = idx === arr.length - 1
      const growth = 0.6 + 0.4 * Math.min(1, (monthsSinceOpen.indexOf(month) + 1) / 8)
      const visitCount = Math.round((160 + rand() * 60) * growth * (storeClients.length / 10))
      const revenue = Math.round(visitCount * 3600)
      const rep: MonthlyReport = {
        id: `mr_${store.id}_${month}`, storeId: store.id, month, visitCount, clientCount: storeClients.length, revenue,
        status: isLast ? (store.id === 's_d11' ? 'draft' : 'submitted') : 'invoiced',
        submittedAt: isLast && store.id === 's_d11' ? undefined : `${month}-28T18:00:00.000Z`,
      }
      if (rep.status === 'invoiced') {
        const [yy, mo] = month.split('-').map(Number)
        const issue = toNextMonth(yy, mo, 5)
        const inv: Invoice = {
          id: `inv_${store.id}_${month}`, number: nextInvoiceNo(), storeId: store.id, dealId: store.dealId,
          billToName: store.companyName, kind: 'royalty', title: `${month.replace('-', '年')}月分 ロイヤリティ・システム利用料`,
          items: [
            { name: `ロイヤリティ（月間売上 ${revenue.toLocaleString()}円 × ${store.royaltyRate}%）`, amount: Math.round(revenue * store.royaltyRate / 100), taxRate: 10, account: '売上高' },
            { name: 'システム利用料', amount: store.systemFee, taxRate: 10, account: '売上高' },
          ],
          issueDate: issue, dueDate: addDays(issue, 25), status: 'paid', paidAt: addDays(issue, 20) + 'T10:00:00.000Z',
          reportedAt: addDays(issue, 20) + 'T10:00:00.000Z', monthlyReportId: rep.id,
        }
        rep.invoiceId = inv.id
        invoices.push(inv)
      }
      monthlyReports.push(rep)
    })
  }

  const notices: Notice[] = [
    { id: 'n1', title: '【重要】年末年始の本部営業日について', body: '12月29日〜1月3日は本部休業となります。緊急時はSV携帯までご連絡ください。', target: 'all', createdAt: addDays(T, -2) + 'T09:00:00.000Z', createdBy: 'u_yamada', readBy: [] },
    { id: 'n2', title: '処遇改善加算の届出期限のお知らせ', body: '来年度の処遇改善加算の計画書提出期限は各自治体で異なります。本部マニュアル「加算届出ガイド」をご確認ください。', target: 'stores', createdAt: addDays(T, -6) + 'T09:00:00.000Z', createdBy: 'u_takahashi', readBy: ['u_fc_d10'] },
    { id: 'n3', title: '開業準備オンライン相談会（毎週水曜）', body: '開業準備中の加盟者向けに、指定申請・採用の相談会を毎週水曜15時から開催しています。', target: 'fc_applicants', createdAt: addDays(T, -10) + 'T09:00:00.000Z', createdBy: 'u_takahashi', readBy: [] },
  ]

  return { users, deals, tasks, contracts, invoices, stores, notices, clients, helpers, visits, monthlyReports, auditLogs }
}

function toNextMonth(y: number, m: number, day: number) {
  const ny = m === 12 ? y + 1 : y
  const nm = m === 12 ? 1 : m + 1
  return `${ny}-${String(nm).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}


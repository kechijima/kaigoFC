// ===== ユーザー =====
export type HqRole = 'admin' | 'sales' | 'sv' | 'accounting'
export type UserKind = 'hq' | 'fc' | 'field' | 'partner' // partner = 提携先（転倒予防防止協会）

export interface User {
  id: string
  name: string
  email: string
  kind: UserKind
  hqRole?: HqRole
  dealId?: string // 加盟希望者/オーナーの場合
  storeId?: string // 現場スタッフの場合
  fieldRole?: 'manager' | 'sp' | 'helper' // 管理者 / サ責 / ヘルパー
}

// ===== 加盟案件 =====
export type DealStatus = 'active' | 'on_hold' | 'withdrawn' | 'opened'

export interface Deal {
  id: string
  applicantName: string
  companyName: string
  email: string
  phone: string
  area: string
  prefecture: string
  phase: number // 0..6
  status: DealStatus
  salesUserId: string
  svUserId: string
  targetOpenDate: string // YYYY-MM-DD
  createdAt: string
  ownerUserId?: string
  storeId?: string
  withdrawReason?: string
  memo?: string // 本部内部メモ
}

// ===== ワークフロー =====
export type TaskType = 'work' | 'confirm' | 'submit' | 'approve' | 'sign' | 'invoice' | 'payment'
export type TaskStatus = 'todo' | 'in_review' | 'rejected' | 'done' | 'skipped'
export type Assignee = 'hq' | 'fc'

export interface TaskComment {
  at: string
  userId: string
  userName: string
  text: string
}

export interface Task {
  id: string
  dealId: string
  phase: number
  code: string
  title: string
  description?: string
  assignee: Assignee
  hqRole?: HqRole
  type: TaskType
  required: boolean
  hqOnly?: boolean // 加盟店側に表示しない
  dependsOn: string[]
  status: TaskStatus
  dueDate: string
  contractTemplateId?: string
  contractId?: string
  invoiceId?: string
  attachments: string[]
  comments: TaskComment[]
  completedAt?: string
  completedBy?: string
  order: number
}

// ===== 電子契約 =====
export type ContractStatus = 'draft' | 'pending_approval' | 'sent' | 'fc_signed' | 'completed' | 'cancelled'

export interface ContractSigner {
  party: Assignee
  name: string
  email: string
  otpVerifiedAt?: string
  signedAt?: string
  signatureName?: string
  userAgent?: string
  ip?: string
}

export interface ContractHistory {
  at: string
  userName: string
  action: string
  note?: string
}

export interface Contract {
  id: string
  dealId: string
  templateId: string
  title: string
  body: string
  status: ContractStatus
  version: number
  signers: ContractSigner[]
  history: ContractHistory[]
  hash?: string
  createdAt: string
  completedAt?: string
  signDueDate?: string
  pendingOtp?: { code: string; email: string; expiresAt: string }
  terms?: ContractTerms
}

export interface ContractTerms {
  joiningFee: number
  deposit: number
  trainingFee: number
  royaltyRate: number // %
  systemFee: number // 月額
  termYears: number
  territory: string
}

// ===== 請求 =====
export type InvoiceStatus = 'issued' | 'reported' | 'paid'

export interface InvoiceItem {
  name: string
  amount: number // 税抜
  taxRate: number // 0 or 10
  account: string // freee 勘定科目
  category?: FeeCategory // 分配計算用の費目
}

/** 分配ルールの対象になる費目 */
export type FeeCategory = 'joining' | 'deposit' | 'training' | 'royalty' | 'system' | 'insole' | 'analysis'

export interface Invoice {
  id: string
  number: string
  dealId?: string
  storeId?: string
  billToName: string
  kind: 'initial' | 'royalty' | 'order'
  orderId?: string
  title: string
  items: InvoiceItem[]
  issueDate: string
  dueDate: string
  status: InvoiceStatus
  reportedAt?: string
  reportedNote?: string
  paidAt?: string
  monthlyReportId?: string
}

// ===== 店舗・運営 =====
export interface StoreInfo {
  id: string
  dealId: string
  name: string
  companyName: string
  ownerUserId: string
  address: string
  prefecture: string
  officeNumber: string // 指定事業所番号
  openDate: string
  status: 'open' | 'suspended'
  royaltyRate: number
  systemFee: number
}

export interface Notice {
  id: string
  title: string
  body: string
  target: 'all' | 'fc_applicants' | 'stores'
  createdAt: string
  createdBy: string
  readBy: string[]
}

export type ServiceType = '身体介護' | '生活援助' | '身体・生活'

export interface Client {
  id: string
  storeId: string
  name: string
  kana: string
  careLevel: string
  address: string
  careManager: string
  memo?: string
}

export interface Helper {
  id: string
  storeId: string
  name: string
  qualification: string
  employment: '常勤' | '非常勤'
  userId?: string
}

export interface VisitRecord {
  checkIn?: string
  checkOut?: string
  items: string[]
  temperature?: string
  bloodPressure?: string
  note?: string
  recordedBy?: string
}

export interface Visit {
  id: string
  storeId: string
  date: string
  start: string
  end: string
  clientId: string
  helperId: string
  service: ServiceType
  status: 'scheduled' | 'in_progress' | 'done' | 'cancelled'
  record?: VisitRecord
}

export interface MonthlyReport {
  id: string
  storeId: string
  month: string // YYYY-MM
  visitCount: number
  clientCount: number
  revenue: number
  status: 'draft' | 'submitted' | 'invoiced'
  submittedAt?: string
  invoiceId?: string
}

export interface AuditLog {
  id: string
  at: string
  userId: string
  userName: string
  dealId?: string
  action: string
}

// ===== 提携先（転倒予防防止協会）連携 =====

export interface Product {
  id: string
  name: string
  category: 'insole' | 'kit' | 'other'
  sizes?: string[]
  price: number // 税抜（加盟店への販売価格）
  stock: number
  description?: string
}

export interface OrderLine {
  productId: string
  name: string
  size?: string
  clientId?: string // 利用者向けの場合
  qty: number
  price: number
}

export type OrderStatus = 'ordered' | 'accepted' | 'shipped' | 'delivered' | 'cancelled'

export interface Order {
  id: string
  number: string
  storeId: string
  orderedBy: string
  orderedAt: string
  lines: OrderLine[]
  status: OrderStatus
  note?: string
  acceptedAt?: string
  shippedAt?: string
  trackingNo?: string
  deliveredAt?: string
  invoiceId?: string
  analysisId?: string // AI分析レポートからの推奨で発注した場合
}

export interface DistributionRule {
  id: string // = FeeCategory
  category: FeeCategory
  label: string
  rate: number // 協会への分配率（%）
  enabled: boolean
}

export interface SettlementLine {
  invoiceId: string
  invoiceNumber: string
  billToName: string
  category: FeeCategory
  base: number // 税抜の対象額
  rate: number
  amount: number
}

export interface Settlement {
  id: string // st_YYYY-MM
  month: string // 入金月
  lines: SettlementLine[]
  total: number
  status: 'draft' | 'confirmed' | 'paid'
  confirmedAt?: string
  paidAt?: string
}

export interface Video {
  id: string
  title: string
  category: string
  provider: 'hq' | 'partner'
  minutes: number
  required: boolean
  description: string
  storeIds: string[] // 公開先の店舗
  createdAt: string
}

export interface VideoView {
  id: string // `${userId}_${videoId}`
  userId: string
  storeId: string
  videoId: string
  progress: number // 0-100
  completedAt?: string
  updatedAt: string
}

export interface GaitMetrics {
  speed: number // 歩行速度 m/s
  stride: number // 歩幅 cm
  asymmetry: number // 左右差 %
  sway: number // 体幹の揺れ cm
  toeClearance: number // つま先の上がり cm
  cadence: number // 歩数/分
}

export type AnalysisStatus = 'analyzing' | 'review' | 'published'

export interface Analysis {
  id: string
  storeId: string
  clientId: string
  videoFile: string
  shotAt: string // 撮影日
  uploadedBy: string
  uploadedAt: string
  consent: boolean
  status: AnalysisStatus
  metrics?: GaitMetrics
  riskScore?: number // 0-100（高いほど転倒リスク高）
  riskLevel?: 'low' | 'mid' | 'high'
  findings?: string[] // 自動生成の所見
  recommendations?: string[] // 自動生成の推奨
  insoleRecommended?: boolean
  reviewerComment?: string
  reviewedBy?: string
  publishedAt?: string
}

export interface Collections {
  users: User
  deals: Deal
  tasks: Task
  contracts: Contract
  invoices: Invoice
  stores: StoreInfo
  notices: Notice
  clients: Client
  helpers: Helper
  visits: Visit
  monthlyReports: MonthlyReport
  auditLogs: AuditLog
  products: Product
  orders: Order
  distributionRules: DistributionRule
  settlements: Settlement
  videos: Video
  videoViews: VideoView
  analyses: Analysis
}

export type CollectionName = keyof Collections
export const PARTNER_COLLECTIONS: CollectionName[] = ['products', 'orders', 'distributionRules', 'settlements', 'videos', 'videoViews', 'analyses']
export const COLLECTIONS: CollectionName[] = [
  'users', 'deals', 'tasks', 'contracts', 'invoices', 'stores', 'notices',
  'clients', 'helpers', 'visits', 'monthlyReports', 'auditLogs',
  ...PARTNER_COLLECTIONS,
]

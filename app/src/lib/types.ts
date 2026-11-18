// ===== ユーザー =====
export type HqRole = 'admin' | 'sales' | 'sv' | 'accounting'
export type UserKind = 'hq' | 'fc' | 'field'

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
}

export interface Invoice {
  id: string
  number: string
  dealId?: string
  storeId?: string
  billToName: string
  kind: 'initial' | 'royalty'
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
}

export type CollectionName = keyof Collections
export const COLLECTIONS: CollectionName[] = [
  'users', 'deals', 'tasks', 'contracts', 'invoices', 'stores', 'notices',
  'clients', 'helpers', 'visits', 'monthlyReports', 'auditLogs',
]

// 加盟ワークフローのテンプレート（docs/requirements.md §4.2）
import type { Assignee, HqRole, Task, TaskType, Deal } from './types'
import { addDays } from './utils'

export const PHASES = [
  { no: 0, name: '問い合わせ', short: '問合せ' },
  { no: 1, name: '説明会・面談', short: '説明会' },
  { no: 2, name: '加盟申込・審査', short: '審査' },
  { no: 3, name: '契約', short: '契約' },
  { no: 4, name: '入金', short: '入金' },
  { no: 5, name: '開業準備', short: '開業準備' },
  { no: 6, name: '開業', short: '開業' },
] as const

export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  work: '作業', confirm: '確認', submit: '提出', approve: '承認', sign: '電子署名', invoice: '請求', payment: '入金',
}
export const HQ_ROLE_LABEL: Record<HqRole, string> = {
  admin: '本部長（決裁）', sales: '開発担当', sv: 'SV', accounting: '経理',
}

interface TemplateTask {
  code: string
  title: string
  assignee: Assignee
  hqRole?: HqRole
  type: TaskType
  offset: number // 開業希望日からの相対日数（期限）
  dependsOn?: string[]
  required?: boolean
  hqOnly?: boolean
  contractTemplateId?: string
  description?: string
}

export const TEMPLATE: Record<number, TemplateTask[]> = {
  0: [
    { code: '0-1', title: '問い合わせ受付・リード登録', assignee: 'hq', hqRole: 'sales', type: 'work', offset: -240 },
    { code: '0-2', title: '初回連絡・資料送付', assignee: 'hq', hqRole: 'sales', type: 'work', offset: -235, dependsOn: ['0-1'] },
  ],
  1: [
    { code: '1-1', title: '説明会／個別面談の日程調整', assignee: 'hq', hqRole: 'sales', type: 'work', offset: -225 },
    { code: '1-2', title: '説明会への参加', assignee: 'fc', type: 'confirm', offset: -220, dependsOn: ['1-1'] },
    { code: '1-3', title: '秘密保持契約（NDA）の締結', assignee: 'fc', type: 'sign', offset: -215, contractTemplateId: 'nda', description: '事業計画・収支資料の開示前に締結します。' },
    { code: '1-4', title: '事業計画・収支シミュレーションの提示', assignee: 'hq', hqRole: 'sales', type: 'work', offset: -210, dependsOn: ['1-3'] },
    { code: '1-5', title: '候補エリアの商圏確認', assignee: 'hq', hqRole: 'sales', type: 'work', offset: -210, hqOnly: true },
  ],
  2: [
    { code: '2-1', title: '加盟申込書の提出', assignee: 'fc', type: 'submit', offset: -200 },
    { code: '2-2', title: '審査書類の提出（登記簿・決算書・資金証明・本人確認書類）', assignee: 'fc', type: 'submit', offset: -195 },
    { code: '2-3', title: '反社会的勢力チェック', assignee: 'hq', hqRole: 'sales', type: 'work', offset: -190, hqOnly: true, dependsOn: ['2-1'] },
    { code: '2-4', title: '面接・審査', assignee: 'hq', hqRole: 'sales', type: 'work', offset: -188, hqOnly: true, dependsOn: ['2-2'] },
    { code: '2-5', title: '加盟可否の決裁', assignee: 'hq', hqRole: 'admin', type: 'approve', offset: -185, hqOnly: true, dependsOn: ['2-3', '2-4'] },
    { code: '2-6', title: '審査結果の通知', assignee: 'hq', hqRole: 'sales', type: 'work', offset: -183, dependsOn: ['2-5'] },
  ],
  3: [
    { code: '3-1', title: '開示書面（重要事項）の交付・説明', assignee: 'hq', hqRole: 'sales', type: 'work', offset: -175 },
    { code: '3-2', title: '開示書面の受領確認', assignee: 'fc', type: 'confirm', offset: -173, dependsOn: ['3-1'] },
    { code: '3-3', title: 'フランチャイズ加盟契約の締結', assignee: 'fc', type: 'sign', offset: -165, contractTemplateId: 'franchise', dependsOn: ['3-2'], description: '本部で契約書を作成・決裁後、加盟者→本部代表者の順に電子署名します。' },
    { code: '3-4', title: '契約情報の登録（契約期間・テリトリー）', assignee: 'hq', hqRole: 'sales', type: 'work', offset: -163, hqOnly: true, dependsOn: ['3-3'] },
  ],
  4: [
    { code: '4-1', title: '加盟金・保証金・研修費の請求書発行', assignee: 'hq', hqRole: 'accounting', type: 'invoice', offset: -160 },
    { code: '4-2', title: '加盟金等のお振込み', assignee: 'fc', type: 'payment', offset: -150, dependsOn: ['4-1'], description: '振込後に「入金を報告」してください。本部経理が入金を確認すると完了になります。' },
    { code: '4-3', title: '領収書の発行', assignee: 'hq', hqRole: 'accounting', type: 'work', offset: -145, dependsOn: ['4-2'] },
  ],
  5: [
    { code: '5-1', title: '法人設立・定款の事業目的確認', assignee: 'fc', type: 'submit', offset: -140, description: '定款の事業目的に「介護保険法に基づく居宅サービス事業」等の記載が必要です。設立済みの場合は登記簿を提出してください。' },
    { code: '5-2', title: '物件の選定（本部承認）', assignee: 'fc', type: 'submit', offset: -130, description: '事務室・相談スペース・手指洗浄設備を確保できる物件か本部が確認します。' },
    { code: '5-3', title: '賃貸借契約書の提出', assignee: 'fc', type: 'submit', offset: -120, dependsOn: ['5-2'] },
    { code: '5-4', title: '事務所の設備・備品手配', assignee: 'fc', type: 'confirm', offset: -100, dependsOn: ['5-3'] },
    { code: '5-5', title: '自治体への事前相談', assignee: 'fc', type: 'confirm', offset: -110, dependsOn: ['5-1'] },
    { code: '5-6', title: '人員確保（管理者・サ責・訪問介護員 常勤換算2.5人以上）', assignee: 'fc', type: 'submit', offset: -80, description: '人員配置表・資格証・雇用契約書を提出してください。' },
    { code: '5-7', title: '運営規程・重要事項説明書・利用契約書の作成', assignee: 'fc', type: 'submit', offset: -80 },
    { code: '5-8', title: '訪問介護の指定申請', assignee: 'fc', type: 'submit', offset: -65, dependsOn: ['5-3', '5-5', '5-6', '5-7'], description: '指定希望日の前々月末が締切の自治体が多いため早めに準備してください。申請書控えを提出します。' },
    { code: '5-9', title: '指定通知書（事業所番号）の提出', assignee: 'fc', type: 'submit', offset: -5, dependsOn: ['5-8'] },
    { code: '5-10', title: '加算の届出（処遇改善加算 等）', assignee: 'fc', type: 'submit', offset: -20, dependsOn: ['5-8'], required: false },
    { code: '5-11', title: '国保連請求の準備（伝送・請求ソフト設定）', assignee: 'fc', type: 'confirm', offset: -15 },
    { code: '5-12', title: '損害賠償保険の加入', assignee: 'fc', type: 'submit', offset: -20 },
    { code: '5-13', title: 'オーナー・管理者・サ責研修', assignee: 'hq', hqRole: 'sv', type: 'work', offset: -45 },
    { code: '5-14', title: '訪問介護員研修（同行訪問含む）', assignee: 'fc', type: 'confirm', offset: -10, dependsOn: ['5-13'] },
    { code: '5-15', title: '業務システムのアカウント発行', assignee: 'hq', hqRole: 'sv', type: 'work', offset: -30 },
    { code: '5-16', title: '開業前営業（居宅介護支援事業所・地域包括への挨拶）', assignee: 'fc', type: 'confirm', offset: -7 },
    { code: '5-17', title: '開業前最終チェック', assignee: 'hq', hqRole: 'admin', type: 'approve', offset: -3, dependsOn: ['5-9', '5-11', '5-12', '5-14', '5-15'] },
  ],
  6: [
    { code: '6-1', title: '開業日の確定・告知', assignee: 'hq', hqRole: 'sv', type: 'work', offset: -2 },
    { code: '6-2', title: '開業立会い・初期フォロー', assignee: 'hq', hqRole: 'sv', type: 'work', offset: 0, dependsOn: ['6-1'] },
  ],
}

/** 案件にワークフローを展開 */
export function instantiateTasks(deal: Deal): Task[] {
  const tasks: Task[] = []
  let order = 0
  for (const [phase, list] of Object.entries(TEMPLATE)) {
    for (const t of list) {
      tasks.push({
        id: `${deal.id}_${t.code}`,
        dealId: deal.id,
        phase: Number(phase),
        code: t.code,
        title: t.title,
        description: t.description,
        assignee: t.assignee,
        hqRole: t.hqRole,
        type: t.type,
        required: t.required ?? true,
        hqOnly: t.hqOnly,
        dependsOn: t.dependsOn ?? [],
        status: 'todo',
        dueDate: addDays(deal.targetOpenDate, t.offset),
        contractTemplateId: t.contractTemplateId,
        attachments: [],
        comments: [],
        order: order++,
      })
    }
  }
  return tasks
}

export const isClosed = (t: Task) => t.status === 'done' || t.status === 'skipped'

/** 依存タスクが終わっていて、フェーズに到達していれば着手可能 */
export function isAvailable(task: Task, dealTasks: Task[], deal: Deal) {
  if (deal.status !== 'active') return false
  if (task.phase > deal.phase) return false
  return task.dependsOn.every((code) => {
    const dep = dealTasks.find((t) => t.code === code)
    return !dep || isClosed(dep)
  })
}

/** フェーズの必須タスクがすべて完了していれば、次フェーズ番号を返す */
export function computePhase(dealTasks: Task[]) {
  for (const p of PHASES) {
    const open = dealTasks.filter((t) => t.phase === p.no && t.required && !isClosed(t))
    if (open.length) return p.no
  }
  return 7 // すべて完了
}

export function phaseProgress(dealTasks: Task[], phase: number) {
  const list = dealTasks.filter((t) => t.phase === phase)
  const done = list.filter(isClosed).length
  return { done, total: list.length }
}

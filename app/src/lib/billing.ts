import type { ContractTerms, Invoice, InvoiceItem, ServiceType, Visit } from './types'

export function initialInvoiceItems(t: ContractTerms): InvoiceItem[] {
  return [
    { name: '加盟金', amount: t.joiningFee, taxRate: 10, account: '売上高' },
    { name: '保証金（契約終了時返還）', amount: t.deposit, taxRate: 0, account: '預り保証金' },
    { name: '開業研修費', amount: t.trainingFee, taxRate: 10, account: '売上高' },
  ]
}

export function invoiceTotals(inv: Invoice) {
  const subtotal = inv.items.reduce((s, i) => s + i.amount, 0)
  const tax = inv.items.reduce((s, i) => s + Math.floor((i.amount * i.taxRate) / 100), 0)
  return { subtotal, tax, total: subtotal + tax }
}

// 訪問1回あたりの売上の概算（介護報酬単位×地域単価を簡略化したモック値）
const UNIT_PRICE: Record<ServiceType, number> = { 身体介護: 4100, 生活援助: 2300, '身体・生活': 4800 }
export const revenueOf = (v: Visit) => (v.status === 'done' ? UNIT_PRICE[v.service] : 0)

/**
 * freee「取引のインポート」向けCSV（収入取引）。
 * 1請求書の明細行ごとに1行。列は freee のテンプレートに合わせる想定のため、本番前に最新仕様と照合すること。
 */
export function freeeCsv(invoices: Invoice[]) {
  const header = ['収支区分', '管理番号', '発生日', '決済期日', '取引先', '勘定科目', '税区分', '金額', '税計算区分', '税額', '備考', '品目', '決済日', '決済口座', '決済金額']
  const rows: string[][] = []
  for (const inv of invoices) {
    for (const item of inv.items) {
      const tax = Math.floor((item.amount * item.taxRate) / 100)
      const amount = item.amount + tax
      rows.push([
        '収入', inv.number, inv.issueDate.replaceAll('-', '/'), inv.dueDate.replaceAll('-', '/'), inv.billToName,
        item.account, item.taxRate ? '課税売上10%' : '対象外', String(amount), '内税', String(tax), inv.title, item.name,
        inv.paidAt ? inv.paidAt.slice(0, 10).replaceAll('-', '/') : '', inv.paidAt ? '本部普通預金' : '', inv.paidAt ? String(amount) : '',
      ])
    }
  }
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s)
  return [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')
}

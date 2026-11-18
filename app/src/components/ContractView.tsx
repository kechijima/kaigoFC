// 内製電子契約: 作成 → 社内承認 → 加盟者署名 → 本部署名 → 締結完了
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Contract, ContractTerms } from '../lib/types'
import { useData } from '../lib/store'
import * as A from '../lib/actions'
import { db } from '../lib/db'
import { CONTRACT_STATUS, ContractStatusBadge, Field } from './ui'
import { fmtDateTime, yen } from '../lib/utils'

const FLOW: Contract['status'][] = ['draft', 'pending_approval', 'sent', 'fc_signed', 'completed']

export function ContractView({ contract }: { contract: Contract }) {
  const { data, me, toast } = useData()
  const deal = data.deals.find((d) => d.id === contract.dealId)
  const [note, setNote] = useState('')
  const [editing, setEditing] = useState(false)
  const [terms, setTerms] = useState<ContractTerms | undefined>(contract.terms)
  if (!me || !deal) return null
  const isHq = me.kind === 'hq'
  const isAdmin = me.hqRole === 'admin'
  const c = contract
  const run = async (fn: () => Promise<unknown>, msg?: string) => {
    try { await fn(); if (msg) toast(msg) } catch (e) { toast('エラー: ' + (e as Error).message) }
  }
  const cancel = async () => {
    await A.contractTransition(c, 'cancelled', me, '取消', note)
    const task = data.tasks.find((t) => t.contractId === c.id)
    if (task) await db.update('tasks', task.id, { contractId: undefined as unknown as string })
  }

  const canSignAs: 'fc' | 'hq' | null =
    c.status === 'sent' && !isHq && me.dealId === c.dealId ? 'fc' : c.status === 'fc_signed' && isHq && isAdmin ? 'hq' : null

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="card">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold">{c.title}</h2>
            <span className="text-sm text-slate-500">第{c.version}版</span>
            <ContractStatusBadge s={c.status} />
            <Link className="ml-auto text-sm text-teal-700 underline" to={isHq ? `/hq/deals/${deal.id}` : '/fc/workflow'}>{isHq ? 'FC進捗へ戻る' : '手続きへ戻る'}</Link>
          </div>
          {c.status !== 'cancelled' && (
            <ol className="mb-4 flex flex-wrap gap-1 text-xs">
              {FLOW.map((s, i) => {
                const reached = FLOW.indexOf(c.status) >= i
                return <li key={s} className={`rounded px-2 py-1 ${reached ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{i + 1}. {CONTRACT_STATUS[s][0]}</li>
              })}
            </ol>
          )}
          <pre className="max-h-[480px] overflow-y-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-4 font-sans text-sm leading-relaxed">{c.body}</pre>
        </div>

        {canSignAs && <SignFlow contract={c} party={canSignAs} />}
      </div>

      <div className="space-y-4">
        {isHq && c.status !== 'completed' && c.status !== 'cancelled' && (
          <div className="card space-y-2">
            <h3 className="font-semibold">本部の操作</h3>
            {c.status === 'draft' && c.terms && (
              editing && terms ? (
                <div className="space-y-2">
                  <TermsForm terms={terms} onChange={setTerms} />
                  <div className="flex gap-2">
                    <button className="btn-primary" onClick={() => run(async () => { await A.updateContractTerms(c, deal, terms, me); setEditing(false) }, '条件を反映しました')}>反映</button>
                    <button className="btn-secondary" onClick={() => setEditing(false)}>キャンセル</button>
                  </div>
                </div>
              ) : <button className="btn-secondary w-full justify-center" onClick={() => { setTerms(c.terms); setEditing(true) }}>契約条件を編集</button>
            )}
            <textarea className="input" rows={2} placeholder="コメント（差し戻し・取消時）" value={note} onChange={(e) => setNote(e.target.value)} />
            {c.status === 'draft' && <button className="btn-primary w-full justify-center" onClick={() => run(() => A.contractTransition(c, 'pending_approval', me, '社内承認を依頼'), '本部長に承認を依頼しました')}>社内承認を依頼</button>}
            {c.status === 'pending_approval' && (
              <>
                <button className="btn-primary w-full justify-center" disabled={!isAdmin} onClick={() => run(() => A.contractTransition(c, 'sent', me, '社内承認・加盟者へ送付'), `承認し、${deal.applicantName} 様へ署名依頼を送付しました（モック）`)}>承認して加盟者へ送付</button>
                <button className="btn-danger w-full justify-center" disabled={!isAdmin || !note} onClick={() => run(() => A.contractTransition(c, 'draft', me, '差し戻し', note))}>差し戻し</button>
                {!isAdmin && <p className="text-xs text-slate-500">承認は本部長（山田）のみ可能です。</p>}
              </>
            )}
            {c.status === 'sent' && <p className="text-xs text-slate-500">加盟者の署名待ちです。加盟者（{deal.applicantName}）に切り替えると署名できます。</p>}
            {c.status === 'fc_signed' && !isAdmin && <p className="text-xs text-slate-500">本部代表者（本部長・山田）の署名待ちです。</p>}
            <button className="btn-danger w-full justify-center" disabled={!note} onClick={() => run(cancel, '取消しました')}>契約書を取消</button>
          </div>
        )}

        {c.terms && (
          <div className="card text-sm">
            <h3 className="mb-2 font-semibold">契約条件</h3>
            <dl className="grid grid-cols-2 gap-y-1">
              <dt className="text-slate-500">加盟金</dt><dd>{yen(c.terms.joiningFee)}</dd>
              <dt className="text-slate-500">保証金</dt><dd>{yen(c.terms.deposit)}</dd>
              <dt className="text-slate-500">研修費</dt><dd>{yen(c.terms.trainingFee)}</dd>
              <dt className="text-slate-500">ロイヤリティ</dt><dd>{c.terms.royaltyRate}%</dd>
              <dt className="text-slate-500">システム料</dt><dd>{yen(c.terms.systemFee)}/月</dd>
              <dt className="text-slate-500">契約期間</dt><dd>{c.terms.termYears}年</dd>
              <dt className="text-slate-500">テリトリー</dt><dd>{c.terms.territory}</dd>
            </dl>
          </div>
        )}

        <div className="card text-sm">
          <h3 className="mb-2 font-semibold">署名者</h3>
          {c.signers.map((s) => (
            <div key={s.party} className="mb-2 rounded bg-slate-50 p-2">
              <div className="font-medium">{s.party === 'fc' ? '加盟者' : '本部'}: {s.name}</div>
              <div className="text-xs text-slate-500">{s.email}</div>
              {s.signedAt ? (
                <div className="mt-1 text-xs text-emerald-700">✓ 署名済 {fmtDateTime(s.signedAt)}<br />署名: {s.signatureName} / メール認証 {fmtDateTime(s.otpVerifiedAt)}<br /><span className="text-slate-400">IP: {s.ip}</span></div>
              ) : <div className="mt-1 text-xs text-slate-400">未署名</div>}
            </div>
          ))}
          {c.hash && <div className="break-all text-[11px] text-slate-500">文書ハッシュ(SHA-256): {c.hash}</div>}
        </div>

        <div className="card text-sm">
          <h3 className="mb-2 font-semibold">締結記録</h3>
          <ul className="space-y-1 text-xs">
            {c.history.map((h, i) => <li key={i}><span className="text-slate-400">{fmtDateTime(h.at)}</span> {h.userName}: {h.action}{h.note && <span className="text-slate-500">（{h.note}）</span>}</li>)}
          </ul>
        </div>
      </div>
    </div>
  )
}

function TermsForm({ terms, onChange }: { terms: ContractTerms; onChange: (t: ContractTerms) => void }) {
  const num = (k: keyof ContractTerms) => (
    <input className="input" type="number" value={terms[k] as number} onChange={(e) => onChange({ ...terms, [k]: Number(e.target.value) })} />
  )
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label="加盟金">{num('joiningFee')}</Field>
      <Field label="保証金">{num('deposit')}</Field>
      <Field label="研修費">{num('trainingFee')}</Field>
      <Field label="ロイヤリティ(%)">{num('royaltyRate')}</Field>
      <Field label="システム料/月">{num('systemFee')}</Field>
      <Field label="契約年数">{num('termYears')}</Field>
      <div className="col-span-2"><Field label="テリトリー"><input className="input" value={terms.territory} onChange={(e) => onChange({ ...terms, territory: e.target.value })} /></Field></div>
    </div>
  )
}

function SignFlow({ contract, party }: { contract: Contract; party: 'fc' | 'hq' }) {
  const { data, me, toast } = useData()
  const [agree, setAgree] = useState(false)
  const [sent, setSent] = useState<{ email: string; code: string } | null>(null)
  const [otp, setOtp] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const deal = data.deals.find((d) => d.id === contract.dealId)!
  const signer = contract.signers.find((s) => s.party === party)!
  const expectedName = party === 'fc' ? deal.applicantName : me!.name

  const sendCode = async () => {
    const r = await A.sendOtp(contract, party)
    setSent(r)
    toast(`（モック）${r.email} に認証コードを送信しました\n認証コード: ${r.code}`)
  }
  const sign = async () => {
    setBusy(true)
    try {
      await A.signContract(contract, party, name, otp, me!, data.tasks, deal)
      toast(party === 'fc' ? '署名しました。本部の署名をお待ちください' : '署名しました。契約が締結されました')
    } catch (e) { toast((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="card space-y-4 border-teal-300">
      <h3 className="font-bold text-teal-800">電子署名（{signer.name} 様）</h3>
      <div>
        <div className="mb-1 text-sm font-semibold">1. 内容の確認</div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />上記の契約書（第{contract.version}版）の内容を確認し、同意します</label>
      </div>
      <div className={agree ? '' : 'pointer-events-none opacity-40'}>
        <div className="mb-1 text-sm font-semibold">2. メール認証</div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-secondary" onClick={sendCode}>{sent ? '再送信' : `${signer.email} に認証コードを送信`}</button>
          {sent && <input className="input w-36" placeholder="6桁のコード" value={otp} maxLength={6} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} />}
          {sent && <span className="text-xs text-slate-400">モックのため画面右下にコードを表示しています</span>}
        </div>
      </div>
      <div className={agree && otp.length === 6 ? '' : 'pointer-events-none opacity-40'}>
        <div className="mb-1 text-sm font-semibold">3. 署名（氏名を入力）</div>
        <input className="input max-w-xs" placeholder={expectedName} value={name} onChange={(e) => setName(e.target.value)} />
        {name && <div className="mt-2 inline-block rounded border border-slate-300 px-6 py-2 font-serif text-2xl italic text-slate-700">{name}</div>}
      </div>
      <button className="btn-primary" disabled={busy || !agree || otp.length !== 6 || name.replace(/\s/g, '') !== expectedName.replace(/\s/g, '')} onClick={sign}>署名する</button>
      {name && name.replace(/\s/g, '') !== expectedName.replace(/\s/g, '') && <p className="text-xs text-rose-600">署名者の氏名（{expectedName}）と一致させてください</p>}
    </div>
  )
}

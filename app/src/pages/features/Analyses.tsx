// AI歩行動画分析: アップロード（加盟店）→ AI解析・レポート自動作成 → 協会レビュー・発行 → 加盟店で閲覧
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useData } from '../../lib/store'
import { METRIC_DEFS, PARTNER_NAME, RISK_LABEL, metricLevel } from '../../lib/partner'
import { publishAnalysis, runAnalysis, saveAnalysisReview, uploadAnalysis } from '../../lib/partnerActions'
import { Empty, Field, Modal, PageTitle, Stat } from '../../components/ui'
import { fmtDate, fmtDateTime, today } from '../../lib/utils'
import type { Analysis } from '../../lib/types'

const STATUS: Record<Analysis['status'], [string, string]> = {
  analyzing: ['AI解析中', 'bg-sky-100 text-sky-700'],
  review: ['協会で確認中', 'bg-amber-100 text-amber-800'],
  published: ['レポート発行済', 'bg-emerald-100 text-emerald-700'],
}
const LEVEL_STYLE = { ok: ['良好', 'text-emerald-700 bg-emerald-50'], caution: ['注意', 'text-amber-800 bg-amber-50'], risk: ['要対策', 'text-rose-700 bg-rose-50'] } as const

function useBase() {
  const { me } = useData()
  return me?.kind === 'partner' ? '/partner' : me?.kind === 'hq' ? '/hq' : me?.kind === 'fc' ? '/fc' : '/field'
}

export const RiskBadge = ({ a }: { a: Analysis }) => a.riskLevel ? <span className={`badge ${RISK_LABEL[a.riskLevel][1]}`}>{RISK_LABEL[a.riskLevel][0]}（{a.riskScore}）</span> : null

export function AnalysisList() {
  const { data, me } = useData()
  const base = useBase()
  const nav = useNavigate()
  const [status, setStatus] = useState(me?.kind === 'partner' ? 'review' : '')
  const [uploading, setUploading] = useState(false)
  if (!me) return null
  const isStoreSide = me.kind === 'fc' || me.kind === 'field'
  const list = data.analyses
    .filter((a) => !isStoreSide || a.storeId === me.storeId)
    .filter((a) => !status || a.status === status)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
  const all = data.analyses.filter((a) => !isStoreSide || a.storeId === me.storeId)
  const clientName = (id: string) => data.clients.find((c) => c.id === id)?.name ?? '-'
  const storeName = (id: string) => data.stores.find((s) => s.id === id)?.name ?? '-'

  return (
    <div className="space-y-4">
      <PageTitle
        sub={isStoreSide ? `利用者の歩行動画をアップロードすると、AIが分析し、${PARTNER_NAME}の確認後にレポートが届きます` : me.kind === 'partner' ? 'AIが作成したレポート下書きを確認し、コメントを追記して加盟店へ発行します' : '全加盟店のAI動画分析'}
        actions={<>
          <select className="input w-full sm:w-44" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">すべての状態</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select>
          {isStoreSide && <button className="btn-primary w-full justify-center py-2 sm:w-auto" onClick={() => setUploading(true)}>＋ 歩行動画をアップロード</button>}
        </>}>
        {me.kind === 'field' ? '歩行分析' : 'AI動画分析'}
      </PageTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="解析中・確認中" value={all.filter((a) => a.status !== 'published').length} tone="amber" />
        <Stat label="発行済レポート" value={all.filter((a) => a.status === 'published').length} tone="teal" />
        <Stat label="転倒リスク 高" value={all.filter((a) => a.status === 'published' && a.riskLevel === 'high').length} tone="rose" />
        <Stat label="インソール推奨" value={all.filter((a) => a.status === 'published' && a.insoleRecommended).length} />
      </div>
      <div className="space-y-2">
        {list.map((a) => (
          <button key={a.id} onClick={() => nav(`${base}/analyses/${a.id}`)} className="card flex w-full flex-wrap items-center gap-2 p-3 text-left hover:border-teal-400">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{clientName(a.clientId)} 様 {!isStoreSide && <span className="text-xs font-normal text-slate-500">／{storeName(a.storeId)}</span>}</div>
              <div className="text-xs text-slate-500">撮影 {fmtDate(a.shotAt)}・アップロード {fmtDateTime(a.uploadedAt)}</div>
            </div>
            <span className={`badge ${STATUS[a.status][1]}`}>{STATUS[a.status][0]}</span>
            {(a.status === 'published' || !isStoreSide) && <RiskBadge a={a} />}
            <span className="text-slate-300">›</span>
          </button>
        ))}
        {!list.length && <Empty>該当する分析はありません</Empty>}
      </div>
      {uploading && <UploadModal onClose={() => setUploading(false)} />}
    </div>
  )
}

function UploadModal({ onClose }: { onClose: () => void }) {
  const { data, me, toast } = useData()
  const base = useBase()
  const nav = useNavigate()
  const clients = data.clients.filter((c) => c.storeId === me?.storeId)
  const [f, setF] = useState({ clientId: clients[0]?.id ?? '', shotAt: today(), file: '', consent: false })
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    const client = clients.find((c) => c.id === f.clientId)!
    const a = await uploadAnalysis(client, f.file, f.shotAt, me!)
    toast('アップロードしました。AIが解析しています…')
    // モック: 数秒後にAI解析が完了し、レポート下書きが作成される
    setTimeout(async () => {
      await runAnalysis(a, client, data.analyses)
      toast('AI解析が完了しました。協会の確認後にレポートが発行されます')
    }, 2500)
    onClose()
    nav(`${base}/analyses/${a.id}`)
  }
  return (
    <Modal title="歩行動画のアップロード" onClose={onClose}>
      <div className="space-y-3">
        <Field label="利用者"><select className="input" value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value })}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name} 様（{c.careLevel}）</option>)}</select></Field>
        <Field label="撮影日"><input className="input" type="date" value={f.shotAt} max={today()} onChange={(e) => setF({ ...f, shotAt: e.target.value })} /></Field>
        <Field label="歩行動画（横から5m程度の歩行を撮影）">
          <input type="file" accept="video/*" capture="environment" className="block w-full text-sm" onChange={(e) => setF({ ...f, file: e.target.files?.[0]?.name ?? '' })} />
        </Field>
        <p className="text-xs text-slate-500">撮影のコツは研修動画「AI歩行分析のための動画の撮り方」を参照。モックのため動画は送信せず、ファイル名のみ記録します。</p>
        <label className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-sm"><input type="checkbox" className="mt-0.5 h-5 w-5" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} />利用者本人（またはご家族）から、動画の撮影とAI分析・協会への提供について同意を得ています</label>
        <button className="btn-primary w-full justify-center py-2.5" disabled={busy || !f.file || !f.consent || !f.clientId} onClick={submit}>アップロードしてAI分析を依頼</button>
      </div>
    </Modal>
  )
}

export function AnalysisDetail() {
  const { id } = useParams()
  const { data, me, toast } = useData()
  const base = useBase()
  const a = data.analyses.find((x) => x.id === id)
  const [editing, setEditing] = useState(false)
  const [comment, setComment] = useState('')
  if (!a || !me) return <Empty>分析が見つかりません</Empty>
  const client = data.clients.find((c) => c.id === a.clientId)
  const store = data.stores.find((s) => s.id === a.storeId)
  const isPartner = me.kind === 'partner'
  const isStoreSide = me.kind === 'fc' || me.kind === 'field'
  if (isStoreSide && a.storeId !== me.storeId) return <Empty>分析が見つかりません</Empty>
  const history = data.analyses.filter((x) => x.clientId === a.clientId && x.metrics && (x.status === 'published' || x.id === a.id)).sort((x, y) => x.shotAt.localeCompare(y.shotAt))
  const prev = history.filter((x) => x.shotAt < a.shotAt).at(-1)
  const showReport = a.metrics && (a.status === 'published' || !isStoreSide)

  return (
    <div className="space-y-4">
      <Link to={`${base}/analyses`} className="text-sm text-teal-700 print:hidden">← 一覧</Link>
      <div className="card space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold">歩行分析レポート</h1>
          <span className={`badge ${STATUS[a.status][1]}`}>{STATUS[a.status][0]}</span>
          <div className="ml-auto flex gap-2 print:hidden">
            {showReport && <button className="btn-secondary" onClick={() => window.print()}>印刷</button>}
          </div>
        </div>
        <div className="text-sm">{client?.name} 様（{client?.careLevel}）／{store?.name}</div>
        <div className="text-xs text-slate-500">撮影日 {fmtDate(a.shotAt)}・動画 {a.videoFile}・分析 {PARTNER_NAME}{a.publishedAt && `・発行 ${fmtDate(a.publishedAt)}`}</div>
      </div>

      {a.status === 'analyzing' && (
        <div className="card space-y-3 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-teal-200 border-t-teal-600" />
          <div className="text-sm">AIが歩行動画を解析しています（モック: 数秒で完了します）</div>
          {!isStoreSide && client && <button className="btn-secondary mx-auto" onClick={async () => { await runAnalysis(a, client, data.analyses); toast('AI解析を実行しました') }}>解析を今すぐ実行</button>}
        </div>
      )}
      {a.status === 'review' && isStoreSide && (
        <div className="card text-sm text-slate-600">AI解析は完了しました。現在、{PARTNER_NAME}の担当者がレポートを確認しています。発行されるとここに表示されます。</div>
      )}

      {showReport && a.metrics && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className={`card text-center ${a.riskLevel === 'high' ? 'border-rose-300' : a.riskLevel === 'mid' ? 'border-amber-300' : 'border-emerald-300'}`}>
              <div className="text-xs text-slate-500">転倒リスクスコア</div>
              <div className="text-4xl font-bold">{a.riskScore}<span className="text-base font-normal text-slate-400">/100</span></div>
              <RiskBadge a={a} />
              {prev?.riskScore != null && <div className="mt-1 text-xs text-slate-500">前回 {prev.riskScore}（{fmtDate(prev.shotAt)}）</div>}
            </div>
            <div className="card sm:col-span-2">
              <div className="mb-2 text-xs text-slate-500">スコアの推移</div>
              <div className="flex h-24 items-end gap-3">
                {history.map((h) => (
                  <div key={h.id} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-xs">{h.riskScore}</span>
                    <div className={`w-full max-w-12 rounded-t ${h.id === a.id ? 'bg-teal-600' : 'bg-slate-300'}`} style={{ height: `${(h.riskScore ?? 0) * 0.7}px` }} />
                    <span className="text-[10px] text-slate-500">{h.shotAt.slice(2).replaceAll('-', '/')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card overflow-x-auto p-0">
            <table className="w-full min-w-[520px]">
              <thead className="bg-slate-50"><tr><th className="th">指標</th><th className="th text-right">今回</th><th className="th text-right">前回</th><th className="th">判定</th><th className="th">参考値</th></tr></thead>
              <tbody>{METRIC_DEFS.map((d) => {
                const v = a.metrics![d.key]
                const lv = metricLevel(d, v)
                return (
                  <tr key={d.key}>
                    <td className="td font-medium">{d.label}</td>
                    <td className="td text-right">{v} <span className="text-xs text-slate-400">{d.unit}</span></td>
                    <td className="td text-right text-slate-500">{prev?.metrics ? prev.metrics[d.key] : '-'}</td>
                    <td className="td"><span className={`badge ${LEVEL_STYLE[lv][1]}`}>{LEVEL_STYLE[lv][0]}</span></td>
                    <td className="td text-xs text-slate-500">{d.higherIsBetter ? `${d.caution}${d.unit}以上` : `${d.caution}${d.unit}以下`}</td>
                  </tr>
                )
              })}</tbody>
            </table>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="card">
              <h2 className="mb-2 font-semibold">所見（AI自動作成）</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm">{a.findings?.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
            <div className="card">
              <h2 className="mb-2 font-semibold">おすすめの対策（AI自動作成）</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm">{a.recommendations?.map((t, i) => <li key={i}>{t}</li>)}</ul>
              {a.insoleRecommended && a.status === 'published' && isStoreSide && (
                <Link to={`${base === '/field' ? '/field' : '/fc'}/orders?analysis=${a.id}`} className="btn-primary mt-3 print:hidden">推奨インソールを発注する</Link>
              )}
            </div>
          </div>

          <div className="card">
            <h2 className="mb-2 font-semibold">協会からのコメント</h2>
            {editing ? (
              <div className="space-y-2">
                <textarea className="input" rows={4} value={comment} onChange={(e) => setComment(e.target.value)} />
                <div className="flex gap-2">
                  <button className="btn-primary" onClick={async () => { await saveAnalysisReview(a, { reviewerComment: comment, findings: a.findings, recommendations: a.recommendations }); setEditing(false); toast('コメントを保存しました') }}>保存</button>
                  <button className="btn-secondary" onClick={() => setEditing(false)}>キャンセル</button>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-sm">{a.reviewerComment || <span className="text-slate-400">（未記入）</span>}</p>
            )}
            {isPartner && !editing && (
              <div className="mt-3 flex flex-wrap gap-2 print:hidden">
                <button className="btn-secondary" onClick={() => { setComment(a.reviewerComment ?? ''); setEditing(true) }}>コメントを編集</button>
                {a.status === 'review' && <button className="btn-primary" onClick={async () => { await publishAnalysis(a, me); toast(`${store?.name} へレポートを発行しました`) }}>加盟店へ発行する</button>}
              </div>
            )}
          </div>
          <p className="text-xs text-slate-400">※ モックのため、指標はAIを模した擬似的な値です。判定の参考値は仮のもので、本番では協会の基準に置き換えます。</p>
        </>
      )}
    </div>
  )
}

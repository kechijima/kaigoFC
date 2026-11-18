import { useState } from 'react'
import { useData, resetSeed } from '../../lib/store'
import { db } from '../../lib/db'
import { PageTitle } from '../../components/ui'
import { HQ_ROLE_LABEL, PHASES, TEMPLATE, TASK_TYPE_LABEL } from '../../lib/workflow'
import { COLLECTIONS } from '../../lib/types'

export default function Settings() {
  const { data, toast } = useData()
  const [busy, setBusy] = useState(false)
  const reset = async () => {
    if (!confirm('すべてのデータを削除し、ダミーデータを投入し直します。よろしいですか？')) return
    setBusy(true)
    try { await resetSeed(); toast('ダミーデータを投入しました') } catch (e) { toast('エラー: ' + (e as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="space-y-4">
      <PageTitle>設定・データ</PageTitle>
      <div className="card space-y-3 text-sm">
        <h2 className="font-semibold">データベース</h2>
        <p>接続先: <b>{db.mode === 'local' ? 'ローカル（ブラウザの localStorage）' : db.mode === 'emulator' ? 'Firestore エミュレータ (127.0.0.1:8080)' : `Firestore（${import.meta.env.VITE_FIREBASE_PROJECT_ID}）`}</b></p>
        {db.mode === 'local' && <p className="text-xs text-slate-500">app/.env.local に Firebase の設定を書くと Firestore に切り替わります（app/.env.example 参照）。同じブラウザの別タブで本部と加盟店を並べて操作すると、変更がリアルタイムに反映されます。</p>}
        <div className="flex flex-wrap gap-2 text-xs">{COLLECTIONS.map((c) => <span key={c} className="rounded bg-slate-100 px-2 py-1">{c}: {data[c].length}件</span>)}</div>
        <button className="btn-danger" disabled={busy} onClick={reset}>{busy ? '投入中…' : 'ダミーデータを投入し直す（全データ初期化）'}</button>
      </div>
      <div className="card text-sm">
        <h2 className="mb-2 font-semibold">ワークフローテンプレート（訪問介護・標準）</h2>
        <p className="mb-3 text-xs text-slate-500">モックでは固定です。期限は開業希望日からの相対日数で自動設定されます。</p>
        {PHASES.map((p) => (
          <div key={p.no} className="mb-3">
            <div className="font-semibold">P{p.no} {p.name}</div>
            <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-xs"><tbody>
              {TEMPLATE[p.no].map((t) => (
                <tr key={t.code} className="border-t border-slate-100">
                  <td className="w-10 py-1 text-slate-400">{t.code}</td><td className="py-1">{t.title}</td>
                  <td className="w-20 py-1">{TASK_TYPE_LABEL[t.type]}</td>
                  <td className="w-32 py-1">{t.assignee === 'hq' ? `本部・${HQ_ROLE_LABEL[t.hqRole!]}` : '加盟者'}</td>
                  <td className="w-24 py-1 text-slate-500">開業{t.offset}日</td>
                  <td className="w-32 py-1 text-slate-500">{t.dependsOn?.length ? `前提: ${t.dependsOn.join(', ')}` : ''}</td>
                </tr>
              ))}
            </tbody></table></div>
          </div>
        ))}
      </div>
    </div>
  )
}

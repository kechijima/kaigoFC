// 教育動画: 加盟店ごとの視聴ページ（スタッフ）／受講状況（オーナー）／ライブラリ・公開設定・進捗（本部・協会）
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useData } from '../../lib/store'
import { recordView, saveVideo, toggleVideoStore } from '../../lib/partnerActions'
import { Empty, Field, Modal, PageTitle, Stat } from '../../components/ui'
import { fmtDate, nowIso, uid } from '../../lib/utils'
import type { Video } from '../../lib/types'

const ProviderBadge = ({ v }: { v: Video }) => (
  <span className={`badge ${v.provider === 'partner' ? 'bg-indigo-50 text-indigo-700' : 'bg-orange-50 text-orange-700'}`}>{v.provider === 'partner' ? '協会' : '本部'}</span>
)

/** 加盟店ごとの視聴ページ（/field/videos、プレビュー: /learn/:storeId） */
export function StoreVideoPage() {
  const { storeId: paramStore } = useParams()
  const { data, me } = useData()
  const [playing, setPlaying] = useState<Video | null>(null)
  const [cat, setCat] = useState('')
  const storeId = paramStore ?? me?.storeId
  const store = data.stores.find((s) => s.id === storeId)
  if (!store || !me) return <Empty>視聴ページが見つかりません</Empty>
  const preview = !!paramStore && me.storeId !== paramStore
  const videos = data.videos.filter((v) => v.storeIds.includes(store.id)).sort((a, b) => Number(b.required) - Number(a.required) || a.id.localeCompare(b.id))
  const cats = [...new Set(videos.map((v) => v.category))]
  const myView = (vid: string) => data.videoViews.find((x) => x.userId === me.id && x.videoId === vid)
  const req = videos.filter((v) => v.required)
  const done = req.filter((v) => (myView(v.id)?.progress ?? 0) >= 100).length

  return (
    <div className="space-y-4">
      <PageTitle sub={preview ? `${store.name} の視聴ページ（本部・協会のプレビュー表示）` : `${store.name} 専用の研修動画ページ`}>研修動画</PageTitle>
      {!preview && (
        <div className="card">
          <div className="flex items-center justify-between text-sm"><span>必須動画の修了</span><b>{done} / {req.length}</b></div>
          <div className="mt-2 h-2 rounded bg-slate-100"><div className="h-2 rounded bg-teal-500" style={{ width: `${req.length ? (done / req.length) * 100 : 0}%` }} /></div>
        </div>
      )}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {['', ...cats].map((c) => <button key={c} onClick={() => setCat(c)} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm ${cat === c ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300 bg-white'}`}>{c || 'すべて'}</button>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {videos.filter((v) => !cat || v.category === cat).map((v) => {
          const p = preview ? 0 : myView(v.id)?.progress ?? 0
          return (
            <button key={v.id} onClick={() => setPlaying(v)} className="card flex flex-col gap-2 p-0 text-left hover:border-teal-400">
              <div className="relative flex aspect-video items-center justify-center rounded-t-lg bg-gradient-to-br from-slate-700 to-slate-900 text-white">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-2xl">▶</span>
                <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 text-xs">{v.minutes}分</span>
                {p >= 100 && <span className="absolute left-2 top-2 badge bg-emerald-500 text-white">修了</span>}
              </div>
              <div className="space-y-1 px-3 pb-3">
                <div className="flex flex-wrap items-center gap-1"><ProviderBadge v={v} />{v.required && <span className="badge bg-rose-50 text-rose-700">必須</span>}<span className="text-xs text-slate-500">{v.category}</span></div>
                <div className="font-medium">{v.title}</div>
                <div className="text-xs text-slate-500">{v.description}</div>
                {!preview && <div className="h-1.5 rounded bg-slate-100"><div className="h-1.5 rounded bg-teal-500" style={{ width: `${p}%` }} /></div>}
              </div>
            </button>
          )
        })}
      </div>
      {!videos.length && <Empty>公開されている動画はありません</Empty>}
      {playing && <PlayerModal video={playing} preview={preview} onClose={() => setPlaying(null)} />}
    </div>
  )
}

/** モックの動画プレーヤー: 再生すると進捗が進み、視聴記録を保存する */
function PlayerModal({ video, preview, onClose }: { video: Video; preview: boolean; onClose: () => void }) {
  const { data, me, toast } = useData()
  const existing = data.videoViews.find((x) => x.userId === me?.id && x.videoId === video.id)
  const [progress, setProgress] = useState(existing?.progress ?? 0)
  const [play, setPlay] = useState(false)
  const saved = useRef(progress)
  useEffect(() => {
    if (!play) return
    const t = setInterval(() => setProgress((p) => Math.min(100, p + 4)), 200) // モック: 約5秒で最後まで
    return () => clearInterval(t)
  }, [play])
  useEffect(() => {
    if (preview || !me || progress === saved.current) return
    if (progress >= 100 || progress - saved.current >= 20) {
      saved.current = progress
      recordView(me, video, progress, existing)
      if (progress >= 100) { setPlay(false); toast(`「${video.title}」を修了しました`) }
    }
  }, [progress]) // eslint-disable-line react-hooks/exhaustive-deps
  const close = () => { if (!preview && me && progress > saved.current) recordView(me, video, progress, existing); onClose() }
  return (
    <Modal title={video.title} onClose={close} wide>
      <div className="relative flex aspect-video items-center justify-center rounded-md bg-slate-900 text-white">
        <button className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-3xl hover:bg-white/30" onClick={() => setPlay(!play)} aria-label={play ? '一時停止' : '再生'}>{play ? '❚❚' : '▶'}</button>
        <span className="absolute left-3 top-2 text-xs opacity-70">動画プレーヤー（モック）</span>
        <div className="absolute inset-x-3 bottom-3 h-1.5 rounded bg-white/20"><div className="h-1.5 rounded bg-teal-400" style={{ width: `${progress}%` }} /></div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <ProviderBadge v={video} />{video.required && <span className="badge bg-rose-50 text-rose-700">必須</span>}
        <span className="text-slate-500">{video.minutes}分・視聴 {progress}%</span>
        {existing?.completedAt && <span className="text-emerald-700">✓ {fmtDate(existing.completedAt)} 修了</span>}
      </div>
      <p className="mt-2 text-sm text-slate-600">{video.description}</p>
      {preview && <p className="mt-2 text-xs text-slate-400">プレビュー表示のため視聴記録は残りません。</p>}
    </Modal>
  )
}

/** オーナー: 自店スタッフの受講状況 */
export function StoreVideoProgress() {
  const { me } = useData()
  if (!me?.storeId) return <Empty>開業後に利用できます</Empty>
  return (
    <div className="space-y-4">
      <PageTitle sub="自店スタッフの研修動画の受講状況" actions={<Link className="btn-secondary" to={`/learn/${me.storeId}`}>視聴ページを見る</Link>}>教育動画</PageTitle>
      <ProgressMatrix storeId={me.storeId} />
    </div>
  )
}

function ProgressMatrix({ storeId }: { storeId: string }) {
  const { data } = useData()
  const staff = data.helpers.filter((h) => h.storeId === storeId && h.userId)
  const videos = data.videos.filter((v) => v.storeIds.includes(storeId))
  const prog = (uid: string, vid: string) => data.videoViews.find((x) => x.userId === uid && x.videoId === vid)?.progress ?? 0
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full min-w-[640px]">
        <thead className="bg-slate-50"><tr><th className="th sticky left-0 bg-slate-50">スタッフ</th>{videos.map((v) => <th key={v.id} className="th w-24 text-center text-[11px] font-normal" title={v.title}>{v.title.slice(0, 10)}{v.title.length > 10 ? '…' : ''}{v.required && <span className="text-rose-600">*</span>}</th>)}<th className="th text-center">必須修了</th></tr></thead>
        <tbody>{staff.map((h) => {
          const req = videos.filter((v) => v.required)
          const done = req.filter((v) => prog(h.userId!, v.id) >= 100).length
          return (
            <tr key={h.id}>
              <td className="td sticky left-0 bg-white font-medium">{h.name}</td>
              {videos.map((v) => {
                const p = prog(h.userId!, v.id)
                return <td key={v.id} className="td text-center">{p >= 100 ? <span className="text-emerald-600">✓</span> : p > 0 ? <span className="text-xs text-amber-700">{p}%</span> : <span className="text-slate-300">－</span>}</td>
              })}
              <td className={`td text-center font-semibold ${done === req.length ? 'text-emerald-700' : 'text-rose-600'}`}>{done}/{req.length}</td>
            </tr>
          )
        })}</tbody>
      </table>
      {!staff.length && <Empty>スタッフがいません</Empty>}
      <div className="px-3 py-2 text-xs text-slate-400">* は必須動画</div>
    </div>
  )
}

/** 本部・協会: ライブラリ、店舗ごとの公開設定、受講状況 */
export function VideoAdmin() {
  const { data, me, toast } = useData()
  const [tab, setTab] = useState<'library' | 'assign' | 'progress'>('library')
  const [editing, setEditing] = useState<Video | null>(null)
  const [storeId, setStoreId] = useState('')
  if (!me) return null
  const isPartner = me.kind === 'partner'
  const canEdit = (v: Video) => !isPartner || v.provider === 'partner'
  const sid = storeId || data.stores[0]?.id
  const completion = (sId: string) => {
    const staff = data.helpers.filter((h) => h.storeId === sId && h.userId)
    const req = data.videos.filter((v) => v.required && v.storeIds.includes(sId))
    const total = staff.length * req.length
    const done = staff.reduce((n, h) => n + req.filter((v) => (data.videoViews.find((x) => x.userId === h.userId && x.videoId === v.id)?.progress ?? 0) >= 100).length, 0)
    return total ? Math.round((done / total) * 100) : 0
  }
  const newVideo = (): Video => ({ id: uid('vd_'), title: '', category: isPartner ? '転倒予防' : '基礎研修', provider: isPartner ? 'partner' : 'hq', minutes: 10, required: false, description: '', storeIds: data.stores.map((s) => s.id), createdAt: nowIso() })

  return (
    <div className="space-y-4">
      <PageTitle sub="動画を登録し、加盟店ごとに公開する動画を選ぶと、その店舗専用の視聴ページに表示されます" actions={<button className="btn-primary" onClick={() => setEditing(newVideo())}>＋ 動画を登録</button>}>教育動画</PageTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="登録動画" value={data.videos.length} />
        <Stat label="協会提供" value={data.videos.filter((v) => v.provider === 'partner').length} />
        {data.stores.slice(0, 2).map((s) => <Stat key={s.id} label={`${s.name} 必須修了率`} value={`${completion(s.id)}%`} tone="teal" />)}
      </div>
      <div className="-mx-3 flex gap-1 overflow-x-auto border-b border-slate-200 px-3 md:mx-0 md:px-0">
        {([['library', 'ライブラリ'], ['assign', '店舗ごとの公開設定'], ['progress', '受講状況']] as const).map(([k, l]) => (
          <button key={k} className={`whitespace-nowrap px-4 py-2 text-sm ${tab === k ? 'border-b-2 border-teal-600 font-semibold text-teal-700' : 'text-slate-500'}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'library' && (
        <div className="space-y-2">
          {data.videos.map((v) => (
            <div key={v.id} className="card flex flex-wrap items-center gap-2 p-3">
              <ProviderBadge v={v} />{v.required && <span className="badge bg-rose-50 text-rose-700">必須</span>}
              <div className="min-w-0 flex-1"><div className="font-medium">{v.title}</div><div className="text-xs text-slate-500">{v.category}・{v.minutes}分・公開 {v.storeIds.length}店舗</div></div>
              {canEdit(v) && <button className="btn-secondary" onClick={() => setEditing(v)}>編集</button>}
            </div>
          ))}
        </div>
      )}

      {tab === 'assign' && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[560px]">
            <thead className="bg-slate-50"><tr><th className="th">動画</th>{data.stores.map((s) => <th key={s.id} className="th text-center">{s.name}<div><Link to={`/learn/${s.id}`} className="text-[11px] font-normal text-teal-700 underline">視聴ページ</Link></div></th>)}</tr></thead>
            <tbody>{data.videos.map((v) => (
              <tr key={v.id}>
                <td className="td"><div className="flex items-center gap-1"><ProviderBadge v={v} /><span>{v.title}</span></div></td>
                {data.stores.map((s) => (
                  <td key={s.id} className="td text-center">
                    <input type="checkbox" className="h-5 w-5" checked={v.storeIds.includes(s.id)} disabled={!canEdit(v)} onChange={() => toggleVideoStore(v, s.id)} aria-label={`${s.name}に公開`} />
                  </td>
                ))}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {tab === 'progress' && (
        <div className="space-y-3">
          <select className="input w-full sm:w-60" value={sid} onChange={(e) => setStoreId(e.target.value)}>{data.stores.map((s) => <option key={s.id} value={s.id}>{s.name}（必須修了率 {completion(s.id)}%）</option>)}</select>
          {sid && <ProgressMatrix storeId={sid} />}
        </div>
      )}

      {editing && (
        <Modal title={editing.title ? '動画の編集' : '動画の登録'} onClose={() => setEditing(null)}>
          <VideoForm v={editing} onSave={async (v) => { await saveVideo(v, me); setEditing(null); toast('保存しました') }} />
        </Modal>
      )}
    </div>
  )
}

function VideoForm({ v, onSave }: { v: Video; onSave: (v: Video) => void }) {
  const [f, setF] = useState(v)
  return (
    <div className="space-y-3">
      <Field label="タイトル *"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="カテゴリ"><input className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></Field>
        <Field label="長さ（分）"><input className="input" type="number" value={f.minutes} onChange={(e) => setF({ ...f, minutes: Number(e.target.value) })} /></Field>
      </div>
      <Field label="説明"><textarea className="input" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <Field label="動画ファイル（モック: ファイル名のみ）"><input type="file" accept="video/*" className="block w-full text-sm" /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={f.required} onChange={(e) => setF({ ...f, required: e.target.checked })} />必須（全スタッフが視聴）</label>
      <button className="btn-primary w-full justify-center" disabled={!f.title} onClick={() => onSave(f)}>保存</button>
    </div>
  )
}

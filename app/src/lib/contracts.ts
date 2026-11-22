// 契約書テンプレート（モック用の簡易文面。本番では法務確認済みの文面に差し替える）
import type { ContractTerms, Deal } from './types'
import { yen } from './utils'

export const HQ_NAME = '株式会社サクラコーポレーション'
export const HQ_REP = '代表取締役 山田 一郎'

export const DEFAULT_TERMS: ContractTerms = {
  joiningFee: 2000000,
  deposit: 500000,
  trainingFee: 300000,
  royaltyRate: 5,
  systemFee: 30000,
  termYears: 5,
  territory: '',
}

export const CONTRACT_TEMPLATES: Record<string, { title: string; render: (d: Deal, t: ContractTerms) => string }> = {
  nda: {
    title: '秘密保持契約書',
    render: (d) => `秘密保持契約書

${d.companyName || d.applicantName}（以下「甲」という）と${HQ_NAME}（以下「乙」という）は、乙が運営する訪問介護フランチャイズへの加盟検討にあたり、次のとおり秘密保持契約を締結する。

第1条（目的）
甲は、加盟検討の目的にのみ、乙から開示される事業計画、収支モデル、運営ノウハウ等（以下「秘密情報」）を使用する。

第2条（秘密保持）
甲は、秘密情報を第三者に開示・漏えいしてはならない。

第3条（返還）
甲は、加盟に至らなかった場合、乙の求めに応じて秘密情報を返還または破棄する。

第4条（有効期間）
本契約の有効期間は締結日から3年間とする。`,
  },
  franchise: {
    title: '訪問介護フランチャイズ加盟契約書',
    render: (d, t) => `訪問介護フランチャイズ加盟契約書

${HQ_NAME}（以下「本部」という）と${d.companyName || d.applicantName}（以下「加盟者」という）は、次のとおりフランチャイズ加盟契約を締結する。

第1条（目的）
本部は加盟者に対し、本部の商標および訪問介護事業の運営ノウハウの使用を許諾し、加盟者はこれに基づき訪問介護事業所を運営する。

第2条（テリトリー）
加盟者の営業地域は「${t.territory || d.area}」とする。

第3条（契約期間）
契約期間は締結日から${t.termYears}年間とし、期間満了の6か月前までに双方から申し出がない場合は同一条件で更新する。

第4条（加盟金等）
加盟者は本部に対し、次の金員を本部の指定する期日までに支払う。
　加盟金　${yen(t.joiningFee)}（税別）
　保証金　${yen(t.deposit)}（非課税・契約終了時に返還）
　開業研修費　${yen(t.trainingFee)}（税別）

第5条（ロイヤリティ）
加盟者は、毎月の介護報酬および利用者負担額の合計（以下「月間売上」）の${t.royaltyRate}％をロイヤリティとして、またシステム利用料として月額${yen(t.systemFee)}（税別）を、翌月末日までに支払う。

第6条（指定の取得）
加盟者は、自らの責任において介護保険法に基づく訪問介護事業所の指定を受けるものとし、本部はこれを支援する。

第7条（報告）
加盟者は、本部所定の業務システムにより毎月の提供実績を本部に報告する。

第8条（秘密保持・競業避止）
加盟者は、契約期間中および終了後2年間、本部のノウハウを用いた同種事業を営まない。`,
  },
}

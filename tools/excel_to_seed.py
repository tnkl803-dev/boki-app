"""Excel学習管理ブック -> data/seed.json。使い方: python tools/excel_to_seed.py <xlsx> [today YYYY-MM-DD]"""
import json, sys, datetime as dt
import openpyxl

def iso(v):
    if isinstance(v, dt.datetime): return v.date().isoformat()
    if isinstance(v, dt.date): return v.isoformat()
    return None

CAUSES = ['知識不足', '科目判断ミス', '読み違い', '計算ミス', '桁ミス', '時間切れ', '回答範囲不足']

def normalize_cause(text):
    """Normalize cause text to one of the CAUSES enum values or null.
    Maps text that equals or contains an enum member keyword to it.
    Returns null for unmappable text (including '未分類' and empty strings).
    Special mapping: 読い違い/読み違い → 読み違い
    """
    if not text or not str(text).strip():
        return None
    text = str(text).strip()
    # Check for exact match
    if text in CAUSES:
        return text
    # Special case: normalize 読い違い to 読み違い
    if '読い違い' in text:
        return '読み違い'
    # Check if text contains any enum keyword
    for cause in CAUSES:
        if cause in text:
            return cause
    # Unmappable (including '未分類')
    return None

def rows(ws, header_row=3):
    hdr = [c.value for c in ws[header_row]]
    for r in ws.iter_rows(min_row=header_row + 1, values_only=True):
        if r[0] is None: continue
        yield dict(zip(hdr, r))

A, L, E, R, X = '資産', '負債', '純資産', '収益', '費用'
def acc(names, cat, lvl): return [{'name': n, 'category': cat, 'level': lvl} for n in names]
ACCOUNTS = (
  acc(['現金','小口現金','普通預金','当座預金','受取手形','売掛金','クレジット売掛金','電子記録債権','未収入金','前払金','立替金','仮払金','貸付金','商品','繰越商品','貯蔵品','前払費用','未収収益','建物','備品','車両運搬具','土地','仮払消費税','仮払法人税等','現金過不足'], A, '3級') +
  acc(['支払手形','買掛金','電子記録債務','未払金','前受金','預り金','仮受金','借入金','未払費用','前受収益','仮受消費税','未払消費税','未払法人税等','貸倒引当金','減価償却累計額'], L, '3級') +
  acc(['資本金','繰越利益剰余金'], E, '3級') +
  acc(['売上','受取手数料','受取利息','受取家賃','雑益','固定資産売却益','貸倒引当金戻入'], R, '3級') +
  acc(['仕入','給料','法定福利費','広告宣伝費','支払手数料','旅費交通費','通信費','水道光熱費','消耗品費','支払家賃','保険料','租税公課','減価償却費','貸倒引当金繰入','貸倒損失','支払利息','雑損','固定資産売却損','法人税等'], X, '3級') +
  acc(['満期保有目的債券','売買目的有価証券','その他有価証券','子会社株式','ソフトウェア','のれん','リース資産','繰延税金資産','契約資産'], A, '2級商') +
  acc(['リース債務','退職給付引当金','修繕引当金','商品保証引当金','社債','契約負債','返金負債','繰延税金負債'], L, '2級商') +
  acc(['資本準備金','利益準備金','別途積立金','その他有価証券評価差額金','非支配株主持分'], E, '2級商') +
  acc(['有価証券利息','有価証券売却益','為替差益','受取配当金','法人税等調整額'], R, '2級商') +
  acc(['退職給付費用','有価証券売却損','為替差損','商品保証引当金繰入','研究開発費','のれん償却','ソフトウェア償却','支払リース料','創立費','開業費'], X, '2級商') +
  acc(['材料','仕掛品','製品','製造間接費','賃金','経費','売上原価','月次損益','材料副費','製造間接費配賦差異','原価差異','予算差異','操業度差異','材料消費価格差異','賃率差異','本社','工場'], '工業', '2級工')
)

def q(i, fmt, field, topic, pri, text, answer, explain, std, choices=None, setId='W02-BASIC'):
    return {'id': f'Q-{i:04d}', 'setId': setId, 'field': field, 'topic': topic, 'priority': pri, 'difficulty': '基本', 'format': fmt,
            'text': text, 'choices': choices or [], 'answer': answer, 'explain': explain, 'stdSec': std, 'tags': ''}
def J(d, c): return {'debit': d, 'credit': c}
QUESTIONS = [
  q(1, '仕訳', '商業簿記', '商品売買', 'A', '架空商店は商品50,000円を掛けで仕入れた。', J([{'acct':'仕入','amt':50000}], [{'acct':'買掛金','amt':50000}]), '商品の掛け仕入は買掛金。三分法では仕入勘定。', 60),
  q(2, '仕訳', '商業簿記', '商品売買', 'A', '架空商店は商品80,000円を販売し、代金は掛けとした。', J([{'acct':'売掛金','amt':80000}], [{'acct':'売上','amt':80000}]), '商品の掛け販売は売掛金。', 60),
  q(3, '仕訳', '商業簿記', '債権債務', 'A', '不要になった備品を30,000円で売却し、代金は月末に受け取ることにした（帳簿価額30,000円、減価償却は考慮しない）。', J([{'acct':'未収入金','amt':30000}], [{'acct':'備品','amt':30000}]), '商品以外の後日回収は未収入金。', 90),
  q(4, '仕訳', '商業簿記', '債権債務', 'A', '備品120,000円を購入し、代金は翌月払いとした。', J([{'acct':'備品','amt':120000}], [{'acct':'未払金','amt':120000}]), '商品以外の後日支払は未払金。', 60),
  q(5, '仕訳', '商業簿記', '前払前受', 'A', '商品の注文にあたり手付金20,000円を現金で支払った。', J([{'acct':'前払金','amt':20000}], [{'acct':'現金','amt':20000}]), '商品受取前の手付金支払は前払金（資産）。', 60),
  q(6, '仕訳', '商業簿記', '前払前受', 'A', '商品の注文を受け、手付金15,000円が普通預金に振り込まれた。', J([{'acct':'普通預金','amt':15000}], [{'acct':'前受金','amt':15000}]), '商品引渡前の手付金受取は前受金（負債）。', 60),
  q(7, '仕訳', '商業簿記', '商品売買', 'A', '商品100,000円を販売し、30,000円は現金で受け取り、残額は掛けとした。', J([{'acct':'現金','amt':30000},{'acct':'売掛金','amt':70000}], [{'acct':'売上','amt':100000}]), '一部現金・残額掛け。借方2行。', 90),
  q(8, '仕訳', '商業簿記', '債権債務', 'A', '売掛金40,000円が普通預金に振り込まれた。', J([{'acct':'普通預金','amt':40000}], [{'acct':'売掛金','amt':40000}]), '売掛金の回収。資産の減少は貸方。', 60),
  q(9, '科目判断', '商業簿記', '債権債務', 'A', '商品を掛けで販売したときに増える科目は？', '売掛金', '商品＋後で受け取る＝売掛金', 20, ['売掛金','買掛金','未収入金','未払金']),
  q(10, '科目判断', '商業簿記', '債権債務', 'A', '商品を掛けで仕入れたときに増える科目は？', '買掛金', '商品＋後で支払う＝買掛金', 20, ['売掛金','買掛金','未収入金','未払金']),
  q(11, '科目判断', '商業簿記', '債権債務', 'A', '土地を売却し代金を後日受け取るときの科目は？', '未収入金', '商品以外＋後で受け取る＝未収入金', 20, ['売掛金','買掛金','未収入金','未払金']),
  q(12, '科目判断', '商業簿記', '債権債務', 'A', '車両を購入し代金を後日支払うときの科目は？', '未払金', '商品以外＋後で支払う＝未払金', 20, ['売掛金','買掛金','未収入金','未払金']),
  q(13, '科目判断', '商業簿記', '前払前受', 'A', '商品の手付金を先に受け取ったときの科目は？', '前受金', '引渡前の受取＝前受金（負債）', 20, ['前払金','前受金','仮受金','売掛金']),
  q(14, '科目判断', '商業簿記', '前払前受', 'A', '内容不明の入金があったときに一時的に使う科目は？', '仮受金', '内容不明の入金＝仮受金', 20, ['前受金','仮受金','仮払金','雑益']),
  q(15, '計算', '商業簿記', '売上原価', 'A', '期首商品20,000円、当期仕入150,000円、期末商品30,000円。売上原価は？', 140000, '期首＋仕入−期末＝20,000＋150,000−30,000', 60),
  q(16, '計算', '商業簿記', '減価償却', 'A', '取得原価600,000円、残存価額0円、耐用年数5年。定額法の年間減価償却費は？', 120000, '（取得原価−残存価額）÷耐用年数', 60),
]

def main(path, today=None):
    today = today or dt.date.today().isoformat()
    wb = openpyxl.load_workbook(path, data_only=True)
    st = {r[0]: r[1] for r in wb['設定'].iter_rows(min_row=4, values_only=True) if r[0]}
    settings = [{'id': 'main', 'startDate': iso(st['学習開始日']), 'examDate': iso(st['目標受験日']),
                 'weekdayMin': 90, 'weekendMin': 120, 'passScore': int(st['合格基準点']), 'safeScore': int(st['安全圏基準点'])}]
    roadmap = [{'id': r['RoadmapID'], 'week': int(r['Week']), 'phase': r['フェーズ'], 'field': r['分野'], 'topic': r['論点'],
                'priority': r['優先度'], 'planMin': r['予定学習時間分'], 'planQ': r['予定問題数'], 'targetRate': r['目標正答率'],
                'commuteTask': r['通勤タスク'], 'nightTask': r['夜タスク'], 'weekendTask': r['休日タスク'],
                'minLine': r['最低ライン'], 'stdLine': r['標準ライン'], 'extraLine': r['追加ライン'], 'doneCond': r['完了条件']}
               for r in rows(wb['ロードマップ'])]
    cards = [{'id': r['CardID'], 'createdAt': iso(r['作成日']), 'field': r['分野'], 'topic': r['論点'], 'priority': r['優先度'],
              'type': r['カード種類'], 'front': r['表面'], 'back': r['裏面'], 'example': r['具体例'] or '', 'pitfall': r['間違えやすい点'] or '',
              'tags': r['タグ'] or '', 'status': '新規',
              'due': today, 'interval': 0, 'ease': 2.5, 'reps': 0, 'streak': 0, 'lastResult': None, 'lastReviewed': None}
             for r in rows(wb['単語帳'])]
    daily = [{'id': r['DailyLogID'], 'date': iso(r['日付']), 'sessionType': r['セッション区分'], 'field': r['分野'], 'topic': r['論点'],
              'priority': r['優先度'], 'content': r['学習内容'], 'planMin': r['予定時間分'], 'actualMin': r['実績時間分'],
              'q': r['問題数'], 'correct': r['正解数'], 'wrong': r['不正解数'], 'blank': r['未回答数'],
              'understand': r['理解度'], 'focus': r['集中度'], 'confidence': r['自信度'], 'cause': normalize_cause(r['間違いの主原因']),
              'comment': r.get('コメント') or ''}
             for r in rows(wb['日次記録'])]
    start = settings[0]['startDate']
    for d in daily:
        d['week'] = (dt.date.fromisoformat(d['date']) - dt.date.fromisoformat(start)).days // 7 + 1
        den = (d['correct'] or 0) + (d['wrong'] or 0)
        d['rate'] = round((d['correct'] or 0) / den, 3) if den else None
    out = {'settings': settings, 'roadmap': roadmap, 'cards': cards, 'dailyLogs': daily, 'accounts': ACCOUNTS, 'questions': QUESTIONS}
    with open('data/seed.json', 'w', encoding='utf-8') as f: json.dump(out, f, ensure_ascii=False, indent=1)
    print(f'cards={len(cards)} roadmap={len(roadmap)} daily={len(daily)} accounts={len(ACCOUNTS)} questions={len(QUESTIONS)}')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)

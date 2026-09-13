from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[2]
BOOK = ROOT / "artifacts" / "gx-official-book"
ASSETS = BOOK / "assets"
PAGES = BOOK / "pages"
PDF_DIR = ROOT / "output" / "pdf"
PAGES.mkdir(parents=True, exist_ok=True)
PDF_DIR.mkdir(parents=True, exist_ok=True)

W, H = 1920, 1200

FONT_SANS = r"C:\Windows\Fonts\NotoSansJP-VF.ttf"
FONT_SERIF = r"C:\Windows\Fonts\NotoSerifJP-VF.ttf"

CREAM = (244, 241, 233)
PAPER = (249, 247, 241)
INK = (17, 30, 40)
NAVY = (5, 18, 28)
NAVY_2 = (10, 31, 44)
MIZU = (103, 167, 194)
AMANE = (147, 190, 216)
SAKUYA = (184, 122, 112)
MOSS = (112, 135, 113)
GOLD = (210, 156, 90)
WHITE = (246, 247, 244)
MUTED = (105, 119, 126)


def font(size, serif=False):
    return ImageFont.truetype(FONT_SERIF if serif else FONT_SANS, size=size)


def load(name):
    return Image.open(name).convert("RGB")


def fit(path, size, centering=(0.5, 0.5)):
    return ImageOps.fit(load(path), size, method=Image.Resampling.LANCZOS, centering=centering)


def rgba_overlay(base, color, alpha):
    layer = Image.new("RGBA", base.size, (*color, alpha))
    return Image.alpha_composite(base.convert("RGBA"), layer).convert("RGB")


def gradient_overlay(base, color, start_alpha, end_alpha, horizontal=True, reverse=False):
    w, h = base.size
    grad = Image.new("L", (w, h))
    px = grad.load()
    span = w if horizontal else h
    for i in range(span):
        t = i / max(1, span - 1)
        if reverse:
            t = 1 - t
        a = int(start_alpha + (end_alpha - start_alpha) * t)
        if horizontal:
            for y in range(h):
                px[i, y] = a
        else:
            for x in range(w):
                px[x, i] = a
    layer = Image.new("RGBA", (w, h), (*color, 255))
    layer.putalpha(grad)
    return Image.alpha_composite(base.convert("RGBA"), layer).convert("RGB")


def wrap_chars(text, fnt, max_width):
    lines, current = [], ""
    for ch in text:
        if ch == "\n":
            lines.append(current)
            current = ""
            continue
        trial = current + ch
        if fnt.getlength(trial) > max_width and current:
            lines.append(current)
            current = ch
        else:
            current = trial
    lines.append(current)
    return lines


def text_box(draw, xy, text, fnt, fill, max_width, line_gap=0, max_lines=None):
    x, y = xy
    lines = wrap_chars(text, fnt, max_width)
    if max_lines:
        lines = lines[:max_lines]
    line_h = fnt.size + line_gap
    for line in lines:
        draw.text((x, y), line, font=fnt, fill=fill)
        y += line_h
    return y


def rule(draw, x1, y1, x2, y2, fill, width=2):
    draw.line((x1, y1, x2, y2), fill=fill, width=width)


def small_label(draw, x, y, label, color=MIZU, dark=False):
    draw.ellipse((x, y + 5, x + 9, y + 14), fill=color)
    draw.text((x + 22, y), label, font=font(19), fill=WHITE if dark else INK)


def page_num(draw, num, dark=False):
    col = (184, 195, 200) if dark else (102, 118, 124)
    draw.text((W - 160, H - 62), f"{num:02d} / 10", font=font(17), fill=col)


def save_page(img, num):
    path = PAGES / f"page-{num:02d}.png"
    img.save(path, optimize=True)
    return path


cover = ASSETS / "cover-keyvisual-new-sakuya.png"
cast = ASSETS / "cast-ensemble-new-sakuya.png"
prologue = ASSETS / "prologue-zushi-new-sakuya.png"
sakuya = ASSETS / "sakuya-konohanasakuya-model.png"
coevo = ROOT / "artifacts" / "gx-setting-bible" / "04-life-earth-coevolution.png"
ui_gateway = ROOT / "artifacts" / "contest-visual-v56" / "01-gateway-desktop.png"
ui_novel = ROOT / "artifacts" / "contest-visual-v56" / "02-novel-selection-desktop.png"
ui_space = ROOT / "artifacts" / "space-mode" / "space-desktop.png"
ui_abstract = ROOT / "gaia-mode-01.png"

outputs = []


# 01 COVER
img = fit(cover, (W, H), centering=(0.52, 0.5))
img = gradient_overlay(img, NAVY, 235, 18, horizontal=True)
d = ImageDraw.Draw(img)
small_label(d, 70, 64, "GAIA SENSEWARE / OFFICIAL SETTING BOOK", MIZU, True)
d.text((68, 190), "GAIA", font=font(116), fill=WHITE)
d.text((68, 300), "SENSEWARE", font=font(116), fill=WHITE)
d.text((73, 448), "GX", font=font(202, serif=True), fill=(221, 230, 228))
rule(d, 74, 690, 670, 690, MIZU, 3)
d.text((74, 730), "地球と人類が、ともに次の段階へ移るまで。", font=font(34, serif=True), fill=WHITE)
d.text((75, 802), "地球の声を聴く、10の感覚器", font=font(22), fill=(188, 204, 209))
d.text((75, 1084), "CONCEPT BOOK / VERSION 01", font=font(16), fill=(165, 183, 188))
page_num(d, 1, True)
outputs.append(save_page(img, 1))


# 02 WORLD / GX
img = Image.new("RGB", (W, H), PAPER)
d = ImageDraw.Draw(img)
small_label(d, 72, 64, "WORLD CONCEPT / GAIA TRANSFORMATION", SAKUYA)
d.text((70, 132), "GX", font=font(220, serif=True), fill=(202, 210, 204))
d.text((290, 190), "GAIA TRANSFORMATION", font=font(41), fill=INK)
d.text((72, 410), "地球は、守られるだけの\n完成品ではない。", font=font(60, serif=True), fill=INK, spacing=16)
body = (
    "生命は地球に適応するだけでなく、大気、海、土、気候を変えてきた。"
    "そして変化した地球が、次の生命の姿を変えてきた。人類文明も、その長い共進化史の外側にはいない。\n\n"
    "GXとは、いまの社会を少し緑色にすることではない。地球規模の力を持った人類が、"
    "無自覚な変化から、他の生命や人工知能とともに選び取る変化へ移ること。その文明的な相転移を、私たちはGaia Transformationと呼ぶ。"
)
text_box(d, (76, 635), body, font(25), (51, 66, 73), 760, line_gap=16)

art = fit(coevo, (880, 1030), centering=(0.58, 0.18))
art = rgba_overlay(art, CREAM, 22)
img.paste(art, (1010, 82))
d = ImageDraw.Draw(img)
rule(d, 970, 82, 970, 1112, (190, 196, 190), 2)
for i, (title, sub, col) in enumerate([
    ("感覚の変容", "地球規模で感じる", MIZU),
    ("文明の変容", "技術を地球の器官へ", AMANE),
    ("人間観の変容", "共進化の参加者になる", SAKUYA),
]):
    y = 916 + i * 72
    d.ellipse((1046, y + 6, 1060, y + 20), fill=col)
    d.text((1080, y), title, font=font(22), fill=INK)
    d.text((1290, y + 2), sub, font=font(17), fill=(75, 92, 98))
page_num(d, 2)
outputs.append(save_page(img, 2))


# 03 STORY / PROLOGUE
img = fit(prologue, (W, H), centering=(0.58, 0.48))
img = gradient_overlay(img, NAVY, 224, 6, horizontal=True)
img = gradient_overlay(img, NAVY, 0, 104, horizontal=False, reverse=False)
d = ImageDraw.Draw(img)
small_label(d, 70, 64, "STORY / PROLOGUE", AMANE, True)
d.text((68, 150), "はじめまして、は\n画面の外で。", font=font(68, serif=True), fill=WHITE, spacing=14)
story = (
    "普段はオンラインで学ぶ三人が、コンテスト作品を完成させるため、逗子の海辺で初めて顔を合わせる。\n\n"
    "制作するのは、公開データを光と動きへ変換する「GAIA SENSEWARE」。"
    "けれど三人は、同じGXという言葉を使いながら、別々の未来を見ていた。"
)
text_box(d, (72, 472), story, font(26), (218, 228, 229), 690, line_gap=15)
rule(d, 74, 837, 730, 837, (117, 166, 178), 2)
d.text((72, 872), "「私たちは、同じ未来を見ていない。」", font=font(31, serif=True), fill=WHITE)
d.text((72, 1035), "現在から少し先 / 神奈川・逗子の海辺 / オンライン大学", font=font(18), fill=(170, 188, 194))
page_num(d, 3, True)
outputs.append(save_page(img, 3))


# 04 CAST / MIZUHA & AMANE
img = Image.new("RGB", (W, H), PAPER)
top = fit(cast, (W, 720), centering=(0.42, 0.18))
img.paste(top, (0, 0))
overlay = Image.new("RGBA", (W, 720), (249, 247, 241, 36))
img = Image.alpha_composite(img.convert("RGBA"), Image.new("RGBA", (W, H), (0, 0, 0, 0))).convert("RGB")
d = ImageDraw.Draw(img)
d.rectangle((0, 710, W, H), fill=NAVY)
small_label(d, 68, 54, "CHARACTERS / THREE ECOLOGIES", MIZU)
d.text((66, 735), "三人でなければ、GXには届かない。", font=font(37, serif=True), fill=WHITE)

cols = [(70, "MIZUHA", "ミズハ", "生態・身体・感覚", MIZU,
         "海や雨、生きものの変化を、数字になる前の違和感として受け取る。自然を美しいものとして見すぎる弱さがあり、技術も生命圏の一部になり得ることを学んでいく。"),
        (980, "AMANE", "アマネ", "社会・技術・システム", AMANE,
         "データ、AI、都市、エネルギー網を未来の仕組みへ接続する。正しい計算が正しい未来を作るとは限らないと知り、最適化する知性から共創する知性へ変わる。")]
for x, en, jp, role, col, body in cols:
    d.text((x, 818), en, font=font(18), fill=col)
    d.text((x, 855), jp, font=font(45, serif=True), fill=WHITE)
    d.text((x + 222, 872), role, font=font(19), fill=(183, 200, 204))
    rule(d, x, 925, x + 770, 925, col, 3)
    text_box(d, (x, 956), body, font(20), (216, 225, 227), 770, line_gap=12)
page_num(d, 4, True)
outputs.append(save_page(img, 4))


# 05 SAKUYA / REDESIGN
img = fit(sakuya, (W, H), centering=(0.48, 0.5))
img = gradient_overlay(img, NAVY, 238, 0, horizontal=True)
d = ImageDraw.Draw(img)
small_label(d, 68, 56, "CHARACTER DESIGN / KONOHANASAKUYA", SAKUYA, True)
d.text((66, 134), "SAKUYA", font=font(76), fill=WHITE)
d.text((70, 230), "サクヤ", font=font(46, serif=True), fill=(239, 225, 216))
d.text((70, 304), "精神・文化・記憶", font=font(22), fill=(201, 180, 174))
rule(d, 70, 358, 650, 358, SAKUYA, 3)
body = (
    "モチーフはコノハナサクヤヒメ。桜の儚さだけでなく、火、富士、再生、短い生を選ぶ強さを現代服へ置き換えた。\n\n"
    "黒褐色の高いサイドポニーと山稜のような直線的シルエットで、ミズハの長い水面の髪と明確に区別する。"
    "灰桜のスカート裾には富士と火山を思わせる三角形を残し、朱の細いタイだけを熱の色にした。\n\n"
    "過去を守るだけでは未来を作れないと知り、記憶を新しい文化へ手渡す役割を担う。"
)
text_box(d, (70, 400), body, font(24), (224, 229, 228), 650, line_gap=14)
d.text((70, 1016), "「残したいものを決めるだけじゃ、未来は始まらない。」", font=font(25, serif=True), fill=WHITE)
page_num(d, 5, True)
outputs.append(save_page(img, 5))


# 06 SYSTEM / TEN SENSE ORGANS
img = fit(ui_abstract, (W, H), centering=(0.5, 0.5)).filter(ImageFilter.GaussianBlur(2.2))
img = rgba_overlay(img, NAVY, 194)
d = ImageDraw.Draw(img)
small_label(d, 66, 54, "SYSTEM / TEN SENSE ORGANS", MIZU, True)
d.text((64, 116), "地球を観測する、\n10の感覚器官。", font=font(58, serif=True), fill=WHITE, spacing=10)
d.text((66, 290), "公開データを、色・粒子・波・呼吸へ変換する。", font=font(23), fill=(178, 199, 205))

senses = [
    ("01", "空気", "CO2と気温"), ("02", "海", "海流と風"),
    ("03", "森", "森林と雨"), ("04", "生きもの", "花と昆虫"),
    ("05", "ごみ", "資源の行方"), ("06", "都市", "光と排出"),
    ("07", "地震", "地球の揺れ"), ("08", "暮らし", "三つの生態系"),
    ("09", "エネルギー", "太陽と風"), ("10", "すべて", "九つの信号"),
]
for i, (n, title, sub) in enumerate(senses):
    col = i % 2
    row = i // 2
    x = 66 + col * 430
    y = 398 + row * 126
    d.rounded_rectangle((x, y, x + 390, y + 98), radius=10, outline=(86, 122, 136), width=2, fill=(7, 24, 35))
    d.text((x + 18, y + 17), n, font=font(16), fill=MIZU)
    d.text((x + 74, y + 13), title, font=font(25), fill=WHITE)
    d.text((x + 74, y + 56), sub, font=font(16), fill=(141, 163, 170))

# System flow on right
rx = 1010
d.text((rx, 138), "SIGNAL FLOW", font=font(19), fill=GOLD)
d.text((rx, 184), "数値が光になるまで", font=font(38, serif=True), fill=WHITE)
flow = [
    ("SOURCE", "観測された公開データ", MIZU),
    ("TRANSFORM", "補間・集計・視覚変換", AMANE),
    ("EXPERIENCE", "触れる・読む・聴く", SAKUYA),
    ("TRACE", "観客の軌跡を残す", MOSS),
]
for i, (a, b, col) in enumerate(flow):
    y = 300 + i * 176
    d.ellipse((rx, y + 7, rx + 18, y + 25), fill=col)
    d.text((rx + 42, y), a, font=font(20), fill=col)
    d.text((rx + 42, y + 44), b, font=font(27), fill=WHITE)
    if i < 3:
        d.line((rx + 9, y + 74, rx + 9, y + 155), fill=(92, 121, 131), width=2)
d.text((rx, 1025), "地球を一つの点数にしない。矛盾する信号も、そのまま残す。", font=font(20), fill=(183, 200, 204))
page_num(d, 6, True)
outputs.append(save_page(img, 6))


# 07 UI / FOUR ENTRANCES
img = Image.new("RGB", (W, H), NAVY)
d = ImageDraw.Draw(img)
small_label(d, 66, 54, "INTERFACE / FOUR WAYS TO LISTEN", AMANE, True)
d.text((64, 112), "同じ地球に、四つの入口。", font=font(54, serif=True), fill=WHITE)
d.text((66, 198), "モードを選び、10の感覚器官から一つの信号へ入る。", font=font(22), fill=(173, 194, 200))

shots = [
    (ui_abstract, "01 / ABSTRACT", "抽象モード", "光に触れる"),
    (ui_gateway, "02 / MAP", "地図モード", "場所へ戻す"),
    (ui_novel, "03 / NOVEL", "ノベルモード", "物語で聴く"),
    (ui_space, "04 / SPACE", "宇宙モード", "地球圏を眺める"),
]
for i, (path, cap, title, desc) in enumerate(shots):
    col = i % 2
    row = i // 2
    x = 64 + col * 928
    y = 280 + row * 405
    thumb = fit(path, (860, 280), centering=(0.5, 0.45))
    img.paste(thumb, (x, y))
    d = ImageDraw.Draw(img)
    d.rectangle((x, y + 280, x + 860, y + 365), fill=(9, 29, 41))
    d.text((x + 18, y + 300), cap, font=font(15), fill=MIZU if i < 2 else (194, 156, 210) if i == 2 else GOLD)
    d.text((x + 230, y + 294), title, font=font(27), fill=WHITE)
    d.text((x + 560, y + 302), desc, font=font(17), fill=(151, 173, 180))
d.text((66, 1098), "共通導線：入口 → 10の選択 → 演出 → データ諸元 / コード / RAW DATA", font=font(19), fill=(170, 192, 198))
page_num(d, 7, True)
outputs.append(save_page(img, 7))


# 08 OPEN DATA
img = Image.new("RGB", (W, H), PAPER)
d = ImageDraw.Draw(img)
small_label(d, 66, 54, "OPEN DATA / PROVENANCE", MOSS)
d.text((64, 112), "公開データは、\n地球が発している信号である。", font=font(54, serif=True), fill=INK, spacing=8)
d.text((68, 276), "ただし、観測値・加工値・仮想シナリオを混ぜない。", font=font(22), fill=(74, 91, 97))

cards = [
    ("SOURCE", "公開データそのもの", "提供機関、URL、取得日、期間、単位、空間解像度、注意事項、先頭10行を表示。", MIZU),
    ("DERIVED", "補間・集計した値", "欠測は時間方向と近隣地点から推定し、推定値であることを残す。生データには戻さない。", AMANE),
    ("SCENARIO", "観客が作る仮想状態", "未来は予言ではなく、現在の傾向が続いた場合の試算。不確実性と前提を同時に示す。", SAKUYA),
]
for i, (name, title, body, col) in enumerate(cards):
    x = 66 + i * 610
    y = 374
    d.rounded_rectangle((x, y, x + 560, y + 310), radius=16, fill=(238, 238, 231), outline=col, width=3)
    d.text((x + 28, y + 28), name, font=font(19), fill=col)
    d.text((x + 28, y + 76), title, font=font(30, serif=True), fill=INK)
    text_box(d, (x + 28, y + 138), body, font(20), (55, 70, 77), 500, line_gap=12)

d.text((66, 748), "DATA SOURCES", font=font(18), fill=MOSS)
sources = [
    ("NOAA / NASA", "大気CO2・気温・風・海洋"),
    ("JAXA / GOSAT", "宇宙からCO2・CH4の分布を観測"),
    ("JMA / USGS", "気象・海面水温・地震記録"),
    ("GBIF / GloBI", "生物観察記録・生物間相互作用"),
    ("UN / 環境省ほか", "資源循環・排出量・エネルギー"),
]
for i, (org, desc) in enumerate(sources):
    y = 806 + i * 62
    d.text((68, y), org, font=font(20), fill=INK)
    d.text((330, y + 2), desc, font=font(19), fill=(76, 92, 98))
    rule(d, 66, y + 43, 890, y + 43, (214, 216, 207), 1)

d.rounded_rectangle((1000, 748, 1848, 1096), radius=18, fill=NAVY_2)
d.text((1040, 786), "GOSAT / いぶき", font=font(22), fill=GOLD)
d.text((1040, 836), "温室効果ガスを、宇宙から見る。", font=font(34, serif=True), fill=WHITE)
gosat = (
    "GOSATは、地表の一点だけではなく、大気の柱全体に含まれるCO2やCH4を観測する人工衛星。"
    "作品では分布の変化を色と呼吸へ変換する。雲や観測条件で欠測が生じるため、補完した場所は実測と区別して表示する。"
)
text_box(d, (1040, 914), gosat, font(21), (203, 216, 219), 740, line_gap=14)
page_num(d, 8)
outputs.append(save_page(img, 8))


# 09 STORY STRUCTURE
img = Image.new("RGB", (W, H), CREAM)
d = ImageDraw.Draw(img)
small_label(d, 66, 54, "DRAMATURGY / THREE ACTS", SAKUYA)
d.text((64, 112), "循環を知る。影響を見る。\n関係を編み直す。", font=font(54, serif=True), fill=INK, spacing=8)
d.text((68, 278), "悪役は存在しない。対立するのは、人間と地球を切り離す古いOS。", font=font(22), fill=(75, 90, 96))

acts = [
    ("ACT I", "地球を感じる", "01-03", "大気・海・森を通して、地球規模の循環を身体で知る。", MIZU),
    ("ACT II", "人類という地球現象", "04-07", "共進化・資源・都市・地震から、人類がすでに地球規模の力であると知る。", AMANE),
    ("ACT III", "次の地球を共創する", "08-10", "生態・社会・精神を重ね、技術と文化を地球の新しい器官へ変える。", SAKUYA),
]
for i, (act, title, nums, body, col) in enumerate(acts):
    x = 66 + i * 610
    y = 390
    d.text((x, y), act, font=font(20), fill=col)
    d.text((x, y + 48), title, font=font(34, serif=True), fill=INK)
    d.text((x, y + 104), nums, font=font(17), fill=(104, 118, 122))
    rule(d, x, y + 146, x + 520, y + 146, col, 3)
    text_box(d, (x, y + 180), body, font(22), (54, 70, 76), 520, line_gap=14)

# viewer / fourth co-creator diagram
d.rounded_rectangle((66, 760, 1848, 1068), radius=22, fill=NAVY)
d.text((106, 804), "THE FOURTH CO-CREATOR", font=font(18), fill=GOLD)
d.text((106, 850), "観客が、最後の感覚器官になる。", font=font(39, serif=True), fill=WHITE)
viewer = (
    "観客は三人の物語を眺めるだけではない。触れた場所、選んだ信号、残した軌跡が10番目の演出へ加わる。"
    "ただし未来を一つに決定するのではなく、矛盾する可能性を重ねたまま、次の観客へ渡す。"
)
text_box(d, (108, 922), viewer, font(21), (199, 214, 218), 1070, line_gap=14)
for i, (label, col) in enumerate([("MIZUHA", MIZU), ("AMANE", AMANE), ("SAKUYA", SAKUYA), ("YOU", GOLD)]):
    x = 1300 + (i % 2) * 250
    y = 820 + (i // 2) * 100
    d.ellipse((x, y, x + 24, y + 24), fill=col)
    d.text((x + 42, y - 3), label, font=font(19), fill=WHITE)
page_num(d, 9, True)
outputs.append(save_page(img, 9))


# 10 END / MANIFESTO
img = fit(cover, (W, H), centering=(0.67, 0.52))
img = gradient_overlay(img, NAVY, 20, 226, horizontal=True, reverse=True)
img = gradient_overlay(img, NAVY, 0, 118, horizontal=False)
d = ImageDraw.Draw(img)
small_label(d, 68, 54, "GX / THE NEXT PAGE IS UNFINISHED", GOLD, True)
d.text((790, 150), "人類が地球を救う\n物語ではない。", font=font(62, serif=True), fill=WHITE, spacing=12)
d.text((790, 370), "人類が地球の一部として目覚め、\nともに次の進化を選び始める物語である。", font=font(35, serif=True), fill=(232, 237, 235), spacing=14)
rule(d, 792, 548, 1730, 548, GOLD, 3)
closing = (
    "完成した未来を展示するのではなく、未来を選び直すための感覚をひらく。\n"
    "GAIA SENSEWAREは、そのための未完のインターフェースである。"
)
text_box(d, (792, 594), closing, font(25), (204, 216, 218), 900, line_gap=16)
d.text((792, 948), "GAIA SENSEWARE / GX", font=font(30), fill=WHITE)
d.text((792, 1002), "Concept references: 共創地球論 / 人新世の人類学", font=font(17), fill=(168, 187, 192))
d.text((792, 1038), "HTML / CSS / JavaScript / Pure WebGL / Local data snapshots", font=font(16), fill=(150, 170, 176))
page_num(d, 10, True)
outputs.append(save_page(img, 10))


# PDF
pdf_path = PDF_DIR / "gaia-senseware-gx-official-setting-book-v1.pdf"
c = canvas.Canvas(str(pdf_path), pagesize=(960, 600))
for page in outputs:
    c.drawImage(str(page), 0, 0, width=960, height=600, preserveAspectRatio=True, mask="auto")
    c.showPage()
c.save()


# Contact sheet for quick review
thumbs = [fit(p, (576, 360)) for p in outputs]
sheet = Image.new("RGB", (1920, 1740), (26, 35, 42))
for i, th in enumerate(thumbs):
    x = 48 + (i % 3) * 624
    y = 54 + (i // 3) * 414
    sheet.paste(th, (x, y))
    sd = ImageDraw.Draw(sheet)
    sd.text((x, y + 366), f"PAGE {i + 1:02d}", font=font(16), fill=(210, 220, 222))
sheet.save(BOOK / "contact-sheet.png", optimize=True)

print(pdf_path)
for p in outputs:
    print(p)

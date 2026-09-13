(() => {
  const regions = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
  if (typeof Intl.DisplayNames === 'function') {
    const ja = new Intl.DisplayNames(['ja'], { type: 'region' });
    const en = new Intl.DisplayNames(['en'], { type: 'region' });
    const zh = new Intl.DisplayNames(['zh-CN'], { type: 'region' });
    GaiaI18n.register(regions.map(code => [ja.of(code), en.of(code), zh.of(code)]));
  }
  GaiaI18n.register([
    ['北海道','Hokkaido','北海道'], ['青森県','Aomori','青森县'], ['岩手県','Iwate','岩手县'],
    ['宮城県','Miyagi','宫城县'], ['秋田県','Akita','秋田县'], ['山形県','Yamagata','山形县'],
    ['福島県','Fukushima','福岛县'], ['茨城県','Ibaraki','茨城县'], ['栃木県','Tochigi','栃木县'],
    ['群馬県','Gunma','群马县'], ['埼玉県','Saitama','埼玉县'], ['千葉県','Chiba','千叶县'],
    ['東京都','Tokyo','东京都'], ['神奈川県','Kanagawa','神奈川县'], ['新潟県','Niigata','新潟县'],
    ['富山県','Toyama','富山县'], ['石川県','Ishikawa','石川县'], ['福井県','Fukui','福井县'],
    ['山梨県','Yamanashi','山梨县'], ['長野県','Nagano','长野县'], ['岐阜県','Gifu','岐阜县'],
    ['静岡県','Shizuoka','静冈县'], ['愛知県','Aichi','爱知县'], ['三重県','Mie','三重县'],
    ['滋賀県','Shiga','滋贺县'], ['京都府','Kyoto','京都府'], ['大阪府','Osaka','大阪府'],
    ['兵庫県','Hyogo','兵库县'], ['奈良県','Nara','奈良县'], ['和歌山県','Wakayama','和歌山县'],
    ['鳥取県','Tottori','鸟取县'], ['島根県','Shimane','岛根县'], ['岡山県','Okayama','冈山县'],
    ['広島県','Hiroshima','广岛县'], ['山口県','Yamaguchi','山口县'], ['徳島県','Tokushima','德岛县'],
    ['香川県','Kagawa','香川县'], ['愛媛県','Ehime','爱媛县'], ['高知県','Kochi','高知县'],
    ['福岡県','Fukuoka','福冈县'], ['佐賀県','Saga','佐贺县'], ['長崎県','Nagasaki','长崎县'],
    ['熊本県','Kumamoto','熊本县'], ['大分県','Oita','大分县'], ['宮崎県','Miyazaki','宫崎县'],
    ['鹿児島県','Kagoshima','鹿儿岛县'], ['沖縄県','Okinawa','冲绳县'],
    ['札幌','Sapporo','札幌'], ['青森','Aomori','青森'], ['盛岡','Morioka','盛冈'], ['仙台','Sendai','仙台'],
    ['秋田','Akita','秋田'], ['山形','Yamagata','山形'], ['福島','Fukushima','福岛'], ['水戸','Mito','水户'],
    ['宇都宮','Utsunomiya','宇都宫'], ['前橋','Maebashi','前桥'], ['さいたま','Saitama','埼玉'], ['千葉','Chiba','千叶'],
    ['東京','Tokyo','东京'], ['新宿','Shinjuku','新宿'], ['横浜','Yokohama','横滨'], ['新潟','Niigata','新潟'],
    ['富山','Toyama','富山'], ['金沢','Kanazawa','金泽'], ['福井','Fukui','福井'], ['甲府','Kofu','甲府'],
    ['長野','Nagano','长野'], ['岐阜','Gifu','岐阜'], ['静岡','Shizuoka','静冈'], ['名古屋','Nagoya','名古屋'],
    ['津','Tsu','津'], ['大津','Otsu','大津'], ['京都','Kyoto','京都'], ['大阪','Osaka','大阪'],
    ['神戸','Kobe','神户'], ['奈良','Nara','奈良'], ['和歌山','Wakayama','和歌山'], ['鳥取','Tottori','鸟取'],
    ['松江','Matsue','松江'], ['岡山','Okayama','冈山'], ['広島','Hiroshima','广岛'], ['山口','Yamaguchi','山口'],
    ['徳島','Tokushima','德岛'], ['高松','Takamatsu','高松'], ['松山','Matsuyama','松山'], ['高知','Kochi','高知'],
    ['福岡','Fukuoka','福冈'], ['佐賀','Saga','佐贺'], ['長崎','Nagasaki','长崎'], ['熊本','Kumamoto','熊本'],
    ['大分','Oita','大分'], ['宮崎','Miyazaki','宫崎'], ['鹿児島','Kagoshima','鹿儿岛'], ['那覇','Naha','那霸'],
    ['アメリカ合衆国','United States','美国'], ['英国','United Kingdom','英国'], ['ロシア連邦','Russia','俄罗斯'],
    ['大韓民国','South Korea','韩国'], ['中華人民共和国','China','中国'], ['国名不明','Unknown country','国家名称不明'],
  ]);
})();

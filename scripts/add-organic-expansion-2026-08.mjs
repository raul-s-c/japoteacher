import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fullPath = path.join(root, "data", "exercises.full.csv");
const expansionPath = path.join(root, "data", "exercises.expansion-organic-2026-08.csv");
const headers = "exercise_id,source_language,target_language,direction,source_text,reference_translation,accepted_alternatives_json,jlpt_level,difficulty,topic_tags,situation_tags,grammar_tags,particle_tags,vocabulary_tags,kanji_tags,verb_tags,adjective_tags,counter_tags,register,communicative_function,tense_aspect,polarity,sentence_type,pedagogical_notes,ambiguity_notes,core_exercise,active,dataset_version".split(",");

const pairs = [
  ["N5", 301, "今朝は牛乳とパンを食べました。", "Esta mañana tomé leche y pan.", "vida_diaria|comida", "desayuno", "past_polite|particle_wo", "は|と|を", "今朝|牛乳|パン|食べる", "今朝|牛乳|食", "食べる", "", "", 34, "narrar_rutina", "pasado"],
  ["N5", 302, "明日の午後、図書館で勉強します。", "Mañana por la tarde estudiaré en la biblioteca.", "tiempo|estudio", "biblioteca", "future_polite|time_expression", "の|で", "明日|午後|図書館|勉強", "明日|午後|図書館|勉強", "勉強する", "", "", 36, "planificar", "futuro"],
  ["N5", 303, "毎週火曜日に漢字を十個覚えます。", "Cada martes aprendo diez kanji.", "tiempo|estudio", "rutina_estudio", "frequency|counter_ko", "に|を", "毎週|火曜日|漢字|十個|覚える", "毎週|火曜日|漢字|十個|覚", "覚える", "", "個", 42, "describir_rutina", "presente"],
  ["N5", 304, "バス停は駅の右にあります。", "La parada de autobús está a la derecha de la estación.", "transporte|ubicacion", "orientacion", "existence_aru|location_words", "は|の|に", "バス停|駅|右|ある", "停|駅|右", "", "", "", 38, "ubicar_lugar", "presente"],
  ["N5", 305, "この道をまっすぐ歩いてください。", "Camina recto por esta calle, por favor.", "transporte|servicios", "direcciones", "te_kudasai|direction_expression", "を", "道|まっすぐ|歩く|ください", "道|歩", "歩く", "", "", 40, "dar_instrucciones", "presente"],
  ["N5", 306, "新しい靴は少し高いです。", "Los zapatos nuevos son un poco caros.", "compras|ropa", "tienda", "i_adjective|degree_adverb", "は", "新しい|靴|少し|高い", "新|靴|少|高", "", "新しい|高い", "", 32, "describir_objeto", "presente"],
  ["N5", 307, "母は台所で野菜を切っています。", "Mi madre está cortando verduras en la cocina.", "familia|comida|hogar", "cocina", "progressive_teiru|particle_de", "は|で|を", "母|台所|野菜|切る", "母|台所|野菜|切", "切る", "", "", 46, "describir_accion", "progresivo"],
  ["N5", 308, "父のかばんは机の下にあります。", "El bolso de mi padre está debajo del escritorio.", "familia|hogar|ubicacion", "habitacion", "no_possession|location_words", "の|は|に", "父|かばん|机|下|ある", "父|机|下", "", "", "", 35, "ubicar_objeto", "presente"],
  ["N5", 309, "昨日、友達と地下鉄に乗りました。", "Ayer subí al metro con un amigo.", "transporte|relaciones", "ciudad", "past_polite|particle_to|particle_ni", "と|に", "昨日|友達|地下鉄|乗る", "昨日|友達|地下鉄|乗", "乗る", "", "", 45, "narrar_desplazamiento", "pasado"],
  ["N5", 310, "この辞書は小さくて便利です。", "Este diccionario es pequeño y práctico.", "estudio|tecnologia", "herramientas", "te_form_adjective|na_adjective", "は", "辞書|小さい|便利", "辞書|小", "", "小さい|便利", "", 30, "describir_objeto", "presente"],
  ["N5", 311, "すみません、名前をここに書いてください。", "Disculpe, escriba el nombre aquí, por favor.", "servicios|comunicacion", "formulario", "te_kudasai|particle_ni", "を|に", "すみません|名前|ここ|書く|ください", "名前|書", "書く", "", "", 36, "pedir_accion", "presente"],
  ["N5", 312, "窓の近くは寒くないです。", "Cerca de la ventana no hace frío.", "hogar|clima", "habitacion", "i_adjective_negative|location_words", "の|は", "窓|近く|寒い", "窓|近|寒", "", "寒い", "", 28, "describir_estado", "presente", "negativa"],
  ["N5", 313, "赤いシャツを二枚見せてください。", "Muéstreme dos camisas rojas, por favor.", "compras|ropa|colores", "tienda", "te_kudasai|counter_mai", "を", "赤い|シャツ|二枚|見せる|ください", "赤|二枚|見", "見せる", "赤い", "枚", 44, "pedir_producto", "presente"],
  ["N5", 314, "電気を消してもいいですか。", "¿Puedo apagar la luz?", "hogar|permiso", "habitacion", "te_mo_ii|permission", "を", "電気|消す|いい", "電気|消", "消す", "", "", 39, "pedir_permiso", "presente", "afirmativa", "interrogativa"],
  ["N5", 315, "果物は冷蔵庫の中にあります。", "La fruta está dentro de la nevera.", "comida|hogar|ubicacion", "cocina", "existence_aru|location_words", "は|の|に", "果物|冷蔵庫|中|ある", "果物|冷蔵庫|中", "", "", "", 37, "ubicar_comida", "presente"],
  ["N5", 316, "兄は日曜日に部屋を掃除します。", "Mi hermano mayor limpia la habitación los domingos.", "familia|hogar|rutina", "limpieza", "polite_present|time_expression", "は|に|を", "兄|日曜日|部屋|掃除", "兄|日曜日|部屋|掃除", "掃除する", "", "", 35, "describir_rutina", "presente"],
  ["N5", 317, "この切符はどこで買えますか。", "¿Dónde se puede comprar este billete?", "transporte|compras", "estacion", "potential_basic|question_doko", "は|で", "切符|どこ|買える", "切符|買", "買える", "", "", 48, "preguntar_lugar", "presente", "afirmativa", "interrogativa"],
  ["N5", 318, "もう一度ゆっくり読んでください。", "Lee despacio una vez más, por favor.", "estudio|comunicacion", "clase", "te_kudasai|adverb", "を", "もう一度|ゆっくり|読む|ください", "一度|読", "読む", "", "", 33, "pedir_repeticion", "presente"],
  ["N5", 319, "午後は雨が降ると思います。", "Creo que lloverá por la tarde.", "clima|tiempo", "pronostico", "to_omou_basic|weather", "は|が|と", "午後|雨|降る|思う", "午後|雨|降|思", "降る|思う", "", "", 50, "expresar_opinion", "futuro"],
  ["N5", 320, "妹はお茶より水が好きです。", "A mi hermana menor le gusta más el agua que el té.", "familia|comida|comparacion", "preferencias", "yori_comparison|suki", "は|より|が", "妹|お茶|水|好き", "妹|茶|水|好", "", "好き", "", 43, "comparar_preferencia", "presente"],
  ["N5", 321, "午前中は会社に電話しません。", "Por la mañana no llamo a la empresa.", "trabajo|tiempo", "oficina", "polite_negative|time_expression", "は|に", "午前中|会社|電話", "午前中|会社|電話", "電話する", "", "", 41, "expresar_negacion", "presente", "negativa"],
  ["N5", 322, "郵便局の前で友達を待ちます。", "Espero a un amigo delante de correos.", "servicios|relaciones", "encuentro", "particle_de|particle_wo", "の|で|を", "郵便局|前|友達|待つ", "郵便局|前|友達|待", "待つ", "", "", 36, "describir_accion", "presente"],
  ["N5", 323, "この黒いペンは私のです。", "Este bolígrafo negro es mío.", "compras|posesion|colores", "objetos_personales", "demonstrative_kono|no_possession", "は|の", "黒い|ペン|私", "黒|私", "", "黒い", "", 27, "indicar_posesion", "presente"],
  ["N5", 324, "病院までタクシーで行きましょう。", "Vayamos al hospital en taxi.", "salud|transporte", "desplazamiento", "mashou|movement_particles", "まで|で", "病院|タクシー|行く", "病院|行", "行く", "", "", 42, "proponer_accion", "futuro"],
  ["N5", 325, "この町には小さい映画館があります。", "En esta ciudad hay un cine pequeño.", "ocio|sociedad|lugares", "ciudad", "existence_aru|niwa", "に|は|が", "町|小さい|映画館|ある", "町|小|映画館", "", "小さい", "", 45, "describir_lugar", "presente"],
  ["N5", 326, "昼ご飯の後で薬を飲みます。", "Tomo la medicina después de comer.", "salud|comida", "tratamiento", "ato_de|polite_present", "の|で|を", "昼ご飯|後|薬|飲む", "昼|飯|後|薬|飲", "飲む", "", "", 40, "describir_rutina", "presente"],
  ["N5", 327, "弟はまだ自転車に乗れません。", "Mi hermano pequeño todavía no sabe montar en bicicleta.", "familia|transporte|habilidades", "aprendizaje", "potential_negative|mada", "は|に", "弟|まだ|自転車|乗れる", "弟|自転車|乗", "乗れる", "", "", 49, "expresar_capacidad", "presente", "negativa"],
  ["N5", 328, "この白い皿を使ってください。", "Usa este plato blanco, por favor.", "comida|hogar|colores", "cocina", "te_kudasai|demonstrative_kono", "を", "白い|皿|使う|ください", "白|皿|使", "使う", "白い", "", 33, "dar_instrucciones", "presente"],
  ["N5", 329, "外は暑いですが、部屋は涼しいです。", "Fuera hace calor, pero la habitación está fresca.", "clima|hogar|contraste", "habitacion", "ga_contrast|i_adjective", "は|が", "外|暑い|部屋|涼しい", "外|暑|部屋|涼", "", "暑い|涼しい", "", 47, "contrastar_estado", "presente"],
  ["N5", 330, "日本語の質問が三つあります。", "Tengo tres preguntas de japonés.", "estudio|preguntas", "clase", "existence_aru|counter_tsu", "の|が", "日本語|質問|三つ|ある", "日本語|質問|三", "", "", "つ", 39, "expresar_existencia", "presente"],

  ["N4", 451, "もうすぐ会議が始まるので、会議室に入ってください。", "La reunión empezará pronto, así que entra en la sala de reuniones.", "trabajo|tiempo", "oficina", "node_reason|mousugu|te_kudasai", "が|ので|に", "もうすぐ|会議|始まる|会議室|入る", "会議|始|会議室|入", "始まる|入る", "", "", 58, "dar_instrucciones", "futuro"],
  ["N4", 452, "住所を間違えてしまったので、もう一度送ります。", "Como me equivoqué con la dirección, la enviaré otra vez.", "servicios|comunicacion", "tramite", "te_shimau|node_reason", "を|ので", "住所|間違える|もう一度|送る", "住所|間違|一度|送", "間違える|送る", "", "", 62, "explicar_error", "pasado"],
  ["N4", 453, "課長によると、来週から予定が変わるそうです。", "Según el jefe de sección, parece que el plan cambiará desde la próxima semana.", "trabajo|planes", "oficina", "ni_yoru_to|sou_da_hearsay", "に|から|が", "課長|来週|予定|変わる|そう", "課長|来週|予定|変", "変わる", "", "", 66, "transmitir_informacion", "futuro"],
  ["N4", 454, "海岸を歩きながら、将来のことを考えました。", "Pensé en el futuro mientras caminaba por la costa.", "naturaleza|planes", "paseo", "nagara|noun_modification", "を|ながら|の", "海岸|歩く|将来|考える", "海岸|歩|将来|考", "歩く|考える", "", "", 55, "narrar_reflexion", "pasado"],
  ["N4", 455, "一日中働いたので、足が痛くなりました。", "Como trabajé todo el día, me empezaron a doler los pies.", "trabajo|salud", "cansancio", "node_reason|ku_naru", "ので|が", "一日中|働く|足|痛い|なる", "一日中|働|足|痛", "働く|なる", "痛い", "", 61, "explicar_consecuencia", "pasado"],
  ["N4", 456, "友達が合格して、私もとても嬉しかったです。", "Mi amigo aprobó y yo también me alegré mucho.", "relaciones|estudio|emociones", "resultado", "te_sequence|i_adjective_past", "が|も", "友達|合格|私|嬉しい", "友達|合格|私|嬉", "合格する", "嬉しい", "", 54, "expresar_emocion", "pasado"],
  ["N4", 457, "知らない人に急に話しかけられて、少し驚きました。", "Me sorprendí un poco cuando un desconocido me habló de repente.", "relaciones|comunicacion", "calle", "passive|te_sequence", "に", "知らない人|急に|話しかける|少し|驚く", "知|人|急|話|驚", "話しかける|驚く", "", "", 67, "relatar_experiencia", "pasado"],
  ["N4", 458, "試験の結果を聞くまで、母はずっと心配していました。", "Mi madre estuvo preocupada todo el tiempo hasta escuchar el resultado del examen.", "familia|estudio|emociones", "espera", "made|teiru_state", "の|を|まで|は", "試験|結果|聞く|母|ずっと|心配", "試験|結果|聞|母|心配", "聞く|心配する", "", "", 70, "describir_estado", "pasado"],
  ["N4", 459, "説明を読んだら、使い方が少し分かりやすくなりました。", "Cuando leí la explicación, la forma de uso se volvió un poco más fácil de entender.", "tecnologia|estudio", "manual", "tara_conditional|yasui|ku_naru", "を|が", "説明|読む|使い方|少し|分かりやすい", "説明|読|使|方|分", "読む|分かる", "分かりやすい", "", 64, "explicar_cambio", "pasado"],
  ["N4", 460, "この坂を上がると、右に古い寺が見えます。", "Si subes esta cuesta, verás un templo antiguo a la derecha.", "viajes|orientacion|cultura", "paseo", "to_condition|potential_mieru", "を|と|に|が", "坂|上がる|右|古い|寺|見える", "坂|上|右|古|寺|見", "上がる|見える", "古い", "", 60, "dar_direccion", "presente"],
  ["N4", 461, "電気代が高いので、使わない部屋の電気を消すことにしました。", "Como la factura de la luz está alta, decidí apagar la luz de las habitaciones que no uso.", "hogar|medio_ambiente", "ahorro", "node_reason|koto_ni_suru|relative_clause", "が|ので|の|を", "電気代|高い|使う|部屋|電気|消す", "電気代|高|使|部屋|電気|消", "使う|消す", "高い", "", 72, "explicar_decision", "pasado"],
  ["N4", 462, "安全のために、交差点では自転車を降りなければなりません。", "Por seguridad, hay que bajarse de la bicicleta en el cruce.", "transporte|normas", "calle", "tame_ni|nakereba_naranai", "の|ために|では|を", "安全|交差点|自転車|降りる", "安全|交差点|自転車|降", "降りる", "", "", 73, "expresar_norma", "presente"],
  ["N4", 463, "カーテンを替えたら、部屋が明るくなりました。", "Al cambiar las cortinas, la habitación se volvió más luminosa.", "hogar|cambios", "decoracion", "tara|ku_naru", "を|が", "カーテン|替える|部屋|明るい|なる", "替|部屋|明", "替える|なる", "明るい", "", 57, "describir_cambio", "pasado"],
  ["N4", 464, "赤ちゃんが寝ている間は、大きな声で話さないでください。", "Mientras el bebé duerme, no hables en voz alta.", "familia|hogar|normas", "cuidado", "aida|negative_request", "が|間|は|で", "赤ちゃん|寝る|間|大きな声|話す", "赤|寝|間|大|声|話", "寝る|話す", "大きな", "", 68, "pedir_cuidado", "presente", "negativa"],
  ["N4", 465, "番組が始まる前に、飲み物を用意しておきます。", "Antes de que empiece el programa, dejaré preparadas las bebidas.", "ocio|hogar", "television", "mae_ni|te_oku", "が|前に|を", "番組|始まる|前|飲み物|用意", "番組|始|前|飲|物|用意", "始まる|用意する", "", "", 59, "preparar_accion", "futuro"],
  ["N4", 466, "アルバイトをしながら、日本語学校に通っています。", "Asisto a una escuela de japonés mientras trabajo a tiempo parcial.", "trabajo|estudio", "rutina", "nagara|teiru_habit", "を|ながら|に", "アルバイト|日本語学校|通う", "日本語学校|通", "通う", "", "", 63, "describir_habito", "presente"],
  ["N4", 467, "会場に着いたら、受付で名前を言ってください。", "Cuando llegues al recinto, di tu nombre en recepción.", "eventos|servicios", "entrada", "tara|te_kudasai", "に|で|を", "会場|着く|受付|名前|言う", "会場|着|受付|名前|言", "着く|言う", "", "", 56, "dar_instrucciones", "futuro"],
  ["N4", 468, "この鏡は割れやすいので、箱に入れて運びましょう。", "Este espejo se rompe fácilmente, así que llevémoslo dentro de una caja.", "hogar|servicios", "mudanza", "yasui|node_reason|mashou", "は|ので|に", "鏡|割れる|箱|入れる|運ぶ", "鏡|割|箱|入|運", "割れる|入れる|運ぶ", "", "", 69, "proponer_cuidado", "presente"],
  ["N4", 469, "悲しい映画なのに、最後は少し安心しました。", "Aunque era una película triste, al final me sentí un poco aliviado.", "ocio|emociones", "cine", "noni_contrast|na_no_ni", "なのに|は", "悲しい|映画|最後|少し|安心", "悲|映画|最後|少|安心", "安心する", "悲しい", "", 65, "expresar_contraste", "pasado"],
  ["N4", 470, "案内のメールに地図が付いているかどうか確認してください。", "Comprueba si el correo de información lleva un mapa adjunto.", "servicios|tecnologia", "correo", "ka_douka|te_kudasai", "の|に|が", "案内|メール|地図|付く|確認", "案内|地図|付|確認", "付く|確認する", "", "", 71, "pedir_confirmacion", "presente"],
  ["N4", 471, "味が薄かったら、少ししょうゆを入れてもいいですよ。", "Si el sabor está suave, puedes añadir un poco de salsa de soja.", "comida|cocina", "cocina", "tara|te_mo_ii", "が|を", "味|薄い|少し|しょうゆ|入れる", "味|薄|少|入", "入れる", "薄い", "", 58, "dar_permiso", "presente"],
  ["N4", 472, "この店は込んでいますが、料理が出るのは早いです。", "Esta tienda está llena, pero la comida sale rápido.", "comida|servicios", "restaurante", "ga_contrast|nominalizer_no", "は|が|の", "店|込む|料理|出る|早い", "店|込|料理|出|早", "込む|出る", "早い", "", 61, "contrastar_servicio", "presente"],
  ["N4", 473, "アナウンサーの話し方をまねして、発音を練習しています。", "Estoy practicando la pronunciación imitando la forma de hablar del presentador.", "estudio|medios", "pronunciacion", "te_sequence|teiru_progressive", "の|を", "アナウンサー|話し方|まね|発音|練習", "話|方|発音|練習", "まねする|練習する", "", "", 74, "describir_estudio", "progresivo"],
  ["N4", 474, "気分が悪くなったら、すぐ先生に知らせてください。", "Si te encuentras mal, avisa enseguida al profesor.", "salud|estudio", "clase", "tara|ku_naru|te_kudasai", "が|に", "気分|悪い|すぐ|先生|知らせる", "気分|悪|先生|知", "知らせる", "悪い", "", 67, "dar_instrucciones", "futuro"],
  ["N4", 475, "この資料は大切なので、なくさないようにしてください。", "Como este documento es importante, procura no perderlo.", "trabajo|estudio", "documentos", "node_reason|you_ni_suru", "は|なので", "資料|大切|なくす|ください", "資料|大切", "なくす", "大切", "", 60, "pedir_cuidado", "presente", "negativa"],
  ["N4", 476, "帰りにスーパーへ寄ってから、夕飯を作ります。", "De vuelta pasaré por el supermercado y luego prepararé la cena.", "vida_diaria|comida", "recados", "te_kara|sequence", "に|へ|から|を", "帰り|スーパー|寄る|夕飯|作る", "帰|夕飯|作", "寄る|作る", "", "", 57, "explicar_secuencia", "futuro"],
  ["N4", 477, "科学の本を読んでみたら、思ったより面白かったです。", "Probé a leer un libro de ciencia y fue más interesante de lo que pensaba.", "estudio|ocio", "lectura", "te_miru|tara|yori", "の|を|より", "科学|本|読む|思う|面白い", "科学|本|読|思|面白", "読む|思う", "面白い", "", 66, "relatar_descubrimiento", "pasado"],
  ["N4", 478, "倍の値段でも、安全な物を選ぶつもりです。", "Aunque cueste el doble, pienso elegir un producto seguro.", "compras|seguridad", "decision", "temo_concession|tsumori", "の|でも|を", "倍|値段|安全|物|選ぶ|つもり", "倍|値段|安全|物|選", "選ぶ", "安全", "", 72, "expresar_intencion", "futuro"],
  ["N4", 479, "このアプリを使うと、単語の復習が続けやすくなります。", "Si usas esta aplicación, repasar vocabulario se vuelve más fácil de mantener.", "tecnologia|estudio", "app", "to_condition|yasui|ku_naru", "を|と|の|が", "アプリ|使う|単語|復習|続ける", "使|単語|復習|続", "使う|続ける", "続けやすい", "", 64, "explicar_utilidad", "presente"],
  ["N4", 480, "会話の練習中に間違えても、すぐ直せば大丈夫です。", "Durante la práctica de conversación, aunque te equivoques, está bien si corriges enseguida.", "estudio|comunicacion", "clase", "temo|ba_condition", "の|中に|ても|ば", "会話|練習中|間違える|すぐ|直す|大丈夫", "会話|練習中|間違|直|大丈夫", "間違える|直す", "", "", 75, "animar_correccion", "presente"]
];

function cell(value) {
  const s = String(value ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(pair, direction) {
  const [level, number, ja, es, topic, situation, grammar, particle, vocabulary, kanji, verbs, adjectives, counters, difficulty, fn, tense, polarity = "afirmativa", sentenceType = "declarativa"] = pair;
  const jaEs = direction === "ja_es";
  const id = `${jaEs ? "JAES" : "ESJA"}-${level}-ORGANIC-202608-${String(number).padStart(4, "0")}`;
  const values = {
    exercise_id: id,
    source_language: jaEs ? "ja" : "es",
    target_language: jaEs ? "es" : "ja",
    direction,
    source_text: jaEs ? ja : es,
    reference_translation: jaEs ? es : ja,
    accepted_alternatives_json: "[]",
    jlpt_level: level,
    difficulty,
    topic_tags: topic,
    situation_tags: situation,
    grammar_tags: grammar,
    particle_tags: particle,
    vocabulary_tags: vocabulary,
    kanji_tags: kanji,
    verb_tags: verbs,
    adjective_tags: adjectives,
    counter_tags: counters,
    register: "cortés",
    communicative_function: fn,
    tense_aspect: tense,
    polarity,
    sentence_type: sentenceType,
    pedagogical_notes: `Lote orgánico 2026-08: ${level} con vocabulario contextual y progresión temática.`,
    ambiguity_notes: "",
    core_exercise: number % 5 === 1 ? "true" : "false",
    active: "true",
    dataset_version: "5.0",
  };
  return headers.map((header) => cell(values[header])).join(",");
}

const expansionRows = pairs.flatMap((pair) => [row(pair, "ja_es"), row(pair, "es_ja")]);
const existing = fs.readFileSync(fullPath, "utf8").trimEnd().split(/\r?\n/);
const base = existing
  .filter((line, index) => index === 0 || !line.includes("-ORGANIC-202608-"))
  .map((line) =>
    line.startsWith("JAES-N5-0001,") || line.startsWith("ESJA-N5-0001,")
      ? line.replace(/,4\.0$/, ",5.0")
      : line,
  );

fs.writeFileSync(expansionPath, [headers.join(","), ...expansionRows].join("\n") + "\n", "utf8");
fs.writeFileSync(fullPath, [...base, ...expansionRows].join("\n") + "\n", "utf8");

console.log(JSON.stringify({
  semantic_pairs: pairs.length,
  exercises: expansionRows.length,
  n5_pairs: pairs.filter((pair) => pair[0] === "N5").length,
  n4_pairs: pairs.filter((pair) => pair[0] === "N4").length,
  output: path.relative(root, expansionPath),
}, null, 2));

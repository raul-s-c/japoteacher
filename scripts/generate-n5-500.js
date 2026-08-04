import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fullPath=path.join(root,'data','exercises.full.csv');
const outputPath=path.join(root,'data','exercises.expansion-n5-500.csv');
const original=fs.readFileSync(fullPath,'utf8').trimEnd().split(/\r?\n/).filter(line=>!line.includes('-N5-MORE-'));
const headers=original[0].split(',');
const cell=value=>{const s=String(value??'');return /[",\r\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s};

const days=[['月曜日','el lunes'],['火曜日','el martes'],['水曜日','el miércoles'],['木曜日','el jueves'],['金曜日','el viernes'],['土曜日','el sábado'],['日曜日','el domingo'],['毎朝','cada mañana'],['毎晩','cada noche'],['週末','el fin de semana']];
const times=[['七時','las siete'],['八時半','las ocho y media'],['九時','las nueve'],['十時半','las diez y media'],['十一時','las once'],['十二時','las doce'],['一時半','la una y media'],['三時','las tres'],['五時半','las cinco y media'],['六時','las seis']];
const places=[['学校','la escuela'],['図書館','la biblioteca'],['駅','la estación'],['公園','el parque'],['会社','la oficina'],['銀行','el banco'],['郵便局','correos'],['病院','el hospital'],['スーパー','el supermercado'],['レストラン','el restaurante']];
const destinations=[['学校','a la escuela'],['図書館','a la biblioteca'],['駅','a la estación'],['公園','al parque'],['会社','a la oficina'],['銀行','al banco'],['郵便局','a correos'],['病院','al hospital'],['スーパー','al supermercado'],['レストラン','al restaurante']];
const transport=[['歩いて','andando'],['自転車で','en bicicleta'],['バスで','en autobús'],['電車で','en tren'],['地下鉄で','en metro'],['タクシーで','en taxi'],['車で','en coche'],['新幹線で','en tren bala'],['飛行機で','en avión'],['船で','en barco']];
const foods=[['すし','el sushi'],['魚','el pescado'],['肉','la carne'],['野菜','las verduras'],['果物','la fruta'],['パン','el pan'],['ラーメン','el ramen'],['カレー','el curry'],['卵','los huevos'],['アイスクリーム','el helado']];
const drinks=[['水','agua'],['お茶','té'],['コーヒー','café'],['牛乳','leche'],['ジュース','zumo'],['紅茶','té negro'],['炭酸水','agua con gas'],['レモン水','agua con limón'],['温かいお茶','té caliente'],['冷たい水','agua fría']];
const objects=[['本','libro'],['新聞','periódico'],['手紙','carta'],['写真','foto'],['切符','billete'],['地図','mapa'],['傘','paraguas'],['辞書','diccionario'],['かばん','bolso'],['ノート','cuaderno']];
const counters=[['本を一冊','un libro'],['新聞を二部','dos periódicos'],['手紙を三通','tres cartas'],['写真を四枚','cuatro fotos'],['切符を二枚','dos billetes'],['地図を一枚','un mapa'],['傘を一本','un paraguas'],['辞書を二冊','dos diccionarios'],['かばんを一つ','un bolso'],['ノートを三冊','tres cuadernos']];
const people=[['父','mi padre'],['母','mi madre'],['兄','mi hermano mayor'],['姉','mi hermana mayor'],['弟','mi hermano menor'],['妹','mi hermana menor'],['祖父','mi abuelo'],['祖母','mi abuela'],['友達','mi amigo'],['先生','mi profesor']];
const animals=[['猫','un gato'],['犬','un perro'],['鳥','un pájaro'],['魚','un pez'],['うさぎ','un conejo'],['馬','un caballo'],['牛','una vaca'],['鶏','una gallina'],['亀','una tortuga'],['ねずみ','un ratón']];
const adjectives=[['大きい','grande'],['小さい','pequeño'],['新しい','nuevo'],['古い','antiguo'],['高い','caro'],['安い','barato'],['面白い','interesante'],['難しい','difícil'],['静か','tranquilo'],['便利','práctico']];
const colors=[['赤い','rojo'],['青い','azul'],['白い','blanco'],['黒い','negro'],['黄色い','amarillo'],['緑の','verde'],['茶色い','marrón'],['ピンクの','rosa'],['灰色の','gris'],['紫の','morado']];
const activities=[['日本語を勉強します','estudio japonés'],['本を読みます','leo un libro'],['音楽を聞きます','escucho música'],['映画を見ます','veo una película'],['料理をします','cocino'],['写真を撮ります','hago fotos'],['手紙を書きます','escribo una carta'],['買い物をします','hago compras'],['散歩します','doy un paseo'],['テニスをします','juego al tenis']];
const infinitives=['estudiar japonés','leer un libro','escuchar música','ver una película','cocinar','hacer fotos','escribir una carta','hacer compras','dar un paseo','jugar al tenis'];
const pastActivities=[['日本語を勉強しました','estudié japonés'],['本を読みました','leí un libro'],['音楽を聞きました','escuché música'],['映画を見ました','vi una película'],['料理をしました','cociné'],['写真を撮りました','hice fotos'],['手紙を書きました','escribí una carta'],['買い物をしました','hice compras'],['散歩しました','di un paseo'],['テニスをしました','jugué al tenis']];

const patterns=[
  {topic:'rutina|tiempo',situation:'casa',grammar:'polite_present|particle_ni',particle:'に',fn:'describir_rutina',tense:'presente',make:i=>[`${days[i][0]}${times[i][0]}に起きます。`,`Me levanto a ${times[i][1]} ${days[i][1]}.`]},
  {topic:'viaje|transporte',situation:'desplazamiento',grammar:'movement_particles',particle:'へ|で',fn:'desplazarse',tense:'presente',make:i=>[`${transport[i][0]}${destinations[i][0]}へ行きます。`,`Voy ${destinations[i][1]} ${transport[i][1]}.`]},
  {topic:'lugares',situation:'ciudad',grammar:'existence_aru',particle:'に|が',fn:'describir_lugar',tense:'presente',make:i=>[`${places[i][0]}に${objects[i][0]}があります。`,`Hay un ${objects[i][1]} en ${places[i][1]}.`]},
  {topic:'animales|lugares',situation:'entorno',grammar:'existence_iru',particle:'に|が',fn:'describir_lugar',tense:'presente',make:i=>[`${places[i][0]}に${animals[i][0]}がいます。`,`Hay ${animals[i][1]} en ${places[i][1]}.`]},
  {topic:'comida|preferencias',situation:'restaurante',grammar:'suki',particle:'が',fn:'expresar_gusto',tense:'presente',make:i=>[`${people[i][0]}は${foods[i][0]}が好きです。`,`${people[i][1]} le gusta ${foods[i][1]}.`]},
  {topic:'comida',situation:'restaurante',grammar:'request_kudasai',particle:'を',fn:'pedir_comida',tense:'presente',make:i=>[`${drinks[i][0]}をください。`,`Póngame ${drinks[i][1]}, por favor.`]},
  {topic:'compras|contadores',situation:'tienda',grammar:'counter|polite_past',particle:'を',fn:'comprar',tense:'pasado',make:i=>[`${counters[i][0]}買いました。`,`Compré ${counters[i][1]}.`]},
  {topic:'compras|colores',situation:'tienda',grammar:'demonstrative_kono|adjective',particle:'は',fn:'describir_objeto',tense:'presente',make:i=>[`この${colors[i][0]}${objects[i][0]}はいくらですか。`,`¿Cuánto cuesta este ${objects[i][1]} ${colors[i][1]}?`]},
  {topic:'lugares|adjetivos',situation:'ciudad',grammar:'i_na_adjective',particle:'は',fn:'describir_lugar',tense:'presente',make:i=>[`${places[i][0]}は${adjectives[i][0]}です。`,`${places[i][1]} es ${adjectives[i][1]}.`]},
  {topic:'familia|ocupaciones',situation:'presentacion',grammar:'noun_desu',particle:'は',fn:'presentar_persona',tense:'presente',make:i=>[`${people[i][0]}は${places[i][0]}で働いています。`,`${people[i][1]} trabaja en ${places[i][1]}.`]},
  {topic:'rutina|acciones',situation:'vida_diaria',grammar:'polite_present',particle:'で|を',fn:'describir_accion',tense:'presente',make:i=>[`${places[i][0]}で${activities[i][0]}`,`${activities[i][1]} en ${places[i][1]}.`]},
  {topic:'pasado|acciones',situation:'vida_diaria',grammar:'polite_past',particle:'で|を',fn:'relatar_accion',tense:'pasado',make:i=>[`${days[i][0]}${places[i][0]}で${pastActivities[i][0]}`,`${days[i][1]} ${pastActivities[i][1]} en ${places[i][1]}.`]},
  {topic:'negacion|comida',situation:'habitos',grammar:'polite_negative',particle:'を',fn:'expresar_negacion',tense:'presente',polarity:'negativa',make:i=>[`${people[i][0]}は${foods[i][0]}を食べません。`,`${people[i][1]} no come ${foods[i][1]}.`]},
  {topic:'tiempo|horarios',situation:'agenda',grammar:'kara_made',particle:'から|まで',fn:'informar_horario',tense:'presente',make:i=>[`${places[i][0]}は${times[i][0]}から${times[(i+3)%10][0]}までです。`,`${places[i][1]} abre desde ${times[i][1]} hasta ${times[(i+3)%10][1]}.`]},
  {topic:'invitaciones|ocio',situation:'amistad',grammar:'mashouka',particle:'で',fn:'invitar',tense:'futuro',type:'interrogativa',make:i=>[`${days[i][0]}${places[i][0]}で${activities[i][0].replace('ます','ませんか')}`,`¿Te apetece ${infinitives[i]} en ${places[i][1]} ${days[i][1]}?`]},
  {topic:'deseos|ocio',situation:'planes',grammar:'tai_form',particle:'で|を',fn:'expresar_deseo',tense:'futuro',make:i=>[`${places[i][0]}で${activities[i][0].replace('ます','たいです')}`,`Quiero ${infinitives[i]} en ${places[i][1]}.`]},
  {topic:'peticiones',situation:'comunicacion',grammar:'te_kudasai',particle:'を',fn:'pedir_accion',tense:'presente',make:i=>[`${objects[i][0]}を見せてください。`,`Muéstreme el ${objects[i][1]}, por favor.`]},
  {topic:'permiso',situation:'lugares_publicos',grammar:'te_mo_ii',particle:'で',fn:'pedir_permiso',tense:'presente',type:'interrogativa',make:i=>[`${places[i][0]}で写真を撮ってもいいですか。`,`¿Puedo hacer fotos en ${places[i][1]}?`]},
  {topic:'normas',situation:'lugares_publicos',grammar:'te_wa_ikemasen',particle:'で',fn:'expresar_prohibicion',tense:'presente',polarity:'negativa',make:i=>[`${places[i][0]}で食べてはいけません。`,`No se puede comer en ${places[i][1]}.`]},
  {topic:'comparacion',situation:'vida_diaria',grammar:'yori_comparison',particle:'より|は',fn:'comparar',tense:'presente',make:i=>[`${objects[i][0]}は${objects[(i+1)%10][0]}より${adjectives[i][0]}です。`,`El ${objects[i][1]} es más ${adjectives[i][1]} que el ${objects[(i+1)%10][1]}.`]},
  {topic:'frecuencia|rutina',situation:'vida_diaria',grammar:'frequency_adverb',particle:'で',fn:'expresar_frecuencia',tense:'presente',make:i=>[`${days[i][0]}はよく${places[i][0]}で${activities[i][0]}`,`${days[i][1]} a menudo ${activities[i][1]} en ${places[i][1]}.`]},
  {topic:'posesion|familia',situation:'casa',grammar:'no_possession',particle:'の|です',fn:'indicar_posesion',tense:'presente',make:i=>[`この${objects[i][0]}は${people[i][0]}のです。`,`Este ${objects[i][1]} es de ${people[i][1]}.`]},
  {topic:'ubicacion',situation:'orientacion',grammar:'location_words',particle:'の|に',fn:'ubicar_objeto',tense:'presente',make:i=>[`${objects[i][0]}は${places[i][0]}の前にあります。`,`El ${objects[i][1]} está delante de ${places[i][1]}.`]},
  {topic:'preguntas|personas',situation:'conversacion',grammar:'question_dare',particle:'と',fn:'preguntar_persona',tense:'pasado',type:'interrogativa',make:i=>[`${days[i][0]}だれと${destinations[i][0]}へ行きましたか。`,`¿Con quién fuiste ${destinations[i][1]} ${days[i][1]}?`]},
  {topic:'preguntas|eleccion',situation:'tienda',grammar:'question_dore',particle:'が',fn:'preguntar_preferencia',tense:'presente',type:'interrogativa',make:i=>[`${colors[i][0]}${objects[i][0]}と${colors[(i+1)%10][0]}${objects[(i+1)%10][0]}と、どちらが好きですか。`,`¿Qué prefieres, el ${objects[i][1]} ${colors[i][1]} o el ${objects[(i+1)%10][1]} ${colors[(i+1)%10][1]}?`]}
];

function row(id,direction,ja,es,pattern,index){const jaEs=direction==='ja_es',values={exercise_id:id,source_language:jaEs?'ja':'es',target_language:jaEs?'es':'ja',direction,source_text:jaEs?ja:es,reference_translation:jaEs?es:ja,accepted_alternatives_json:'[]',jlpt_level:'N5',difficulty:1+(index%4),topic_tags:pattern.topic,situation_tags:pattern.situation,grammar_tags:pattern.grammar,particle_tags:pattern.particle,vocabulary_tags:'',kanji_tags:'',verb_tags:'',adjective_tags:'',counter_tags:pattern.topic.includes('contadores')?'basic_counters':'',register:'cortés',communicative_function:pattern.fn,tense_aspect:pattern.tense,polarity:pattern.polarity||'afirmativa',sentence_type:pattern.type||'declarativa',pedagogical_notes:'Práctica JLPT N5 contextualizada.',ambiguity_notes:'',core_exercise:index%10===0?'true':'false',active:'true',dataset_version:'3.0'};return headers.map(header=>cell(values[header])).join(',')}

const rows=[];let number=0;
for(const pattern of patterns)for(let i=0;i<10;i++){number++;const [ja,es]=pattern.make(i),suffix=String(number).padStart(4,'0');rows.push(row(`JAES-N5-MORE-${suffix}`,'ja_es',ja,es,pattern,number));rows.push(row(`ESJA-N5-MORE-${suffix}`,'es_ja',ja,es,pattern,number))}
if(number!==250||rows.length!==500)throw new Error(`Cantidad inesperada: ${number} pares / ${rows.length} ejercicios`);
fs.writeFileSync(outputPath,[headers.join(','),...rows].join('\n')+'\n','utf8');
fs.writeFileSync(fullPath,[...original,...rows].join('\n')+'\n','utf8');
console.log(JSON.stringify({pairs:number,rows:rows.length,ja_es:250,es_ja:250,total:original.length-1+rows.length,last_id:'ESJA-N5-MORE-0250'}));

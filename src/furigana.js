(function(){
  const readings={
    'JAES-N5-0001':'<ruby>毎朝<rt>まいあさ</rt></ruby><ruby>七時<rt>しちじ</rt></ruby>に<ruby>起<rt>お</rt></ruby>きます。',
    'JAES-N5-0002':'<ruby>駅<rt>えき</rt></ruby>の<ruby>前<rt>まえ</rt></ruby>で<ruby>友達<rt>ともだち</rt></ruby>を<ruby>待<rt>ま</rt></ruby>っています。',
    'JAES-N5-0003':'この<ruby>本<rt>ほん</rt></ruby>はあまり<ruby>難<rt>むずか</rt></ruby>しくないです。',
    'JAES-N5-0004':'<ruby>日曜日<rt>にちようび</rt></ruby>に<ruby>家族<rt>かぞく</rt></ruby>と<ruby>公園<rt>こうえん</rt></ruby>へ<ruby>行<rt>い</rt></ruby>きました。',
    'JAES-N5-0005':'コーヒーをもう<ruby>一杯<rt>いっぱい</rt></ruby>ください。',
    'JAES-N4-0006':'<ruby>雨<rt>あめ</rt></ruby>が<ruby>降<rt>ふ</rt></ruby>っても、<ruby>試合<rt>しあい</rt></ruby>はあります。',
    'JAES-N4-0007':'<ruby>日本<rt>にほん</rt></ruby>へ<ruby>来<rt>き</rt></ruby>てから、<ruby>寿司<rt>すし</rt></ruby>が<ruby>好<rt>す</rt></ruby>きになりました。',
    'JAES-N4-0008':'この<ruby>薬<rt>くすり</rt></ruby>は<ruby>食事<rt>しょくじ</rt></ruby>の<ruby>後<rt>あと</rt></ruby>で<ruby>飲<rt>の</rt></ruby>んでください。',
    'JAES-N4-0009':'<ruby>電車<rt>でんしゃ</rt></ruby>が<ruby>遅<rt>おく</rt></ruby>れたので、<ruby>会議<rt>かいぎ</rt></ruby>に<ruby>間<rt>ま</rt></ruby>に<ruby>合<rt>あ</rt></ruby>いませんでした。',
    'JAES-N4-0010':'<ruby>時間<rt>じかん</rt></ruby>があれば、<ruby>美術館<rt>びじゅつかん</rt></ruby>にも<ruby>行<rt>い</rt></ruby>きたいです。'
  };
  window.Furigana={html:exercise=>readings[exercise.exercise_id]||exercise.source_text,has:exercise=>Boolean(readings[exercise.exercise_id])};
})();

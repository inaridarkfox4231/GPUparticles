// 見る人増えてきたのでsimplifyします
// hideを解除したときリセットされるように仕様変更（20220718）
// hideしてるときにsaveできない問題を解消（20220727）

// 色だけdat.GUIで変えられるようにしました。
// 参考：h_doxasさんのhttps://wgld.org/d/webgl/w083.html です！

// bgManager廃止してシェーダでグラデとかチェックとかするように
// しますか

// あれと同じように
// 白(baseColor)→黒(mainColor)で変化させる
// MONOTONEの場合はmainColorだけ使われる
// GRADATION_Xとか_Yの場合はsubColorが使われてmainが右上で
// subが左下になるように変化させる
// って感じで
// たとえばbaseColorを灰色に近くするとチェックで...そういうこと。
// あれと同じように、ね。

// 青海波や工字繋ぎはスケール固定でその場で生成する
// 雲とかも
// それをテクスチャに放り込んで参照させて使う感じですかね

// シェーダーで描くのか2Dで描くのか
// どっちもやる
// パターンごとにシェーダー作る
// 2Dのグラフィックスを1枚作って
// webglのグラフィックを1枚
// 1枚のフレームバッファに最終的に落として
// それを使ってってやる

// その前にリサイズ関連なんとかするのと
// リセットを用意（dataInputを呼び出すだけなので楽ちん）

// やめようめんどくさい
// 毎フレーム描画でいいと思う
// それでうまくいくように調整して
// なんなら流用でもいい（あれの流用）

// テクスチャなんとかしたいね
// これだとちょっとね

// とりあえずトラぺ作るか（完全に忘れてた）
// トラぺの時に仮背景出すにはセーブ時にフラグ立てて
// セーブが完了してからフラグを折ればいい
// 然るべく背景設定してセーブフラグも立てる感じ
// 関数の内容を「フラグを立てる」にして
// フラグが立ってる場合に背景無視してセーブしたらフラグを折る
// 一瞬でできるので帰ってから

// エンターキーだと数値入力の際に不具合が出るので
// Rキーでリセットすることにした（82）

// 20220831
// bloom実装の前段階としてRenderNodeを最新版に更新（setFBOでエラーを出すなどいくつか改善されてる）
// copyVertでマウスのy反転をしていなかったのでinput部分と両方直すことで改善（困るので）
// さらにFragの方をmirrorFragに名前変更（copyFragを別に作って利用するので）
// bloom関連のシェーダを移植
// bgのFBOが不要だったので削除
// configにBLOOM関連の変数を追加
// TODO:initFramebuffersを導入して処理を導入してdyeの代わりにparticleを用いる
// それでうまくいくはずです
// 最終的にはparticleに結果を代入してって思ったけど
// mirrorがあるからワンクッションおかないとまずいわね。
// ワンクッションおいてdyeに...というかまあ、いいや。dyeに落として、framebufferに。
// それにbloomかけて最終的にbloomを足して結果とする。

// 移した。dyeを表示するところまでやりました。あとはbloomをapplyするだけ。

// 20220901
// shaderを一通り用意。
// bloom実装完了. お疲れさまでした。

// --------------------------------------------------------------- //
// global.

let _gl, gl;

let _node; // RenderSystemSetにアクセスするためのglobal.

let accell = 0; // 加速度
let properFrameCount = 0;

const TEX_SIZE = 512; // 512x512個のパーティクルを用いる

let ext = {}; // extension.

const MONOTONE_PATTERN = 0;
const NOISE_PATTERN = 1;
const CHECK_PATTERN = 2;
const CLOUD_PATTERN = 3;
const TRIANGLE_PATTERN = 4;
const SEIGAIHA_PATTERN = 5;
const KOJI_PATTERN = 6;
const ASANOHA_PATTERN = 7;

const MONOTONE_GRADATION = 0;
const X_GRADATION = 1;
const Y_GRADATION = 2;

const AUTO_SIZE = 0;
const MANUAL_SIZE = 1;

const testFunc = {'alert':function(){console.log("hello!")}};

let config = {
  PARTICLE_COLOR:{r:32,g:64,b:255}, // パーティクルの色
  AUTO_COLOR:false, // trueの場合色が時間経過で変化する感じ
  MIRROR_X:false, // mirror_x
  MIRROR_Y:false, // mirror_y
  MAIN_COLOR:{r:0,g:0,b:0}, // テクスチャの黒い部分の色
  SUB_COLOR:{r:0,g:0,b:0},  // 黒い部分でグラデやるときに使う
  BASE_COLOR:{r:60,g:60,b:60}, // テクスチャの白い部分の色
  BGPATTERN:MONOTONE_PATTERN,
  GRADATION:MONOTONE_GRADATION,
  SIZETYPE:AUTO_SIZE, // 画面サイズに応じて決まる
  WIDTH:1024,
  HEIGHT:768,
  HIDE:false, // パーティクルを描画しない
  TRANSPARENT:false, // 透過素材作成用
  BLOOM: true,
	BLOOM_DITHER: true,
  BLOOM_ITERATIONS: 8,
  BLOOM_RESOLUTION: 256,
  BLOOM_INTENSITY: 0.8,
  BLOOM_THRESHOLD: 0.6,
  BLOOM_SOFT_KNEE: 0.7,
  BLOOM_COLOR: "#fff",
};

let textureTableSource;
let textureTable;

let currentWidth;
let currentHeight;

let saveFlag = false; // これをtrueにして...

// --------------------------------------------------------------- //
// dat.GUI

(function(){
  var gui = new dat.GUI({ width: 280 });

	gui.add(testFunc, 'alert');

  gui.addColor(config, 'PARTICLE_COLOR').name('particleColor');
  gui.add(config, 'AUTO_COLOR').name('autoColor');
  gui.add(config, 'MIRROR_X').name('mirrorX');
  gui.add(config, 'MIRROR_Y').name('mirrorY');

  let bgFolder = gui.addFolder('bg');
  bgFolder.addColor(config, 'MAIN_COLOR').name('mainColor');
  bgFolder.addColor(config, 'SUB_COLOR').name('subColor');
  bgFolder.addColor(config, 'BASE_COLOR').name('baseColor');
  bgFolder.add(config, 'BGPATTERN', {'MONOTONE':MONOTONE_PATTERN, 'NOISE':NOISE_PATTERN, 'CHECK':CHECK_PATTERN, 'CLOUD':CLOUD_PATTERN, 'TRIANGLE':TRIANGLE_PATTERN, 'SEIGAIHA':SEIGAIHA_PATTERN, 'KOJI':KOJI_PATTERN, 'ASANOHA':ASANOHA_PATTERN}).name('pattern');
  bgFolder.add(config, 'GRADATION', {'MONOTONE':MONOTONE_GRADATION, 'GRADATION_X':X_GRADATION, 'GRADATION_Y':Y_GRADATION}).name('gradation');
  bgFolder.add(config, 'TRANSPARENT').name('transparent');

  let sizeFolder = gui.addFolder('size');
  sizeFolder.add(config, 'SIZETYPE', {'AUTO':AUTO_SIZE, 'MANUAL':MANUAL_SIZE}).name('sizeType');
  sizeFolder.add(config, 'WIDTH', 256, 1280, 1).name('width');
  sizeFolder.add(config, 'HEIGHT', 256, 768, 1).name('height');

	let bloomFolder = gui.addFolder('bloom');
  bloomFolder.add(config, 'BLOOM').name('bloom');
	bloomFolder.add(config, 'BLOOM_DITHER').name('dither');
  bloomFolder.add(config, 'BLOOM_ITERATIONS', 1, 8, 1).name('iterations');
  bloomFolder.add(config, 'BLOOM_INTENSITY', 0, 5, 0.1).name('intensity');
  bloomFolder.add(config, 'BLOOM_THRESHOLD', 0, 1, 0.1).name('threshold');
  bloomFolder.add(config, 'BLOOM_SOFT_KNEE', 0, 1, 0.1).name('soft_knee');
  bloomFolder.addColor(config, 'BLOOM_COLOR').name('bloom_color');

  gui.add({fun:saveFlagOn}, 'fun').name('save');
  gui.add({fun:dataInput}, 'fun').name('reset');
  gui.add(config, 'HIDE').name('hide').onChange(showReset);
})();

// show時にリセット
function showReset(){
	if(!config.HIDE){ dataInput(); }
}

// ------------------------------------- //
// texture用

// テクスチャ関連の関数は床の模様とオブジェクト用で使い回す
const forTexture =
// テクスチャサンプリングのための前処理
"vec2 prepareForTexture(vec2 p){" +
"  if(uTextureId == 6.0){" + // 工字繋ぎ
"    p *= mat2(0.5,-sqrt(3.0)*0.5,0.5,sqrt(3.0)*0.5);" +
"    p = fract(p*4.0);" + // ついでに4倍
"  }else if(uTextureId == 7.0){" + // あさのは
"    p.y = fract(p.y*2.0/sqrt(3.0));" + // ここでyにこうしたあとで
"    p = fract(p);" + // fract.
"  }else{" +
"    p = fract(p);" +
"  }" +
"  return p;" +
"}" +
// テクスチャサンプリング
"float getAmount(vec2 tex){" +
"  float offsetX = mod(uTextureId, 4.0) * 0.25;" +
"  float offsetY = floor(uTextureId / 4.0) * 0.25;" +
"  float delta = 1.0/uTextureSize;" +
// つなぎ目の不自然さを消すための処理。暫定処理だけどこれでいこう。
"  tex.x = clamp(tex.x, delta, 1.0-delta);" +
"  tex.y = clamp(tex.y, delta, 1.0-delta);" +
"  vec2 _tex = vec2(offsetX, offsetY) + tex*0.25;" +
"  float amt = texture2D(uTextureTable, _tex).r;" +
"  return amt;" +
"}";

// --------------------------------------------------------------- //
// shader.

// dataShader. 最初の位置と速度を設定するところ。
// いわゆる板ポリ芸で初期値を決めている（座標値依存）
const dataVert=
"precision mediump float;" +
"attribute vec2 aPosition;" + // unique attribute.
"void main(){" +
"  gl_Position = vec4(aPosition, 0.0, 1.0);" +
"}";

const dataFrag=
"precision mediump float;" +
"uniform float uTexSize;" +
"void main(){" +
"  vec2 p = gl_FragCoord.xy / uTexSize;" + // 0.0～1.0に正規化
// 初期位置と初期速度を設定
"  vec2 pos = (p - 0.5) * 2.0;" + // 位置は-1～1,-1～1で。
"  gl_FragColor = vec4(pos, 0.0, 0.0);" + // 初期速度は0で。
"}";

// moveShader. 位置と速度の更新をオフスクリーンレンダリングで更新する。
const moveVert =
"precision mediump float;" +
"attribute vec2 aPosition;" +
"void main(){" +
"  gl_Position = vec4(aPosition, 0.0, 1.0);" +
"}";

const moveFrag =
"precision mediump float;" +
"uniform sampler2D uTex;" +
"uniform float uTexSize;" +
"uniform vec2 uMouse;" +
"uniform bool uMouseFlag;" +
"uniform float uAccell;" +
"const float SPEED = 0.05;" +
"void main(){" +
"  vec2 p = gl_FragCoord.xy / uTexSize;" + // ピクセル位置そのまま
"  vec4 t = texture2D(uTex, p);" +
"  vec2 pos = t.xy;" +
"  vec2 velocity = t.zw;" +
// 更新処理
"  vec2 v = normalize(uMouse - pos) * 0.2;" +
"  vec2 w = normalize(velocity + v);" + // 大きさは常に1で
"  vec4 destColor = vec4(pos + w * SPEED * uAccell, w);" +
// マウスが押されてなければ摩擦で減衰させる感じで
"  if(!uMouseFlag){ destColor.zw = velocity; }" +
"  gl_FragColor = destColor;" +
"}";

// pointShader. 位置情報に基づいて点の描画を行う。
const pointVert =
"precision mediump float;" +
"attribute float aIndex;" +
"uniform sampler2D uTex;" +
"uniform vec2 uResolution;" + // 解像度
"uniform float uTexSize;" + // テクスチャフェッチ用
"uniform float uPointScale;" +
"void main() {" +
// uTexSize * uTexSize個の点を配置
// 0.5を足しているのはきちんとマス目にアクセスするためです
"  float indX = mod(aIndex, uTexSize);" +
"  float indY = floor(aIndex / uTexSize);" +
"  float x = (indX + 0.5) / uTexSize;" +
"  float y = (indY + 0.5) / uTexSize;" +
"  vec4 t = texture2D(uTex, vec2(x, y));" +
"  vec2 p = t.xy;" +
"  p *= vec2(min(uResolution.x, uResolution.y)) / uResolution;" +
"  gl_Position = vec4(p, 0.0, 1.0);" +
"  gl_PointSize = 0.1 + uPointScale;" + // 動いてるときだけ大きく
"}";

// このuColorをまずHSBに落としたうえで
// hue値をばらして
// 再びrgbに落とすっていうのをやりたい
// うーん...だんだん位置が重複していって
// 同じ色に収束しちゃうわね。むずい。てかこんな位置重複してたのか。...
const pointFrag =
"precision mediump float;" +
"uniform vec3 uColor;" +
// メインコード
"void main(){" +
"  gl_FragColor = vec4(uColor, 1.0);" +
"}";

// particleに落とした画像を落とすためのシェーダ
const copyVert =
"precision mediump float;" +
"attribute vec2 aPosition;" +
"varying vec2 vUv;" +
"void main () {" +
"  vUv = aPosition * 0.5 + 0.5;" +
"  vUv.y = 1.0 - vUv.y;" +
"  gl_Position = vec4(aPosition, 0.0, 1.0);" +
"}";

// simpleなcopy用シェーダ
const copyFrag =
"precision mediump float;" +
"precision mediump sampler2D;" +
"varying highp vec2 vUv;" +
"uniform sampler2D uTex;" +
"void main () {" +
"  gl_FragColor = texture2D(uTex, vUv);" +
"}";

// こっちで複製した方がめっちゃ楽やん
// そうよね
// じゃあこっちでオプション設ける方向で...
// (0.5,0.5)を中心として回転させるとかしても面白そうなんだけど、
// 切れちゃうのがね...まずいんよね。だからせいぜいミラーリングまで
// 例えば縮小して回転とかだったら可能だけれど(0.7程度に収めるとか)
const mirrorFrag =
"precision mediump float;" +
"precision mediump sampler2D;" +
"varying highp vec2 vUv;" +
"uniform sampler2D uTex;" +
"uniform vec2 uMirror;" +
"void main () {" +
"  vec2 p = vUv;" +
"  vec2 p1 = vec2(1.0-p.x, p.y);" +
"  vec2 p2 = vec2(p.x, 1.0-p.y);" +
"  vec2 p3 = vec2(1.0-p.x, 1.0-p.y);" +
"  vec4 result = texture2D(uTex, p);" +
"  if(uMirror.x > 0.0){ result += texture2D(uTex, p1); }" +
"  if(uMirror.y > 0.0){ result += texture2D(uTex, p2); }" +
"  if(uMirror.x > 0.0 && uMirror.y > 0.0){ result += texture2D(uTex, p3); }" +
"  gl_FragColor = result;" +
"}";

// 背景はbgManager使わないでこれでいこう
const patternVert =
"precision mediump float;" +
"attribute vec2 aPosition;" +
"void main () {" +
"  gl_Position = vec4(aPosition, 0.0, 1.0);" +
"}";

// 最終的には
// まずサイズに応じた画像を生成して
// それに対し白：ベースカラー、黒：メインカラーで色変え
// それを背景とする
// グラデの場合にはサブカラーを使ってグラデかける
// でよろしく

// まずglのcoordを256で割って0～1に落とす
// それを加工する
// さらにamtを取得
// それと色情報から背景色を決定する。以上。
const patternFrag =
"precision mediump float;" +
"uniform vec2 uResolution;" +
"uniform vec3 uMainColor;" +
"uniform vec3 uSubColor;" +
"uniform vec3 uBaseColor;" +
"uniform float uTextureId;" +
"uniform float uTextureSize;" +
"uniform sampler2D uTextureTable;" +
"uniform int uGradationId;" +
forTexture +
// 25で
"float check(vec2 st){" +
"  vec2 f = vec2(floor(st.x / 25.0), floor(st.y / 25.0));" +
"  return mod(f.x + f.y, 2.0);" +
"}" +
"void main(){" +
"  vec2 st = gl_FragCoord.xy;" + // 座標そのまま
"  vec2 tex = st / uTextureSize;" + // サイズ(256)で割る(fractはしない)
"  tex.y = 1.0 - tex.y;" + // 反転させよう
//"  vec2 p = st / min(uResolution.x, uResolution.y);" +
"  vec2 q = st / uResolution;" +
"  vec3 col;" +
//"  col = vec3(q.y);" +
//"  col = vec3(check(st)*0.5);" +
"  tex = prepareForTexture(tex);" + // 事前の処理
"  float amt = getAmount(tex);" +
"  if(uGradationId == 0){ col = uMainColor; }" +
"  else if(uGradationId == 1){ col = uMainColor * q.x + uSubColor * (1.0 - q.x); }" +
"  else if(uGradationId == 2){ col = uMainColor * q.y + uSubColor * (1.0 - q.y); }" +
"  col = (1.0 - amt) * col + amt * uBaseColor;" +
"  gl_FragColor = vec4(col, 1.0);" +
"}";

// ---------------------------------------------------------------- //
// bloom関連のシェーダ

// 基本バーテックスシェーダ
const baseVertexShader =
"precision highp float;" +
"attribute vec2 aPosition;" +
"varying vec2 vUv;" +
"varying vec2 vL;" + // left  // 「//」は中に入れちゃ駄目です。
"varying vec2 vR;" + // right
"varying vec2 vT;" + // top
"varying vec2 vB;" + // bottom
"uniform vec2 uTexelSize;" +
"void main () {" +
// 0～1の0～1で上下逆なのでTがプラス
"  vUv = aPosition * 0.5 + 0.5;" +
"  vL = vUv - vec2(uTexelSize.x, 0.0);" +
"  vR = vUv + vec2(uTexelSize.x, 0.0);" +
"  vT = vUv + vec2(0.0, uTexelSize.y);" +
"  vB = vUv - vec2(0.0, uTexelSize.y);" +
"  gl_Position = vec4(aPosition, 0.0, 1.0);" +
"}";

// simple vertex shader.
// vLやら何やらを使ってない場合はこっちを使いましょう。copyとか使ってないはず。
const simpleVertexShader =
"precision highp float;" +
"attribute vec2 aPosition;" +
"varying vec2 vUv;" +
"void main () {" +
"  vUv = aPosition * 0.5 + 0.5;" +
"  gl_Position = vec4(aPosition, 0.0, 1.0);" +
"}";

// ディスプレイ用
const displayShaderSource =
"precision highp float;" +
"precision highp sampler2D;" +
"varying vec2 vUv;" +
"varying vec2 vL;" +
"varying vec2 vR;" +
"varying vec2 vT;" +
"varying vec2 vB;" +
"uniform sampler2D uTexture;" +
"uniform sampler2D uDithering;" +
"uniform vec2 uDitherScale;" +
"uniform sampler2D uBloom;" +
// 各種フラグ
"uniform bool uBloomFlag;" +
"uniform bool uDitheringFlag;" +
// リニア→ガンマ
"vec3 linearToGamma (vec3 color) {" + // linearをGammaに変換・・
"  color = max(color, vec3(0));" +
"  return max(1.055 * pow(color, vec3(0.416666667)) - 0.055, vec3(0));" +
"}" +
// メインコード
"void main () {" +
"  vec4 tex = texture2D(uTexture, vUv);" +
"  vec3 c = tex.rgb;" +
"  vec3 bloom;" +
"  if(uBloomFlag){" +
"    bloom = texture2D(uBloom, vUv).rgb;" +
"    if(uDitheringFlag){" +
"      float noise = texture2D(uDithering, vUv * uDitherScale).r;" +
"      noise = noise * 2.0 - 1.0;" +
"      bloom += noise / 255.0;" +
"    }" +
"    bloom = linearToGamma(bloom);" +
"    c += bloom;" +
"  }" +
"  gl_FragColor = vec4(c, tex.a);" +
"}";

// どうも輝度抽出とかいうのをここでやってるっぽい
// brがbrightness？というかまあc.r,c.g,c.bの最大値。
// これがcurve.xより小さいと0になるのでそれで切ってる？
// わからん.....
const bloomPrefilterShader =
"precision mediump float;" +
"precision mediump sampler2D;" +
"varying vec2 vUv;" +
"uniform sampler2D uTexture;" +
"uniform vec3 uCurve;" +
"uniform float uThreshold;" +
"void main () {" +
"  vec3 c = texture2D(uTexture, vUv).rgb;" +
"  float br = max(c.r, max(c.g, c.b));" +
"  float rq = clamp(br - uCurve.x, 0.0, uCurve.y);" +
"  rq = uCurve.z * rq * rq;" +
"  c *= max(rq, br - uThreshold) / max(br, 0.0001);" +
"  gl_FragColor = vec4(c, 0.0);" +
"}";

// bloomのメインシェーダ
const bloomBlurShader =
"precision mediump float;" +
"precision mediump sampler2D;" +
"varying vec2 vL;" +
"varying vec2 vR;" +
"varying vec2 vT;" +
"varying vec2 vB;" +
"uniform sampler2D uTexture;" +
"void main () {" +
"  vec4 sum = vec4(0.0);" +
"  sum += texture2D(uTexture, vL);" +
"  sum += texture2D(uTexture, vR);" +
"  sum += texture2D(uTexture, vT);" +
"  sum += texture2D(uTexture, vB);" +
"  sum *= 0.25;" +
"  gl_FragColor = sum;" +
"}";

// bloomの仕上げシェーダ
// 最終的にブラーがかかったものができる！ようです！！
const bloomFinalShader =
"precision mediump float;" +
"precision mediump sampler2D;" +
"varying vec2 vL;" +
"varying vec2 vR;" +
"varying vec2 vT;" +
"varying vec2 vB;" +
"uniform sampler2D uTexture;" +
"uniform float uIntensity;" +
"uniform vec3 uBloomColor;" +
"void main () {" +
"  vec4 sum = vec4(0.0);" +
"  sum += texture2D(uTexture, vL);" +
"  sum += texture2D(uTexture, vR);" +
"  sum += texture2D(uTexture, vT);" +
"  sum += texture2D(uTexture, vB);" +
"  sum *= 0.25;" +
"  gl_FragColor = sum * uIntensity * vec4(uBloomColor, 1.0);" +
"}";

// ------------------------------ //
// preload.

let ditheringImg, ditheringTexture;

function preload(){
  textureTableSource = loadImage("https://inaridarkfox4231.github.io/assets/texture/textureTable.png");
	ditheringImg = loadImage("https://inaridarkfox4231.github.io/assets/texture/dither.png");
}

// --------------------------------------------------------------- //
// setup.

function setup(){
  // _glはp5のwebgl, glはwebglのレンダリングコンテキスト。
  _gl = createCanvas(windowWidth, windowHeight, WEBGL);
  currentWidth = windowWidth;
  currentHeight = windowHeight;
  pixelDensity(1);
  gl = _gl.GL;

  // nodeを用意
  _node = new RenderNode();
  // extensionのチェック一通り
  confirmExtensions();
	// bloom用のframebufferを一通り用意する
	initFramebuffers();

  const positions = [-1, -1, -1, 1, 1, -1, 1, 1]; // 板ポリ用
	// シェーダー用の汎用エイリアス
  let sh;

  // ----- 背景 ----- //
  sh = createShader(patternVert, patternFrag);
  _node.regist('pattern', sh, 'board')
       .registAttribute('aPosition', positions, 2);

	// ----- GPUパーティクル関連 ----- //
  // dataShader:点の位置と速度の初期設定用
  sh = createShader(dataVert, dataFrag);
  _node.regist('input', sh, 'board')
       .registAttribute('aPosition', positions, 2);

  // moveShader:点の位置と速度の更新用
  sh = createShader(moveVert, moveFrag);
  _node.regist('move', sh, 'board')
       .registAttribute('aPosition', positions, 2)
       .registUniformLocation('uTex');

  // 点描画用のインデックスを格納する配列
  let indices = [];
  // 0～TEX_SIZE*TEX_SIZE-1のindexを放り込む
  for(let i = 0; i < TEX_SIZE * TEX_SIZE; i++){ indices.push(i); }

  // pointShader:点描画用
  sh = createShader(pointVert, pointFrag);
  _node.regist('point', sh, 'display')
       .registAttribute('aIndex', indices, 1)
       .registUniformLocation('uTex');

  // mirrorShader: パーティクルレイヤー用
	// これの結果をdyeに格納する。
  // ミラー機能追加
  sh = createShader(copyVert, mirrorFrag);
  _node.regist('mirror', sh, 'board')
       .registAttribute('aPosition', positions, 2)
       .registUniformLocation('uTex');

	// ----- bloom関連 ----- //
	// 下準備。dyeから輝度を抽出
  sh = createShader(simpleVertexShader, bloomPrefilterShader);
  _node.regist('bloomPrefilter', sh, 'simple')
       .registAttribute('aPosition', positions, 2)
       .registUniformLocation('uTexture');

	// blurをかける処理。ここだけ切り出すと通常のblurとして使えそう。
  sh = createShader(baseVertexShader, bloomBlurShader);
  _node.regist('bloomBlur', sh, 'board')
       .registAttribute('aPosition', positions, 2)
       .registUniformLocation('uTexture');

	// 仕上げ。この結果を元の画像に加算合成する。
  sh = createShader(baseVertexShader, bloomFinalShader);
  _node.regist('bloomFinal', sh, 'board')
       .registAttribute('aPosition', positions, 2)
       .registUniformLocation('uTexture');

	// display.今回直にbind:nullで描画するのはこれの結果。
  sh = createShader(baseVertexShader, displayShaderSource);
  _node.regist('display', sh, 'board')
       .registAttribute('aPosition', positions, 2)
       .registUniformLocation('uTexture')
       .registUniformLocation('uBloom')
	     .registUniformLocation('uDithering');

  // doubleのFBOを用意。11と12を予約します。
  _node.registDoubleFBO('data', 11, TEX_SIZE, TEX_SIZE, gl.FLOAT, gl.NEAREST);
  // particle用に13を使う。これにmirrorを施してdyeに落としてそれからbloomをかける
  _node.registFBO('particle', 13, width, height, gl.FLOAT, gl.NEAREST);

  // 位置と速度の初期設定
  dataInput();

  // textureTableのtextureを用意
  textureTable = new p5.Texture(_gl, textureTableSource);

	// dithering用。
	ditheringTexture = new p5.Texture(_gl, ditheringImg); // これ。64x64のモザイク。規則性は...無いように見える。

	// ditheringTextureの用意。本家に倣ってパラメトリをいじる。
	gl.bindTexture(gl.TEXTURE_2D, ditheringTexture.glTex);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
}

// --------------------------------------- //
// initFramebuffers.

function initFramebuffers(){
  const halfFloat = ext.textureHalfFloat.HALF_FLOAT_OES;
  const linearFilterParam = (ext.textureHalfFloatLinear ? gl.LINEAR : gl.NEAREST);

  gl.disable(gl.BLEND);

  // dyeは0,1を使います。ここにparticleのmirrorしたやつを落とす...
	// というかresizeの際にこれもいじる必要があるのか...めんど...
  _node.registDoubleFBO("dye", 0, width, height, halfFloat, linearFilterParam);

  // bloomは2～10を使います。
  initBloomFramebuffers(); // 2～10.
  // 11にbgTexを使う予定...分けないといけない
  // fboで使う番号とtextureで使う番号を分けているのです
}

function initBloomFramebuffers(){
  let res = getResolution(config.BLOOM_RESOLUTION);
  const halfFloat = ext.textureHalfFloat.HALF_FLOAT_OES;
  const linearFilterParam = (ext.textureHalfFloatLinear ? gl.LINEAR : gl.NEAREST);
  // bloom_0と、bloom_1～bloom_8を用意する感じ
  _node.registFBO('bloom_0', 2, res.frameWidth, res.frameHeight, halfFloat, linearFilterParam);
  // ITERATIONSは最大で8で...まあ8で。
  // bloom_0を用意した。bloom_1～bloom_8が用意される（予定）
  for(let i = 1; i <= config.BLOOM_ITERATIONS; i++){
    let fw = (res.frameWidth >> i);
    let fh = (res.frameHeight >> i);
    _node.registFBO('bloom_' + i, 2 + i, fw, fh, halfFloat, linearFilterParam);
  }
}

// --------------------------------------------------------------- //
// main loop.

function draw(){
  // リサイズ処理
  resizeCheck();

  // マウスの値を調整して全画面に合わせる
  const _size = min(width, height);
  const mouse_x = (mouseX / width - 0.5) * 2.0 * width / _size;
  const mouse_y = (mouseY / height - 0.5) *2.0 * height / _size;
  const mouse_flag = mouseIsPressed;

  // ここで位置と速度を更新
  moveRendering(mouse_x, mouse_y, mouse_flag);

  // こっからはキャンバス自体への描画です
  _node.bindFBO(null);
  _node.setViewport(0, 0, width, height);

  clear();
  // 透過の場合はsaveFlagが立ってなければ描画
  if(config.TRANSPARENT){
    if(!saveFlag){ drawCheckerBoard(); }
  }else{
    drawBackground();
  }

  // 点描画しない場合は以下の処理をしない
	// 背景保存モード
  if(!config.HIDE){
		// 点描画の色指定
		let {r, g, b} = getProperColor(config.PARTICLE_COLOR);

		if(config.AUTO_COLOR){ // 時間変化
			const col = _HSV((properFrameCount%720)/720, 0.8, 1);
			r = col.r; g = col.g; b = col.b;
		}else{
			r /= 255; g /= 255; b /= 255;
		}

		// fboをセットし中身をクリアする
		_node.bindFBO('particle')
				 .clearFBO();

		// 点描画に際してblendの有効化
		gl.enable(gl.BLEND);
		// SCREENだってhttps://yomotsu.net/blog/2013/08/08/2013-08-7-blendmode-in-webgl2.html
		// よくわかんないけどこれにしとこ
		gl.blendFunc(gl.ONE_MINUS_DST_COLOR, gl.ONE);

		// 点描画
		_node.use('point', 'display')
				 .setAttribute()
				 .setFBO('uTex', 'data')
				 .setUniform("uTexSize", TEX_SIZE)
				 .setUniform("uColor", [r, g, b])
				 .setUniform("uPointScale", accell)
				 .setUniform("uResolution", [width, height])
				 .drawArrays(gl.POINTS)
				 .clear();

		// ここでbloomを計算する(particleを元にして)
		// mirrorか...
		// あー、じゃあmirror使った結果を考慮して
		// それに対してbloomかけないとまずいねぇ
		// というわけで間にdyeを挟んでそこにmirrorを適用した結果を放り込んで
		// そのうえでbloomかける流れか。

		// これだ！これを使うと上書きできる！なるほど...
		// これをやる前にbloomの処理を終わらせる感じ。
		//gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // drawDisplayまでおあづけ

		// 一旦blendを切る
		gl.disable(gl.BLEND);

		// ここでdyeに一旦落とす...
		_node.bindFBO('dye');
		_node.use('mirror', 'board')
				 .setAttribute()
				 .setFBO('uTex', 'particle')
				 .setUniform("uMirror", [config.MIRROR_X, config.MIRROR_Y])
				 .drawArrays(gl.TRIANGLE_STRIP)
		     .swapFBO('dye')
				 .clear();

		applyBloom();  // 工事中
		drawDisplay(); // なのでとりあえずdyeの結果をそのまま表示してみます
	}

  // 画像保存処理
  if(saveFlag){
    saveImage();
    saveFlagOff();
  }

  // 加速度調整
  if(mouse_flag){ accell = 1.0; }else{ accell *= 0.95; }
  // step
  properFrameCount++;
}

function resizeCheck(){
  if(config.SIZETYPE == MANUAL_SIZE){
    currentWidth = config.WIDTH;
    currentHeight = config.HEIGHT;
  }else{
    currentWidth = windowWidth;
    currentHeight = windowHeight;
  }
  if(currentWidth == width && currentHeight == height){ return; }
  resizeCanvas(currentWidth, currentHeight);
  // particleとbgを上書き更新（引き継がないので）
  // 引き継ぐならresizeが必要になるけど今回は要らない

  // 焼き付け用
  _node.registFBO('particle', 2, currentWidth, currentHeight, gl.FLOAT, gl.NEAREST);

	// dyeもresizeしないといけない。
  const halfFloat = ext.textureHalfFloat.HALF_FLOAT_OES;
  const linearFilterParam = (ext.textureHalfFloatLinear ? gl.LINEAR : gl.NEAREST);
  _node.registDoubleFBO("dye", 0, width, height, halfFloat, linearFilterParam);
}

// --------------------------------------------------------------- //
// offscreen rendering.

// オフスクリーンレンダリングで初期の位置と速度を設定
// こちらは座標値依存なので座標の値に応じて決めるのに便利
function dataInput(){
  _node.bindFBO('data')  // writeのframebufferをbindする
       .setViewport(0, 0, TEX_SIZE, TEX_SIZE) // viewport設定
       .clearFBO() // 中身をclear
       .use('input', 'board') // use.
       .setAttribute()
       .setUniform('uTexSize', TEX_SIZE)
       .drawArrays(gl.TRIANGLE_STRIP)
       .swapFBO('data') // writeに書き込んだ内容がreadに移される
       .clear();
       //.bindFBO(null); // bindを解除
}

// offscreen renderingで位置と速度を更新
function moveRendering(mx, my, mFlag){
  _node.bindFBO('data')  // writeのframebufferをbindする
       .setViewport(0, 0, TEX_SIZE, TEX_SIZE) // viewport設定
       .clearFBO()  // 書き込む前に中身をclear
       .use('move', 'board') // use.
       .setAttribute()
       .setFBO('uTex', 'data')
       .setUniform("uTexSize", TEX_SIZE)
       .setUniform("uAccell", accell)
       .setUniform("uMouseFlag", mFlag)
       .setUniform("uMouse", [mx, my])
       .drawArrays(gl.TRIANGLE_STRIP)
       .swapFBO('data') // writeの中身をreadに移す
       .clear();
       //.bindFBO(null); // bindを解除
}

// ---------------------------- //
// background.

function drawBackground(){
  const mainColor = getProperColor(config.MAIN_COLOR);
  const subColor = getProperColor(config.SUB_COLOR);
  const baseColor = getProperColor(config.BASE_COLOR);

  _node.use('pattern', 'board')
       .setAttribute()
       .setUniform('uResolution', [width, height])
       .setTexture('uTextureTable', textureTable.glTex, 0)
       .setUniform('uTextureId', config.BGPATTERN)
       .setUniform('uTextureSize', 256)
       .setUniform('uMainColor', [mainColor.r/255, mainColor.g/255, mainColor.b/255])
       .setUniform('uSubColor', [subColor.r/255, subColor.g/255, subColor.b/255])
       .setUniform('uBaseColor', [baseColor.r/255, baseColor.g/255, baseColor.b/255])
       .setUniform('uGradationId', config.GRADATION)
       .drawArrays(gl.TRIANGLE_STRIP)
       .clear();
}

function drawCheckerBoard(){
  _node.use('pattern', 'board')
       .setAttribute()
       .setUniform('uResolution', [width, height])
       .setTexture('uTextureTable', textureTable.glTex, 0)
       .setUniform('uTextureId', 2)
       .setUniform('uTextureSize', 256)
       .setUniform('uMainColor', [0.8, 0.8, 0.8])
       .setUniform('uSubColor', [0,0,0])
       .setUniform('uBaseColor', [0.9, 0.9, 0.9])
       .setUniform('uGradationId', 0)
       .drawArrays(gl.TRIANGLE_STRIP)
       .clear();
}

// --------------------- //
// applyBloom.

function applyBloom(){
  // dyeを元にしてbloomになんか焼き付ける
  gl.disable(gl.BLEND);
  let res = getResolution(256);

  let knee = config.BLOOM_THRESHOLD * config.BLOOM_SOFT_KNEE + 0.0001;
  let curve0 = config.BLOOM_THRESHOLD - knee;
  let curve1 = knee * 2;
  let curve2 = 0.25 / knee;
  // ここの処理texelSize使ってない
  // dyeの内容を初期値として埋め込んで
  // 輝度抽出なるものを行なっているようです
  _node.bindFBO('bloom_0');
  _node.use('bloomPrefilter', 'simple')
       .setAttribute()
       .setFBO('uTexture', 'dye')
       .setUniform('uCurve', [curve0, curve1, curve2])
       .setUniform('uThreshold', config.BLOOM_THRESHOLD)
       .drawArrays(gl.TRIANGLE_STRIP)
       .clear(); // ここclear必須っぽいな

	// modeは使わないのです
  // まあ本来はシェーダー切り替えるたびにclear必要だけどね...

  // bloomやっぱ通し番号にするか...0,1,2,...,8みたいに。
  // その方が良さそう。
  _node.use('bloomBlur', 'board')
       .setAttribute();
  // FBOもuniformもbindやsetするあれごとに異なるので、
  // その都度設定し直す。
  // まず0→1, 1→2, ..., N-1→Nとする
  for(let i = 1; i <= config.BLOOM_ITERATIONS; i++){
    // i-1→iって感じ
    const w = (res.frameWidth >> (i-1));
    const h = (res.frameHeight >> (i-1));
    _node.bindFBO('bloom_' + i);
    _node.setUniform('uTexelSize', [1/w, 1/h])
         .setFBO('uTexture', 'bloom_' + (i-1))
         .drawArrays(gl.TRIANGLE_STRIP);
  }

  gl.blendFunc(gl.ONE, gl.ONE);
  gl.enable(gl.BLEND);

  // 次にN→N-1,...,2→1とする。
  for(let i = config.BLOOM_ITERATIONS; i >= 2; i--){
    const w = (res.frameWidth >> i);
    const h = (res.frameHeight >> i);
    _node.bindFBO('bloom_' + (i-1));
    _node.setUniform('uTexelSize', [1/w, 1/h])
         .setFBO('uTexture', 'bloom_' + i)
         .drawArrays(gl.TRIANGLE_STRIP);
  }

  _node.clear();
  gl.disable(gl.BLEND);

  // 最後に1→0でおしまい
  const w1 = (res.frameWidth >> 1);
  const h1 = (res.frameHeight >> 1);
  const col = getProperColor(config.BLOOM_COLOR);
  //_node.setViewport(0, 0, res.frameWidth, res.frameHeight);
  _node.bindFBO('bloom_0');
  _node.use('bloomFinal', 'board')
       .setAttribute()
       .setFBO('uTexture', 'bloom_1')
       .setUniform('uTexelSize', [1/w1, 1/h1])
       .setUniform('uIntensity', config.BLOOM_INTENSITY)
       .setUniform('uBloomColor', [col.r/255, col.g/255, col.b/255])
       .drawArrays(gl.TRIANGLE_STRIP)
       .clear();
  // bloomについては以上。
}

// --------------------- //
// drawDisplay.

function drawDisplay(){
	// スクリーンへの描画。
  _node.bindFBO(null);
	// 先に背景があるのでこれをしないといけない
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  _node.use('display', 'board')
       .setAttribute()
       .setFBO('uTexture', 'dye')
       .setUniform('uBloomFlag', config.BLOOM)
       .setFBO('uBloom', 'bloom_0')
	     .setUniform('uDitheringFlag', config.BLOOM_DITHER)
	     .setTexture('uDithering', ditheringTexture.glTex, 14) // やっぱ番号かぶるとまずいんだわ。0はだめだろ...
	     .setUniform('uDitherScale', [width/ditheringImg.width, height/ditheringImg.height])
       .drawArrays(gl.TRIANGLE_STRIP)
       .clear();

	// 戻す。blendが必要ない場合は切る癖をつけた方がいいと思う
  gl.disable(gl.BLEND);
}

// --------------------------------------------------------------- //
// extension check.

// というわけでextensionsの確認メソッドにしました
// ext={}に順次追加していきます
// 引っかかったらalertを発信

// 注意1:HALF_FLOATはwebgl1ではサポートされてないのでそれ使う場合は
// いつもgl.FLOATのところをext.textureHalfFloat.HALF_FLOAT_OESを使おう。
// 注意2:gl.LINEARをHALF_FLOATのテクスチャで使いたい場合は
// ext.textureHalfFloatLinearがnullでないかどうかを確認しよう。
function confirmExtensions(){
  ext.textureFloat = gl.getExtension('OES_texture_float');
  // これのHALF_FLOAT_OESが欲しいわけですね
  ext.textureHalfFloat = gl.getExtension('OES_texture_half_float');
  // halfFloatでlinearが使える場合これが何らかのオブジェクトになる感じ
  ext.textureHalfFloatLinear = gl.getExtension('OES_texture_half_float_linear');
  ext.elementIndexUint = gl.getExtension('OES_element_index_uint');
  if(ext.textureFloat == null || ext.textureHalfFloat == null){
    alert('float texture not supported');
  }
  if(ext.elementIndexUint == null){
    alert('Your web browser does not support the WebGL Extension OES_element_index_uint.');
  }
}

// --------------------------------------------------------------- //
// global functions.

// framebuffer.
// framebufferを生成するための関数
// attribute関連はstaticメソッドに移しました。
// RenderNodeの処理にする・・？

// fboを作る関数
function create_fbo(name, texId, w, h, textureFormat, filterParam){
  // フォーマットチェック
  if(!textureFormat){
    textureFormat = gl.UNSIGNED_BYTE;
  }
  if(!filterParam){
    filterParam = gl.NEAREST;
  }

  // フレームバッファの生成
  let framebuffer = gl.createFramebuffer();

  // フレームバッファをWebGLにバインド
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

  // 深度バッファ用レンダーバッファの生成とバインド
  let depthRenderBuffer = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, depthRenderBuffer);

  // レンダーバッファを深度バッファとして設定
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);

  // フレームバッファにレンダーバッファを関連付ける
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRenderBuffer);

  // フレームバッファ用テクスチャの生成
  let fTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + texId);

  // フレームバッファ用のテクスチャをバインド
  gl.bindTexture(gl.TEXTURE_2D, fTexture);

  // フレームバッファ用のテクスチャにカラー用のメモリ領域を確保
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, textureFormat, null);

  // テクスチャパラメータ
  // このNEARESTのところを可変にする
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filterParam);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filterParam);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // フレームバッファにテクスチャを関連付ける
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fTexture, 0);
  // 中身をクリアする(clearに相当する)
  gl.viewport(0, 0, w, h);
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

  // 各種オブジェクトのバインドを解除
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  // オブジェクトを返して終了
  return {f:framebuffer, d:depthRenderBuffer, t:fTexture, id:texId, name:name, frameWidth:w, frameHeight:h, texelSizeX:1/w, texelSizeY:1/h};
}

// fboのペアを作る
// nameはreadやwriteの中に入ってるイメージですかね
function create_double_fbo(name, texId, w, h, textureFormat, filterParam){
  // texIdは片方について1増やす
  let fbo1 = create_fbo(name, texId, w, h, textureFormat, filterParam);
  let fbo2 = create_fbo(name, texId + 1, w, h, textureFormat, filterParam);
  let doubleFbo = {};
  doubleFbo.read = fbo1;
  doubleFbo.write = fbo2;
  doubleFbo.swap = function(){
    let tmp = this.read;
    this.read = this.write;
    this.write = tmp;
  }
  doubleFbo.frameWidth = w;
  doubleFbo.frameHeight = h;
  doubleFbo.texelSizeX = 1/w;
  doubleFbo.texelSizeY = 1/h;
  doubleFbo.name = name; // まあ直接アクセスできる方がいいよね
  return doubleFbo;
}

// vboの作成
function create_vbo(data){
  // バッファオブジェクトの生成
  let vbo = gl.createBuffer();

  // バッファをバインドする
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);

  // バッファにデータをセット
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);

  // バッファのバインドを無効化
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  // 生成したVBOを返して終了
  return vbo;
}

// IBOを生成する関数
// たとえばLINESを想定しているなら
// 0,32,64,...でつなぎたいなら
// [0,32,32,64,64,96,....,1,33,33,65,65,97,....]とかして作る。
// typeは「UInt16Array」または「UInt32Array」.
function create_ibo(data, type){
  // バッファオブジェクトの生成
  var ibo = gl.createBuffer();

  // バッファをバインドする
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);

  // バッファにデータをセット
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new (type)(data), gl.STATIC_DRAW);

  // バッファのバインドを無効化
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  // 生成したIBOを返して終了
  return ibo;
}


// attributeの登録
function set_attribute(attributes){
  // 引数として受け取った配列を処理する
  for(let name of Object.keys(attributes)){
    const attr = attributes[name];
    // バッファをバインドする
    gl.bindBuffer(gl.ARRAY_BUFFER, attr.vbo);

    // attributeLocationを有効にする
    gl.enableVertexAttribArray(attr.location);

    // attributeLocationを通知し登録する
    gl.vertexAttribPointer(attr.location, attr.stride, gl.FLOAT, false, 0, 0);
  }
}

// ----------------------------------------------------------//
// utility for bloom.

// ちょっとした工夫
// 2べきに合わせるということらしい
// 短い方がresolutionで長い方がそれに長/短を掛ける形
function getResolution(resolution){
  let aspectRatio = width / height;
  //let aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
  if(aspectRatio < 1){ aspectRatio = 1.0 / aspectRatio; }
  // 要するに縦横のでかい方÷小さい方
  let _min = Math.round(resolution);
  let _max = Math.round(resolution * aspectRatio);

  if(width > height){
    return {frameWidth: _max, frameHeight: _min};
  }
  return {frameWidth: _min, frameHeight: _max};
}

// --------------------------------------------------------------- //
// utility.

function _RGB(r, g, b){
  if(arguments.length === 1){
    g = r;
    b = r;
  }
  return {r:r, g:g, b:b};
}

function _HSV(h, s, v){
  h = constrain(h, 0, 1);
  s = constrain(s, 0, 1);
  v = constrain(v, 0, 1);
  let _r = constrain(abs(((6 * h) % 6) - 3) - 1, 0, 1);
  let _g = constrain(abs(((6 * h + 4) % 6) - 3) - 1, 0, 1);
  let _b = constrain(abs(((6 * h + 2) % 6) - 3) - 1, 0, 1);
  _r = _r * _r * (3 - 2 * _r);
  _g = _g * _g * (3 - 2 * _g);
  _b = _b * _b * (3 - 2 * _b);
  let result = {};
  result.r = v * (1 - s + s * _r);
  result.g = v * (1 - s + s * _g);
  result.b = v * (1 - s + s * _b);
  return result;
}

// dat.GUIで色情報を放り込むところで#ee4400みたいに入力した場合
// 直接rgbが取り出せずエラーになるので
// p5の関数をかませてオブジェクトが取得できるようにするそのための関数。
// ちなみにpavelさんのあれを含めほとんどのdatはそうなってないですね。
// まあ普通しないので...スライダー動かした方が楽なので。
// ただそれだとピッキングで取得した特定の色を指定したい場合とかに、
// その特定の色が16進数指定だったりしたら困るわけです。そゆことです。
function getProperColor(col){
  if(typeof(col) == "object"){
    return {r:col.r, g:col.g, b:col.b};
  }else if(typeof(col) == "string"){
    col = color(col);
    return {r:red(col), g:green(col), b:blue(col)};
  }
  return {r:255, g:255, b:255};
}

// --------------------------------------------------------------- //
// RenderSystem class.
// shaderとprogramとtopologyのsetとあとテクスチャのロケーション
// その組です
// topologyはattribute群ですね
// たとえば立方体やトーラスを登録するわけ（もちろん板ポリも）

class RenderSystem{
  constructor(name, _shader){
    this.name = name;
    this.shader = _shader;
    shader(_shader);
    this.program = _shader._glProgram;
    this.topologies = {};
    this.uniformLocations = {};
  }
  getName(){
    return this.name;
  }
  registTopology(topologyName){
    if(this.topologies[topologyName] !== undefined){ return; }
    this.topologies[topologyName] = new Topology(topologyName);
  }
  getProgram(){
    return this.program;
  }
  getShader(){
    return this.shader;
  }
  getTopology(topologyName){
    return this.topologies[topologyName];
  }
  registUniformLocation(uniformName){
    if(this.uniformLocations[uniformName] !== undefined){ return; }
    this.uniformLocations[uniformName] = gl.getUniformLocation(this.program, uniformName);
  }
  setTexture(uniformName, _texture, locationID){
    gl.activeTexture(gl.TEXTURE0 + locationID);
    gl.bindTexture(gl.TEXTURE_2D, _texture);
    gl.uniform1i(this.uniformLocations[uniformName], locationID);
  }
}

// --------------------------------------------------------------- //
// RenderNode class.
// RenderSystemを登録して名前で切り替える感じ
// こっちで統一しよう。で、トポロジー。
// 一つのプログラムに複数のトポロジーを登録できる
// そして同じプログラムを使い回すことができる
// 立方体やトーラスを切り替えて描画したりできるというわけ

class RenderNode{
  constructor(){
    this.renderSystems = {};
    this.framebufferObjects = {}; // 追加！！
    this.currentRenderSystem = undefined;
    this.currentShader = undefined;
    this.currentTopology = undefined;
    this.useTextureFlag = false;
    this.uMV = new p5.Matrix(); // デフォルト4x4行列
    // uMVをここにコピーして使い回す感じ
  }
  registRenderSystem(renderSystemName, _shader){
    if(this.renderSystems[renderSystemName] !== undefined){ return this; }
    this.renderSystems[renderSystemName] = new RenderSystem(renderSystemName, _shader);
    // regist時に自動的にuseされるイメージ
    this.useRenderSystem(renderSystemName);
    return this;
  }
  useRenderSystem(renderSystemName){
    // 使うプログラムを決める
    this.currentRenderSystem = this.renderSystems[renderSystemName];
    this.currentShader = this.currentRenderSystem.getShader();
    this.currentShader.useProgram();
    return this;
  }
  registTopology(topologyName){
    // currentProgramに登録するので事前にuseが必要ですね
    this.currentRenderSystem.registTopology(topologyName);
    // regist時に自動的にuseされる
    this.useTopology(topologyName);
    return this;
  }
  useTopology(topologyName){
    // たとえば複数のトポロジーを使い回す場合ここだけ切り替える感じ
    this.currentTopology = this.currentRenderSystem.getTopology(topologyName);
    return this;
  }
  regist(renderSystemName, _shader, topologyName){
    // registでまとめてやる処理とする
    this.registRenderSystem(renderSystemName, _shader);
    this.registTopology(topologyName);
    return this;
  }
  use(renderSystemName, topologyName){
    // まとめてやれた方がいい場合もあるので
    //if(this.renderSystems[renderSystemName] == undefined){ return this; }
    this.useRenderSystem(renderSystemName);
    //this.registTopology(topologyName); // 登録済みなら何もしない
    this.useTopology(topologyName);
    return this;
  }
  existFBO(target){
    // あるかどうかチェックする関数. targetがfboの場合はそれが持つnameで見る。
    if(typeof(target) == 'string'){
      return this.framebufferObjects[target] !== undefined;
    }
    return this.framebufferObjects[target.name] !== undefined;
  }
  registFBO(target, texId, w, h, textureFormat, filterParam){
    // fboをセット(同じ名前の場合は新しく作って上書き)
    // targetがstringの場合はcreate_fboするけど
    // fbo自身の場合にはそれをはめこんで終了って感じにする
    if(typeof(target) == 'string'){
      let fbo = create_fbo(target, texId, w, h, textureFormat, filterParam);
      this.framebufferObjects[target] = fbo;
      return this;
    }
    // targetがfboの場合。名前はtargetが持ってるはず。直接放り込む。
    this.framebufferObjects[target.name] = target;
    return this;
  }
  registDoubleFBO(targetName, texId, w, h, textureFormat, filterParam){
    //doubleFBOをセット(同じ名前の場合は新しく作って上書き)
    let fbo = create_double_fbo(targetName, texId, w, h, textureFormat, filterParam);
    this.framebufferObjects[targetName] = fbo;
    return this;
  }
  resizeFBO(targetName, texId, w, h, textureFormat, filterParam){
    // resizeもメソッド化しないと...
    let fbo = this.framebufferObjects[targetName];
    this.framebufferObjects[targetName] = resize_fbo(fbo, texId, w, h, textureFormat, filterParam);
  }
  resizeDoubleFBO(targetName, texId, w, h, textureFormat, filterParam){
    // リサイズダブル。これらはreturn thisしなくていいでしょうね
    let fbo = this.framebufferObjects[targetName];
    this.framebufferObjects[targetName] = resize_double_fbo(fbo, texId, w, h, textureFormat, filterParam);
  }
  bindFBO(target){
    // FBOをbindもしくはnullで初期化。ダブルの場合はwriteをセット。viewport設定機能を追加。
    if(typeof(target) == 'string'){
      let fbo = this.framebufferObjects[target];
      if(!fbo){ return this; }
      if(fbo.write){
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.write.f);
        gl.viewport(0, 0, fbo.frameWidth, fbo.frameHeight);
        return this;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.f);
      gl.viewport(0, 0, fbo.frameWidth, fbo.frameHeight);
      return this;
    }
    if(target == null){
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, width, height); // nullの場合は全体
      return this;
    }
    // targetがfboそのものの場合。
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.f);
    gl.viewport(0, 0, target.frameWidth, target.frameHeight);
    return this;
  }
  clearFBO(){
    // そのときにbindしているframebufferのクリア操作
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    return this; // ←これが欲しいだけ。
  }
  setFBO(uniformName, FBOName){
    // FBOを名前経由でセット。ダブルの場合はreadをセット。
    // FBONameがundefinedの状態で運用されることはないうえ、
    // ここはstringであることが要求される。
    // fbo.readのところは!!fbo.readってやると
    // undefinedではありませんって表現できるみたい。その方がいいかも？
    if(FBOName === undefined || (typeof FBOName !== 'string')){
      alert("Inappropriate name setting.");
      noLoop();
      return this;
    }
    let fbo = this.framebufferObjects[FBOName];
    if(!fbo){
      alert("The corresponding framebuffer does not exist.");
      noLoop();
      return this;
    }
    if(!!fbo.read){
      this.setTexture(uniformName, fbo.read.t, fbo.read.id);
      return this;
    }
    this.setTexture(uniformName, fbo.t, fbo.id);
    return this;
  }
  swapFBO(FBOName){
    // ダブル前提。ダブルの場合にswapする
    if(FBOName == null){ return this; }
    let fbo = this.framebufferObjects[FBOName];
    if(fbo.read && fbo.write){ fbo.swap(); }
    return this;
  }
  registAttribute(attributeName, data, stride){
    this.currentTopology.registAttribute(this.currentRenderSystem.getProgram(), attributeName, data, stride);
    return this;
  }
  registAttributes(attrData){
    for(let attrName of Object.keys(attrData)){
      const attr = attrData[attrName];
      this.registAttribute(attrName, attr.data, attr.stride);
    }
    return this;
  }
  setAttribute(){
    // その時のtopologyについて準備する感じ
    this.currentTopology.setAttribute();
    return this;
  }
  registIndexBuffer(data){
    // 65535より大きい場合にUint32Arrayを指定する。
    let type = Uint16Array;
    if(data.length > 65535){ type = Uint32Array; }
    this.currentTopology.registIndexBuffer(data, type);
    return this;
  }
  bindIndexBuffer(){
    this.currentTopology.bindIndexBuffer();
    return this;
  }
  registUniformLocation(uniformName){
    this.currentRenderSystem.registUniformLocation(uniformName);
    return this;
  }
  setTexture(uniformName, _texture, locationID){
    this.currentRenderSystem.setTexture(uniformName, _texture, locationID);
    this.useTextureFlag = true; // 1回でも使った場合にtrue
    return this;
  }
  setUniform(uniformName, data){
    this.currentShader.setUniform(uniformName, data);
    return this;
  }
  clear(){
    // 描画の後処理
    // topologyを切り替える場合にも描画後にこれを行なったりする感じ
    // 同じプログラム、トポロジーで点描画や線描画を行う場合などは
    // その限りではない（レアケースだけどね）
    this.currentTopology.clear();
    // textureを使っている場合はbindを解除する
    if(this.useTextureFlag){
      gl.bindTexture(gl.TEXTURE_2D, null);
      this.useTextureFlag = false;
    }
    return this;
  }
  setViewport(x, y, w, h){
    gl.viewport(x, y, w, h);
    return this;
  }
  setMatrixStandard(){
    // uMVをuMVMatrixとして一通り通知する関数
    const sh = this.currentShader;
    sh.setUniform('uProjectionMatrix', _gl.uPMatrix.mat4);
    sh.setUniform('uModelViewMatrix', this.uMV.mat4);
    sh.setUniform('uViewMatrix', _gl._curCamera.cameraMatrix.mat4);
    _gl.uNMatrix.inverseTranspose(this.uMV);
    sh.setUniform('uNormalMatrix', _gl.uNMatrix.mat3);
  }
  setMatrix(tf){
    // uMVとuPとuViewとuNormalを登録(uNormalは使われないこともあるけど)
    //let uMV = _gl.uMVMatrix.copy();
    // this.uMVにuMVMatrixの内容をコピー
    for(let i = 0; i < 16; i++){
      this.uMV.mat4[i] = _gl.uMVMatrix.mat4[i];
    }
    if(tf !== undefined){
      this.transform(tf); // tfは配列。tr, rotX, rotY, rotZ, scale.
      // rotAxisも一応残しといて。
    }
    this.setMatrixStandard();
    return this;
  }
  transform(tf){
    // tfのコマンドに従っていろいろ。
    for(let command of tf){
      const name = Object.keys(command)[0];
      const value = command[name];
      switch(name){
        case "tr":
          // 長さ1の配列の場合は同じ値にする感じで
          if(value.length === 1){ value.push(value[0], value[0]); }
          this.uMV.translate(value);
          break;
        // rotX～rotZはすべてスカラー値
        case "rotX":
          this.uMV.rotateX(value); break;
        case "rotY":
          this.uMV.rotateY(value); break;
        case "rotZ":
          this.uMV.rotateZ(value); break;
        case "rotAxis":
          // 角度と、軸方向からなる長さ4の配列
          this.uMV.rotate(...value); break;
        case "scale":
          // 長さ1の場合は同じ値にする。
          if(value.length === 1){ value.push(value[0], value[0]); }
          this.uMV.scale(...value); break;
      }
    }
  }
  setVertexColor(){
    const sh = this.currentShader;
    sh.setUniform('uUseColorFlag', 0);
    return this;
  }
  setMonoColor(col, a = 1){
    const sh = this.currentShader;
    sh.setUniform('uUseColorFlag', 1);
    sh.setUniform('uMonoColor', [col.r, col.g, col.b, a]);
    return this;
  }
  setUVColor(){
    const sh = this.currentShader;
    sh.setUniform("uUseColorFlag", 2);
    return this;
  }
  setDirectionalLight(col, x, y, z){
    const sh = this.currentShader;
    sh.setUniform('uUseDirectionalLight', true);
    sh.setUniform('uDirectionalDiffuseColor', [col.r, col.g, col.b]);
    sh.setUniform('uLightingDirection', [x, y, z]);
    return this;
  }
  setAmbientLight(col){
    const sh = this.currentShader;
    sh.setUniform('uAmbientColor', [col.r, col.g, col.b]);
    return this;
  }
  setPointLight(col, x, y, z, att0 = 1, att1 = 0, att2 = 0){
    // att0,att1,att2はattenuation（減衰）
    // たとえば0,0,1だと逆2乗の減衰になるわけ
    const sh = this.currentShader;
    sh.setUniform('uUsePointLight', true);
    sh.setUniform('uPointLightDiffuseColor', [col.r, col.g, col.b]);
    sh.setUniform('uPointLightLocation', [x, y, z]);
    sh.setUniform('uAttenuation', [att0, att1, att2]);
    return this;
  }
  drawArrays(mode, first, count){
    // 引数はドローコール、スタートと終わりなんだけどね。んー。
    // トポロジーがサイズ持ってるからそれ使って描画？
    if(arguments.length == 1){
      first = 0;
      count = this.currentTopology.getAttrSize();
    }
    gl.drawArrays(mode, first, count);
    return this;
  }
  drawElements(mode, count){
    // 大きい場合はgl.UNSIGNED_INTを指定
    const _type = this.currentTopology.getIBOType();
    const type = (_type === Uint16Array ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT);
    // 基本的にサイズをそのまま使うので
    if(count === undefined){ count = this.currentTopology.getIBOSize(); }
    gl.drawElements(mode, count, type, 0);
    return this;
  }
  flush(){
    gl.flush();
    return this;
  }
}

// --------------------------------------------------------------- //
// Topology class.
// topologyのsetを用意して、それで・・・うん。
// 同じ内容でもプログラムが違えば違うトポロジーになるので
// 使い回しはできないですね・・・（ロケーション）

class Topology{
  constructor(name){
    this.name = name;
    this.attributes = {}; // Object.keysでフェッチ。delete a[name]で削除。
    this.attrSize = 0;
    this.ibo = undefined;
    this.iboType = undefined;
    this.iboSize = 0;
  }
  getName(){
    return this.name;
  }
  getAttrSize(){
    return this.attrSize;
  }
  getIBOType(){
    return this.iboType;
  }
  getIBOSize(){
    return this.iboSize;
  }
  registAttribute(program, attributeName, data, stride){
    let attr = {};
    attr.vbo = create_vbo(data);
    attr.location = gl.getAttribLocation(program, attributeName);
    attr.stride = stride;
    this.attrSize = Math.floor(data.length / stride); // attrの個数
    this.attributes[attributeName] = attr;
  }
  setAttribute(){
    set_attribute(this.attributes);
  }
  registIndexBuffer(data, type){
    this.ibo = create_ibo(data, type);
    this.iboType = type;
    this.iboSize = data.length; // iboのサイズ
  }
  bindIndexBuffer(){
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
  }
  clear(){
    // 描画が終わったらbindを解除する
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    if(this.ibo !== undefined){ gl.bindBuffer(gl.ELEMENT_BUFFER, null); }
    return this;
  }
}
// -------------------------------------------- //
// keyAction.

// スペースキーでセーブ
// Rキーでリセット
function keyTyped(){
  if(keyCode == 32){ saveFlagOn(); }
  if(keyCode == 82){ dataInput(); }
}

// -------------------------------------------- //
// save.

function saveFlagOn(){
  saveFlag = true;
}

function saveFlagOff(){
  saveFlag = false;
}

function saveImage(){
  const elapsedSeconds = hour()*3600 + minute()*60 + second();
  const title = "gpu_particle_" + elapsedSeconds;
  save(title);
}

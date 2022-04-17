// 見る人増えてきたのでsimplifyします

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
  let sizeFolder = gui.addFolder('size');
  bgFolder.add(config, 'TRANSPARENT').name('transparent');
  sizeFolder.add(config, 'SIZETYPE', {'AUTO':AUTO_SIZE, 'MANUAL':MANUAL_SIZE}).name('sizeType');
  sizeFolder.add(config, 'WIDTH', 256, 1280, 1).name('width');
  sizeFolder.add(config, 'HEIGHT', 256, 768, 1).name('height');
  gui.add({fun:saveFlagOn}, 'fun').name('save');
  gui.add({fun:dataInput}, 'fun').name('reset');
  gui.add(config, 'HIDE').name('hide');
})()

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
"  gl_Position = vec4(aPosition, 0.0, 1.0);" +
"}";

// こっちで複製した方がめっちゃ楽やん
// そうよね
// じゃあこっちでオプション設ける方向で...
// (0.5,0.5)を中心として回転させるとかしても面白そうなんだけど、
// 切れちゃうのがね...まずいんよね。だからせいぜいミラーリングまで
// 例えば縮小して回転とかだったら可能だけれど(0.7程度に収めるとか)
const copyFrag =
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

// ------------------------------ //
// preload.

function preload(){
  textureTableSource = loadImage("https://inaridarkfox4231.github.io/assets/texture/textureTable.png");
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

  // extensionのチェック一通り
  confirmExtensions();

  // nodeを用意
  _node = new RenderNode();
  let sh;

  // dataShader:点の位置と速度の初期設定用
  sh = createShader(dataVert, dataFrag);
  _node.regist('input', sh, 'board')
       .registAttribute('aPosition', [-1,1,-1,-1,1,1,1,-1], 2);

  // moveShader:点の位置と速度の更新用
  sh = createShader(moveVert, moveFrag);
  _node.regist('move', sh, 'board')
       .registAttribute('aPosition', [-1,1,-1,-1,1,1,1,-1], 2)
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

  // copyShader: パーティクルレイヤー用
  // ベースに上書きするだけの単純なシェーダ。
  sh = createShader(copyVert, copyFrag);
  _node.regist('copy', sh, 'board')
       .registAttribute('aPosition', [-1,1,-1,-1,1,1,1,-1], 2)
       .registUniformLocation('uTex');

  // 背景用
  sh = createShader(patternVert, patternFrag);
  _node.regist('pattern', sh, 'board')
       .registAttribute('aPosition', [-1,1,-1,-1,1,1,1,-1], 2);

  // doubleのFBOを用意。0と1を予約します。
  _node.registDoubleFBO('data', 0, TEX_SIZE, TEX_SIZE, gl.FLOAT, gl.NEAREST);
  // 焼き付け用
  _node.registFBO('particle', 2, width, height, gl.FLOAT, gl.NEAREST);
  // 背景用
  _node.registFBO('bg', 3, width, height);

  // 位置と速度の初期設定
  dataInput();

  // textureTableのtextureを用意
  textureTable = new p5.Texture(_gl, textureTableSource);
}

// --------------------------------------------------------------- //
// main loop.

function draw(){
  // リサイズ処理
  resizeCheck();

  // マウスの値を調整して全画面に合わせる
  const _size = min(width, height);
  const mouse_x = (mouseX / width - 0.5) * 2.0 * width / _size;
  const mouse_y = -(mouseY / height - 0.5) *2.0 * height / _size;
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

  // 点描画しない場合はここでおさらばというわけ
  if(config.HIDE){ return; }

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

  // blendの有効化
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);

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

  // これだ！これを使うと上書きできる！なるほど...
  // 便利だねぇ...ありがたいね...
  // bgManagerの救世主。
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.enable(gl.BLEND);

  _node.bindFBO(null);
  _node.use('copy', 'board')
       .setAttribute()
       .setFBO('uTex', 'particle')
       .setUniform("uMirror", [config.MIRROR_X, config.MIRROR_Y])
       .drawArrays(gl.TRIANGLE_STRIP)
       .clear()
       .flush();

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
  // 背景用
  _node.registFBO('bg', 3, currentWidth, currentHeight);
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
function create_fbo(texId, w, h, textureFormat, filterParam){
  // フォーマットチェック
  if(!textureFormat){
    textureFormat = gl.UNSIGNED_BYTE;
  }
  if(!filterParam){
    filterParam = gl.NEAREST;
  }

  // フレームバッファの生成
  let frameBuffer = gl.createFramebuffer();

  // フレームバッファをWebGLにバインド
  gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);

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
  return {f:frameBuffer, d:depthRenderBuffer, t:fTexture, id:texId};
}

// fboのペアを作る
function create_double_fbo(texId, w, h, textureFormat, filterParam){
  // texIdは片方について1増やす
  let fbo1 = create_fbo(texId, w, h, textureFormat, filterParam);
  let fbo2 = create_fbo(texId + 1, w, h, textureFormat, filterParam);
  let doubleFbo = {};
  doubleFbo.read = fbo1;
  doubleFbo.write = fbo2;
  doubleFbo.swap = function(){
    let tmp = this.read;
    this.read = this.write;
    this.write = tmp;
  }
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
  registFBO(FBOName, texId, w, h, textureFormat, filterParam){
    // fboをセット(同じ名前の場合は新しく作って上書き)
    //if(this.framebufferObjects[FBOName] !== undefined){ return this; }
    let fbo = create_fbo(texId, w, h, textureFormat, filterParam);
    this.framebufferObjects[FBOName] = fbo;
    return this;
  }
  registDoubleFBO(FBOName, texId, w, h, textureFormat, filterParam){
    // doubleFBOをセット（同じ名前の場合は新しく作って上書き）
    //if(this.framebufferObjects[FBOName] !== undefined){ return this; }
    let fbo = create_double_fbo(texId, w, h, textureFormat, filterParam);
    this.framebufferObjects[FBOName] = fbo;
    return this;
  }
  bindFBO(FBOName){
    // FBOをbindもしくはnullで初期化。ダブルの場合はwriteをセット。
    if(FBOName == null){
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); return this;
    }
    let fbo = this.framebufferObjects[FBOName];
    if(!fbo){ return this; }
    if(fbo.write){
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.write.f); return this;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.f);
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
    if(FBOName == null){ return this; }
    let fbo = this.framebufferObjects[FBOName];
    if(!fbo){ return this; }
    if(fbo.read){
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
  registIndexBuffer(data, type){
    // デフォルトはUint16Array. 多い場合はUint32Arrayを指定する。
    if(type === undefined){ type = Uint16Array; }
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

// attributes:{"programName":{}}
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
    // ここでシェーダー名を引数に取ってそれを・・ってやればいいのね。
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

# GPUparticles
GPGPUでparticleAnimation(h_doxasさんの作品の写経）.  
demo: https://inaridarkfox4231.github.io/GPUparticles/  
マウスダウンでパーティクルが動きます。  
Rキーでリセット、スペースキーでセーブできます。  
datについて...  
particleColor: パーティクルの色を決めます。文字入力で#ee4のように直接編集もできます。  
autoColor: 色が時間経過で変化します。  
mirrorX, mirrorY: パーティクル画像が上下左右に折り返しコピーされます。  
bgタブ  
mainColor, subColor: グラデーションがない場合はメインカラーのみが使われます。  
baseColor: 背景の白い部分の色を決めます。  
pattern: パターンを選べます。  
gradation: XとYでmainColorとsubColorに応じたグラデーションを付けることができます。  
transparent: ここにチェックを入れてセーブすると透過画像になります。  
sizeタブ  
sizeType: AUTOだとウィンドウのサイズに応じた大きさになります。MANUALにすると自由に決めることができます。  
width, height: サイズをスライダーまたは入力で決めることができます（MANUALモードのみ）  
関数  
save: 画像を保存します（スペースキーでも可）  
reset: パーティクルの状態を初期状態に戻します。  

hide: パーティクルが非表示になります。背景を保存したいときにお使いください。  

参考：h_doxasさんのhttps://wgld.org/d/webgl/w083.html です。



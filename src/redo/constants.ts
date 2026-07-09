// constants.ts
// VNodeの特殊な型を表すシンボル定数

/**
 * Fragmentノードを表すシンボル
 * Fragmentは複数の子要素をグループ化するが、DOM上には要素を生成しない
 */
export const FRAGMENT = Symbol("FRAGMENT");

/**
 * テキストノードを表すシンボル
 * 文字列や数値がDOMのTextNodeとしてレンダリングされる
 */
export const TEXT = Symbol("TEXT");

/**
 * 境界（Boundary）ノードを表すシンボル
 * 部分再描画の島(island)の宣言に使われる。
 * 境界の内部はその島だけが所有し、親の再描画は境界内部に立ち入らない（不透明）。
 */
export const BOUNDARY = Symbol("BOUNDARY");

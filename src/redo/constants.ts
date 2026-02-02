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

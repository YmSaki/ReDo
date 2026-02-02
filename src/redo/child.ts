// src/redo/child.ts
// JSXの子要素として受け入れ可能な型定義

import { JSXNode } from "./jsx-node";

/**
 * JSXの子要素をh()で正規化したときに使用される型
 * - プリミティブ値（string, number
 * - JSXNode（JSXから変換されたNode）
 * - JSXChild[]（配列のネスト）
 */
export type JSXChild =
	| string
	| number
	| boolean
	| JSXNode
	| JSXChild[]
	| undefined
	| null;

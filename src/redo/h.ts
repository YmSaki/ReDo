// src/redo/h.ts
// JSX変換関数（クラシックJSX変換）

import type { JSXNode, JSXNodeChild } from "./jsx-node";
import type { Component } from "./component";
import type { JSXChild } from "./child";
import { FRAGMENT } from "./constants";
import { VNode } from "./vnode";


/**
 * JSXをJSXNodeオブジェクトに変換する関数
 * Vite/SWCによってJSXが自動的にこの関数呼び出しに変換される
 *
 * @param type - 要素の型（HTML要素名、シンボル、またはコンポーネント関数）
 * @param props - 要素の属性
 * @param children - 子要素（可変長引数）
 * @returns JSXNode オブジェクト
 *
 * @example
 * // JSX: <div className="app">Hello</div>
 * // 変換後: h("div", { className: "app" }, "Hello")
 */
// TODO: typeに応じて処理を分解する
export function h(
	type: string | typeof FRAGMENT | Component,
	props: Record<string, unknown>,
	...children: JSXChild[]
): JSXNode {
	const normalizedProps = props || {};

	// idつきで かつ keyが未指定の場合は、idをkeyとしてフォールバックする
	if (normalizedProps.key === undefined && normalizedProps.id !== undefined) {
		normalizedProps.key = normalizedProps.id;
	}

	return {
		type,
		props: normalizedProps,
		children: flat(children),
	};
}

/**
 * 子要素の配列を平坦化し、JSXNodeの配列に正規化する
 * - null/undefined/boolean は除外される（レンダリングされない）
 * - ネストした配列は再帰的に平坦化される
 * - 文字列や数値はTEXTノードに変換される
 *
 * @param children - 正規化する子要素の配列
 * @returns 平坦化されたJSXNodeの配列
 */
const flat = (children: JSXChild[]): JSXNodeChild[] => {
	return children.flatMap((child) => {
		return Array.isArray(child)
			? flat(child)
			: (
				child == null || typeof child === "boolean"
					? []
					: [child]
			);
	});
}

/** Fragment（複数要素をグループ化するが、DOM要素を生成しない） */
export { FRAGMENT as Fragment };

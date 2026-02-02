// src/redo/render.ts
// JSXNodeをVNodeに解決する（コンポーネント関数を実行してツリーを展開）

import { FRAGMENT, TEXT } from "./constants";
import type { JSXNode } from "./jsx-node";
import { VNodeProps } from "./props";
import type { VNode } from "./vnode";

/**
 * JSXNodeを再帰的に解決してVNodeツリーを生成する
 * コンポーネント関数が実行され、最終的にHTML要素とテキストノードのみのツリーになる
 *
 * @param node - 解決するJSXNode
 * @returns 解決されたVNode
 */
export const render = (node: JSXNode | string | number): VNode => {
	if (typeof node === "string" || typeof node === "number") {
		return {
			type: TEXT,
			props: { nodeValue: node },
			children: [],
		};
	}

	const { children, key, ...props } = node.props;
	const vKey = key as string | number | undefined;

	if (node.type === FRAGMENT) {
		return {
			type: FRAGMENT,
			props: {},
			children: node.children.map(render),
			key: vKey,
		}
	}

	// コンポーネント関数の場合は実行して再帰的に解決
	if (typeof node.type === "function") {
		// propsにchildrenをマージして渡す
		const result = node.type({
			...node.props,
			children: node.children,
		})
		const vResult = render(result);
		vResult.key = vKey;
		return vResult;
	}

	// TODO: 要検証
	return {
		type: node.type,
		props: props as VNodeProps,
		children: node.children.map(render),
		key: vKey,
	};
}

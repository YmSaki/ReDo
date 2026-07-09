// src/redo/mount.ts
// VNodeから実際のDOM要素を生成する

import { FRAGMENT, TEXT } from "./constants"
import { applyAttribute } from "./domattribute";
import { enqueue } from "./queue";
import type { VNode } from "./vnode";

/**
 * VNodeから実際のDOM要素を生成して親要素に追加する
 *
 * @param vnode - マウントするVNode
 * @param parent - 親となるDOM要素
 * @returns 生成されたDOM要素（FragmentやnullVNodeの場合はnull）
 */
export function mount(vnode: VNode | null, parent: HTMLElement | null): HTMLElement | Text | null {
	// null VNodeは何も生成しない
	if (!vnode) {
		return null;
	}

	// Fragmentは子要素のみをマウント（DOM要素を作らない）
	if (vnode.type === FRAGMENT) {
		vnode.children.forEach((child: VNode) => mount(child, parent));
		return null;
	}

	// テキストノードを生成
	if (vnode.type === TEXT) {
		const el = document.createTextNode(String(vnode.props.nodeValue));
		if (parent) {
			parent.appendChild(el);
		}

		vnode.dom = el; // 差分検出用にDOM参照を保存

		// onMountを起動する
		if (vnode.props.onMount) {
			enqueue(vnode.props.onMount, el);
		}

		return el;
	}

	// HTML要素を生成
	const el = document.createElement(vnode.type as string);
	vnode.dom = el; // 差分検出用にDOM参照を保存

	// 属性とイベントハンドラを設定（patch.tsのpatchPropsと共通のロジックを使用）
	// mount時は旧値が存在しないため oldValue = undefined として呼び出す
	for (const key in vnode.props) {
		applyAttribute(el, key, undefined, vnode.props[key]);
	}

	// 子要素を再帰的にマウント
	vnode.children.forEach((child: VNode) => mount(child, el));
	if (parent) {
		parent.appendChild(el);
	}

	// onMountを起動する
	if (vnode.props.onMount) {
		enqueue(vnode.props.onMount, el);
	}

	return el;
}

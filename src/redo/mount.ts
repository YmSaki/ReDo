// src/redo/mount.ts
// VNodeから実際のDOM要素を生成する

import { FRAGMENT, TEXT } from "./constants"
import { updateEvent } from "./domeventmanager";
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

	// 属性とイベントハンドラを設定
	for (const key in vnode.props) {
		const value = vnode.props[key];
		if (key === "children") {
			continue;
		}

		if (key === "style" && typeof value === "object" && value !== null) {
			Object.assign(el.style, value);
			continue;
		}

		// イベントハンドラ（onXxx）の処理
		if (key.startsWith("on") && typeof value === "function") {
			updateEvent(el, key, undefined, value);
			continue;
		}

		// 通常の属性を設定
		el.setAttribute(key, String(value));
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

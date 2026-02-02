// src/redo/patch.ts
// VNode間の差分を検出してDOMを効率的に更新する

import { TEXT } from "./constants";
import { mount } from "./mount";
import { ComponentProps } from "./props";
import { enqueue } from "./queue";
import type { VNode } from "./vnode";
import { updateEvent } from "./domeventmanager";
import { ReDoEvent } from "./event";

/**
 * 旧VNodeと新VNodeを比較してDOMを差分更新する
 * フォーカスやスクロール位置を維持しながら、変更のあった部分のみを更新する
 *
 * @param parent - 親となるDOM要素
 * @param oldVNode - 前回レンダリング時のVNode
 * @param newVNode - 今回レンダリングするVNode
 * @param index - 子要素のインデックス（内部用）
 * @returns 更新されたDOM要素
 */
export function patch(
	parent: HTMLElement,
	oldVNode: VNode | null,
	newVNode: VNode | null
): HTMLElement | Text | null {
	// Case 1: Delete - 新VNodeがnull → 要素を削除
	if (!newVNode) {
		if (oldVNode?.dom) {
			invokeUnmount(oldVNode);
			oldVNode.dom.remove();
		}
		return null;
	}

	// Case 2: Insert - 旧VNodeがnull → 新規マウント
	if (!oldVNode) {
		return mount(newVNode, parent);
	}

	// Case 3: Replace - 型が変わった → 要素を置き換え
	if (oldVNode.type !== newVNode.type) {
		const newDOM = mount(newVNode, null);
		if (newDOM && oldVNode.dom) {
			invokeUnmount(oldVNode);
			oldVNode.dom.replaceWith(newDOM);
		}

		invokeUpdate(newVNode);
		return newDOM;
	}

	// Case 4: Update - 同じ要素 → DOM参照を引き継ぐ
	const element = (newVNode.dom = oldVNode.dom!) as HTMLElement;

	// Case 5: Update - テキストノード → 内容が変わっていれば更新
	if (newVNode.type == TEXT) {
		if (oldVNode.props.nodeValue !== newVNode.props.nodeValue) {
			element.nodeValue = String(newVNode.props.nodeValue);
		}
		invokeUpdate(newVNode);
		return element;
	}

	// Case 6: Update - HTML要素 → 属性と子要素を差分更新
	patchProps(element, oldVNode.props, newVNode.props);

	// 子要素を再帰的に差分更新
	patchChildren(element, oldVNode.children, newVNode.children);

	invokeUpdate(newVNode);

	return element;
}

/**
 * 要素の属性（props）を差分更新する
 * 変更があった属性のみを更新し、削除された属性を削除する
 *
 * @param element - 更新対象のDOM要素
 * @param oldProps - 前回の属性
 * @param newProps - 今回の属性
 */
function patchProps(element: HTMLElement, oldProps: ComponentProps, newProps: ComponentProps) {
	// 新しい属性を追加/更新
	for (const key in newProps) {
		if (key === "children") {
			continue;
		}

		const oldValue = oldProps[key];
		const newValue = newProps[key];

		// 値が変わっていなければスキップ
		if (oldValue === newValue) {
			continue;
		}

		// イベントハンドラ（onXxx）の差分更新
		if (key.startsWith("on")) {
			updateEvent(element, key, oldValue as Function, newValue as Function);
		} else {
			element.setAttribute(key, String(newValue));
		}

		// style属性の差分更新
		if (key === "style") {
			if (typeof newValue === "string") {
				element.style.cssText = newValue;
			}
			else if (typeof newValue === "object" && newValue !== null) {
				if (typeof oldValue === "object" && oldValue !== null) {
					for (const sKey in oldValue) {
						// @ts-ignore
						if (!(sKey in newValue)) element.style[sKey] = "";
					}
				}

				// 新しいスタイルを適用
				for (const sKey in newValue) {
					// @ts-ignore
					element.style[sKey] = newValue[sKey];
				}
			}
			continue;
		}

		// class / className の正規化
		if (key === "className") {
			element.setAttribute("class", String(newValue));
			continue;
		}

		// それ以外は通常の属性として設定
		// null/undefined/falseの場合は属性を削除（boolean属性対応）
		if (newValue == null || newValue === false) {
			element.removeAttribute(key);
		} else {
			// trueの場合は属性名のみ設定（<input disabled />）
			const attrValue = newValue === true ? "" : String(newValue);
			element.setAttribute(key, attrValue);
		}
	}

	// 削除された属性を除去
	for (const key in oldProps) {
		if (key === "children") {
			continue;
		}
		if (!(key in newProps)) {
			if (key.startsWith("on")) {
				updateEvent(element, key, oldProps[key] as Function, undefined);
			} else {
				element.removeAttribute(key);
			}
		}
	}
}

function patchChildren(parent: HTMLElement, oldChildren: VNode[], newChildren: VNode[]) {
	const oldMap = new Map<string | number, VNode>();
	const oldUnKeyd: VNode[] = [];

	oldChildren.forEach((child) => {
		if (child.key != null) {
			oldMap.set(child.key, child);
		} else {
			oldUnKeyd.push(child);
		}
	});

	let unKeydIndex = 0;

	newChildren.forEach((child, index) => {
		let oldChild: VNode | undefined;
		if (child.key != null) {
			oldChild = oldMap.get(child.key);
			if (oldChild) {
				oldMap.delete(child.key);
			}
		} else {
			if (unKeydIndex < oldUnKeyd.length) {
				oldChild = oldUnKeyd[unKeydIndex];
				unKeydIndex++;
			}

		}

		if (oldChild) {
			// 一致する場合
			patch(parent, oldChild, child);
			oldMap.delete(child.key!);

			if (child.key != null) {
				// 移動しただけの場合
				const currentDom = child.dom;
				const refNode = parent.childNodes[index];

				if (currentDom && refNode && currentDom !== refNode) {
					// insertBeforeで移動も兼ねる
					parent.insertBefore(currentDom, refNode);
				}
			}
		} else {
			// 新規作成が必要
			const newDom = mount(child, null);
			if (newDom) {
				const referenceNode = parent.childNodes[index] || null;
				parent.insertBefore(newDom, referenceNode);
			}
		}
	});

	// 余りを消す
	oldMap.forEach((child) => {
		invokeUnmount(child);
		child.dom?.remove();
	});
	while (unKeydIndex < oldUnKeyd.length) {
		const child = oldUnKeyd[unKeydIndex];
		invokeUnmount(child);
		child.dom?.remove();
		unKeydIndex++;
	}
}

function invokeUpdate(vnode: VNode) {
	if (vnode.props.onUpdate) {
		enqueue(vnode.props.onUpdate, vnode.dom!);
	}
}

function invokeUnmount(vnode: VNode) {
	if (vnode.props.onUnmount) {
		enqueue(vnode.props.onUnmount, vnode.dom!);
	}
	vnode.children.forEach((child) => invokeUnmount(child));
}

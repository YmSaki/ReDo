// src/redo/core.ts
// アプリケーションの初期化と再レンダリング機能

import { render } from "./render";
import { h } from "./h";
import type { Component } from "./component";
import { VNode } from "./vnode";
import { patch } from "./patch";

/**
 * ReDoアプリケーションインスタンス
 * init()から返され、そのアプリ固有のreRender()を提供する
 */
export type App = {
	reRender: () => void;
};

// 最後にinitされたApp（後方互換用）
let lastApp: App | null = null;

/**
 * ReDoアプリケーションを初期化する
 * @param component - ルートコンポーネント関数
 * @param container - マウント先のDOM要素
 * @returns Appインスタンス
 */
export const init = (component: Component, container: HTMLElement): App => {
	// クロージャで各Appの状態を保持
	let oldVNode: VNode | null = null;

	const appReRender = () => {
		// コンポーネントをJSXNodeに変換
		const generatedVNode = h(component, {});
		// コンポーネント関数を再帰的に解決してVNodeツリーを生成
		const newVNode = render(generatedVNode);

		// 差分検出してDOM更新
		patch(container, oldVNode, newVNode);
		// 次回の差分検出のために保存
		oldVNode = newVNode;

		console.log("[ReDo] reRender");
	};

	const app: App = { reRender: appReRender };

	// 後方互換のために最後のAppを保持
	lastApp = app;

	// 初回レンダリング
	appReRender();

	return app;
};

/**
 * アプリケーション全体を再レンダリングする（後方互換用）
 * 最後にinitされたAppのreRender()を呼び出す
 */
export const reRender = () => {
	if (lastApp) {
		lastApp.reRender();
	}
};

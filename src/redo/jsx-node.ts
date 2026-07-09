// src/redo/jsx-node.ts
// JSX変換後の中間表現の型定義

import type { Component } from "./component";
import { BOUNDARY, FRAGMENT } from "./constants";

/**
 * JSX変換後の中間表現（h関数の戻り値）
 * - HTML要素、Fragment/TEXT、またはコンポーネント関数を表現
 * - render関数によってVNodeに解決される
 */
export type JSXNode = {
	/// 要素の型（コンポーネント関数）
	// TODO: discriminated unionに分解
	type: string | Component | typeof FRAGMENT | typeof BOUNDARY;
	/// 要素の属性
	props: Record<string, unknown>;
	/// 子要素の配列
	children: JSXNodeChild[];
};

export type JSXNodeChild = JSXNode | string | number;

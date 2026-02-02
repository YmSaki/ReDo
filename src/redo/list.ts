// src/redo/list.ts
// リストレンダリングを効率化・自動化するヘルパー

import { h, Fragment } from "./h";
import type { JSXNode } from "./jsx-node";

// オブジェクト参照用のレジストリ (WeakMapはメモリリークしないのでグローバルでOK)
const objectKeyRegistry = new WeakMap<object, string>();
let uniqueIdCounter = 0;

/**
 * オブジェクト用: 参照ベースの不変IDを取得
 */
const getObjectKey = (item: object): string => {
	const existingKey = objectKeyRegistry.get(item);
	if (existingKey) return existingKey;

	const newKey = `ref-${++uniqueIdCounter}`;
	objectKeyRegistry.set(item, newKey);
	return newKey;
};

export type ListProps<T> = {
	/** レンダリングする配列 */
	items: T[];
	/** 各要素のレンダリング関数 */
	renderItem: (item: T, index: number) => JSXNode;
	/** オプション: keyを明示的に指定する関数 */
	keyExtractor?: (item: T) => string | number;
};

/**
 * スマートなListコンポーネント
 * オブジェクトには参照IDを、プリミティブには値ベースのIDを自動付与する
 *
 * - オブジェクト型: WeakMapでオブジェクトの同一性を追跡してkeyを自動生成
 * - プリミティブ型: 値ベース + 重複連番IDでkeyを生成（例: "100", "100_1"）
 * - keyExtractorを指定した場合: 明示的なkey生成関数を使用
 *
 * @example
 * // オブジェクト配列（自動key）
 * <List items={users} renderItem={(user) => <UserCard user={user} />} />
 *
 * @example
 * // 明示的なkey指定
 * <List
 *   items={users}
 *   renderItem={(user) => <UserCard user={user} />}
 *   keyExtractor={(user) => user.id}
 * />
 *
 * @example
 * // プリミティブ配列（値ベース + 連番）
 * <List items={["a", "b", "a"]} renderItem={(str) => <div>{str}</div>} />
 * // → key: "a", "b", "a_1"
 */
export const List = <T>({ items, renderItem, keyExtractor }: ListProps<T>): JSXNode => {
	// プリミティブ値の重複出現回数を記録するマップ (レンダリングのたびにリセット)
	// これにより [100, 100] のような重複データでも "100", "100_1" と一意になる
	const primitiveCount = new Map<string | number | boolean, number>();

	const nodes = items.map((item, index) => {
		const vnode = renderItem(item, index);
		let key: string | number;

		if (keyExtractor) {
			// ユーザー指定があれば最優先
			key = keyExtractor(item);
		} else if (typeof item === 'object' && item !== null) {
			// オブジェクトならWeakMap (参照が変わらない限りKeyは不変)
			key = getObjectKey(item);
		} else {
			// プリミティブ型の自動生成ロジック
			// 値そのものをベースにするが、重複がある場合はサフィックスをつける
			const val = item as string | number | boolean;
			const count = primitiveCount.get(val) || 0;

			// "val" または "val_1", "val_2"...
			key = count === 0 ? String(val) : `${val}_${count}`;

			primitiveCount.set(val, count + 1);
		}

		// VNodeにKeyを注入
		vnode.props.key = key;

		return vnode;
	});

	return h(Fragment, {}, ...nodes);
};

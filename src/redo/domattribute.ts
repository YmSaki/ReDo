// src/redo/domattribute.ts
// DOM要素への属性（props）反映を一本化するモジュール
// mount.ts と patch.ts(patchProps) の両方がこのモジュールを介してDOMへ属性を反映する。
// 1つのpropに対してDOM操作が最大1系統になるよう、分岐は排他的（if/else + early return）にする。

import { updateEvent } from "./domeventmanager";

/**
 * 1つのprop値をDOM要素に反映する（追加・更新・削除を統一的に扱う）
 *
 * 削除したい場合は newValue に undefined を渡して呼び出す。
 * mount時は「旧値がない」状態として oldValue に undefined を渡して呼び出せばよい。
 *
 * 判定順序:
 *   1. children / key → 何もしない（属性ではない）
 *   2. onXxx かつ関数（ライフサイクルprops含む）→ updateEvent
 *      ※ onMount/onUpdate/onUnmount のenqueue処理はmount/patch側の既存ロジックのまま。
 *        ここではon*として扱う現状の挙動を維持する（updateEventへの誤登録問題はIssue #4）
 *   3. style → 文字列ならcssText、オブジェクトなら旧値との差分適用
 *   4. className → class属性として設定（className というliteral属性は作らない）
 *   5. boolean/null/undefined → true は空文字属性、false/null/undefinedは属性除去
 *   6. それ以外 → 通常のsetAttribute
 *
 * @param el - 対象のDOM要素
 * @param key - prop名
 * @param oldValue - 直前の値（mount時や新規追加時はundefined）
 * @param newValue - 新しい値（削除したい場合はundefined）
 */
export function applyAttribute(el: HTMLElement, key: string, oldValue: unknown, newValue: unknown): void {
	// children / key は属性ではないため無視
	if (key === "children" || key === "key") {
		return;
	}

	// イベントハンドラ（onXxx）の処理
	// 追加/更新時はnewValueが関数、削除時はoldValueが関数になっている
	if (key.startsWith("on") && (typeof newValue === "function" || typeof oldValue === "function")) {
		updateEvent(el, key, oldValue as Function | undefined, newValue as Function | undefined);
		return;
	}

	// style属性の反映
	if (key === "style") {
		applyStyle(el, oldValue, newValue);
		return;
	}

	// className -> class 属性への正規化（className というliteral属性は作らない）
	if (key === "className") {
		if (newValue == null || newValue === false) {
			el.removeAttribute("class");
		} else {
			el.setAttribute("class", String(newValue));
		}
		return;
	}

	// boolean/null/undefined属性
	// null/undefined/falseの場合は属性を削除（boolean属性対応）
	if (newValue == null || newValue === false) {
		el.removeAttribute(key);
		return;
	}
	// trueの場合は属性名のみ設定（<input disabled />）
	if (newValue === true) {
		el.setAttribute(key, "");
		return;
	}

	// それ以外は通常の属性として設定
	el.setAttribute(key, String(newValue));
}

/**
 * style属性を反映する
 * - 文字列 → cssTextとしてそのまま設定
 * - オブジェクト → 旧オブジェクトとの差分適用（旧にあって新にないキーは ""でクリア）
 * - それ以外（削除時など） → style属性ごと除去
 *
 * @param el - 対象のDOM要素
 * @param oldValue - 直前のstyle値
 * @param newValue - 新しいstyle値
 */
function applyStyle(el: HTMLElement, oldValue: unknown, newValue: unknown): void {
	// 文字列指定はcssTextにそのまま反映する（[object Object]が入り込む余地をなくす）
	if (typeof newValue === "string") {
		el.style.cssText = newValue;
		return;
	}

	// オブジェクト指定は旧値との差分を適用する
	if (typeof newValue === "object" && newValue !== null) {
		// 旧にあって新にないキーはクリアする
		if (typeof oldValue === "object" && oldValue !== null) {
			for (const sKey in oldValue as Record<string, unknown>) {
				if (!(sKey in (newValue as Record<string, unknown>))) {
					// @ts-ignore
					el.style[sKey] = "";
				}
			}
		}

		// 新しいスタイルを適用
		for (const sKey in newValue as Record<string, unknown>) {
			// @ts-ignore
			el.style[sKey] = (newValue as Record<string, unknown>)[sKey];
		}
		return;
	}

	// null/undefined/false等 → style属性ごと除去
	el.removeAttribute("style");
}

// src/redo/controller.ts
// 「コントローラ + this.reRender()」パターンの薄いヘルパー（Issue #8）
//
// 設計:
// - コントローラは実際のclassとして書く。View（島のView関数）とイベントハンドラは
//   arrowフィールドとして定義する。arrowフィールドはインスタンス生成時にthisを
//   レキシカルに束縛するため、queue.ts の flush が `item.event(ctx)` と裸で
//   呼び出しても、ハンドラ内のthisは常にそのコントローラインスタンスを指す
//   （thisを決めるのはReDoではなくJavaScriptの言語仕様そのもの）。
// - 基本形は `this.reRender()`。中身はただの `reRenderIsland(this.View)` の呼び出しで、
//   コントローラは自分がどの島（View）に属するかを自分で知っているので、
//   イベントの発生源（ctx.payload）がDOM要素かどうかに関係なく常に正しい島を再描画できる。
//   これが非同期完了時（ctx.run の success ハンドラ。payloadは非同期処理の結果であって
//   DOM要素ではない）でもこのパターンが決定的に機能する理由であり、存在意義そのもの。
// - `getComponent(this)` のようなヘルパーは意図的に作らない。`this` と書けている時点で
//   すでにコントローラの上に立っているので、そこから改めて所属コンポーネントを逆引きする
//   必要がない（循環）。詳細は docs/future-tasks.md を参照。
//
// このファイルが提供するのは「reRender = () => reRenderIsland(this.View)」という
// 1行のボイラープレートを更に1行にするだけの薄いヘルパーであり、魔法（暗黙のthis解決や
// 自動登録など）は一切足さない。ヘルパーを使わず直接
// `reRender = () => reRenderIsland(this.View);` と書いても全く同じ効果である。

import { reRenderIsland } from "./island";
import type { Component } from "./component";

/**
 * コントローラのView（島のView関数）に対応する再描画関数を作る
 *
 * `reRender = () => reRenderIsland(this.View);` を書くボイラープレートを
 * 1行にするだけの薄いヘルパー。返り値は reRenderIsland(view) を呼ぶだけの関数であり、
 * それ以上のことは何もしない。
 *
 * 使い方（コントローラのクラス定義内で、View宣言の後に置く）:
 * ```ts
 * class Counter {
 *   count = 0;
 *   View: Component = () => h("div", {}, String(this.count));
 *   increment = (ctx: Context) => { this.count++; this.reRender(); };
 *   reRender = makeReRender(this.View);
 * }
 * ```
 *
 * @param view - コントローラのView関数（インスタンスごとに一意なarrow関数を想定）
 * @returns 呼び出すとその島だけを再描画する関数
 */
export const makeReRender = (view: Component): (() => void) => {
	return () => reRenderIsland(view);
};

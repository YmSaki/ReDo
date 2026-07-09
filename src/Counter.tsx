// src/Counter.tsx
// 「コントローラ + this.reRender()」パターンのサンプル（Issue #8）
//
// - Counter は実際のclass。count(状態)、View(島のView関数)、
//   increment(同期イベント)をarrowフィールドとして持つ。
// - arrowフィールドはthisをレキシカルに束縛するので、queue.ts の flush が
//   ハンドラを裸で呼び出しても(`item.event(ctx)`)、ハンドラ内のthisは
//   常にこのCounterインスタンスを指す。ctx.payload はトリガー側（DOMイベント）。
// - reRender = makeReRender(this.View) は `reRenderIsland(this.View)` を
//   呼ぶだけの薄いラッパー。island(counter.View) で宣言した島だけを
//   差分再描画し、親（CounterDemo）や非島の兄弟要素には一切触れない。
// - refresh/apply は非同期完了時の例。ctx.run() の success ハンドラに渡る
//   payload はサーバーからの結果であってDOM要素ではないため、DOMから島を
//   辿る方式では対象を特定できない。インスタンスがthis.Viewを直接握っている
//   this.reRender() だけが、この場合でも確実に正しい島を再描画できる。

import { island } from "./redo";
import type { Component, Context } from "./redo";
import { makeReRender } from "./redo/controller";

export class Counter {
	count = 0;

	// 島のView。単一のホスト要素をルートに返す（v1制約）
	View: Component = () => (
		<div class="counter">
			<span class="counter-value">{this.count}</span>
			<button onClick={this.increment}>+1</button>
			<button onClick={this.refresh}>Refresh (async)</button>
		</div>
	);

	// 同期イベント: this.count++ してから this.reRender()
	increment = (ctx: Context<Event>) => {
		this.count++;
		this.reRender();
	};

	// 非同期イベント: サーバー等から新しいcountを取得する体で、ctx.runに渡す
	refresh = (ctx: Context<Event>) => {
		ctx.run(
			async () => {
				// 実際にはfetch等。ここではダミーの非同期完了を模す
				return this.count + 10;
			},
			undefined,
			{ success: this.apply },
		);
	};

	// 非同期完了時のハンドラ。ctx.payloadは非同期処理の結果（数値）であり、
	// DOM要素ではない。this.reRender()だけがこのケースでも確実に動く。
	apply = (ctx: Context<number>) => {
		this.count = ctx.payload ?? this.count;
		this.reRender();
	};

	// 島だけを再描画する。中身はreRenderIsland(this.View)を呼ぶだけ
	reRender = makeReRender(this.View);
}

// コントローラのインスタンスはコンポーネント関数の外で保持する
// （island は View 関数をキーに1つのマウントとして管理するため、
//   再描画のたびに new Counter() すると別の島として扱われてしまう）
const counter = new Counter();

/**
 * 親コンポーネント: 「コントローラの島」と「非島の兄弟要素」を並べて配置する。
 * counter.reRender() は island(counter.View) の内部だけを更新し、
 * 兄弟のinputは再描画の影響を受けない（値も参照も保持される）。
 */
export const CounterDemo: Component = () => {
	return (
		<div class="counter-demo">
			{island(counter.View)}
			<input class="sibling-input" placeholder="ここは island の外（this.reRender()の影響を受けない）" />
		</div>
	);
};

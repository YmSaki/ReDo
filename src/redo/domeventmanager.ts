// src/redo/domeventmanager.ts
// DOMイベントマネージャー
import { ReDoEvent, ReDoAsync } from "./event";
import { enqueue, runAsync } from "./queue";

type ReDoHTMLElement = HTMLElement & {
	_eventListener?: Record<string, EventListener>;
	_eventHandler?: Record<string, Function>;
}

export const updateEvent = (
	el: HTMLElement,
	eventName: string,
	oldHandler: Function | undefined,
	newHandler: Function | undefined,
) => {
	const element = el as ReDoHTMLElement;
	const lowerName = eventName.slice(2).toLowerCase();

	// 初期化
	if (!element._eventHandler) element._eventHandler = {};
	if (!element._eventListener) element._eventListener = {};

	// 削除
	if (!newHandler) {
		const listener = element._eventListener[lowerName];
		if (listener) {
			element.removeEventListener(lowerName, listener);
			delete element._eventListener[lowerName];
			delete element._eventHandler[lowerName];
		}
		return;
	}

	// 更新
	element._eventHandler[lowerName] = newHandler;
	if (!element._eventListener[lowerName]) {
		const proxyListener = (event: Event) => {
			const handler = element._eventHandler?.[lowerName];
			if (handler) {
				// 高速パス: ネイティブのasync関数は constructor.name === "AsyncFunction" になる。
				// ただし以下のケースではこの判定をすり抜け、"Function" になってしまう（Issue #5）:
				//   - swc/babel等でasync関数を古いターゲットにトランスパイルした場合
				//   - fn.bind() されたasync関数
				// これらは誤ってenqueue（同期経路）に回るが、その場合の安全網として
				// queue.ts の flush() 側で「同期ハンドラの返り値がPromiseだった場合」の
				// フォールバック処理（trackStraySyncResult）を用意している。
				// そちらでrejectの握り潰し（unhandled rejection化）を防いでいるため、
				// ここでの判定はあくまで「高速パス（正しく判定できた場合はrunAsyncの
				// 正式なタスク管理・AsyncRoutingに乗せる）」として維持してよい。
				const isAsync = handler.constructor.name === "AsyncFunction";
				if (isAsync) {
					runAsync(handler as ReDoAsync<Event, unknown>, event);
				} else {
					enqueue(handler as ReDoEvent<Event>, event);
				}
			}
		}
		element._eventListener[lowerName] = proxyListener;
		element.addEventListener(lowerName, proxyListener);
	}
}

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

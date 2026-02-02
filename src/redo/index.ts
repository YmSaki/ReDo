// src/redo/index.ts
// ReDo Framework - Public API
// このファイルはReDoフレームワークの公開APIを定義します

// === コア関数 ===
/** アプリケーションの初期化 */
export { init } from "./core";
/** アプリケーションインスタンスの型 */
export type { App } from "./core";

// === JSX ===
/** JSX変換関数とFragment */
export { h, Fragment } from "./h";

// === ヘルパー ===
/** リスト要素の自動key付与 */
export { List } from "./list";

// === 型定義のエクスポート ===

export type { Component } from "./component";
export type { ReDoEvent as Event, ReDoAsync as Async } from "./event";
export type { ComponentProps as Props } from "./props";
export type { JSXChild as Child } from "./child";
export type { EventContext as Context } from "./context";
export type { ListProps } from "./list";

// === 内部実装は非公開 ===
// queue, mount, render, patch, constants などは内部実装のため公開していません

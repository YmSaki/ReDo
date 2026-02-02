// src/redo/lifecycle.ts
// コンポーネントのライフサイクルイベントの型定義

import { ReDoEvent } from "./event";

export type LifecycleEvent = ReDoEvent<HTMLElement | Text>;

export type ReDoLifecycleEventsKey = "onMount" | "onUnmount" | "onUpdate";

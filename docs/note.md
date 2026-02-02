JSX (構文)
↓ h()
JSXNode（構文木・未評価）
↓ render()
VNode（評価済・DOM 直前）
↓ mount/patch
DOM

---

## JSXNode の役割（再定義）

### JSXNode = 「まだコンポーネントが実行されていない構文木」

JSXNode が持つべきもの

- type: string | Component
- props
- children（JSXNode | string | number）

JSXNode が 持ってはいけないもの

- dom
- TEXT
- 実 DOM 概念
- patch/diff 向け情報

## VNode の役割（再定義）

### VNode = 「DOM に 1:1 対応する評価済ノード」

VNode が持つべきもの

- type: string | TEXT | FRAGMENT
- props（DOM 用）
- children: VNode[]
- dom?: HTMLElement | Text

### VNode が 持ってはいけないもの

- Component
- JSXNode
- Child
- 未評価の構文

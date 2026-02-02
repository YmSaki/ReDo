// src/redo/jsx.d.ts
// TypeScriptのJSX型定義

/**
 * JSX名前空間の型定義
 * TypeScriptがJSXの型チェックを行うために必要
 */
declare namespace JSX {
	/**
	 * HTML要素の共通属性
	 * W3C HTML Living Standard に基づく
	 * @see https://html.spec.whatwg.org/multipage/
	 */
	interface HTMLAttributes {
		// === グローバル属性 (W3C HTML Living Standard) ===

		/**
		 * 要素の一意な識別子
		 * @see https://html.spec.whatwg.org/multipage/dom.html#the-id-attribute
		 */
		id?: string;

		/**
		 * 要素に適用するCSSクラス名（スペース区切りで複数指定可能）
		 * @see https://html.spec.whatwg.org/multipage/dom.html#classes
		 */
		class?: string;

		/**
		 * classの代替名（React互換性のため提供）
		 * @deprecated W3C仕様では "class" が正式名称。パフォーマンス向上のため class の使用を推奨
		 */
		className?: string;

		/**
		 * インラインCSSスタイル（文字列またはオブジェクト形式）
		 * @see https://html.spec.whatwg.org/multipage/dom.html#the-style-attribute
		 */
		style?: string | Partial<CSSStyleDeclaration>;

		/**
		 * 要素を非表示にするboolean属性
		 * @see https://html.spec.whatwg.org/multipage/interaction.html#the-hidden-attribute
		 */
		hidden?: boolean;

		/**
		 * 要素に関する助言情報（ツールチップとして表示される）
		 * @see https://html.spec.whatwg.org/multipage/dom.html#the-title-attribute
		 */
		title?: string;

		/**
		 * 要素の言語コード（BCP 47形式: "ja", "en-US" など）
		 * @see https://html.spec.whatwg.org/multipage/dom.html#the-lang-and-xml:lang-attributes
		 */
		lang?: string;

		/**
		 * タブキーによるフォーカス順序（正の整数、0、-1）
		 * @see https://html.spec.whatwg.org/multipage/interaction.html#attr-tabindex
		 */
		tabIndex?: number;

		/**
		 * 要素のテキスト方向（"ltr" | "rtl" | "auto"）
		 * @see https://html.spec.whatwg.org/multipage/dom.html#the-dir-attribute
		 */
		dir?: "ltr" | "rtl" | "auto";

		// === フォーム関連属性 ===

		/**
		 * フォーム要素の現在値
		 * @see https://html.spec.whatwg.org/multipage/input.html#attr-input-value
		 */
		value?: string | number | readonly string[];

		/**
		 * チェックボックス・ラジオボタンのチェック状態
		 * @see https://html.spec.whatwg.org/multipage/input.html#attr-input-checked
		 */
		checked?: boolean;

		/**
		 * フォーム要素の無効化（ユーザー操作を受け付けない）
		 * @see https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#attr-fe-disabled
		 */
		disabled?: boolean;

		/**
		 * input要素の種類（"text" | "password" | "email" など）
		 * @see https://html.spec.whatwg.org/multipage/input.html#attr-input-type
		 */
		type?: string;

		/**
		 * 入力欄のプレースホルダーテキスト（入力のヒント）
		 * @see https://html.spec.whatwg.org/multipage/input.html#attr-input-placeholder
		 */
		placeholder?: string;

		/**
		 * フォーム要素の名前（送信時のキー名）
		 * @see https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#attr-fe-name
		 */
		name?: string;

		// === ReDo拡張 ===

		/**
		 * 任意の属性やイベントハンドラを許可
		 * ReDoは「海賊船」哲学に基づき、柔軟性を重視してindex signatureを許可
		 */
		[key: string]: any;
	}

	/**
	 * 組み込みHTML要素の型定義
	 * W3C HTML Living Standard で定義される要素
	 * @see https://html.spec.whatwg.org/multipage/
	 */
	interface IntrinsicElements {
		// === コンテンツ区分 (Content sectioning) ===

		/** 汎用コンテナ（ブロックレベル） */
		div: HTMLAttributes;

		/** 汎用コンテナ（インラインレベル） */
		span: HTMLAttributes;

		/** 段落 */
		p: HTMLAttributes;

		/** 見出しレベル1（最も重要） */
		h1: HTMLAttributes;

		/** 見出しレベル2 */
		h2: HTMLAttributes;

		/** 見出しレベル3 */
		h3: HTMLAttributes;

		/** 見出しレベル4 */
		h4: HTMLAttributes;

		/** 見出しレベル5 */
		h5: HTMLAttributes;

		/** 見出しレベル6（最も重要度が低い） */
		h6: HTMLAttributes;

		/** ヘッダー領域 */
		header: HTMLAttributes;

		/** フッター領域 */
		footer: HTMLAttributes;

		/** ナビゲーション領域 */
		nav: HTMLAttributes;

		/** メインコンテンツ領域 */
		main: HTMLAttributes;

		/** 独立したセクション */
		section: HTMLAttributes;

		/** 独立した記事コンテンツ */
		article: HTMLAttributes;

		/** 補足コンテンツ */
		aside: HTMLAttributes;

		// === テキストコンテンツ ===

		/** 順序なしリスト */
		ul: HTMLAttributes;

		/** 順序付きリスト */
		ol: HTMLAttributes;

		/** リスト項目 */
		li: HTMLAttributes;

		/** 定義リスト */
		dl: HTMLAttributes;

		/** 定義リストの用語 */
		dt: HTMLAttributes;

		/** 定義リストの説明 */
		dd: HTMLAttributes;

		/** 整形済みテキスト */
		pre: HTMLAttributes;

		/** コードブロック */
		code: HTMLAttributes;

		/** 引用ブロック */
		blockquote: HTMLAttributes;

		// === インラインテキストセマンティクス ===

		/**
		 * ハイパーリンク
		 * @property href - リンク先URL
		 * @property target - リンクを開く場所（_blank, _self など）
		 * @property rel - リンクの関係性（noopener, noreferrer など）
		 */
		a: HTMLAttributes & { href?: string; target?: string; rel?: string };

		/** 強調（視覚的に太字） */
		strong: HTMLAttributes;

		/** 強調（視覚的に斜体） */
		em: HTMLAttributes;

		/** 小さいテキスト */
		small: HTMLAttributes;

		/** 打ち消し線 */
		s: HTMLAttributes;

		/** 下線 */
		u: HTMLAttributes;

		/** 改行 */
		br: HTMLAttributes;

		// === 画像・メディア ===

		/**
		 * 画像
		 * @property src - 画像ファイルのURL
		 * @property alt - 代替テキスト（アクセシビリティ上必須）
		 * @property width - 幅
		 * @property height - 高さ
		 */
		img: HTMLAttributes & { src?: string; alt?: string; width?: string | number; height?: string | number };

		/**
		 * 動画
		 * @property src - 動画ファイルのURL
		 * @property controls - コントロールバーの表示
		 * @property autoplay - 自動再生
		 * @property loop - ループ再生
		 */
		video: HTMLAttributes & { src?: string; controls?: boolean; autoplay?: boolean; loop?: boolean };

		/**
		 * 音声
		 * @property src - 音声ファイルのURL
		 * @property controls - コントロールバーの表示
		 * @property autoplay - 自動再生
		 * @property loop - ループ再生
		 */
		audio: HTMLAttributes & { src?: string; controls?: boolean; autoplay?: boolean; loop?: boolean };

		// === フォーム要素 ===

		/**
		 * フォーム
		 * @property action - 送信先URL
		 * @property method - 送信方式（GET | POST）
		 */
		form: HTMLAttributes & { action?: string; method?: string };

		/** 入力欄 */
		input: HTMLAttributes;

		/**
		 * 複数行テキスト入力
		 * @property rows - 行数
		 * @property cols - 列数
		 */
		textarea: HTMLAttributes & { rows?: number; cols?: number };

		/**
		 * ボタン
		 * @property type - ボタンの種類（button | submit | reset）
		 */
		button: HTMLAttributes & { type?: "button" | "submit" | "reset" };

		/**
		 * 選択リスト
		 * @property multiple - 複数選択を許可
		 */
		select: HTMLAttributes & { multiple?: boolean };

		/**
		 * 選択リストの項目
		 * @property value - 送信される値
		 * @property selected - 初期選択状態
		 */
		option: HTMLAttributes & { value?: string; selected?: boolean };

		/**
		 * ラベル（フォーム要素の説明）
		 * @property htmlFor - 関連付けるフォーム要素のid
		 */
		label: HTMLAttributes & { htmlFor?: string };

		// === テーブル ===

		/** テーブル */
		table: HTMLAttributes;

		/** テーブルヘッダー行グループ */
		thead: HTMLAttributes;

		/** テーブルボディ行グループ */
		tbody: HTMLAttributes;

		/** テーブルフッター行グループ */
		tfoot: HTMLAttributes;

		/** テーブル行 */
		tr: HTMLAttributes;

		/** テーブルヘッダーセル */
		th: HTMLAttributes;

		/** テーブルデータセル */
		td: HTMLAttributes;

		// === Web Components / カスタム要素 ===

		/**
		 * 未定義のタグも許容（Web Components、カスタム要素用）
		 * 柔軟性重視のため存在する。
		 */
		[elemName: string]: HTMLAttributes;
	}

	/**
	 * JSX式が返す要素の型
	 */
	type Element = import("./jsx-node").JSXNode;
}

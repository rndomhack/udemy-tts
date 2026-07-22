# Udemy TTS

Udemy の講義字幕を LLM で翻訳し、Microsoft Edge TTS で音声合成してリアルタイムに読み上げるブラウザ拡張機能。**Firefox / Chrome 両対応 (Manifest V3、Firefox 主対応)**。

## 特徴

- **マルチ LLM 対応**: Google Gemini / OpenAI / OpenRouter / OpenAI 互換エンドポイント、および Chrome・Edge 内蔵の無料機械翻訳。低料金・高速モデルのみをプリセット表示し、プロバイダごとに API キーを保存
- **翻訳者パーソナリティ**: 標準・簡潔・フレンドリーのプリセットに加え、自由記述のカスタム指示にも対応
- **正確な翻訳マッピング**: インデックス付き JSON + 構造化出力。欠落検出時はチャンク全体をリトライし、最終的に原文フォールバック(再生は止めない)
- **翻訳キャッシュ**: 講義ごとに IndexedDB へ保存。設定画面でコース別に確認・削除・全削除
- **音声合成プロバイダ**: Edge TTS (既定) と VOICEVOX (日本語専用、ローカルエンジン) を選択可能
- **自動速度調整**: グローバルな再生レートを一定間隔で再計算し、1 tick あたり小さな上限内で滑らかに変化。先読みウィンドウ + 講義末デッドラインで「最後には確実に間に合う」ことを保証
- **一時停止・再開**: 動画停止で音声も停止し、再開時はその地点から続き。イヤホンのメディアキーが音声だけを止めた場合は watchdog が自動復帰
- **発音の読み替え**: ユーザー定義辞書 + LLM が講義ごとに生成する発音マップ(Edge TTS は SSML `<phoneme>` 非対応のためテキスト置換方式)
- **字幕オーバーレイ**: 翻訳結果 (または翻訳 OFF 時は原文) を動画上に表示。TTS と独立に ON/OFF でき、位置はドラッグで調整可能
- **セットアップガイド同梱**: 各プロバイダの API キー取得・課金設定の手順を拡張内のページとして同梱
- **多言語 UI**: 34 言語 (詳細は [locales/](locales/) を参照)

## インストール (開発ビルド)

```sh
npm install
npm run build:firefox   # → .output/firefox-mv3
npm run build           # → .output/chrome-mv3
```

- **Firefox**: `about:debugging` → 「一時的なアドオンを読み込む」→ `.output/firefox-mv3/manifest.json`。
- **Chrome**: `chrome://extensions` → デベロッパーモード → 「パッケージ化されていない拡張機能を読み込む」→ `.output/chrome-mv3`。

## 使い方

1. ツールバーの拡張アイコン → 設定ページで LLM プロバイダと API キーを設定し「接続テスト」
2. Udemy の講義ページを開くと、プレイヤーのコントロールバーに TTS ボタンが追加される
3. パネルから ON/OFF、音量、基準速度、自動速度、翻訳を切り替え

## 開発

```sh
npm run dev:firefox   # HMR 付き開発 (Firefox)
npm run dev           # HMR 付き開発 (Chrome)
npm test              # ユニットテスト (Vitest)
npm run compile       # 型チェック (tsc + svelte-check)
```

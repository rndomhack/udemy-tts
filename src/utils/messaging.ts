import { browser } from '#imports';
import type { ExtensionMessage } from '../lib/types';

// コンテキスト間のメッセージ送受信

export function sendMessage<T>(message: ExtensionMessage): Promise<T> {
  return browser.runtime.sendMessage(message) as Promise<T>;
}

export type MessageHandler = (message: never) => Promise<unknown>;

export function registerMessageRouter(
  route: (message: ExtensionMessage) => (() => Promise<unknown>) | undefined,
  onError: (error: unknown, message: ExtensionMessage) => unknown,
): void {
  browser.runtime.onMessage.addListener(
    (message: unknown, _sender: unknown, sendResponse: (response: unknown) => void) => {
      const msg = message as ExtensionMessage;
      const handler = route(msg);
      // 扱わないメッセージは他のリスナーに委ねる
      if (!handler) return undefined;
      handler().then(sendResponse, (e) => sendResponse(onError(e, msg)));
      // 非同期に応答するため sendResponse を使い true を返す (Promise を返しても応答にならない環境があるため)
      return true;
    },
  );
}

import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-svelte', '@wxt-dev/i18n/module'],
  zip: {
    excludeSources: ['docs/**', 'tmp/**'],
  },
  webExt: {
    firefoxPref: {
      'extensions.originControls.grantByDefault': true,
    },
  },
  manifest: ({ browser }) => ({
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    action: {},
    permissions: [
      'storage',
      ...(browser === 'firefox'
        ? ['webRequest', 'webRequestBlocking']
        : ['declarativeNetRequest', 'offscreen']),
    ],
    host_permissions: [
      'https://*.udemy.com/*',
      'https://*.udemycdn.com/*',
      'https://generativelanguage.googleapis.com/*',
      'https://api.openai.com/*',
      'https://openrouter.ai/*',
      'https://speech.platform.bing.com/*',
      'wss://speech.platform.bing.com/*',
    ],
    ...(browser === 'firefox'
      ? { optional_permissions: ['<all_urls>'] }
      : { optional_host_permissions: ['<all_urls>'] }),
    ...(browser !== 'firefox' && {
      minimum_chrome_version: '116',
    }),
    browser_specific_settings: {
      gecko: {
        id: 'udemy-tts@rndomhack',
        strict_min_version: '142.0',
        data_collection_permissions: {
          required: ['none'],
        },
      },
    },
  }),
});

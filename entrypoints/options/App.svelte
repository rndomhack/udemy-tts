<script lang="ts">
  import { onMount } from 'svelte';
  import { i18n } from '#i18n';
  import AdvancedSection from '../../src/options/components/AdvancedSection.svelte';
  import CacheSection from '../../src/options/components/CacheSection.svelte';
  import DictionarySection from '../../src/options/components/DictionarySection.svelte';
  import GeneralSection from '../../src/options/components/GeneralSection.svelte';
  import LanguageSection from '../../src/options/components/LanguageSection.svelte';
  import ProviderSection from '../../src/options/components/ProviderSection.svelte';
  import SpeechSection from '../../src/options/components/SpeechSection.svelte';
  import SubtitleSection from '../../src/options/components/SubtitleSection.svelte';
  import TranslationSection from '../../src/options/components/TranslationSection.svelte';
  import { initSettings, settings } from '../../src/options/stores';

  type Tab = 'general' | 'speech' | 'translation' | 'subtitle' | 'dictionary' | 'advanced';
  let tab = $state<Tab>('general');

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'general', label: i18n.t('options.tabs.general') },
    { id: 'speech', label: i18n.t('options.tabs.speech') },
    { id: 'translation', label: i18n.t('options.tabs.translation') },
    { id: 'subtitle', label: i18n.t('options.tabs.subtitle') },
    { id: 'dictionary', label: i18n.t('options.tabs.dictionary') },
    { id: 'advanced', label: i18n.t('options.tabs.advanced') },
  ];

  onMount(() => {
    document.title = i18n.t('options.title');
    void initSettings();
  });
</script>

<div class="layout">
  <header>
    <img class="app-icon" src="/icon-48.png" alt="" width="28" height="28" />
    <h1>{i18n.t('options.title')}</h1>
  </header>
  <div class="body">
    <nav>
      {#each tabs as t (t.id)}
        <button type="button" class:active={tab === t.id} onclick={() => (tab = t.id)}>
          {t.label}
        </button>
      {/each}
    </nav>
    <main>
      {#if $settings}
        {#if tab === 'general'}
          <GeneralSection />
          <LanguageSection />
        {:else if tab === 'speech'}
          <SpeechSection />
        {:else if tab === 'translation'}
          <TranslationSection />
          <ProviderSection />
          <CacheSection />
        {:else if tab === 'subtitle'}
          <SubtitleSection />
        {:else if tab === 'dictionary'}
          <DictionarySection />
        {:else}
          <AdvancedSection />
        {/if}
      {/if}
    </main>
  </div>
</div>

<style>
  :global(:root) {
    --bg: #f7f7f8;
    --card: #ffffff;
    --border: #e5e5e5;
    --border-soft: #f0f0f0;
    --text: #1c1c1e;
    --muted: #555;
    --muted-2: #777;
    --hint: #808085;
    --accent: #6d28d9;
    --accent-hover: #5b21b6;
    --danger: #b91c1c;
    --danger-border: #ecc5c5;
    --danger-bg-hover: #fef2f2;
    --input-border: #d4d4d8;
    --hover: #ececee;
    --active: #e4e4e7;
    --ok: #15803d;
    color-scheme: light;
  }
  @media (prefers-color-scheme: dark) {
    :global(:root) {
      --bg: #1c1d1f;
      --card: #26272b;
      --border: #3b3c40;
      --border-soft: #333438;
      --text: #ececee;
      --muted: #b4b4b9;
      --muted-2: #99999f;
      --hint: #8e8e94;
      --accent: #8b5cf6;
      --accent-hover: #7c3aed;
      --danger: #f87171;
      --danger-border: #7f1d1d;
      --danger-bg-hover: #3b1d1d;
      --input-border: #4a4b50;
      --hover: #2e2f33;
      --active: #3a3b40;
      --ok: #4ade80;
      color-scheme: dark;
    }
  }

  :global(*) {
    box-sizing: border-box;
  }
  :global(body) {
    margin: 0;
    font-family:
      system-ui,
      -apple-system,
      'Segoe UI',
      'Hiragino Sans',
      'Noto Sans JP',
      sans-serif;
    background: var(--bg);
    color: var(--text);
    font-size: 16px;
  }
  .layout {
    max-width: 940px;
    margin: 0 auto;
    padding: 0 20px 60px;
  }
  header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 24px 0 16px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 20px;
  }
  .app-icon {
    display: block;
    flex-shrink: 0;
  }
  @media (prefers-color-scheme: dark) {
    .app-icon {
      filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.9));
    }
  }
  h1 {
    font-size: 24px;
    margin: 0;
    font-weight: 700;
  }
  .body {
    display: flex;
    gap: 24px;
    align-items: flex-start;
  }
  nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 165px;
    flex-shrink: 0;
    position: sticky;
    top: 20px;
  }
  nav button {
    text-align: left;
    padding: 11px 15px;
    border: none;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    color: var(--muted);
  }
  nav button:hover {
    background: var(--hover);
  }
  nav button.active {
    background: var(--active);
    font-weight: 600;
    color: var(--text);
  }
  main {
    flex: 1;
    min-width: 0;
  }

  main :global(section) {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 22px 26px;
    margin-bottom: 20px;
  }
  main :global(h2) {
    font-size: 19px;
    margin: 0 0 15px;
    font-weight: 600;
  }
  main :global(.field) {
    display: block;
    margin-bottom: 16px;
  }
  main :global(.field > span) {
    display: block;
    font-size: 15px;
    color: var(--muted);
    margin-bottom: 4px;
  }
  main :global(.field.checkbox) {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  main :global(.field.checkbox span) {
    margin: 0;
    font-size: 16px;
    color: inherit;
  }
  main :global(.inline) {
    display: flex;
    gap: 8px;
  }
  main :global(.inline input) {
    flex: 1;
  }
  main :global(input[type='text']),
  main :global(input[type='password']),
  main :global(input[type='url']),
  main :global(textarea),
  main :global(select) {
    width: 100%;
    padding: 10px 13px;
    border: 1px solid var(--input-border);
    border-radius: 6px;
    font-size: 15px;
    background: var(--card);
    color: inherit;
  }
  main :global(.inline input),
  main :global(.inline select) {
    width: auto;
  }
  main :global(textarea) {
    font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
    resize: vertical;
  }
  main :global(input[type='range']) {
    width: 100%;
    accent-color: var(--accent);
  }
  main :global(input[type='checkbox']) {
    accent-color: var(--accent);
    width: 19px;
    height: 19px;
  }
  main :global(button) {
    padding: 10px 15px;
    border: 1px solid var(--input-border);
    border-radius: 6px;
    background: var(--card);
    cursor: pointer;
    font-size: 15px;
    color: inherit;
    white-space: nowrap;
  }
  main :global(button:hover:not(:disabled)) {
    background: var(--hover);
  }
  main :global(button:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }
  main :global(button.primary) {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
  main :global(button.primary:hover:not(:disabled)) {
    background: var(--accent-hover);
  }
  main :global(button.danger) {
    color: var(--danger);
    border-color: var(--danger-border);
  }
  main :global(button.danger:hover:not(:disabled)) {
    background: var(--danger-bg-hover);
  }
  main :global(small) {
    display: block;
    color: var(--hint);
    font-size: 15px;
    margin-top: 4px;
    line-height: 1.5;
  }

  @media (max-width: 640px) {
    .layout {
      padding: 0 12px 40px;
    }
    .body {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }
    nav {
      position: static;
      flex-direction: row;
      width: 100%;
      overflow-x: auto;
      padding-bottom: 4px;
    }
    nav button {
      white-space: nowrap;
      flex-shrink: 0;
    }
    main {
      width: 100%;
    }
    main :global(section) {
      padding: 14px;
    }
  }
</style>

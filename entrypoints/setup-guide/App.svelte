<script lang="ts">
  import { onMount } from 'svelte';
  import { i18n } from '#i18n';
  import { MODEL_PRESETS } from '../../src/lib/constants';

  type MsgKey = Parameters<typeof i18n.t>[0];

  type GuideProviderId = 'gemini' | 'openai' | 'openrouter';

  const providers: Array<{
    id: GuideProviderId;
    name: string;
    keyUrl: string;
    keyUrlLabel: string;
    keyImages: string[];
    billingUrl: string;
    billingUrlLabel: string;
    billingImages: string[];
    limitUrl: string | null;
    limitUrlLabel: string | null;
    limitImages: string[];
  }> = [
    {
      id: 'gemini',
      name: 'Google AI Studio (Gemini)',
      keyUrl: 'https://aistudio.google.com/apikey',
      keyUrlLabel: 'aistudio.google.com/apikey',
      keyImages: ['/guide/gemini.avif', '/guide/gemini-create.avif', '/guide/gemini-created.avif'],
      billingUrl: 'https://aistudio.google.com/billing',
      billingUrlLabel: 'aistudio.google.com/billing',
      billingImages: ['/guide/gemini-billing.avif', '/guide/gemini-billing-paid.avif'],
      limitUrl: 'https://aistudio.google.com/spend',
      limitUrlLabel: 'aistudio.google.com/spend',
      limitImages: ['/guide/gemini-limit.avif', '/guide/gemini-limit-edit.avif'],
    },
    {
      id: 'openai',
      name: 'OpenAI (ChatGPT)',
      keyUrl: 'https://platform.openai.com/api-keys',
      keyUrlLabel: 'platform.openai.com/api-keys',
      keyImages: ['/guide/openai.avif', '/guide/openai-create.avif', '/guide/openai-created.avif'],
      billingUrl: 'https://platform.openai.com/settings/organization/billing/overview',
      billingUrlLabel: 'platform.openai.com/settings/organization/billing/overview',
      billingImages: [
        '/guide/openai-billing.avif',
        '/guide/openai-payment.avif',
        '/guide/openai-billing-paid.avif',
        '/guide/openai-buy.avif',
      ],
      limitUrl: 'https://platform.openai.com/settings/organization/limits',
      limitUrlLabel: 'platform.openai.com/settings/organization/limits',
      limitImages: ['/guide/openai-limit.avif'],
    },
    {
      id: 'openrouter',
      name: 'OpenRouter',
      keyUrl: 'https://openrouter.ai/settings/keys',
      keyUrlLabel: 'openrouter.ai/settings/keys',
      keyImages: [
        '/guide/openrouter.avif',
        '/guide/openrouter-create.avif',
        '/guide/openrouter-created.avif',
      ],
      billingUrl: 'https://openrouter.ai/settings/credits',
      billingUrlLabel: 'openrouter.ai/settings/credits',
      billingImages: ['/guide/openrouter-credits.avif', '/guide/openrouter-buy.avif'],
      limitUrl: null,
      limitUrlLabel: null,
      limitImages: ['/guide/openrouter-limit.avif', '/guide/openrouter-limit-list.avif'],
    },
  ];

  const ids = providers.map((p) => p.id);
  let active = $state<GuideProviderId>('gemini');

  function selectTab(id: GuideProviderId, event: MouseEvent) {
    event.preventDefault();
    active = id;
    history.replaceState(null, '', `#${id}`);
  }

  onMount(() => {
    document.title = i18n.t('guide.title');
    const id = location.hash.slice(1) as GuideProviderId;
    if (ids.includes(id)) active = id;
  });
</script>

<div class="layout">
  <header>
    <img class="app-icon" src="/icon-48.png" alt="" width="30" height="30" />
    <h1>{i18n.t('guide.title')}</h1>
  </header>

  <p class="intro">{i18n.t('guide.intro')}</p>
  <p class="privacy">{i18n.t('guide.privacy')}</p>
  <p class="disclaimer">{i18n.t('guide.disclaimer')}</p>

  <nav>
    {#each providers as p (p.id)}
      <a href={`#${p.id}`} class:active={active === p.id} onclick={(e) => selectTab(p.id, e)}>
        {p.name}
      </a>
    {/each}
  </nav>

  <main>
    {#each providers as p (p.id)}
      {#if active === p.id}
        <section id={p.id}>
          <h2>{p.name}</h2>
          <p class="tagline">{i18n.t(`guide.${p.id}.tagline` as MsgKey)}</p>

          <h3>{i18n.t('guide.modelsHeading')}</h3>
          <p class="detail">{i18n.t('guide.modelsHint')}</p>
          <ul class="models">
            {#each MODEL_PRESETS[p.id] as preset (preset.id)}
              <li>
                <span class="model-name">{preset.label}</span>
                <code>{preset.id}</code>
                <span class="model-note">{i18n.t(`guide.models.${preset.noteKey}` as MsgKey)}</span>
              </li>
            {/each}
          </ul>

          <h3>{i18n.t('guide.keyHeading')}</h3>
          <p class="url">
            <a href={p.keyUrl} target="_blank" rel="noopener noreferrer">{p.keyUrlLabel}</a>
          </p>
          <ol>
            <li>{i18n.t(`guide.${p.id}.step1` as MsgKey)}</li>
            <li>{i18n.t(`guide.${p.id}.step2` as MsgKey)}</li>
            <li>{i18n.t(`guide.${p.id}.step3` as MsgKey)}</li>
            <li>{i18n.t('guide.commonStep')}</li>
          </ol>
          {#each p.keyImages as src (src)}
            <img class="screenshot" {src} alt="" loading="lazy" />
          {/each}
          <small>{i18n.t(`guide.${p.id}.note` as MsgKey)}</small>

          <h3>{i18n.t('guide.billingHeading')}</h3>
          <p class="url">
            <a href={p.billingUrl} target="_blank" rel="noopener noreferrer">{p.billingUrlLabel}</a>
          </p>
          <p class="detail">{i18n.t(`guide.${p.id}.billing` as MsgKey)}</p>
          {#each p.billingImages as src (src)}
            <img class="screenshot" {src} alt="" loading="lazy" />
          {/each}

          <h3>{i18n.t('guide.limitHeading')}</h3>
          {#if p.limitUrl}
            <p class="url">
              <a href={p.limitUrl} target="_blank" rel="noopener noreferrer">{p.limitUrlLabel}</a>
            </p>
          {/if}
          <p class="detail">{i18n.t(`guide.${p.id}.limit` as MsgKey)}</p>
          {#each p.limitImages as src (src)}
            <img class="screenshot" {src} alt="" loading="lazy" />
          {/each}
        </section>
      {/if}
    {/each}
  </main>
</div>

<style>
  :global(:root) {
    --bg: #f7f7f8;
    --card: #ffffff;
    --border: #e5e5e5;
    --text: #1c1c1e;
    --muted: #555;
    --hint: #808085;
    --accent: #6d28d9;
    --accent-hover: #5b21b6;
    --input-border: #d4d4d8;
    --hover: #ececee;
    --danger: #b91c1c;
    color-scheme: light;
  }
  @media (prefers-color-scheme: dark) {
    :global(:root) {
      --bg: #1c1d1f;
      --card: #26272b;
      --border: #3b3c40;
      --text: #ececee;
      --muted: #b4b4b9;
      --hint: #8e8e94;
      --accent: #8b5cf6;
      --accent-hover: #7c3aed;
      --input-border: #4a4b50;
      --hover: #2e2f33;
      --danger: #f87171;
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
    line-height: 1.6;
  }
  .layout {
    max-width: 790px;
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
  .intro {
    margin: 0 0 8px;
  }
  .privacy {
    margin: 0 0 6px;
    color: var(--hint);
    font-size: 15px;
  }
  .disclaimer {
    margin: 0 0 16px;
    color: var(--danger);
    font-size: 15px;
    font-weight: 600;
  }
  nav {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }
  nav a {
    padding: 8px 15px;
    border: 1px solid var(--input-border);
    border-radius: 999px;
    background: var(--card);
    color: inherit;
    text-decoration: none;
    font-size: 15px;
  }
  nav a:hover {
    background: var(--hover);
  }
  section {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 22px 26px;
    margin-bottom: 20px;
    scroll-margin-top: 16px;
  }
  h2 {
    font-size: 19px;
    margin: 0 0 6px;
    font-weight: 600;
  }
  .tagline {
    margin: 0 0 10px;
    color: var(--muted);
    font-size: 15px;
  }
  h3 {
    font-size: 17px;
    margin: 20px 0 6px;
    font-weight: 600;
  }
  .detail {
    margin: 0 0 10px;
    font-size: 15px;
    color: var(--muted);
  }
  .url {
    margin: 0 0 8px;
    word-break: break-all;
  }
  ol,
  ul {
    margin: 0 0 14px;
    padding-left: 24px;
  }
  ol li,
  ul li {
    margin-bottom: 6px;
  }
  ul.models {
    list-style: none;
    padding-left: 0;
  }
  ul.models li {
    padding: 10px 14px;
    margin-bottom: 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
  }
  .model-name {
    font-weight: 600;
    margin-right: 8px;
  }
  .model-note {
    display: block;
    margin-top: 4px;
    font-size: 14px;
    color: var(--muted);
  }
  code {
    font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
    font-size: 13px;
    color: var(--hint);
    background: var(--hover);
    border-radius: 4px;
    padding: 1px 6px;
  }
  section a {
    color: var(--accent);
    word-break: break-all;
  }
  .screenshot {
    display: block;
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 6px;
    margin-bottom: 10px;
  }
  small {
    display: block;
    color: var(--hint);
    font-size: 15px;
    line-height: 1.5;
  }

  @media (max-width: 640px) {
    .layout {
      padding: 0 12px 40px;
    }
    section {
      padding: 14px;
    }
  }
</style>

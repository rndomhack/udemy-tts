<script lang="ts">
  import { i18n } from '#i18n';
  import { browser } from '#imports';
  import { MODEL_PRESETS } from '../../lib/constants';
  import { originPattern } from '../../lib/host-pattern';
  import type { ProviderId, TestProviderResponse } from '../../lib/types';
  import { sendMessage } from '../../utils/messaging';
  import { settings, updateProvider, updateSettings } from '../stores';

  type MsgKey = Parameters<typeof i18n.t>[0];

  const providerIds: ProviderId[] = import.meta.env.FIREFOX
    ? ['gemini', 'openai', 'openrouter', 'openai-compatible']
    : ['gemini', 'openai', 'openrouter', 'openai-compatible', 'device'];
  const providerLabels: Record<ProviderId, string> = {
    gemini: 'Google AI Studio (Gemini)',
    openai: 'OpenAI (ChatGPT)',
    openrouter: 'OpenRouter',
    'openai-compatible': i18n.t('options.provider.labelCompatible'),
    device: i18n.t('options.provider.labelDevice'),
  };

  let showKey = $state(false);
  let testState = $state<'idle' | 'testing' | 'ok' | 'error'>('idle');
  let testError = $state('');

  const active = $derived($settings?.activeProvider ?? 'gemini');
  const config = $derived($settings?.providers[active]);
  const isDevice = $derived(active === 'device');
  const presets = $derived(
    active === 'openai-compatible' || active === 'device' ? null : MODEL_PRESETS[active],
  );

  function grantPermission() {
    const origin = originPattern($settings?.providers['openai-compatible']?.baseUrl ?? '');
    if (origin) void browser.permissions.request({ origins: [origin] });
  }

  async function test() {
    testState = 'testing';
    testError = '';
    await new Promise((r) => setTimeout(r, 400));
    try {
      const res = await sendMessage<TestProviderResponse>({ type: 'TEST_PROVIDER' });
      if (res.success) {
        testState = 'ok';
      } else {
        testState = 'error';
        testError =
          res.errorCode === 'no-key'
            ? i18n.t('options.provider.errNoKey')
            : res.errorCode === 'no-model'
              ? i18n.t('options.provider.errNoModel')
              : (res.error ?? 'unknown error');
      }
    } catch (e) {
      testState = 'error';
      testError = e instanceof Error ? e.message : String(e);
    }
  }
</script>

{#if $settings && config}
  <section>
    <h2>{i18n.t('options.provider.heading')}</h2>

    {#if !isDevice}
      <p class="guide-link">
        <a
          href={`${browser.runtime.getURL('/setup-guide.html')}${active !== 'openai-compatible' ? `#${active}` : ''}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          📖 {i18n.t('guide.optionsLink')} ↗
        </a>
      </p>
    {/if}

    <label class="field">
      <span>{i18n.t('options.provider.provider')}</span>
      <select
        value={active}
        onchange={(e) => {
          testState = 'idle';
          updateSettings({ activeProvider: e.currentTarget.value as ProviderId });
        }}
      >
        {#each providerIds as id}
          <option value={id}>{providerLabels[id]}</option>
        {/each}
      </select>
    </label>

    {#if isDevice}
      <p class="device-hint">{i18n.t('options.provider.deviceHint')}</p>
    {/if}

    {#if active === 'openai-compatible'}
      <label class="field">
        <span>{i18n.t('options.provider.baseUrl')}</span>
        <div class="inline">
          <input
            type="url"
            placeholder="https://api.groq.com/openai/v1"
            value={config.baseUrl ?? ''}
            oninput={(e) => updateProvider(active, { baseUrl: e.currentTarget.value })}
          />
          <button type="button" onclick={grantPermission}>
            {i18n.t('options.provider.grantPermission')}
          </button>
        </div>
        <small>{i18n.t('options.provider.baseUrlHint')}</small>
      </label>
    {/if}

    {#if !isDevice}
      <label class="field">
        <span>{i18n.t('options.provider.apiKey')}</span>
        <div class="inline">
          <input
            type={showKey ? 'text' : 'password'}
            autocomplete="off"
            value={config.apiKey}
            oninput={(e) => updateProvider(active, { apiKey: e.currentTarget.value })}
          />
          <button type="button" onclick={() => (showKey = !showKey)}>
            {showKey ? i18n.t('options.provider.hide') : i18n.t('options.provider.show')}
          </button>
        </div>
      </label>

      <label class="field">
        <span>{i18n.t('options.provider.model')}</span>
        {#if presets}
          <select
            value={config.model}
            onchange={(e) => updateProvider(active, { model: e.currentTarget.value })}
          >
            {#each presets as preset}
              <option value={preset.id}>{preset.label}</option>
            {/each}
          </select>
        {:else}
          <input
            type="text"
            placeholder={i18n.t('options.provider.modelPlaceholder')}
            value={config.model}
            oninput={(e) => updateProvider(active, { model: e.currentTarget.value })}
          />
        {/if}
      </label>
    {/if}

    {#if active === 'openai-compatible'}
      <label class="field checkbox">
        <input
          type="checkbox"
          checked={config.useJsonSchema ?? false}
          onchange={(e) => updateProvider(active, { useJsonSchema: e.currentTarget.checked })}
        />
        <span>{i18n.t('options.provider.jsonSchema')}</span>
      </label>
      <small class="json-schema-hint">{i18n.t('options.provider.jsonSchemaHint')}</small>
    {/if}

    {#if active === 'openrouter'}
      <label class="field">
        <span>{i18n.t('options.provider.sort')}</span>
        <select
          value={config.sort ?? ''}
          onchange={(e) => updateProvider(active, { sort: e.currentTarget.value })}
        >
          <option value="">--</option>
          <option value="price">price</option>
          <option value="throughput">throughput</option>
          <option value="latency">latency</option>
        </select>
        <small>{i18n.t(`options.provider.sortDesc.${config.sort || 'none'}` as MsgKey)}</small>
      </label>
    {/if}

    {#if active === 'openrouter' || active === 'openai-compatible'}
      <label class="field">
        <span>{i18n.t('options.provider.extraBody')}</span>
        <textarea
          rows="3"
          spellcheck="false"
          placeholder={'{"temperature": 0.3}'}
          value={config.extraBody ?? ''}
          oninput={(e) => updateProvider(active, { extraBody: e.currentTarget.value })}
        ></textarea>
        <small>{i18n.t('options.provider.extraBodyHint')}</small>
      </label>
    {/if}

    <div class="test-row">
      <button type="button" class="primary" disabled={testState === 'testing'} onclick={test}>
        {testState === 'testing'
          ? i18n.t('options.provider.testing')
          : i18n.t('options.provider.test')}
      </button>
      <div class="test-result" class:ok={testState === 'ok'} class:err={testState === 'error'}>
        {#if testState === 'ok'}
          ✓ {i18n.t('options.provider.testOk')}
        {:else if testState === 'error'}
          ✗ {testError}
        {:else if testState === 'testing'}
          {i18n.t('options.provider.testing')}
        {/if}
      </div>
    </div>
  </section>
{/if}

<style>
  .guide-link {
    margin: 0 0 18px;
    font-size: 16px;
  }
  .guide-link a {
    color: var(--danger);
    font-weight: 600;
    text-decoration: none;
  }
  .guide-link a:hover {
    text-decoration: underline;
  }
  .device-hint {
    margin: 0 0 18px;
    color: var(--muted-2);
    line-height: 1.5;
  }
  .json-schema-hint {
    margin-top: 0;
    margin-bottom: 24px;
  }
  .test-row {
    display: flex;
    align-items: stretch;
    gap: 10px;
    margin-top: 26px;
  }
  .test-result {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    border: 1px dashed var(--input-border);
    border-radius: 6px;
    padding: 8px 12px;
    color: var(--muted-2);
    word-break: break-all;
    line-height: 1.4;
  }
  .test-result.ok {
    color: var(--ok);
    border-style: solid;
  }
  .test-result.err {
    color: var(--danger);
    border-style: solid;
    border-color: var(--danger-border);
  }
</style>

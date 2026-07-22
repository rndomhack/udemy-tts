<script lang="ts">
  import { onMount } from 'svelte';
  import { i18n } from '#i18n';
  import { browser } from '#imports';
  import type {
    AutoRateMode,
    EdgeVoice,
    GetVoicesResponse,
    TtsProviderId,
    VoicevoxConfig,
    VoicevoxSpeaker,
    VoicevoxSpeakersResponse,
  } from '../../lib/types';
  import { originPattern } from '../../lib/host-pattern';
  import { sendMessage } from '../../utils/messaging';
  import { settings, updateSettings } from '../stores';

  type MsgKey = Parameters<typeof i18n.t>[0];

  let voices = $state<EdgeVoice[]>([]);
  let voiceState = $state<'loading' | 'loaded' | 'error'>('loading');

  let speakers = $state<VoicevoxSpeaker[]>([]);
  let speakerState = $state<'idle' | 'loading' | 'loaded' | 'error'>('idle');

  const useVoicevox = $derived(
    $settings?.targetLanguage === 'ja' && $settings?.ttsProvider === 'voicevox',
  );

  const groupedVoices = $derived.by(() => {
    const groups = new Map<string, EdgeVoice[]>();
    for (const v of voices) {
      const list = groups.get(v.locale) ?? [];
      list.push(v);
      groups.set(v.locale, list);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  });

  async function loadVoices() {
    voiceState = 'loading';
    try {
      const res = await sendMessage<GetVoicesResponse>({ type: 'GET_VOICES' });
      voices = res.voices;
      voiceState = res.voices.length > 0 ? 'loaded' : 'error';
    } catch {
      voiceState = 'error';
    }
  }

  async function loadSpeakers() {
    speakerState = 'loading';
    try {
      const res = await sendMessage<VoicevoxSpeakersResponse>({ type: 'GET_VOICEVOX_SPEAKERS' });
      if (res.success && res.speakers?.length) {
        speakers = res.speakers;
        speakerState = 'loaded';
      } else {
        speakerState = 'error';
      }
    } catch {
      speakerState = 'error';
    }
  }

  function updateVoicevox(patch: Partial<VoicevoxConfig>) {
    const current = $settings?.voicevox;
    if (current) updateSettings({ voicevox: { ...current, ...patch } });
  }

  async function grantVoicevoxPermission() {
    const origin = originPattern($settings?.voicevox.baseUrl ?? '');
    if (!origin) return;
    const granted = await browser.permissions.request({ origins: [origin] });
    if (granted) void loadSpeakers();
  }

  $effect(() => {
    if (useVoicevox && speakerState === 'idle') void loadSpeakers();
  });

  onMount(loadVoices);
</script>

{#if $settings}
  <section>
    <h2>{i18n.t('options.speech.heading')}</h2>

    <label class="field checkbox">
      <input
        type="checkbox"
        checked={$settings.ttsEnabled}
        onchange={(e) => updateSettings({ ttsEnabled: e.currentTarget.checked })}
      />
      <span>{i18n.t('options.speech.enabled')}</span>
    </label>

    <label class="field checkbox auto-rate-toggle">
      <input
        type="checkbox"
        checked={$settings.autoRateAdjust}
        onchange={(e) => updateSettings({ autoRateAdjust: e.currentTarget.checked })}
      />
      <span>{i18n.t('options.speech.autoRate')}</span>
    </label>
    <small class="auto-rate-hint">{i18n.t('options.speech.autoRateHint')}</small>

    <label class="field">
      <span>{i18n.t('options.speech.autoRateMode')}</span>
      <select
        value={$settings.autoRateMode}
        disabled={!$settings.autoRateAdjust}
        onchange={(e) => updateSettings({ autoRateMode: e.currentTarget.value as AutoRateMode })}
      >
        <option value="natural">{i18n.t('options.speech.autoRateNatural')}</option>
        <option value="strong">{i18n.t('options.speech.autoRateStrong')}</option>
      </select>
      <small>{i18n.t(`options.speech.autoRateModeDesc.${$settings.autoRateMode}` as MsgKey)}</small>
    </label>
  </section>

  <section>
    <h2>{i18n.t('options.speech.ttsHeading')}</h2>

    {#if $settings.targetLanguage === 'ja'}
      <label class="field">
        <span>{i18n.t('options.speech.provider')}</span>
        <select
          value={$settings.ttsProvider}
          onchange={(e) => updateSettings({ ttsProvider: e.currentTarget.value as TtsProviderId })}
        >
          <option value="edge">{i18n.t('options.speech.providerStandard')}</option>
          <option value="voicevox">VOICEVOX</option>
        </select>
      </label>
    {/if}

    {#if useVoicevox}
      <p class="voicevox-hint">{i18n.t('options.speech.voicevoxHint')}</p>

      <label class="field">
        <span>{i18n.t('options.speech.voicevoxUrl')}</span>
        <div class="inline">
          <input
            type="text"
            value={$settings.voicevox.baseUrl}
            oninput={(e) => updateVoicevox({ baseUrl: e.currentTarget.value })}
          />
          <button type="button" onclick={grantVoicevoxPermission}>
            {i18n.t('options.provider.grantPermission')}
          </button>
        </div>
      </label>

      <label class="field">
        <span>{i18n.t('options.speech.voice')}</span>
        {#if speakerState === 'loaded'}
          <select
            value={$settings.voicevox.speaker}
            onchange={(e) => updateVoicevox({ speaker: Number(e.currentTarget.value) })}
          >
            {#each speakers as speaker}
              <option value={speaker.id}>{speaker.name}</option>
            {/each}
          </select>
        {:else}
          <div class="inline">
            <input
              type="number"
              value={$settings.voicevox.speaker}
              oninput={(e) => updateVoicevox({ speaker: Number(e.currentTarget.value) })}
            />
            <button type="button" onclick={loadSpeakers}>
              {speakerState === 'loading'
                ? i18n.t('options.speech.loading')
                : i18n.t('options.speech.loadVoices')}
            </button>
          </div>
          {#if speakerState === 'error'}
            <small class="err">{i18n.t('options.speech.loadFailed')}</small>
          {/if}
        {/if}
      </label>
    {:else}
      <label class="field">
        <span>{i18n.t('options.speech.voice')}</span>
        {#if voiceState === 'loaded'}
        <select
          value={$settings.ttsVoice}
          onchange={(e) => updateSettings({ ttsVoice: e.currentTarget.value })}
        >
          {#each groupedVoices as [locale, list]}
            <optgroup label={locale}>
              {#each list as voice}
                <option value={voice.shortName}>{voice.shortName} ({voice.gender})</option>
              {/each}
            </optgroup>
          {/each}
        </select>
      {:else}
        <div class="inline">
          <input
            type="text"
            value={$settings.ttsVoice}
            oninput={(e) => updateSettings({ ttsVoice: e.currentTarget.value })}
          />
          <button type="button" onclick={loadVoices}>
            {voiceState === 'loading'
              ? i18n.t('options.speech.loading')
              : i18n.t('options.speech.loadVoices')}
          </button>
        </div>
        {#if voiceState === 'error'}
          <small class="err">{i18n.t('options.speech.loadFailed')}</small>
        {/if}
      {/if}
      </label>
    {/if}

    <label class="field">
      <span>{i18n.t('options.speech.rate')}: {$settings.ttsRate.toFixed(1)}</span>
      <input
        type="range"
        min="0.5"
        max="2"
        step="0.1"
        value={$settings.ttsRate}
        oninput={(e) => updateSettings({ ttsRate: parseFloat(e.currentTarget.value) })}
      />
    </label>

    {#if !useVoicevox}
      <label class="field">
        <span>{i18n.t('options.speech.pitch')}: {$settings.ttsPitch.toFixed(1)}</span>
        <input
          type="range"
          min="0.5"
          max="1.5"
          step="0.1"
          value={$settings.ttsPitch}
          oninput={(e) => updateSettings({ ttsPitch: parseFloat(e.currentTarget.value) })}
        />
      </label>
    {/if}

    <label class="field">
      <span>{i18n.t('options.speech.volume')}: {Math.round($settings.ttsVolume * 100)}</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={$settings.ttsVolume}
        oninput={(e) => updateSettings({ ttsVolume: parseFloat(e.currentTarget.value) })}
      />
    </label>
  </section>
{/if}

<style>
  .err {
    color: var(--danger);
  }
  .voicevox-hint {
    margin: 0 0 18px;
    color: var(--muted-2);
    line-height: 1.5;
  }
  .auto-rate-toggle {
    margin-bottom: 4px;
  }
  .auto-rate-hint {
    margin-top: 0;
    margin-bottom: 24px;
  }
</style>

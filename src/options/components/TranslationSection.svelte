<script lang="ts">
  import { i18n } from '#i18n';
  import type { TranslatorPersonality } from '../../lib/types';
  import { settings, updateSettings } from '../stores';

  type MsgKey = Parameters<typeof i18n.t>[0];

  const personalities: Array<{ id: TranslatorPersonality; label: string }> = [
    { id: 'standard', label: i18n.t('options.translation.personalityStandard') },
    { id: 'concise', label: i18n.t('options.translation.personalityConcise') },
    { id: 'friendly', label: i18n.t('options.translation.personalityFriendly') },
    { id: 'custom', label: i18n.t('options.translation.personalityCustom') },
  ];
</script>

{#if $settings}
  <section>
    <h2>{i18n.t('options.translation.heading')}</h2>

    <label class="field checkbox">
      <input
        type="checkbox"
        checked={$settings.translateEnabled}
        onchange={(e) => updateSettings({ translateEnabled: e.currentTarget.checked })}
      />
      <span>{i18n.t('options.translation.translateEnabled')}</span>
    </label>

    <label class="field">
      <span>{i18n.t('options.translation.personality')}</span>
      <select
        value={$settings.translatorPersonality}
        onchange={(e) =>
          updateSettings({
            translatorPersonality: e.currentTarget.value as TranslatorPersonality,
          })}
      >
        {#each personalities as p}
          <option value={p.id}>{p.label}</option>
        {/each}
      </select>
      <small
        >{i18n.t(
          `options.translation.personalityDesc.${$settings.translatorPersonality}` as MsgKey,
        )}</small
      >
    </label>

    {#if $settings.translatorPersonality === 'custom'}
      <label class="field">
        <span>{i18n.t('options.translation.customPersonality')}</span>
        <textarea
          rows="3"
          placeholder={i18n.t('options.translation.customPersonalityPlaceholder')}
          value={$settings.customPersonality}
          oninput={(e) => updateSettings({ customPersonality: e.currentTarget.value })}
        ></textarea>
      </label>
    {/if}
  </section>
{/if}

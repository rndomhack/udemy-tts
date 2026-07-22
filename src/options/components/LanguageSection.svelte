<script lang="ts">
  import { i18n } from '#i18n';
  import { LANGUAGES, languageName } from '../../lib/constants';
  import { settings, updateSettings } from '../stores';

  const displayNames = (() => {
    try {
      return new Intl.DisplayNames(undefined, { type: 'language' });
    } catch {
      return null;
    }
  })();

  function langLabel(code: string): string {
    try {
      return displayNames?.of(code) ?? languageName(code);
    } catch {
      return languageName(code);
    }
  }
</script>

{#if $settings}
  <section>
    <h2>{i18n.t('options.language.heading')}</h2>

    <label class="field">
      <span>{i18n.t('options.language.target')}</span>
      <select
        value={$settings.targetLanguage}
        onchange={(e) => {
          const targetLanguage = e.currentTarget.value;
          updateSettings(
            targetLanguage !== 'ja' && $settings.ttsProvider === 'voicevox'
              ? { targetLanguage, ttsProvider: 'edge' }
              : { targetLanguage },
          );
        }}
      >
        {#each LANGUAGES as lang}
          <option value={lang.code}>{langLabel(lang.code)}</option>
        {/each}
      </select>
    </label>
  </section>
{/if}

<script lang="ts">
  import { i18n } from '#i18n';
  import type { LogLevel } from '../../lib/types';
  import { settings, updateSettings } from '../stores';

  const levels: LogLevel[] = ['error', 'warn', 'info', 'debug'];
</script>

{#if $settings}
  <section>
    <h2>{i18n.t('options.advanced.heading')}</h2>

    <label class="field">
      <span>{i18n.t('options.advanced.logLevel')}</span>
      <select
        value={$settings.logLevel}
        onchange={(e) => updateSettings({ logLevel: e.currentTarget.value as LogLevel })}
      >
        {#each levels as level}
          <option value={level}>{level}</option>
        {/each}
      </select>
    </label>
  </section>
{/if}

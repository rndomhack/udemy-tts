<script lang="ts">
  import { i18n } from '#i18n';
  import { settings, updateSettings } from '../stores';
</script>

{#if $settings}
  <section>
    <h2>{i18n.t('options.general.heading')}</h2>

    <label class="field checkbox">
      <input
        type="checkbox"
        checked={$settings.enabled}
        onchange={(e) => updateSettings({ enabled: e.currentTarget.checked })}
      />
      <span>{i18n.t('options.general.enableAll')}</span>
    </label>
  </section>
{/if}

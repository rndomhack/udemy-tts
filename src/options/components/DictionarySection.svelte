<script lang="ts">
  import { i18n } from '#i18n';
  import { settings, updateSettings } from '../stores';

  let newWord = $state('');
  let newReading = $state('');

  const entries = $derived(Object.entries($settings?.customWords ?? {}));

  function add() {
    const word = newWord.trim();
    const reading = newReading.trim();
    if (!word || !reading || !$settings) return;
    updateSettings({ customWords: { ...$settings.customWords, [word]: reading } });
    newWord = '';
    newReading = '';
  }

  function remove(word: string) {
    if (!$settings) return;
    const { [word]: _removed, ...rest } = $settings.customWords;
    updateSettings({ customWords: rest });
  }
</script>

{#if $settings}
  <section>
    <h2>{i18n.t('options.dictionary.heading')}</h2>
    <small>{i18n.t('options.dictionary.hint')}</small>

    <div class="add-row">
      <input
        type="text"
        placeholder={i18n.t('options.dictionary.word')}
        bind:value={newWord}
        onkeydown={(e) => e.key === 'Enter' && add()}
      />
      <input
        type="text"
        placeholder={i18n.t('options.dictionary.reading')}
        bind:value={newReading}
        onkeydown={(e) => e.key === 'Enter' && add()}
      />
      <button type="button" class="primary" onclick={add}>
        {i18n.t('options.dictionary.add')}
      </button>
    </div>

    {#if entries.length === 0}
      <p class="empty">{i18n.t('options.dictionary.empty')}</p>
    {:else}
      <table>
        <thead>
          <tr>
            <th>{i18n.t('options.dictionary.word')}</th>
            <th>{i18n.t('options.dictionary.reading')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each entries as [word, reading] (word)}
            <tr>
              <td>{word}</td>
              <td>{reading}</td>
              <td>
                <button type="button" class="danger" onclick={() => remove(word)}>
                  {i18n.t('options.dictionary.remove')}
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>
{/if}

<style>
  .add-row {
    display: flex;
    gap: 8px;
    margin: 14px 0;
  }
  .add-row input {
    flex: 1;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th,
  td {
    text-align: left;
    padding: 6px 8px;
    border-bottom: 1px solid var(--border);
  }
  th {
    color: var(--muted);
    font-weight: 600;
  }
  .empty {
    color: var(--hint);
    font-size: 13px;
  }
</style>

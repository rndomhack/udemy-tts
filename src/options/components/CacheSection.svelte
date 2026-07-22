<script lang="ts">
  import { onMount } from 'svelte';
  import { i18n } from '#i18n';
  import type { CacheSummary } from '../../lib/cache-schema';
  import type { CacheListResponse } from '../../lib/types';
  import { sendMessage } from '../../utils/messaging';

  let entries = $state<CacheSummary[]>([]);
  let loading = $state(false);

  interface CourseGroup {
    courseId: string;
    courseTitle: string;
    keys: string[];
    totalBytes: number;
  }

  const groups = $derived.by((): CourseGroup[] => {
    const map = new Map<string, CourseGroup>();
    for (const entry of entries) {
      let group = map.get(entry.courseId);
      if (!group) {
        group = {
          courseId: entry.courseId,
          courseTitle: entry.courseTitle || entry.courseId,
          keys: [],
          totalBytes: 0,
        };
        map.set(entry.courseId, group);
      }
      group.keys.push(entry.key);
      group.totalBytes += entry.byteSize;
    }
    return [...map.values()].sort((a, b) => a.courseTitle.localeCompare(b.courseTitle));
  });

  const totalBytes = $derived(entries.reduce((sum, e) => sum + e.byteSize, 0));

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  async function refresh() {
    loading = true;
    try {
      const res = await sendMessage<CacheListResponse>({ type: 'CACHE_LIST' });
      entries = res.entries;
    } finally {
      loading = false;
    }
  }

  async function deleteCourse(group: CourseGroup) {
    if (!confirm(i18n.t('options.cache.confirmDeleteCourse'))) return;
    await sendMessage({ type: 'CACHE_DELETE', keys: group.keys });
    await refresh();
  }

  async function clearAll() {
    if (!confirm(i18n.t('options.cache.confirmClearAll'))) return;
    await sendMessage({ type: 'CACHE_CLEAR' });
    await refresh();
  }

  onMount(refresh);
</script>

<section>
  <h2>{i18n.t('options.cache.heading')}</h2>
  <small>{i18n.t('options.cache.hint')}</small>

  <div class="toolbar">
    <button type="button" onclick={refresh} disabled={loading}>
      {i18n.t('options.cache.refresh')}
    </button>
    <span class="total">
      {i18n.t('options.cache.total')}: {formatBytes(totalBytes)}
    </span>
    <button
      type="button"
      class="danger"
      onclick={clearAll}
      disabled={entries.length === 0}
    >
      {i18n.t('options.cache.clearAll')}
    </button>
  </div>

  {#if entries.length === 0}
    <p class="empty">{i18n.t('options.cache.empty')}</p>
  {:else}
    <ul class="courses">
      {#each groups as group (group.courseId)}
        <li>
          <span class="course-title" title={group.courseId}>{group.courseTitle}</span>
          <span class="size">{formatBytes(group.totalBytes)}</span>
          <button type="button" class="danger small" onclick={() => deleteCourse(group)}>
            {i18n.t('options.cache.delete')}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 14px 0;
  }
  .total {
    font-size: 13px;
    color: var(--muted);
    margin-left: auto;
  }
  .courses {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--card);
  }
  .courses li {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    min-width: 0;
  }
  .courses li + li {
    border-top: 1px solid var(--border-soft);
  }
  .course-title {
    font-weight: 600;
    font-size: 14px;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .size {
    color: var(--muted-2);
    font-size: 12px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .empty {
    color: var(--hint);
    font-size: 13px;
  }
  button.small {
    font-size: 11px;
    padding: 3px 8px;
    flex-shrink: 0;
  }
</style>

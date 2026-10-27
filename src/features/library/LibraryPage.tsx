import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useServices } from '../../app/services-context';
import { FavoriteButton } from '../../components/FavoriteButton';
import { flash, LIBRARY_FLASH_KEY, promptFlashKey } from '../../components/flash';
import { categoryLabel, errorMessage, formatDateTime, plural } from '../../components/format';
import { btn, field, label } from '../../components/styles';
import { allTags, queryPrompts, type PromptSort } from '../../core/library/query';
import type { Prompt } from '../../core/schema/prompt';
import { TEMPLATE_CATEGORIES, type TemplateCategory } from '../../core/schema/template';

type Data = { prompts: Prompt[]; invalid: number } | { error: string };

const SORTS: { value: PromptSort; label: string }[] = [
  { value: 'updated', label: 'Last updated' },
  { value: 'created', label: 'Date created' },
  { value: 'lastUsed', label: 'Last used' },
  { value: 'title', label: 'Title (A–Z)' },
];

const selectClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900';

function snippet(text: string, max = 180): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

export function LibraryPage({ pageSize = 50 }: { pageSize?: number }) {
  const services = useServices();
  const navigate = useNavigate();
  const [token, setToken] = useState(0);
  const [data, setData] = useState<Data | null>(null);
  const [notice, setNotice] = useState(() => flash.peek(LIBRARY_FLASH_KEY));
  useEffect(() => flash.clear(LIBRARY_FLASH_KEY), []);

  useEffect(() => {
    let cancelled = false;
    services.prompts.list().then(
      (d) => !cancelled && setData(d),
      (e: unknown) => !cancelled && setData({ error: errorMessage(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [services, token]);
  const reload = () => setToken((t) => t + 1);

  const [text, setText] = useState('');
  const [category, setCategory] = useState<TemplateCategory | ''>('');
  const [tag, setTag] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sort, setSort] = useState<PromptSort>('updated');
  const [limit, setLimit] = useState(pageSize);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const query = useDeferredValue(text);

  const prompts = data && 'prompts' in data ? data.prompts : null;
  const results = useMemo(
    () =>
      prompts ? queryPrompts(prompts, { text: query, category, tag, favoritesOnly, sort }) : [],
    [prompts, query, category, tag, favoritesOnly, sort],
  );
  const tags = useMemo(() => (prompts ? allTags(prompts) : []), [prompts]);
  const filtering = text.trim() !== '' || category !== '' || tag !== '' || favoritesOnly;

  /** Filter setters also reset paging to the first page. */
  const withReset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setLimit(pageSize);
    };

  function clearFilters() {
    setText('');
    setCategory('');
    setTag('');
    setFavoritesOnly(false);
    setLimit(pageSize);
  }

  async function act(id: string, action: () => Promise<void>) {
    setBusyId(id);
    try {
      await action();
    } catch (e) {
      setNotice(`Something went wrong: ${errorMessage(e)}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 id="page-title" className="text-2xl font-semibold">
            Library
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Your saved prompts, stored in this browser.
          </p>
        </div>
        <Link to="/builder" className={btn.primary}>
          New prompt
        </Link>
      </header>

      {notice && (
        <p role="status" className="text-sm text-slate-700 dark:text-slate-300">
          {notice}
        </p>
      )}

      {data === null ? (
        <p role="status" className="text-slate-600 dark:text-slate-400">
          Loading prompts…
        </p>
      ) : 'error' in data ? (
        <div
          role="alert"
          className="space-y-2 rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950"
        >
          <p className="text-sm">Couldn't read your prompts: {data.error}</p>
          <button type="button" className={btn.secondary} onClick={reload}>
            Try again
          </button>
        </div>
      ) : (
        <>
          {data.invalid > 0 && (
            <p
              role="alert"
              className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950"
            >
              {plural(data.invalid, 'stored record')} couldn't be read and{' '}
              {data.invalid === 1 ? 'is' : 'are'} hidden. Nothing was deleted.
            </p>
          )}

          {data.prompts.length === 0 ? (
            <div className="space-y-3 rounded-lg border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
              <h2 className="text-lg font-semibold">No saved prompts yet</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Build a prompt and press Save to keep it here.
              </p>
              <Link to="/builder" className={btn.primary}>
                Open the Builder
              </Link>
            </div>
          ) : (
            <>
              <div role="search" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <div className="space-y-1 sm:col-span-2">
                  <label htmlFor="library-search" className={label}>
                    Search
                  </label>
                  <input
                    id="library-search"
                    type="search"
                    value={text}
                    onChange={(e) => withReset(setText)(e.target.value)}
                    placeholder="Title or text"
                    className={field}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="library-category" className={label}>
                    Category
                  </label>
                  <select
                    id="library-category"
                    value={category}
                    onChange={(e) =>
                      withReset(setCategory)(e.target.value as TemplateCategory | '')
                    }
                    className={selectClass}
                  >
                    <option value="">All</option>
                    {TEMPLATE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {categoryLabel(c)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="library-tag" className={label}>
                    Tag
                  </label>
                  <select
                    id="library-tag"
                    value={tag}
                    onChange={(e) => withReset(setTag)(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">All</option>
                    {tags.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="library-sort" className={label}>
                    Sort by
                  </label>
                  <select
                    id="library-sort"
                    value={sort}
                    onChange={(e) => setSort(e.target.value as PromptSort)}
                    className={selectClass}
                  >
                    {SORTS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 self-end pb-2 text-sm">
                  <input
                    type="checkbox"
                    checked={favoritesOnly}
                    onChange={(e) => withReset(setFavoritesOnly)(e.target.checked)}
                    className="size-4"
                  />
                  Favorites only
                </label>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-400" aria-live="polite">
                {filtering
                  ? `${plural(results.length, 'match')} of ${plural(data.prompts.length, 'prompt')}`
                  : plural(data.prompts.length, 'prompt')}
              </p>

              {results.length === 0 ? (
                <div className="space-y-2 rounded-lg border border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
                  <p className="text-sm">No prompts match these filters.</p>
                  <button type="button" className={btn.secondary} onClick={clearFilters}>
                    Clear filters
                  </button>
                </div>
              ) : (
                <ul className="space-y-3">
                  {results.slice(0, limit).map((p) => (
                    <li
                      key={p.id}
                      className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
                      data-testid="prompt-card"
                    >
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <h2 className="text-base font-semibold">
                            <Link to={`/prompts/${p.id}`} className="hover:underline">
                              {p.title}
                            </Link>
                          </h2>
                          <p className="mt-1 line-clamp-2 break-words text-sm text-slate-600 dark:text-slate-400">
                            {snippet(p.draft) || <em>Empty prompt</em>}
                          </p>
                          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                            <span>{categoryLabel(p.category)}</span>
                            <span>v{p.currentVersion}</span>
                            <span>
                              Updated{' '}
                              <time dateTime={p.updatedAt}>{formatDateTime(p.updatedAt)}</time>
                            </span>
                            {p.tags.map((t) => (
                              <span
                                key={t}
                                className="rounded bg-slate-100 px-1.5 dark:bg-slate-800"
                              >
                                #{t}
                              </span>
                            ))}
                          </p>
                        </div>
                        <FavoriteButton
                          favorite={p.favorite}
                          label={`Favorite: ${p.title}`}
                          disabled={busyId === p.id}
                          onToggle={() =>
                            void act(p.id, async () => {
                              await services.prompts.updateMeta(p.id, { favorite: !p.favorite });
                              reload();
                            })
                          }
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          to={`/prompts/${p.id}`}
                          className={btn.secondary}
                          aria-label={`Open ${p.title}`}
                        >
                          Open
                        </Link>
                        <button
                          type="button"
                          className={btn.secondary}
                          aria-label={`Duplicate ${p.title}`}
                          disabled={busyId === p.id}
                          onClick={() =>
                            void act(p.id, async () => {
                              const copy = await services.prompts.duplicate(p.id);
                              flash.set(
                                promptFlashKey(copy.id),
                                "Duplicated. You're editing the copy.",
                              );
                              void navigate(`/prompts/${copy.id}`);
                            })
                          }
                        >
                          Duplicate
                        </button>
                        <button
                          type="button"
                          className={btn.danger}
                          aria-label={`Delete ${p.title}`}
                          disabled={busyId === p.id}
                          onClick={() => setConfirmDelete(p.id)}
                        >
                          Delete
                        </button>
                      </div>
                      {confirmDelete === p.id && (
                        <div
                          role="alertdialog"
                          aria-labelledby={`confirm-${p.id}`}
                          className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950"
                        >
                          <p id={`confirm-${p.id}`} className="text-sm">
                            Delete “{p.title}” and its {plural(p.currentVersion, 'version')}? This
                            can't be undone.
                          </p>
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              className={btn.dangerSolid}
                              onClick={() =>
                                void act(p.id, async () => {
                                  setConfirmDelete(null);
                                  await services.prompts.remove(p.id);
                                  setNotice(`Deleted “${p.title}”.`);
                                  reload();
                                })
                              }
                            >
                              Delete prompt
                            </button>
                            <button
                              type="button"
                              className={btn.secondary}
                              onClick={() => setConfirmDelete(null)}
                              autoFocus
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {results.length > limit && (
                <button
                  type="button"
                  className={btn.secondary}
                  onClick={() => setLimit((l) => l + pageSize)}
                >
                  Show more ({plural(results.length - limit, 'more prompt')})
                </button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

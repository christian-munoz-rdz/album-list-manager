import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getLists, addChartAlbum, createList } from '../api/client';
import { parseImportFile, type ImportAlbum } from '../utils/importParser';
import type { List } from '../types';

interface ImportModalProps {
  onClose: () => void;
  /** When provided, pre-selects this list and locks the list-picker step to it */
  defaultListId?: string;
}

type Step = 'upload' | 'preview' | 'pick-list' | 'importing' | 'done';

export default function ImportModal({ onClose, defaultListId }: ImportModalProps) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>('upload');
  const [albums, setAlbums] = useState<ImportAlbum[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [targetListId, setTargetListId] = useState<string>(defaultListId ?? '');
  const [newListTitle, setNewListTitle] = useState('');
  const [listMode, setListMode] = useState<'pick' | 'create'>('pick');
  const [importError, setImportError] = useState<string | null>(null);

  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 });

  const { data: lists = [] } = useQuery<List[]>({
    queryKey: ['lists'],
    queryFn: getLists,
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // ---- file handling --------------------------------------------------------

  const processFile = useCallback((file: File) => {
    setParseError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseImportFile(file.name, text);
        if (parsed.length === 0) {
          setParseError('No albums found in this file. Check the format.');
          return;
        }
        setAlbums(parsed);
        setSelected(new Set(parsed.map((_, i) => i))); // select all by default
        setStep('preview');
      } catch (err) {
        setParseError(`Could not parse file: ${(err as Error).message}`);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  // ---- selection ------------------------------------------------------------

  const toggleOne = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === albums.length) setSelected(new Set());
    else setSelected(new Set(albums.map((_, i) => i)));
  };

  // ---- import ---------------------------------------------------------------

  const startImport = async () => {
    const toImport = albums.filter((_, i) => selected.has(i));
    if (toImport.length === 0) return;
    setImportError(null);

    let listId = targetListId;

    if (listMode === 'create') {
      if (!newListTitle.trim()) return;
      try {
        const newList = await createList({ title: newListTitle.trim() });
        queryClient.invalidateQueries({ queryKey: ['lists'] });
        listId = newList.id;
      } catch {
        setImportError('Failed to create list. Please try again.');
        return;
      }
    }

    if (!listId) {
      setImportError('Please select a list.');
      return;
    }

    setStep('importing');
    setProgress({ done: 0, total: toImport.length, failed: 0 });

    let failed = 0;
    for (let i = 0; i < toImport.length; i++) {
      const a = toImport[i];
      try {
        await addChartAlbum(
          listId,
          a.artist,
          a.title,
          '', // no lastfm_url for RYM imports
          null,
          0,
          0,
        );
      } catch {
        failed++;
      }
      setProgress({ done: i + 1, total: toImport.length, failed });
    }

    queryClient.invalidateQueries({ queryKey: ['lists'] });
    queryClient.invalidateQueries({ queryKey: ['list', listId] });
    setStep('done');
  };

  // ---- render ---------------------------------------------------------------

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget && step !== 'importing') onClose(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-800 shrink-0">
          <div>
            <h2 className="text-white font-semibold text-lg">Import Albums</h2>
            <p className="text-zinc-500 text-xs mt-0.5">
              {step === 'upload' && 'Drop a RYM JSON or CSV export'}
              {step === 'preview' && `${albums.length} albums parsed — select which to import`}
              {step === 'pick-list' && 'Choose a destination list'}
              {step === 'importing' && `Importing ${progress.done} / ${progress.total}…`}
              {step === 'done' && `Done! ${progress.total - progress.failed} added${progress.failed > 0 ? `, ${progress.failed} skipped` : ''}`}
            </p>
          </div>
          {step !== 'importing' && (
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-white transition-colors rounded-lg p-1 hover:bg-zinc-800"
              aria-label="Close"
            >
              <svg viewBox="0 0 20 20" className="w-5 h-5 fill-current" aria-hidden="true">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* STEP: upload */}
          {step === 'upload' && (
            <div className="p-6 space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                  isDragging ? 'border-spotify-green bg-spotify-green/5' : 'border-zinc-700 hover:border-zinc-500'
                }`}
              >
                <p className="text-zinc-300 font-medium mb-1">Drop your RYM export here</p>
                <p className="text-zinc-600 text-sm">or click to browse · .json and .csv supported</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,.csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
              {parseError && (
                <p className="text-red-400 text-sm text-center">{parseError}</p>
              )}
              <div className="bg-zinc-800/60 rounded-xl p-4 text-xs text-zinc-500 space-y-1">
                <p className="font-medium text-zinc-400 mb-1">Expected columns</p>
                <p>JSON: <span className="text-zinc-400">rank, title, artist, releaseDate, primaryGenres, rating</span></p>
                <p>CSV: <span className="text-zinc-400">Rank, Title, Artist, Release Date, Primary Genres, Rating</span></p>
              </div>
            </div>
          )}

          {/* STEP: preview */}
          {step === 'preview' && (
            <div className="flex flex-col">
              <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 shrink-0">
                <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selected.size === albums.length}
                    onChange={toggleAll}
                    className="accent-spotify-green w-4 h-4"
                  />
                  {selected.size === albums.length ? 'Deselect all' : `Select all (${albums.length})`}
                </label>
                <span className="text-zinc-600 text-xs">{selected.size} selected</span>
              </div>
              <div className="overflow-y-auto divide-y divide-zinc-800/60">
                {albums.map((a, idx) => (
                  <label
                    key={idx}
                    className="flex items-start gap-3 px-6 py-3 cursor-pointer hover:bg-zinc-800/40 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(idx)}
                      onChange={() => toggleOne(idx)}
                      className="accent-spotify-green w-4 h-4 mt-0.5 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        {a.rank > 0 && (
                          <span className="text-zinc-600 text-xs shrink-0">#{a.rank}</span>
                        )}
                        <p className="text-white text-sm font-medium truncate">{a.title}</p>
                        {a.rating && (
                          <span className="text-zinc-500 text-xs shrink-0">{a.rating.toFixed(2)}</span>
                        )}
                      </div>
                      <p className="text-zinc-500 text-xs truncate">{a.artist}</p>
                      {(a.primaryGenres || a.releaseDate) && (
                        <p className="text-zinc-700 text-xs truncate mt-0.5">
                          {[a.releaseDate, a.primaryGenres].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* STEP: pick-list */}
          {step === 'pick-list' && (
            <div className="p-6 space-y-4">
              {importError && (
                <p className="text-red-400 text-sm text-center">{importError}</p>
              )}
              {/* Tab switcher */}
              <div className="flex gap-2">
                <button
                  onClick={() => setListMode('pick')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    listMode === 'pick' ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Existing list
                </button>
                <button
                  onClick={() => setListMode('create')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    listMode === 'create' ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  New list
                </button>
              </div>

              {listMode === 'pick' ? (
                lists.length === 0 ? (
                  <p className="text-zinc-500 text-sm text-center py-4">
                    No lists yet.{' '}
                    <button onClick={() => setListMode('create')} className="text-spotify-green hover:underline">
                      Create one
                    </button>
                  </p>
                ) : (
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {lists.map((list) => (
                      <label
                        key={list.id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors ${
                          targetListId === list.id ? 'bg-zinc-700' : 'bg-zinc-800 hover:bg-zinc-700/70'
                        }`}
                      >
                        <input
                          type="radio"
                          name="list-pick"
                          value={list.id}
                          checked={targetListId === list.id}
                          onChange={() => setTargetListId(list.id)}
                          className="accent-spotify-green"
                        />
                        <div>
                          <p className="text-white text-sm font-medium">{list.title}</p>
                          {list.album_count !== undefined && (
                            <p className="text-zinc-500 text-xs">{list.album_count} album{list.album_count !== 1 ? 's' : ''}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )
              ) : (
                <input
                  type="text"
                  value={newListTitle}
                  onChange={(e) => setNewListTitle(e.target.value)}
                  placeholder="New list name…"
                  maxLength={120}
                  autoFocus
                  className="w-full bg-zinc-800 border border-zinc-700 focus:border-spotify-green focus:ring-1 focus:ring-spotify-green rounded-lg px-4 py-2.5 text-white placeholder-zinc-600 outline-none transition-colors text-sm"
                />
              )}
            </div>
          )}

          {/* STEP: importing */}
          {step === 'importing' && (
            <div className="p-10 flex flex-col items-center gap-4">
              <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-spotify-green h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-zinc-400 text-sm">{progress.done} of {progress.total} added</p>
            </div>
          )}

          {/* STEP: done */}
          {step === 'done' && (
            <div className="p-10 text-center space-y-3">
              <p className="text-spotify-green text-4xl">✓</p>
              <p className="text-white font-semibold">
                {progress.total - progress.failed} album{progress.total - progress.failed !== 1 ? 's' : ''} added
              </p>
              {progress.failed > 0 && (
                <p className="text-zinc-500 text-sm">
                  {progress.failed} skipped (duplicates or errors)
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        {(step === 'preview' || step === 'pick-list' || step === 'done') && (
          <div className="px-6 py-4 border-t border-zinc-800 flex justify-between gap-3 shrink-0">
            {step === 'preview' && (
              <>
                <button
                  onClick={() => { setStep('upload'); setAlbums([]); setParseError(null); }}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={() => {
                    setImportError(null);
                    if (defaultListId) {
                      // List is already known — jump straight to import
                      startImport();
                    } else {
                      // Auto-select first list so the Import button is immediately enabled
                      if (!targetListId && lists.length > 0) setTargetListId(lists[0].id);
                      setStep('pick-list');
                    }
                  }}
                  disabled={selected.size === 0}
                  className="flex-1 bg-spotify-green hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  {defaultListId
                    ? `Import ${selected.size} album${selected.size !== 1 ? 's' : ''}`
                    : `Continue with ${selected.size} album${selected.size !== 1 ? 's' : ''}`}
                </button>
              </>
            )}
            {step === 'pick-list' && (
              <>
                <button
                  onClick={() => setStep('preview')}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={startImport}
                  disabled={listMode === 'pick' ? !targetListId : !newListTitle.trim()}
                  className="flex-1 bg-spotify-green hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  Import {selected.size} album{selected.size !== 1 ? 's' : ''}
                </button>
              </>
            )}
            {step === 'done' && (
              <button
                onClick={onClose}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Close
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

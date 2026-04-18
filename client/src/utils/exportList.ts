import type { List, ListAlbum } from '../types';

/**
 * Exports match `importParser.ts` (RYM-style): JSON array, CSV with Rank/Title/Artist/… columns.
 * Re-import matches albums by artist + title; per-list notes are not in this schema.
 */

function sanitizeFilenameSegment(title: string): string {
  const s = title.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, ' ').trim();
  return s.slice(0, 80) || 'list';
}

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function sortedByPosition(albums: ListAlbum[]): ListAlbum[] {
  return [...albums].sort((a, b) => a.position - b.position);
}

/** RYM-compatible row for JSON array export (matches parseRymJson). */
function toRymJsonRow(a: ListAlbum, index: number) {
  const genres = a.genres ?? [];
  const ratingVal = a.rating != null && a.rating > 0 ? a.rating : null;
  return {
    rank: a.position ?? index + 1,
    title: a.album_name,
    artist: a.artist_name,
    releaseDate: a.release_year != null ? String(a.release_year) : '',
    primaryGenres: genres.length ? genres.join(', ') : '',
    secondaryGenres: '',
    rating: ratingVal,
  };
}

/** Same field order / names as typical RYM CSV; header normalization in parseRymCsv matches these labels. */
export function buildListAlbumsCsv(albums: ListAlbum[]): string {
  const headers = [
    'Rank',
    'Title',
    'Artist',
    'Release date',
    'Primary genres',
    'Secondary genres',
    'Rating',
  ] as const;

  const ordered = sortedByPosition(albums);
  const lines = [
    headers.join(','),
    ...ordered.map((a, i) => {
      const row = toRymJsonRow(a, i);
      return [
        row.rank,
        row.title,
        row.artist,
        row.releaseDate,
        row.primaryGenres,
        row.secondaryGenres,
        row.rating === null ? '' : row.rating,
      ]
        .map(escapeCsvCell)
        .join(',');
    }),
  ];
  return `\ufeff${lines.join('\r\n')}`;
}

/** JSON array only — parseRymJson requires a top-level array, not an object. */
export function buildListAlbumsJson(_list: List, albums: ListAlbum[]): string {
  const ordered = sortedByPosition(albums);
  const rows = ordered.map((a, i) => toRymJsonRow(a, i));
  return JSON.stringify(rows, null, 2);
}

export function triggerDownload(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.click();
  URL.revokeObjectURL(url);
}

export function exportListFilename(list: List, ext: 'csv' | 'json'): string {
  const base = sanitizeFilenameSegment(list.title);
  const stamp = new Date().toISOString().slice(0, 10);
  return `${base}-${stamp}.${ext}`;
}

export function downloadListAsCsv(list: List, albums: ListAlbum[]): void {
  const csv = buildListAlbumsCsv(albums);
  triggerDownload(csv, exportListFilename(list, 'csv'), 'text/csv');
}

export function downloadListAsJson(list: List, albums: ListAlbum[]): void {
  const json = buildListAlbumsJson(list, albums);
  triggerDownload(json, exportListFilename(list, 'json'), 'application/json');
}

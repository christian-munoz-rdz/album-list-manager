export interface ImportAlbum {
  rank: number;
  title: string;
  artist: string;
  releaseDate: string | null;
  primaryGenres: string;
  secondaryGenres: string;
  rating: number | null;
}

/** Parse the dirty RYM releaseDate string → "DD Month YYYY" or null */
function cleanDate(raw: string): string | null {
  const cleaned = raw.split('\n')[0].trim();
  return cleaned.length > 0 ? cleaned : null;
}

/** Parse RYM JSON export */
export function parseRymJson(text: string): ImportAlbum[] {
  const rows = JSON.parse(text);
  if (!Array.isArray(rows)) throw new Error('Expected a JSON array');
  return rows.map((r) => ({
    rank: parseInt(String(r.rank ?? r.Rank ?? 0), 10),
    title: String(r.title ?? r.Title ?? '').trim(),
    artist: String(r.artist ?? r.Artist ?? '').trim(),
    releaseDate: cleanDate(String(r.releaseDate ?? r['Release Date'] ?? '')),
    primaryGenres: String(r.primaryGenres ?? r['Primary Genres'] ?? '').trim(),
    secondaryGenres: String(r.secondaryGenres ?? r['Secondary Genres'] ?? '').trim(),
    rating: r.rating != null ? parseFloat(String(r.rating ?? r.Rating)) : null,
  })).filter((r) => r.title && r.artist);
}

/** Minimal CSV parser — handles quoted fields with embedded commas/newlines */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n') {
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
      } else if (ch === '\r') {
        // skip \r
      } else {
        field += ch;
      }
    }
  }

  // flush last field/row
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/** Parse RYM CSV export */
export function parseRymCsv(text: string): ImportAlbum[] {
  const rows = parseCsvRows(text);
  if (rows.length < 2) return [];

  // Normalise header names: lower-case, no spaces
  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, ''));

  const idx = (names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i !== -1) return i;
    }
    return -1;
  };

  const iRank = idx(['rank']);
  const iTitle = idx(['title']);
  const iArtist = idx(['artist']);
  const iDate = idx(['releasedate', 'release date']);
  const iPrimary = idx(['primarygenres', 'primary genres']);
  const iSecondary = idx(['secondarygenres', 'secondary genres']);
  const iRating = idx(['rating']);

  return rows
    .slice(1)
    .map((cols) => ({
      rank: iRank >= 0 ? parseInt(cols[iRank] ?? '0', 10) : 0,
      title: (cols[iTitle] ?? '').trim(),
      artist: (cols[iArtist] ?? '').trim(),
      releaseDate: iDate >= 0 ? cleanDate(cols[iDate] ?? '') : null,
      primaryGenres: (cols[iPrimary] ?? '').trim(),
      secondaryGenres: (cols[iSecondary] ?? '').trim(),
      rating: iRating >= 0 && cols[iRating] ? parseFloat(cols[iRating]) : null,
    }))
    .filter((r) => r.title && r.artist);
}

/** Auto-detect format from file extension or content and parse */
export function parseImportFile(filename: string, text: string): ImportAlbum[] {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'json') return parseRymJson(text);
  if (ext === 'csv') return parseRymCsv(text);
  // Fallback: sniff content
  const trimmed = text.trimStart();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) return parseRymJson(text);
  return parseRymCsv(text);
}

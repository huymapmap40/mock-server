import * as fs from 'fs';

/**
 * Dependency-free CSV loading for contract response data.
 *
 * A contract response can reference a `dataFile` (CSV) instead of (or in
 * addition to) an inline `json` body. The loader reads the file, parses each
 * row into an object keyed by the header row, and the response body is then
 * built from those rows — e.g. a 10-row CSV yields a 10-element JSON array.
 *
 * Conventions:
 *   - Columns are separated by `|` (pipe), not comma — values often contain
 *     commas, so a pipe delimiter keeps the data files readable without quoting.
 *   - The first line is the header row (column names).
 *   - Quoted fields ("...") may contain pipes, quotes ("" escapes a quote)
 *     and newlines.
 *   - Values are coerced: integers/decimals -> number, true/false -> boolean,
 *     the literal `null` -> null, everything else stays a string.
 *   - Header names may use dot notation (e.g. `address.city`) to build nested
 *     objects.
 */

export type CsvRow = Record<string, unknown>;

/** Column delimiter. Pipe-separated so cell values can contain commas freely. */
const DELIMITER = '|';

/** Split raw CSV text into rows of raw string cells (RFC-4180-ish). */
function tokenize(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === DELIMITER) {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (c === '\r') {
      i += 1;
      continue;
    }
    if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }

  // Flush the trailing field/row when the file does not end in a newline.
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Coerce a raw CSV cell into a JSON-friendly value. */
function coerce(value: string): unknown {
  if (value === '') return '';
  if (value === 'null') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

/** Assign `value` into `obj` at a (possibly dotted) `path`, creating objects. */
function assignPath(obj: CsvRow, path: string, value: unknown): void {
  const parts = path.split('.');
  let cursor: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (typeof cursor[key] !== 'object' || cursor[key] === null) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
}

/**
 * Read a CSV file and return one object per data row. Throws (with the file
 * path) if the file is missing or has no header, so a broken data file fails
 * the load loudly alongside the contracts.
 */
export function loadCsvRows(filePath: string): CsvRow[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Data file not found: ${filePath}`);
  }

  const text = fs.readFileSync(filePath, 'utf8');
  const table = tokenize(text).filter((cells) => cells.some((c) => c.trim() !== ''));

  if (table.length === 0) {
    throw new Error(`Data file is empty: ${filePath}`);
  }

  const header = table[0].map((h) => h.trim());
  return table.slice(1).map((cells) => {
    const obj: CsvRow = {};
    header.forEach((column, idx) => {
      assignPath(obj, column, coerce(cells[idx] ?? ''));
    });
    return obj;
  });
}

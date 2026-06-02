import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { LoadedContract, validateContract } from './schema';
import { loadCsvRows } from './csv';

const YAML_EXTENSIONS = ['.yaml', '.yml'];

/** Recursively collect every YAML contract file under `dir` (any depth). */
function findYamlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...findYamlFiles(full));
    } else if (YAML_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Load and validate every YAML contract file under a directory tree.
 *
 * Contracts are organised by service then API:
 *   <contractsDir>/<service>/<api>/<name>.yaml  (+ optional <name>.csv)
 *
 * All files are parsed and validated up front; if any file is invalid (or
 * references a missing/empty CSV data file) the whole load throws, so deploying
 * a broken contract fails fast rather than starting the mock with missing or
 * half-filled expectations.
 */
export function loadContracts(dir: string): LoadedContract[] {
  if (!fs.existsSync(dir)) {
    throw new Error(`Contracts directory not found: ${dir}`);
  }

  const files = findYamlFiles(dir).sort();

  if (files.length === 0) {
    throw new Error(`No YAML contract files (*.yaml|*.yml) found under: ${dir}`);
  }

  return files.map((fullPath) => {
    // A short, tree-relative label for error messages and startup logs.
    const relFile = path.relative(dir, fullPath);
    let raw: unknown;
    try {
      raw = yaml.load(fs.readFileSync(fullPath, 'utf8'));
    } catch (error) {
      throw new Error(`Failed to parse ${relFile}: ${(error as Error).message}`);
    }
    const contract = validateContract(raw, relFile);

    // Resolve any CSV-backed responses relative to the YAML file's own folder,
    // so each API folder is self-contained (yaml + its data file live together).
    const contractDir = path.dirname(fullPath);
    for (const expectation of contract.expectations) {
      const res = expectation.response;
      if (res.dataFile) {
        res.data = loadCsvRows(path.join(contractDir, res.dataFile));
      }
    }

    return { ...contract, sourceFile: relFile };
  });
}

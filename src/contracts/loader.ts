import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { LoadedContract, validateContract } from './schema';

const YAML_EXTENSIONS = ['.yaml', '.yml'];

/**
 * Load and validate every YAML contract file in a directory.
 *
 * All files are parsed and validated up front; if any file is invalid the whole
 * load throws, so deploying a broken contract fails fast rather than starting
 * the mock with missing expectations.
 */
export function loadContracts(dir: string): LoadedContract[] {
  if (!fs.existsSync(dir)) {
    throw new Error(`Contracts directory not found: ${dir}`);
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => YAML_EXTENSIONS.includes(path.extname(f).toLowerCase()))
    .sort();

  if (files.length === 0) {
    throw new Error(`No YAML contract files (*.yaml|*.yml) found in: ${dir}`);
  }

  return files.map((file) => {
    const fullPath = path.join(dir, file);
    let raw: unknown;
    try {
      raw = yaml.load(fs.readFileSync(fullPath, 'utf8'));
    } catch (error) {
      throw new Error(`Failed to parse ${file}: ${(error as Error).message}`);
    }
    const contract = validateContract(raw, file);
    return { ...contract, sourceFile: file };
  });
}

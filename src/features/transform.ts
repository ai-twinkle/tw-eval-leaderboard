import type {
  CategoryResult,
  DataSource,
  PivotRow,
  CategoryKey,
} from '../types';

/**
 * Get unique identifier for a source (model + variance)
 */
export function getSourceIdentifier(source: DataSource): string {
  return source.variance !== 'default'
    ? `${source.modelName}-${source.variance}`
    : source.modelName;
}

/**
 * Normalize dataset key by extracting the dataset name and removing prefixes
 */
function normalizeDatasetKey(key: string): string {
  // Remove trailing slashes
  let name = key.replace(/\/+$/, '');
  // Get the last path segment
  name = name.split('/').pop() || name;
  // Remove author prefixes like 'cais__' or 'ikala__'
  name = name.split('__').pop() || name;
  return name;
}

/**
 * Extract category from filename (stem without extension and path)
 */
function extractCategory(filename: string): string {
  // Extract just the filename without path
  const name = filename.split('/').pop() || filename;
  // Remove test suffix and extension
  return name
    .replace(/_test\.(jsonl?|csv|parquet)$/, '')
    .replace(/\.(jsonl?|csv|parquet)$/, '');
}

/**
 * Categorize test by subject area
 */
export function categorizeTest(filename: string): CategoryKey {
  const name = filename.toLowerCase();

  // Computer Science
  if (
    name.includes('computer') ||
    name.includes('machine_learning') ||
    name.includes('security')
  ) {
    return 'computerScience';
  }
  // Mathematics
  else if (
    name.includes('math') ||
    name.includes('algebra') ||
    name.includes('calculus') ||
    name.includes('geometry') ||
    name.includes('statistics') ||
    name.includes('trigonometry')
  ) {
    return 'mathematics';
  }
  // Medicine & Health
  else if (
    name.includes('medicine') ||
    name.includes('nutrition') ||
    name.includes('anatomy') ||
    name.includes('clinical') ||
    name.includes('virology') ||
    name.includes('genetics') ||
    name.includes('pharmacology') ||
    name.includes('veterinary') ||
    name.includes('dentistry') ||
    name.includes('pharmacy') ||
    name.includes('optometry') ||
    name.includes('occupational') ||
    name.includes('therapy') ||
    name.includes('psychological') ||
    name.includes('pathology') ||
    name.includes('medical')
  ) {
    return 'medicineHealth';
  }
  // Science
  else if (
    name.includes('physics') ||
    name.includes('chemistry') ||
    name.includes('biology') ||
    name.includes('astronomy') ||
    name.includes('science') ||
    name.includes('medical')
  ) {
    return 'science';
  }
  // Law & Government
  else if (
    name.includes('law') ||
    name.includes('legal') ||
    name.includes('jurisprudence') ||
    name.includes('government') ||
    name.includes('politics') ||
    name.includes('foreign') ||
    name.includes('policy') ||
    name.includes('politic') ||
    name.includes('national') ||
    name.includes('protection')
  ) {
    return 'lawGovernment';
  }
  // Humanities & Philosophy
  else if (
    name.includes('ttqav2') ||
    name.includes('history') ||
    name.includes('geography') ||
    name.includes('philosophy') ||
    name.includes('logic') ||
    name.includes('logical') ||
    name.includes('reasoning') ||
    name.includes('religions') ||
    name.includes('principles') ||
    name.includes('moral')
  ) {
    return 'humanitiesPhilosophy';
  }
  // Business & Economics
  else if (
    name.includes('business') ||
    name.includes('economics') ||
    name.includes('marketing') ||
    name.includes('accounting') ||
    name.includes('management') ||
    name.includes('finance') ||
    name.includes('financial') ||
    name.includes('analysis') ||
    name.includes('auditing') ||
    name.includes('taxation') ||
    name.includes('insurance') ||
    name.includes('trade') ||
    name.includes('real') ||
    name.includes('estate') ||
    name.includes('trust') ||
    name.includes('public') ||
    name.includes('relations') ||
    name.includes('money') ||
    name.includes('laundering') ||
    name.includes('econometrics') ||
    name.includes('humanities')
  ) {
    return 'businessEconomics';
  }
  // Social Sciences
  else if (
    name.includes('psychology') ||
    name.includes('sociology') ||
    name.includes('behavior') ||
    name.includes('sexuality') ||
    name.includes('aging') ||
    name.includes('social') ||
    name.includes('studies')
  ) {
    return 'socialSciences';
  }
  // Education
  else if (name.includes('education') || name.includes('profession')) {
    return 'education';
  }
  // Engineering & Technical
  else if (
    name.includes('mechanical') ||
    name.includes('technical') ||
    name.includes('electrical') ||
    name.includes('engineering')
  ) {
    return 'engineeringTechnical';
  }
  // Vocational & Arts
  else if (
    name.includes('music') ||
    name.includes('culinary') ||
    name.includes('physical') ||
    name.includes('nautical') ||
    name.includes('agriculture') ||
    name.includes('fire')
  ) {
    return 'vocationalArts';
  }
  // Languages & Literature
  else if (
    name.includes('chinese') ||
    name.includes('language') ||
    name.includes('literature') ||
    name.includes('taiwanese') ||
    name.includes('hokkien')
  ) {
    return 'languagesLiterature';
  }
  // Miscellaneous
  else if (
    name.includes('miscellaneous') ||
    name.includes('design') ||
    name.includes('global') ||
    name.includes('facts')
  ) {
    return 'miscellaneous';
  }

  return 'other';
}

/**
 * Flatten dataset results into category results
 */
export function flattenDatasetResults(rawData: unknown): CategoryResult[] {
  const results: CategoryResult[] = [];

  if (typeof rawData !== 'object' || rawData === null) {
    return results;
  }

  const data = rawData as Record<string, unknown>;
  const datasetResults = data.dataset_results as
    | Record<string, unknown>
    | undefined;

  if (!datasetResults) {
    return results;
  }

  for (const [datasetKey, datasetValue] of Object.entries(datasetResults)) {
    const normalizedDataset = normalizeDatasetKey(datasetKey);

    if (typeof datasetValue !== 'object' || datasetValue === null) {
      continue;
    }

    const datasetObj = datasetValue as Record<string, unknown>;
    const resultsList = datasetObj.results as
      | Array<Record<string, unknown>>
      | undefined;

    if (!Array.isArray(resultsList)) {
      continue;
    }

    for (const result of resultsList) {
      const file = result.file as string;
      const accuracy_mean = result.accuracy_mean as number;
      const accuracy_std = result.accuracy_std as number | undefined;

      if (typeof file === 'string' && typeof accuracy_mean === 'number') {
        let category = extractCategory(file);

        // Normalize tw-legal-benchmark-v1 default test naming
        if (
          normalizedDataset === 'tw-legal-benchmark-v1' &&
          category === 'default'
        ) {
          category = 'benchmark';
        }

        results.push({
          category: `${normalizedDataset}/${category}`,
          file,
          accuracy_mean,
          accuracy_std,
        });
      }
    }
  }

  return results;
}

/**
 * Group results by subject category
 */
export function groupByCategory(
  results: CategoryResult[],
): Record<CategoryKey, CategoryResult[]> {
  const grouped: Record<string, CategoryResult[]> = {};

  for (const result of results) {
    const category = categorizeTest(result.category);
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(result);
  }

  return grouped;
}

/**
 * Build pivot table: category × source
 */
export function buildPivotTable(sources: DataSource[]): PivotRow[] {
  const categoryMap = new Map<string, PivotRow>();

  for (const source of sources) {
    const results = flattenDatasetResults(source.rawData);
    const varianceLabel =
      source.variance !== 'default' ? ` (${source.variance})` : '';
    const sourceLabel = `${source.modelName}${varianceLabel} @ ${source.timestamp}${source.isOfficial ? ' (Official)' : ''}`;

    for (const result of results) {
      let row = categoryMap.get(result.category);
      if (!row) {
        row = { category: result.category };
        categoryMap.set(result.category, row);
      }
      row[sourceLabel] = result.accuracy_mean;
    }
  }

  return Array.from(categoryMap.values());
}

/**
 * Scale value for display (0-1 or 0-100)
 */
export function scaleValue(value: number, scale0100: boolean): number {
  return scale0100 ? value * 100 : value;
}

/**
 * Format value for display
 */
export function formatValue(value: number, scale0100: boolean): string {
  const scaled = scaleValue(value, scale0100);
  return scaled.toFixed(scale0100 ? 2 : 4);
}

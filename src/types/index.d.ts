import { z } from 'zod';

// Category types for i18n
export type CategoryKey =
  | 'computerScience'
  | 'mathematics'
  | 'medicineHealth'
  | 'science'
  | 'lawGovernment'
  | 'humanitiesPhilosophy'
  | 'businessEconomics'
  | 'socialSciences'
  | 'education'
  | 'engineeringTechnical'
  | 'vocationalArts'
  | 'languagesLiterature'
  | 'miscellaneous'
  | 'other';

// Config types
export const BenchmarkConfigSchema = z.object({
  official: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      provider: z.string(),
      modelName: z.string(),
      variance: z.string(),
      openSource: z.boolean(),
      hfFolderUrl: z.string(),
    }),
  ),
  ui: z.object({
    defaultScale0100: z.boolean(),
    pageSizes: z.array(z.number()),
  }),
  security: z.object({
    allowOrigins: z.array(z.string()),
  }),
});

export type BenchmarkConfig = z.infer<typeof BenchmarkConfigSchema>;

// Dynamic schema types that will be inferred at runtime
export interface DataSource {
  id: string;
  label: string;
  provider: string;
  modelName: string;
  modelId: string;
  variance: string;
  openSource: boolean;
  timestamp: string;
  isOfficial: boolean;
  data: unknown;
  rawData: unknown;
}

export interface CategoryResult {
  category: string;
  file: string;
  accuracy_mean: number;
  accuracy_std?: number;
}

export interface PivotRow {
  category: string;
  [sourceLabel: string]: number | string;
}

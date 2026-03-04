import React, { useEffect, useMemo, useState } from 'react';
import {
  Switch,
  Checkbox,
  Divider,
  Button,
  Input,
  Slider,
  AutoComplete,
} from 'antd';
import {
  SlidersOutlined,
  CheckSquareOutlined,
  SearchOutlined,
  DownloadOutlined,
  UploadOutlined,
  SunOutlined,
  MoonOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { FileUploader } from './FileUploader';
import { DownloadButtons } from './DownloadButtons';
import { LanguageSwitcher } from './LanguageSwitcher';
import type { DataSource, PivotRow } from '../types';

interface ControlsPanelProps {
  onFilesUpload: (files: File[]) => void;
  sources: DataSource[];
  selectedSourceIds: string[];
  onSourceSelectionChange: (ids: string[]) => void;
  onSizeFilterChange?: (range: [number, number]) => void;
  scale0100: boolean;
  onScaleToggle: (checked: boolean) => void;
  pivotData: PivotRow[];
  hideHeader?: boolean;
  isDarkMode?: boolean;
  toggleTheme?: () => void;
}

/**
 * Intermediate mark values (B params) shown between 0 and max.
 * Kept sparse so labels never crowd.
 */
const SPARSE_MARKS = [7, 30, 100];

/**
 * Full milestone list used only to snap max up to a clean boundary.
 */
const ALL_MILESTONES = [3, 7, 13, 30, 70, 100, 200, 400, 700, 1000, 2000];

function parseSize(size: number | string): number {
  const n = typeof size === 'string' ? parseFloat(size) : size;
  return isNaN(n) ? 0 : n;
}

function formatSizeB(n: number): string {
  return n === 0 ? '0' : `${n}B`;
}

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
  onFilesUpload,
  sources,
  selectedSourceIds,
  onSourceSelectionChange,
  onSizeFilterChange,
  scale0100,
  onScaleToggle,
  pivotData,
  hideHeader = false,
  isDarkMode,
  toggleTheme,
}) => {
  const { t } = useTranslation();

  // ── Build index-based slider config ──────────────────────────────────────
  //
  // The antd Slider works on indices (0 … N-1), one per mark, so each step
  // is visually equidistant — regardless of the actual B-count gap.
  //
  const { markValues, indexMax, antdMarks } = useMemo(() => {
    if (sources.length === 0) {
      return {
        markValues: [0, 100],
        indexMax: 1,
        antdMarks: { 0: '0', 1: '100B' } as Record<number, string>,
      };
    }

    const rawMax = Math.max(...sources.map((s) => parseSize(s.size)));

    // Snap max up to the next clean milestone
    let max = rawMax;
    for (const m of ALL_MILESTONES) {
      if (m >= rawMax) {
        max = m;
        break;
      }
    }
    if (max < rawMax) max = Math.ceil(rawMax / 100) * 100;

    // Build the ordered array of actual B values: [0, ...sparse, max]
    const values: number[] = [0];
    for (const m of SPARSE_MARKS) {
      if (m < max) values.push(m);
    }
    values.push(max);

    // antd marks: index → label string
    const marks: Record<number, string> = {};
    values.forEach((v, i) => {
      marks[i] = formatSizeB(v);
    });

    return {
      markValues: values,
      indexMax: values.length - 1,
      antdMarks: marks,
    };
  }, [sources]);

  // ── State ─────────────────────────────────────────────────────────────────
  const [searchText, setSearchText] = useState('');
  const [indexRange, setIndexRange] = useState<[number, number]>([0, indexMax]);

  // When sources load / config changes, reset to "show all"
  useEffect(() => {
    setIndexRange([0, indexMax]);
  }, [indexMax]);

  // ── Derive actual B values for filtering ──────────────────────────────────
  const minSize = markValues[indexRange[0]] ?? 0;
  const maxSize =
    markValues[indexRange[1]] ?? markValues[markValues.length - 1];
  const isFiltered = indexRange[0] > 0 || indexRange[1] < indexMax;

  // Notify parent whenever size range changes
  useEffect(() => {
    onSizeFilterChange?.([minSize, maxSize]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minSize, maxSize]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelectAll = () =>
    onSourceSelectionChange(sources.map((s) => s.id));
  const handleSelectDefault = () =>
    onSourceSelectionChange(
      sources.filter((s) => !s.defaultNoneActive).map((s) => s.id),
    );
  const handleClearAll = () => onSourceSelectionChange([]);
  const handleToggleSource = (id: string, checked: boolean) => {
    if (checked) {
      onSourceSelectionChange([...selectedSourceIds, id]);
    } else {
      onSourceSelectionChange(selectedSourceIds.filter((sid) => sid !== id));
    }
  };

  // ── AutoComplete Options ──────────────────────────────────────────────────
  const searchOptions = useMemo(() => {
    const uniqueTerms = new Set<string>();
    sources.forEach((s) => {
      if (s.modelName) uniqueTerms.add(s.modelName);
      if (s.provider) uniqueTerms.add(s.provider);
    });
    return Array.from(uniqueTerms)
      .sort()
      .map((term) => ({ value: term }));
  }, [sources]);

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filteredSources = sources.filter((source) => {
    const n = parseSize(source.size);
    if (n < minSize || n > maxSize) return false;
    const q = searchText.toLowerCase();
    return (
      source.provider.toLowerCase().includes(q) ||
      source.modelName.toLowerCase().includes(q) ||
      source.variance.toLowerCase().includes(q) ||
      source.timestamp.toLowerCase().includes(q)
    );
  });

  const groupedByProvider = filteredSources.reduce(
    (acc, source) => {
      if (!acc[source.provider]) acc[source.provider] = [];
      acc[source.provider].push(source);
      return acc;
    },
    {} as Record<string, DataSource[]>,
  );

  return (
    <div className='p-5'>
      {/* ── Mobile Settings (drawer only) ── */}
      {hideHeader && (
        <>
          <div className='mb-5'>
            <div className='section-header text-sm mb-3'>
              <SlidersOutlined className='!text-amber-500' />
              <span>{t('controls.settings')}</span>
            </div>
            <div className='flex flex-col gap-3'>
              <div className='flex items-center justify-between'>
                <span className='text-xs text-gray-500'>
                  {t('controls.language')}
                </span>
                <LanguageSwitcher size={'small'} />
              </div>

              {toggleTheme && isDarkMode !== undefined && (
                <div className='flex items-center justify-between'>
                  <span className='text-xs text-gray-500'>
                    {t('controls.theme')}
                  </span>
                  <Button
                    icon={isDarkMode ? <SunOutlined /> : <MoonOutlined />}
                    onClick={toggleTheme}
                    size='small'
                  >
                    {isDarkMode ? t('theme.light') : t('theme.dark')}
                  </Button>
                </div>
              )}

              <div className='flex items-center justify-between'>
                <span className='text-xs text-gray-500'>
                  {t('controls.eval')}
                </span>
                <Button
                  href='https://github.com/ai-twinkle/Eval'
                  target='_blank'
                  rel='noopener noreferrer'
                  icon={<RocketOutlined />}
                  size='small'
                  className='flex items-center border-amber-200 text-amber-700 hover:!text-amber-600 hover:!border-amber-400'
                >
                  {t('app.runOwnResult')}
                </Button>
              </div>
            </div>
          </div>
          <Divider className='!my-3' />
        </>
      )}

      {/* ── File Upload ── */}
      <div className='mb-5'>
        <div className='section-header text-sm mb-3'>
          <UploadOutlined className='!text-amber-500' />
          <span>{t('controls.uploadFiles')}</span>
        </div>
        <FileUploader onFilesSelected={onFilesUpload} />
      </div>

      <Divider className='!my-3' />

      {/* ── Model Selection ── */}
      {sources.length > 0 && (
        <>
          <div className='mb-5'>
            {/* Header row */}
            <div className='flex items-center justify-between mb-3'>
              <div className='section-header text-sm'>
                <CheckSquareOutlined className='!text-amber-500' />
                <span>{t('controls.selectModels')}</span>
              </div>
              <div className='flex gap-1'>
                <Button
                  type='link'
                  size='small'
                  onClick={handleSelectAll}
                  className='!p-0 !h-auto !text-xs'
                >
                  {t('controls.all')}
                </Button>
                <span className='text-gray-300'>|</span>
                <Button
                  type='link'
                  size='small'
                  onClick={handleSelectDefault}
                  className='!p-0 !h-auto !text-xs'
                >
                  {t('controls.default', 'Default')}
                </Button>
                <span className='text-gray-300'>|</span>
                <Button
                  type='link'
                  size='small'
                  onClick={handleClearAll}
                  className='!p-0 !h-auto !text-xs'
                >
                  {t('controls.none')}
                </Button>
              </div>
            </div>

            {/* ── Size Range Slider (index-based for equal spacing) ── */}
            <div className='mb-3'>
              <div className='flex items-center justify-between mb-1'>
                <span className='text-xs text-gray-500 flex items-center gap-1'>
                  <SlidersOutlined style={{ fontSize: '10px' }} />
                  {t('controls.sizeFilter')}
                </span>
                <span className='text-xs font-medium text-amber-600'>
                  {!isFiltered
                    ? t('controls.sizeAll')
                    : `${formatSizeB(minSize)} – ${formatSizeB(maxSize)}`}
                </span>
              </div>

              <div className='px-1'>
                <Slider
                  range
                  min={0}
                  max={indexMax}
                  step={1}
                  value={indexRange}
                  marks={antdMarks}
                  onChange={(val) => setIndexRange(val as [number, number])}
                  tooltip={{
                    formatter: (idx) =>
                      idx !== undefined
                        ? formatSizeB(markValues[idx] ?? 0)
                        : '',
                  }}
                />
              </div>

              {isFiltered && (
                <div className='text-right mt-1'>
                  <button
                    onClick={() => setIndexRange([0, indexMax])}
                    className='text-xs text-amber-600 hover:text-amber-700 underline cursor-pointer bg-transparent border-none p-0'
                  >
                    {t('controls.sizeAll')}
                  </button>
                </div>
              )}
            </div>

            {/* Search */}
            <AutoComplete
              options={searchOptions}
              value={searchText}
              onChange={setSearchText}
              filterOption={(inputValue, option) =>
                option!.value
                  .toUpperCase()
                  .indexOf(inputValue.toUpperCase()) !== -1
              }
              className='mb-3 w-full'
            >
              <Input
                placeholder={t('controls.searchPlaceholder')}
                prefix={<SearchOutlined className='text-gray-400' />}
                allowClear
                size='small'
              />
            </AutoComplete>

            {/* Model list */}
            <div
              className={
                (hideHeader ? 'max-h-85' : 'max-h-60') +
                ' overflow-y-auto space-y-3 pr-1'
              }
            >
              {Object.entries(groupedByProvider).map(
                ([provider, providerSources]) => (
                  <div key={provider}>
                    <div className='text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1'>
                      <span className='w-2 h-2 rounded-full bg-amber-400' />
                      {provider}
                    </div>
                    <div className='space-y-1'>
                      {providerSources.map((source) => (
                        <div
                          key={source.id}
                          className={`model-card ${selectedSourceIds.includes(source.id) ? 'selected' : ''}`}
                          onClick={() =>
                            handleToggleSource(
                              source.id,
                              !selectedSourceIds.includes(source.id),
                            )
                          }
                        >
                          <Checkbox
                            checked={selectedSourceIds.includes(source.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleToggleSource(source.id, e.target.checked);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className='!text-xs'
                          >
                            <span className='text-xs font-medium text-gray-700'>
                              {source.modelId ? (
                                <a
                                  href={`https://huggingface.co/${source.modelId}`}
                                  target='_blank'
                                  rel='noopener noreferrer'
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {source.modelName}
                                </a>
                              ) : (
                                source.modelName
                              )}
                            </span>
                          </Checkbox>
                          <div className='flex items-center gap-1 mt-0.5 ml-6'>
                            <span className='badge-size'>
                              {formatSizeB(parseSize(source.size))}
                            </span>
                            {source.variance !== 'default' && (
                              <span className='text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded'>
                                {source.variance}
                              </span>
                            )}
                            {source.openSource && (
                              <span className='badge-oss'>OSS</span>
                            )}
                            {source.isOfficial && (
                              <span className='badge-official'>
                                {t('controls.official')}
                              </span>
                            )}
                          </div>
                          <div className='text-[10px] text-gray-400 mt-0.5 ml-6'>
                            {source.timestamp}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ),
              )}

              {filteredSources.length === 0 && (
                <div className='text-center py-4 text-xs text-gray-400'>
                  {t('chart.noData')}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <Divider className='!my-3' />

      {/* ── Scale Toggle ── */}
      <div className='mb-5'>
        <div className='flex items-center justify-between'>
          <div className='section-header text-sm'>
            <SlidersOutlined className='!text-amber-500' />
            <span>{t('controls.scale')}</span>
          </div>
          <Switch
            checked={scale0100}
            onChange={onScaleToggle}
            checkedChildren='0-100'
            unCheckedChildren='0-1'
            className='!min-w-16'
          />
        </div>
      </div>

      <Divider size={'small'} />

      {/* ── Export CSV ── */}
      <div>
        <div className='flex items-center justify-between'>
          <div className='section-header text-sm'>
            <DownloadOutlined className='!text-amber-500' />
            <span>{t('controls.exportCSV')}</span>
          </div>
          <DownloadButtons pivotData={pivotData} scale0100={scale0100} />
        </div>
      </div>
    </div>
  );
};

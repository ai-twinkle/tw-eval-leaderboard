import React, { useEffect, useState, useMemo } from 'react';
import {
  App,
  Button,
  Flex,
  Radio,
  Space,
  Tooltip,
  Drawer,
  Spin,
  Result,
} from 'antd';
import {
  BarChartOutlined,
  TableOutlined,
  GithubOutlined,
  StarFilled,
  FileAddOutlined,
  MenuOutlined,
  CloseOutlined,
  SunOutlined,
  MoonOutlined,
} from '@ant-design/icons';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { ControlsPanel } from '../components/ControlsPanel';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { CategoryDashboard } from '../charts/CategoryDashboard';
import { BenchmarkRankingTable } from '../charts/BenchmarkRankingTable';
import {
  type BenchmarkConfig,
  BenchmarkConfigSchema,
  type DataSource,
} from '../types';
import { discoverResultFiles, fetchResultFile } from '../features/discover';
import { deriveSchema, mergeSchemas, validateData } from '../features/schema';
import { parseJSONFile } from '../features/parse';
import { buildPivotTable } from '../features/transform';
import type { ZodType } from 'zod';

type ViewMode = 'dashboard' | 'table';

export const Home: React.FC = () => {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const { isDarkMode, toggleTheme } = useTheme();
  const [config, setConfig] = useState<BenchmarkConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<DataSource[]>([]);
  const [dataSchema, setDataSchema] = useState<ZodType | null>(null);

  // UI state
  const [scale0100, setScale0100] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');

  // Mobile sidebar drawer state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Model selection for comparison (simple multi-select)
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);

  // Auto-select new sources
  useEffect(() => {
    const newSourceIds = sources
      .filter((s) => !s.defaultNoneActive)
      .map((s) => s.id);
    setSelectedSourceIds(newSourceIds);
  }, [sources]);

  // Load config on mount
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}config/benchmarks.config.json`)
      .then((res) => res.json())
      .then((data) => {
        const result = BenchmarkConfigSchema.safeParse(data);
        if (result.success) {
          setConfig(result.data);
          setScale0100(result.data.ui.defaultScale0100);
        } else {
          void message.error(t('messages.invalidConfig'));
        }
      })
      .catch(() => {
        void message.error(t('messages.failedLoadConfig'));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  // Autoload latest results from all benchmarks when config is loaded
  useEffect(() => {
    if (!config) return;

    const loadAllLatestResults = async () => {
      setLoading(true);
      let errorCount = 0;

      // Load latest result from each benchmark in parallel
      const loadPromises = config.official.map(async (benchmark) => {
        try {
          // Discover available runs
          const files = await discoverResultFiles(
            benchmark.hfFolderUrl,
            config.security.allowOrigins,
          );

          if (files.length === 0) {
            console.warn(`No results found for ${benchmark.label}`);
            return null;
          }

          // Get the latest run (first one)
          const latestRun = files[0];

          // Fetch the result file
          const data = await fetchResultFile(
            benchmark.hfFolderUrl,
            latestRun.filename,
            config.security.allowOrigins,
          );

          // Derive or merge schema
          const newSchema = deriveSchema(data);
          setDataSchema((prevSchema) =>
            prevSchema ? mergeSchemas(prevSchema, newSchema) : newSchema,
          );

          // Validate against schema (silently)
          const validation = validateData(data, newSchema);

          // Extract model name and timestamp from data
          const dataObj = data as {
            config?: { model?: { name?: string } };
            timestamp?: string;
          };
          const rawModelName =
            dataObj.config?.model?.name || benchmark.modelName;
          const modelName = rawModelName.split('/').pop() || rawModelName;
          const timestamp = latestRun.displayTimestamp;

          // Create new source
          const newSource: DataSource = {
            id: `official-${benchmark.id}-${latestRun.timestamp}`,
            label: benchmark.label,
            provider: benchmark.provider,
            modelName,
            modelId: rawModelName,
            variance: benchmark.variance,
            openSource: benchmark.openSource,
            timestamp,
            isOfficial: true,
            defaultNoneActive: benchmark.defaultNoneActive,
            data: validation.data || data,
            rawData: data,
          };

          return newSource;
        } catch (err) {
          errorCount++;
          console.error(`Failed to load ${benchmark.label}:`, err);
          return null;
        }
      });

      const results = await Promise.all(loadPromises);

      // Filter out nulls and sort alphabetically by label
      const validSources = results.filter((s): s is DataSource => s !== null);
      validSources.sort((a, b) => a.label.localeCompare(b.label));

      // Add all sources at once
      setSources((prev) => {
        const existingIds = new Set(prev.map((s) => s.id));
        const newSources = validSources.filter((s) => !existingIds.has(s.id));
        return [...prev, ...newSources];
      });

      setLoading(false);

      const successCount = validSources.length;

      // Only show notification if there were errors
      if (errorCount > 0) {
        message.error(
          t('messages.loadedPartial', {
            success: successCount,
            total: config.official.length,
            failed: errorCount,
          }),
        );
      } else {
        message.success(t('messages.loadedResults', { count: successCount }));
      }
    };

    void loadAllLatestResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, message]);

  // Handle file uploads
  const handleFilesUpload = async (files: File[]) => {
    for (const file of files) {
      try {
        const data = await parseJSONFile(file);

        // Validate against existing schema
        if (dataSchema) {
          const validation = validateData(data, dataSchema);
          if (!validation.success) {
            message.warning(
              t('messages.schemaMismatch', {
                filename: file.name,
                error: validation.error,
              }),
            );
            // Still try to merge schemas
            const newSchema = deriveSchema(data);
            setDataSchema(mergeSchemas(dataSchema, newSchema));
          }
        } else {
          // First file - derive schema
          setDataSchema(deriveSchema(data));
        }

        // Extract metadata
        const dataObj = data as {
          config?: { model?: { name?: string } };
          timestamp?: string;
        };
        const rawModelName =
          dataObj.config?.model?.name ||
          file.name.replace(/\.(json|jsonl)$/, '');
        const modelName = rawModelName.split('/').pop() || rawModelName;
        const timestamp = dataObj.timestamp || new Date().toISOString();

        const newSource: DataSource = {
          id: `upload-${Date.now()}-${Math.random()}`,
          label: file.name,
          provider: 'User Upload',
          modelName,
          modelId: rawModelName,
          variance: 'default',
          openSource: false,
          timestamp,
          isOfficial: false,
          data,
          rawData: data,
        };

        setSources((prev) => [...prev, newSource]);
        message.success(t('messages.loadedFile', { filename: file.name }));
      } catch (err) {
        message.error(
          t('messages.failedParse', {
            filename: file.name,
            error: String(err),
          }),
        );
      }
    }
  };

  // Compute pivot data for selected sources only
  const pivotData = useMemo(() => {
    if (selectedSourceIds.length === 0) return [];
    const selectedSources = sources.filter((s) =>
      selectedSourceIds.includes(s.id),
    );
    return buildPivotTable(selectedSources);
  }, [sources, selectedSourceIds]);

  // Filter selected sources for display
  const selectedSources = useMemo(() => {
    return sources.filter((s) => selectedSourceIds.includes(s.id));
  }, [sources, selectedSourceIds]);

  // Sidebar content component (shared between desktop and mobile)
  const sidebarContent = (
    <ControlsPanel
      onFilesUpload={handleFilesUpload}
      sources={sources}
      selectedSourceIds={selectedSourceIds}
      onSourceSelectionChange={setSelectedSourceIds}
      scale0100={scale0100}
      onScaleToggle={setScale0100}
      pivotData={pivotData}
    />
  );

  return (
    <div className='flex flex-col h-screen'>
      {/* Header - Sticky with glass effect */}
      <div className='app-header sticky top-0 z-10 px-4 lg:px-6 py-3 lg:py-4'>
        <Flex justify='space-between' align='center' gap={8}>
          {/* Mobile menu button + Logo and Title */}
          <Flex align='center' gap={8} className='min-w-0 flex-1'>
            {/* Mobile menu button - only visible below lg breakpoint */}
            <Button
              type='text'
              icon={<MenuOutlined />}
              onClick={() => setSidebarOpen(true)}
              className='!hidden max-lg:!inline-flex flex-shrink-0'
              style={{ color: '#FFD400' }}
            />

            <a
              href='https://twinkleai.tw/'
              className='flex items-center gap-3 hover:opacity-80 transition-opacity no-underline min-w-0'
              style={{ color: 'inherit' }}
            >
              <img
                src={`${import.meta.env.BASE_URL}twinkle-ai.webp`}
                alt='Twinkle AI Logo'
                className='w-8 h-8 lg:w-10 lg:h-10 rounded-full shadow-md flex-shrink-0'
              />
              <div className='flex flex-col justify-center min-w-0'>
                <h1 className='text-lg lg:text-xl font-bold !mb-0 text-gradient truncate leading-tight'>
                  <span className='sm:hidden'>{t('app.titleShort')}</span>
                  <span className='hidden sm:inline'>{t('app.title')}</span>
                </h1>
                {/* Desktop Subtitle */}
                <p className='text-xs text-gray-500 !mb-0 hidden sm:block'>
                  {t('app.subtitle')}
                </p>
                {/* Mobile Subtitle (Leaderboard) */}
                <span className='text-xs text-gray-500 font-semibold sm:hidden leading-none'>
                  {t('app.leaderboard')}
                </span>
              </div>
            </a>
          </Flex>

          {/* Controls */}
          <Space size={'small'} className='flex-shrink-0'>
            {/* Language Switcher - desktop only */}
            <div className='hidden lg:block'>
              <LanguageSwitcher />
            </div>
            {/* View Mode Toggle - hidden on mobile */}
            <Radio.Group
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              buttonStyle='solid'
              size={'small'}
              className='hidden sm:inline-flex'
            >
              <Radio.Button value='dashboard'>
                <BarChartOutlined />
                <span className='hidden md:inline ml-1'>
                  {t('view.dashboard')}
                </span>
              </Radio.Button>
              <Radio.Button value='table'>
                <TableOutlined />
                <span className='hidden md:inline ml-1'>{t('view.table')}</span>
              </Radio.Button>
            </Radio.Group>
            {/* Theme Toggle - desktop only (moved to sidebar on mobile) */}
            <div className='hidden sm:block'>
              <Tooltip title={isDarkMode ? t('theme.light') : t('theme.dark')}>
                <Button
                  variant={'text'}
                  shape='circle'
                  size='small'
                  onClick={toggleTheme}
                  icon={
                    isDarkMode ? (
                      <SunOutlined className={'!text-lg'} />
                    ) : (
                      <MoonOutlined className={'!text-lg'} />
                    )
                  }
                  className={
                    '!border-none hover:!bg-yellow-50 dark:hover:!bg-yellow-900/20'
                  }
                />
              </Tooltip>
            </div>

            {/* GitHub Link */}
            <Tooltip title={t('app.viewOnGithub')}>
              <Button
                variant={'text'}
                shape='circle'
                size='small'
                href='https://github.com/ai-twinkle/tw-eval-leaderboard/'
                target='_blank'
                rel='noopener noreferrer'
                icon={<GithubOutlined className={'!text-lg'} />}
                className={
                  '!border-none hover:!bg-yellow-50 dark:hover:!bg-yellow-900/20 hidden lg:inline-flex'
                }
              />
            </Tooltip>
          </Space>
        </Flex>
      </div>

      <div className='flex flex-1 overflow-hidden'>
        {/* Desktop Sidebar - Hidden on mobile */}
        <div className='hidden lg:block w-80 app-sidebar overflow-y-auto flex-shrink-0'>
          {sidebarContent}
        </div>

        {/* Mobile Sidebar Drawer */}
        <Drawer
          title={
            <div className='flex items-center gap-3'>
              <img
                src={`${import.meta.env.BASE_URL}twinkle-ai.webp`}
                alt='Twinkle AI Logo'
                className='w-8 h-8 rounded-lg'
              />
              <span className='font-bold'>{t('controls.title')}</span>
            </div>
          }
          placement='left'
          onClose={() => setSidebarOpen(false)}
          open={sidebarOpen}
          width={320}
          className='lg:hidden'
          styles={{
            body: { padding: 0 },
          }}
          closeIcon={<CloseOutlined />}
        >
          {/* Use a version without header for drawer */}
          <ControlsPanel
            onFilesUpload={handleFilesUpload}
            sources={sources}
            selectedSourceIds={selectedSourceIds}
            onSourceSelectionChange={setSelectedSourceIds}
            scale0100={scale0100}
            onScaleToggle={setScale0100}
            pivotData={pivotData}
            hideHeader
            isDarkMode={isDarkMode}
            toggleTheme={toggleTheme}
          />
        </Drawer>

        {/* Main content */}
        <div className='flex-1 flex flex-col overflow-hidden min-w-0'>
          {/* Content Area */}
          <div className='flex-1 overflow-y-auto p-4 lg:p-6 app-content'>
            {loading ? (
              <Result
                icon={<Spin size='large' />}
                title={t('app.loading')}
                subTitle={t('app.loadingNote')}
              />
            ) : sources.length === 0 ? (
              <Result
                icon={<FileAddOutlined style={{ color: '#FFD400' }} />}
                title={t('app.noData')}
                subTitle={t('app.noDataHint')}
              />
            ) : selectedSourceIds.length === 0 ? (
              <Result
                icon={<StarFilled style={{ color: '#FFD400' }} />}
                title={t('app.noSelection')}
                subTitle={t('app.noSelectionHint')}
              />
            ) : viewMode === 'dashboard' ? (
              <CategoryDashboard
                sources={selectedSources}
                scale0100={scale0100}
              />
            ) : (
              <BenchmarkRankingTable
                sources={selectedSources}
                scale0100={scale0100}
              />
            )}
          </div>

          {/* Footer */}
          <div className='app-footer text-xs lg:text-sm'>
            <span>{t('app.poweredBy')} </span>
            <a
              href='https://github.com/ai-twinkle'
              target='_blank'
              rel='noopener noreferrer'
            >
              Twinkle AI
            </a>
            <span className='mx-2'>·</span>
            <span className='hidden sm:inline'>{t('app.builtFor')}</span>
            <StarFilled
              style={{ color: '#FFD400', marginLeft: '4px', fontSize: '12px' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

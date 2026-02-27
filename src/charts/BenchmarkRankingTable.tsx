import React, { useMemo, useState, useCallback } from 'react';
import {
  Table,
  Card,
  Select,
  Space,
  Typography,
  Input,
  Dropdown,
  Button,
  Checkbox,
  Flex,
  theme,
  Tree,
  type TreeDataNode,
} from 'antd';
import {
  TableOutlined,
  SortAscendingOutlined,
  SearchOutlined,
  EyeOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import type { DataSource } from '../types';
import {
  flattenDatasetResults,
  formatValue,
  categorizeTest,
} from '../features/transform';
import { useTheme } from '../contexts/ThemeContext';

const { Title, Text } = Typography;
const { Option } = Select;

interface RankingTableProps {
  sources: DataSource[];
  scale0100: boolean;
}

interface BenchmarkData {
  benchmarkName: string;
  models: ModelRankingRow[];
  allTests: string[];
}

interface ModelRankingRow {
  key: string;
  provider: string;
  modelName: string;
  modelId?: string;
  displayName: string;
  openSource: boolean;
  isOfficial: boolean;
  timestamp: string;
  average: number;
  [testName: string]: string | number | boolean | undefined;
}

function extractBenchmarkName(category: string): string {
  const parts = category.split('/');
  return parts[0] || category;
}

function extractTestName(category: string): string {
  const parts = category.split('/');
  if (parts.length > 1) {
    const name = parts.slice(1).join('/');
    // Remove leading slashes if any (e.g. from double slash in path)
    return name.replace(/^\/+/, '');
  }
  return category;
}

/**
 * Interpolate color between two hex colors based on ratio (0-1)
 */
function interpolateColor(
  color1: string,
  color2: string,
  ratio: number,
): string {
  const hex = (x: number) => {
    const h = Math.round(x).toString(16);
    return h.length === 1 ? '0' + h : h;
  };

  const r1 = parseInt(color1.substring(1, 3), 16);
  const g1 = parseInt(color1.substring(3, 5), 16);
  const b1 = parseInt(color1.substring(5, 7), 16);

  const r2 = parseInt(color2.substring(1, 3), 16);
  const g2 = parseInt(color2.substring(3, 5), 16);
  const b2 = parseInt(color2.substring(5, 7), 16);

  const r = r1 + (r2 - r1) * ratio;
  const g = g1 + (g2 - g1) * ratio;
  const b = b1 + (b2 - b1) * ratio;

  return '#' + hex(r) + hex(g) + hex(b);
}

/**
 * Get heatmap background color for a score (Excel/HuggingFace style)
 * Theme-aware: different palettes for light and dark mode
 */
function getHeatmapColor(value: number, isDarkMode: boolean): string {
  if (isDarkMode) {
    // Dark mode: darker, more saturated colors
    const colorLow = '#5c1a1a'; // Dark red
    const colorMid = '#4a4a00'; // Dark olive
    const colorHigh = '#1a4a1a'; // Dark green

    if (value < 0.5) {
      const ratio = value / 0.5;
      return interpolateColor(colorLow, colorMid, ratio);
    } else {
      const ratio = (value - 0.5) / 0.5;
      return interpolateColor(colorMid, colorHigh, ratio);
    }
  } else {
    // Light mode: softer, pastel-like colors with good contrast
    const colorLow = '#ffcdd2'; // Soft red/pink
    const colorMid = '#fff9c4'; // Soft yellow
    const colorHigh = '#c8e6c9'; // Soft green

    if (value < 0.5) {
      const ratio = value / 0.5;
      return interpolateColor(colorLow, colorMid, ratio);
    } else {
      const ratio = (value - 0.5) / 0.5;
      return interpolateColor(colorMid, colorHigh, ratio);
    }
  }
}

/**
 * Get text color based on theme and value
 */
function getTextColor(value: number, isDarkMode: boolean): string {
  if (isDarkMode) {
    // Dark mode: light colored text
    return value >= 0.7 ? '#a5d6a7' : value >= 0.4 ? '#fff59d' : '#ef9a9a';
  } else {
    // Light mode: dark text for readability
    return value >= 0.7 ? '#1b5e20' : value >= 0.4 ? '#f57f17' : '#b71c1c';
  }
}

interface ColumnVisibilityDropdownProps {
  allTests: string[];
  visibleColumns: Record<string, boolean>;
  onVisibilityChange: (updates: Record<string, boolean>) => void;
  onShowAll: (tests: string[]) => void;
  onHideAll: (tests: string[]) => void;
}

const ColumnVisibilityDropdown: React.FC<ColumnVisibilityDropdownProps> = ({
  allTests,
  visibleColumns,
  onVisibilityChange,
  onShowAll,
  onHideAll,
}) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const [searchText, setSearchText] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [autoExpandParent, setAutoExpandParent] = useState(true);

  // Group tests by category and build tree data
  const treeData = useMemo(() => {
    const grouped: Record<string, string[]> = {};

    allTests.forEach((test) => {
      const category = categorizeTest(test);
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(test);
    });

    // Create tree nodes
    const nodes = Object.entries(grouped)
      .map(([category, tests]) => {
        const categoryKey = `__CAT__${category}`;
        // Filter children based on search
        const filteredChildren = tests.filter(
          (test) =>
            !searchText ||
            test.toLowerCase().includes(searchText.toLowerCase()),
        );

        // If search is active but no children match, return null (filter out later)
        if (searchText && filteredChildren.length === 0) {
          return null;
        }

        return {
          title: <Text strong>{t(`categories.${category}`, category)}</Text>,
          key: categoryKey,
          children: filteredChildren.map((test) => ({
            title: test,
            key: test,
          })),
        };
      })
      .filter((node) => node !== null) as TreeDataNode[];

    // Sort categories (optional, could sort by localized name)
    // For now, let's just use the order from Object.entries or sort keys
    return nodes.sort((a, b) => {
      // simple sort by key or title string if possible
      return (a.key as string).localeCompare(b.key as string);
    });
  }, [allTests, searchText, t]);

  // Expand all categories when searching
  useMemo(() => {
    if (searchText) {
      setExpandedKeys(treeData.map((node) => node.key));
      setAutoExpandParent(true);
    }
  }, [searchText, treeData]);

  const onExpand = (newExpandedKeys: React.Key[]) => {
    setExpandedKeys(newExpandedKeys);
    setAutoExpandParent(false);
  };

  const checkedKeys = useMemo(() => {
    return allTests.filter((test) => visibleColumns[test] !== false);
  }, [allTests, visibleColumns]);

  const handleCheck = (
    checkedKeysValue:
      | React.Key[]
      | { checked: React.Key[]; halfChecked: React.Key[] },
  ) => {
    const keys = Array.isArray(checkedKeysValue)
      ? checkedKeysValue
      : checkedKeysValue.checked;

    const checkedSet = new Set(keys);
    const updates: Record<string, boolean> = {};

    // For all tests in this benchmark, update their visibility based on check status
    // Note: We only care about leaf nodes (tests), not category nodes
    allTests.forEach((test) => {
      // If the test key is in the checked set, it's visible. Otherwise hidden.
      updates[test] = checkedSet.has(test);
    });

    onVisibilityChange(updates);
  };

  const content = (
    <div
      style={{
        padding: 8,
        backgroundColor: token.colorBgElevated,
        boxShadow: token.boxShadowSecondary,
        borderRadius: token.borderRadiusLG,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: 300,
      }}
    >
      <Flex gap={8}>
        <Button
          size='small'
          onClick={() => onShowAll(allTests)}
          style={{ flex: 1 }}
        >
          {t('chart.showAll')}
        </Button>
        <Button
          size='small'
          onClick={() => onHideAll(allTests)}
          style={{ flex: 1 }}
        >
          {t('chart.hideAll')}
        </Button>
      </Flex>
      <Input
        placeholder={t('chart.searchColumns')}
        prefix={<SearchOutlined />}
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        allowClear
      />
      <div
        style={{
          maxHeight: 400,
          overflowY: 'auto',
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadiusXS,
          padding: '4px 0',
        }}
      >
        {treeData.length > 0 ? (
          <Tree
            checkable
            onExpand={onExpand}
            expandedKeys={expandedKeys}
            autoExpandParent={autoExpandParent}
            onCheck={handleCheck}
            checkedKeys={checkedKeys}
            treeData={treeData}
            height={300} // Virtual scroll support
            itemHeight={24}
            blockNode
          />
        ) : (
          <div
            style={{
              color: token.colorTextSecondary,
              textAlign: 'center',
              padding: '16px 0',
            }}
          >
            {t('chart.noColumnsFound')}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Dropdown
      popupRender={() => content}
      trigger={['click']}
      placement='bottomRight'
    >
      <Button size='small' icon={<EyeOutlined />}>
        {t('chart.columnVisibility')}
      </Button>
    </Dropdown>
  );
};

export const BenchmarkRankingTable: React.FC<RankingTableProps> = ({
  sources,
  scale0100,
}) => {
  const { t } = useTranslation();
  const { isDarkMode } = useTheme();
  const [sortBy, setSortBy] = useState<string>('average');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(
    {},
  );
  const [tableSize, setTableSize] = useState<'small' | 'middle' | 'large'>(
    'small',
  );
  const [pageSize, setPageSize] = useState<number>(20);

  const benchmarkData = useMemo((): BenchmarkData[] => {
    const benchmarkMap = new Map<
      string,
      {
        testNames: Set<string>;
        modelData: Map<
          string,
          { source: DataSource; scores: Map<string, number> }
        >;
      }
    >();

    sources.forEach((source) => {
      const results = flattenDatasetResults(source.rawData);

      results.forEach((result) => {
        const benchmarkName = extractBenchmarkName(result.category);
        const testName = extractTestName(result.category);

        if (!benchmarkMap.has(benchmarkName)) {
          benchmarkMap.set(benchmarkName, {
            testNames: new Set(),
            modelData: new Map(),
          });
        }
        const benchmarkEntry = benchmarkMap.get(benchmarkName)!;

        benchmarkEntry.testNames.add(testName);

        const modelKey = source.id;
        if (!benchmarkEntry.modelData.has(modelKey)) {
          benchmarkEntry.modelData.set(modelKey, {
            source,
            scores: new Map(),
          });
        }
        const modelEntry = benchmarkEntry.modelData.get(modelKey)!;

        modelEntry.scores.set(testName, result.accuracy_mean);
      });
    });

    const benchmarks: BenchmarkData[] = [];
    benchmarkMap.forEach((benchmarkEntry, benchmarkName) => {
      const allTests = Array.from(benchmarkEntry.testNames).sort();
      const models: ModelRankingRow[] = [];

      benchmarkEntry.modelData.forEach((modelEntry) => {
        const { source, scores } = modelEntry;
        const displayName = `${source.modelName}${source.variance !== 'default' ? ` (${source.variance})` : ''}`;

        const row: ModelRankingRow = {
          key: `${benchmarkName}-${source.id}`,
          provider: source.provider,
          modelName: source.modelName,
          modelId: source.modelId,
          displayName,
          openSource: source.openSource,
          isOfficial: source.isOfficial,
          timestamp: source.timestamp,
          average: 0,
        };

        let totalScore = 0;
        let count = 0;
        allTests.forEach((testName) => {
          const score = scores.get(testName);
          if (score !== undefined) {
            row[testName] = score;
            totalScore += score;
            count++;
          }
        });

        row.average = count > 0 ? totalScore / count : 0;

        models.push(row);
      });

      benchmarks.push({
        benchmarkName,
        models,
        allTests,
      });
    });

    benchmarks.sort((a, b) => a.benchmarkName.localeCompare(b.benchmarkName));

    return benchmarks;
  }, [sources]);

  // Initialize visible columns when benchmark data changes
  useMemo(() => {
    const allColumns: Record<string, boolean> = {
      provider: true,
      displayName: true,
      average: true,
    };
    benchmarkData.forEach((benchmark) => {
      benchmark.allTests.forEach((test) => {
        allColumns[test] = true;
      });
    });
    setVisibleColumns((prev) => {
      // Only set defaults if empty
      if (Object.keys(prev).length === 0) {
        return allColumns;
      }
      return prev;
    });
  }, [benchmarkData]);

  const handleBatchVisibilityChange = useCallback(
    (updates: Record<string, boolean>) => {
      setVisibleColumns((prev) => ({
        ...prev,
        ...updates,
      }));
    },
    [],
  );

  const handleShowAll = useCallback((allTests: string[]) => {
    const updates: Record<string, boolean> = {};
    allTests.forEach((test) => {
      updates[test] = true;
    });
    setVisibleColumns((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleHideAll = useCallback((allTests: string[]) => {
    const updates: Record<string, boolean> = {};
    allTests.forEach((test) => {
      updates[test] = false;
    });
    setVisibleColumns((prev) => ({ ...prev, ...updates }));
  }, []);

  const generateColumns = (
    allTests: string[],
  ): ColumnsType<ModelRankingRow> => {
    const baseColumns: ColumnsType<ModelRankingRow> = [
      {
        title: t('chart.provider'),
        dataIndex: 'provider',
        key: 'provider',
        width: 100,
        fixed: 'left',
        sorter: (a, b) => a.provider.localeCompare(b.provider),
        render: (text: string) => (
          <Text strong style={{ fontSize: '12px' }}>
            {text}
          </Text>
        ),
      },
      {
        title: t('chart.model'),
        dataIndex: 'displayName',
        key: 'displayName',
        width: 200,
        fixed: 'left',
        sorter: (a, b) => a.displayName.localeCompare(b.displayName),
        render: (text: string, record: ModelRankingRow) => (
          <div>
            <Text strong style={{ fontSize: '13px' }}>
              {record.modelId ? (
                <a
                  href={`https://huggingface.co/${record.modelId}`}
                  target='_blank'
                  rel='noopener noreferrer'
                  onClick={(e) => e.stopPropagation()}
                >
                  {text}
                </a>
              ) : (
                text
              )}
            </Text>
            <div>
              {record.openSource && (
                <Text
                  type='success'
                  style={{ fontSize: '11px', marginRight: '8px' }}
                >
                  (OSS)
                </Text>
              )}
              {record.isOfficial && (
                <Text type='secondary' style={{ fontSize: '11px' }}>
                  ({t('controls.official')})
                </Text>
              )}
            </div>
            <Text
              type='secondary'
              style={{ fontSize: '11px', display: 'block' }}
            >
              {record.timestamp}
            </Text>
          </div>
        ),
      },
      {
        title: t('chart.average'),
        dataIndex: 'average',
        key: 'average',
        width: 120,
        align: 'center',
        sorter: (a, b) => a.average - b.average,
        defaultSortOrder: 'descend',
        onCell: () => ({
          style: { padding: 0 },
        }),
        render: (value: number) => {
          const displayValue = scale0100 ? value * 100 : value;
          const formatted = displayValue.toFixed(scale0100 ? 2 : 4);
          const bgColor = getHeatmapColor(value, isDarkMode);
          const textColor = getTextColor(value, isDarkMode);
          const percentage = Math.min(value * 100, 100);

          return (
            <div
              className='heatmap-cell'
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                overflow: 'hidden',
              }}
            >
              {/* Progress bar background */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${percentage}%`,
                  backgroundColor: bgColor,
                  transition: 'width 0.3s ease',
                }}
              />
              {/* Text content */}
              <div
                style={{
                  position: 'relative',
                  zIndex: 1,
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: textColor,
                    flexShrink: 0,
                  }}
                />
                <Text strong style={{ color: textColor, fontSize: '13px' }}>
                  {formatted}
                  {scale0100 ? ' %' : ''}
                </Text>
              </div>
            </div>
          );
        },
      },
    ];

    const testColumns: ColumnsType<ModelRankingRow> = allTests
      .filter((testName) => visibleColumns[testName] !== false)
      .map((testName) => ({
        title: testName,
        dataIndex: testName,
        key: testName,
        width: 120,
        align: 'center',
        sorter: (a, b) => {
          const aVal = typeof a[testName] === 'number' ? a[testName] : 0;
          const bVal = typeof b[testName] === 'number' ? b[testName] : 0;
          return (aVal as number) - (bVal as number);
        },
        onCell: () => ({
          style: { padding: 0 },
        }),
        render: (value: number | string | boolean | undefined) => {
          if (typeof value === 'number') {
            const displayValue = scale0100 ? value * 100 : value;
            const formatted = displayValue.toFixed(scale0100 ? 2 : 4);
            const bgColor = getHeatmapColor(value, isDarkMode);
            const textColor = getTextColor(value, isDarkMode);
            const percentage = Math.min(value * 100, 100);

            return (
              <div
                className='heatmap-cell'
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {/* Progress bar background */}
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${percentage}%`,
                    backgroundColor: bgColor,
                    transition: 'width 0.3s ease',
                  }}
                />
                {/* Text content */}
                <Text
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    color: textColor,
                    fontWeight: 500,
                    fontSize: '13px',
                  }}
                >
                  {formatted}
                  {scale0100 ? ' %' : ''}
                </Text>
              </div>
            );
          }
          return (
            <div style={{ padding: '8px 12px', textAlign: 'center' }}>
              <Text type='secondary'>-</Text>
            </div>
          );
        },
      }));

    return [...baseColumns, ...testColumns];
  };

  const tableOptionsMenu = useMemo(
    () => ({
      items: [
        {
          key: 'density-label',
          label: (
            <Text strong style={{ fontSize: '12px' }}>
              {t('chart.rowDensity')}
            </Text>
          ),
          disabled: true,
        },
        {
          key: 'compact',
          label: (
            <div
              onClick={() => setTableSize('small')}
              style={{ cursor: 'pointer' }}
            >
              <Checkbox checked={tableSize === 'small'}>
                {t('chart.compact')}
              </Checkbox>
            </div>
          ),
        },
        {
          key: 'comfortable',
          label: (
            <div
              onClick={() => setTableSize('large')}
              style={{ cursor: 'pointer' }}
            >
              <Checkbox checked={tableSize === 'large'}>
                {t('chart.comfortable')}
              </Checkbox>
            </div>
          ),
        },
        { type: 'divider' as const },
        {
          key: 'pagesize-label',
          label: (
            <Text strong style={{ fontSize: '12px' }}>
              {t('chart.rowsPerPage')}
            </Text>
          ),
          disabled: true,
        },
        {
          key: 'pagesize',
          label: (
            <Select
              value={pageSize}
              onChange={setPageSize}
              size='small'
              style={{ width: 80 }}
              onClick={(e) => e.stopPropagation()}
            >
              <Option value={10}>10</Option>
              <Option value={20}>20</Option>
              <Option value={50}>50</Option>
              <Option value={100}>100</Option>
            </Select>
          ),
        },
      ],
    }),
    [tableSize, pageSize, t],
  );

  if (sources.length === 0) {
    return (
      <Card>
        <div className='text-center text-gray-500 py-8'>
          <TableOutlined style={{ fontSize: 48, marginBottom: 16 }} />
          <div>{t('chart.noData')}</div>
        </div>
      </Card>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Search Bar */}
      <div className='flex flex-col gap-3'>
        <Input
          prefix={<SearchOutlined />}
          placeholder={t('chart.searchModels')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
          size='large'
          style={{
            backgroundColor: 'var(--ant-color-bg-container)',
            borderRadius: '8px',
          }}
        />
      </div>

      {/* Header - responsive layout */}
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
        <Space>
          <TableOutlined style={{ fontSize: 12 }} />
          <Title level={5} style={{ margin: 0 }}>
            {t('chart.rankingTables')}
          </Title>
        </Space>
        <div className='flex items-center gap-2 flex-wrap'>
          <SortAscendingOutlined />
          <Text className='text-sm'>{t('chart.sortBy')}</Text>
          <Select
            value={sortBy}
            onChange={setSortBy}
            style={{ width: 180 }}
            size={'small'}
          >
            <Option value='modelName'>{t('chart.modelNameAZ')}</Option>
            <Option value='average'>{t('chart.averageScore')}</Option>
          </Select>
        </div>
      </div>

      <Card size='small' className='bg-blue-50 border-blue-200 !mb-5'>
        <Text>
          <strong>{t('chart.noteLabel')}</strong> {t('chart.noteText')}
          {scale0100
            ? ` ${t('chart.scoresPercentage')}`
            : ` ${t('chart.scoresDecimal')}`}
        </Text>
      </Card>

      {benchmarkData.map((benchmark) => {
        // Filter models by search query
        let filteredModels = benchmark.models;
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          filteredModels = benchmark.models.filter(
            (model) =>
              model.displayName.toLowerCase().includes(query) ||
              model.provider.toLowerCase().includes(query) ||
              model.modelName.toLowerCase().includes(query),
          );
        }

        const sortedModels = [...filteredModels];
        if (sortBy === 'modelName') {
          sortedModels.sort((a, b) =>
            a.displayName.localeCompare(b.displayName),
          );
        } else if (sortBy === 'average') {
          sortedModels.sort((a, b) => b.average - a.average);
        }

        const avgScore =
          sortedModels.length > 0
            ? sortedModels.reduce((sum, model) => sum + model.average, 0) /
              sortedModels.length
            : 0;

        return (
          <Card
            key={benchmark.benchmarkName}
            title={
              <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2'>
                <Space wrap>
                  <Text strong style={{ fontSize: 16 }}>
                    {benchmark.benchmarkName}
                  </Text>
                  <Text type='secondary' style={{ fontSize: 14 }}>
                    ({sortedModels.length} / {benchmark.models.length}{' '}
                    {t('chart.models')}, {benchmark.allTests.length}{' '}
                    {t('chart.tests')}, {t('chart.avg')}:{' '}
                    {formatValue(avgScore, scale0100)}
                    {scale0100 ? '%' : ''})
                  </Text>
                </Space>
                <Space>
                  <ColumnVisibilityDropdown
                    allTests={benchmark.allTests}
                    visibleColumns={visibleColumns}
                    onVisibilityChange={handleBatchVisibilityChange}
                    onShowAll={handleShowAll}
                    onHideAll={handleHideAll}
                  />
                  <Dropdown
                    menu={tableOptionsMenu}
                    trigger={['click']}
                    placement='bottomRight'
                  >
                    <Button size='small' icon={<SettingOutlined />}>
                      {t('chart.tableOptions')}
                    </Button>
                  </Dropdown>
                </Space>
              </div>
            }
            className='shadow-sm !mb-6'
          >
            <Table
              columns={generateColumns(benchmark.allTests)}
              dataSource={sortedModels}
              pagination={{
                defaultPageSize: pageSize,
                pageSize: pageSize,
                showSizeChanger: false,
                showTotal: (total) => t('chart.totalModels', { total }),
              }}
              scroll={{ x: 'max-content' }}
              size={tableSize}
              bordered
            />
          </Card>
        );
      })}
    </div>
  );
};

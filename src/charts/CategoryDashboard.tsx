import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Card, Button, Radio } from 'antd';
import {
  BarChartOutlined,
  AppstoreOutlined,
  UpOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
  RadarChartOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import type { DataSource } from '../types';
import {
  flattenDatasetResults,
  groupByCategory,
  getSourceIdentifier,
} from '../features/transform';
import { formatValue } from '../features/transform';
import { CompactDashboard } from './CompactDashboard';

// Helper to get CSS variable values for D3 charts
const getCssVar = (varName: string): string => {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
};

interface CategoryDashboardProps {
  sources: DataSource[];
  scale0100: boolean;
}

interface CategoryStats {
  name: string;
  testCount: number;
  tests: Array<{
    testName: string;
    fullPath: string;
    dataset: string; // e.g., "mmlu", "tmmluplus"
    values: Map<string, { avg: number; min: number; max: number }>; // sourceIdentifier -> accuracy stats
  }>;
  avgPerModel: Map<string, number>; // sourceIdentifier -> avg
  minPerModel: Map<string, number>; // sourceIdentifier -> min
  maxPerModel: Map<string, number>; // sourceIdentifier -> max
  overallAvg: number;
  overallMin: number;
  overallMax: number;
  variance: number;
}

export const CategoryDashboard: React.FC<CategoryDashboardProps> = ({
  sources,
  scale0100,
}) => {
  const { t } = useTranslation();
  const { isDarkMode } = useTheme();
  const detailChartRef = useRef<HTMLDivElement>(null);

  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [highlightedModel, setHighlightedModel] = useState<string | null>(null);
  const [testSortMode, setTestSortMode] = useState<
    'accuracy' | 'benchmark' | 'name'
  >('accuracy');
  const [selectedBenchmark, setSelectedBenchmark] = useState<string | null>(
    null,
  );

  // Reset selected benchmark when category changes
  useEffect(() => {
    setSelectedBenchmark(null);
  }, [expandedCategory]);

  // Process data hierarchically by category
  const categoryStats = useMemo(() => {
    const categories = new Map<string, CategoryStats>();

    sources.forEach((source) => {
      const sourceId = getSourceIdentifier(source);
      const results = flattenDatasetResults(source.rawData);
      const grouped = groupByCategory(results);

      // Extract individual runs data from rawData
      const rawData = source.rawData as Record<string, unknown>;
      const datasetResults = (rawData?.dataset_results || {}) as Record<
        string,
        unknown
      >;

      for (const [categoryName, categoryResults] of Object.entries(grouped)) {
        if (!categories.has(categoryName)) {
          categories.set(categoryName, {
            name: categoryName,
            testCount: 0,
            tests: [],
            avgPerModel: new Map(),
            minPerModel: new Map(),
            maxPerModel: new Map(),
            overallAvg: 0,
            overallMin: 1,
            overallMax: 0,
            variance: 0,
          });
        }

        const catData = categories.get(categoryName)!;

        // Process each test result
        categoryResults.forEach((result) => {
          // Use testName as the key to group same tests across different models
          const testName = result.category.split('/').pop() || result.category;
          // Extract dataset name from the full path (e.g., "mmlu/test" -> "mmlu")
          const datasetName = result.category.split('/')[0] || 'unknown';

          let testEntry = catData.tests.find((t) => t.testName === testName);
          if (!testEntry) {
            testEntry = {
              testName: testName,
              fullPath: result.category,
              dataset: datasetName,
              values: new Map(),
            };
            catData.tests.push(testEntry);
          }

          // Extract min/max from individual runs if available
          let min = result.accuracy_mean;
          let max = result.accuracy_mean;

          // Try to find the individual runs data - match by exact file path
          for (const [, datasetValue] of Object.entries(datasetResults)) {
            const dataset = datasetValue as Record<string, unknown>;
            if (dataset?.results && Array.isArray(dataset.results)) {
              const testResult = dataset.results.find(
                (r: Record<string, unknown>) => {
                  const file = r.file as string | undefined;
                  // Match by exact file path to avoid cross-contamination
                  return file === result.file;
                },
              ) as Record<string, unknown> | undefined;

              if (testResult?.individual_runs) {
                const individualRuns = testResult.individual_runs as Record<
                  string,
                  unknown
                >;
                const accuracies = individualRuns.accuracies as
                  | number[]
                  | undefined;
                if (
                  accuracies &&
                  Array.isArray(accuracies) &&
                  accuracies.length > 0
                ) {
                  min = Math.min(...accuracies);
                  max = Math.max(...accuracies);
                  break; // Found the right test, stop searching
                }
              }
            }
          }

          testEntry.values.set(sourceId, {
            avg: result.accuracy_mean,
            min,
            max,
          });
        });
      }
    });

    // Calculate statistics for each category
    categories.forEach((catData) => {
      catData.testCount = catData.tests.length;

      sources.forEach((source) => {
        const sourceId = getSourceIdentifier(source);
        const accuracies: number[] = [];
        catData.tests.forEach((test) => {
          const val = test.values.get(sourceId);
          if (val !== undefined) accuracies.push(val.avg);
        });

        if (accuracies.length > 0) {
          const avg = d3.mean(accuracies)!;
          const min = d3.min(accuracies)!;
          const max = d3.max(accuracies)!;
          catData.avgPerModel.set(sourceId, avg);
          catData.minPerModel.set(sourceId, min);
          catData.maxPerModel.set(sourceId, max);
        }
      });

      // Calculate overall stats across all models
      const allAvgs = Array.from(catData.avgPerModel.values());
      if (allAvgs.length > 0) {
        catData.overallAvg = d3.mean(allAvgs)!;
        catData.overallMin = d3.min(Array.from(catData.minPerModel.values()))!;
        catData.overallMax = d3.max(Array.from(catData.maxPerModel.values()))!;

        // Variance across models (shows how much models differ)
        const mean = catData.overallAvg;
        catData.variance =
          allAvgs.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
          allAvgs.length;
      }
    });

    // Return categories as array (no sorting needed for radar chart)
    return Array.from(categories.values());
  }, [sources]);

  const colorScale = useMemo(
    () =>
      d3
        .scaleOrdinal(d3.schemeCategory10)
        .domain(sources.map((s) => getSourceIdentifier(s))),
    [sources],
  );

  // Render Detailed Test Chart when category is expanded
  useEffect(() => {
    if (!detailChartRef.current || !expandedCategory) return;

    const container = detailChartRef.current;

    // NOTE: We do NOT clear the chart if only highlightedModel changes because we handle that in a separate effect.
    // But since this effect depends on other things, we clear it here.
    d3.select(container).selectAll('*').remove();

    const categoryInfo = categoryStats.find((c) => c.name === expandedCategory);
    if (!categoryInfo) return;

    // Create a color scale for datasets/benchmarks
    const uniqueDatasets = Array.from(
      new Set(categoryInfo.tests.map((t) => t.dataset)),
    );
    const datasetColorScale = d3
      .scaleOrdinal(d3.schemePaired)
      .domain(uniqueDatasets);

    // Filter tests based on selected benchmark
    const filteredTests = selectedBenchmark
      ? categoryInfo.tests.filter((t) => t.dataset === selectedBenchmark)
      : categoryInfo.tests;

    // Sort tests
    const sortedTests = [...filteredTests].sort((a, b) => {
      if (testSortMode === 'accuracy') {
        const avgA =
          d3.mean(Array.from(a.values.values()).map((v) => v.avg)) || 0;
        const avgB =
          d3.mean(Array.from(b.values.values()).map((v) => v.avg)) || 0;
        return avgB - avgA; // Descending
      } else if (testSortMode === 'benchmark') {
        // Group by benchmark first, then by accuracy within each benchmark
        if (a.dataset !== b.dataset) {
          return a.dataset.localeCompare(b.dataset);
        }
        const avgA =
          d3.mean(Array.from(a.values.values()).map((v) => v.avg)) || 0;
        const avgB =
          d3.mean(Array.from(b.values.values()).map((v) => v.avg)) || 0;
        return avgB - avgA;
      } else {
        return a.testName.localeCompare(b.testName);
      }
    });

    const width = container.clientWidth;
    // Responsive margins - smaller on mobile (labels above bars, not on left)
    const isMobile = width < 940;

    // Calculate mobile legend height dynamically
    let mobileLegendHeight = 0;
    if (isMobile) {
      const maxWidth = width - 20;
      let currentX = 0;
      let rowY = 16;
      sources.forEach((source) => {
        const varianceLabel =
          source.variance !== 'default' ? ` (${source.variance})` : '';
        const fullName = `${source.modelName}${varianceLabel}`;
        const itemWidth = fullName.length * 5.5 + 18;

        if (currentX + itemWidth > maxWidth && currentX > 0) {
          currentX = 0;
          rowY += 16;
        }
        currentX += itemWidth;
      });

      // Add space for Benchmarks title
      rowY += 30;
      currentX = 0;

      // Calculate Benchmark rows
      uniqueDatasets.forEach((dataset) => {
        const itemWidth = dataset.length * 5.5 + 20;
        if (currentX + itemWidth > maxWidth && currentX > 0) {
          currentX = 0;
          rowY += 16;
        }
        currentX += itemWidth;
      });
      mobileLegendHeight = rowY;
    }

    const margin = {
      top: isMobile ? Math.max(80, mobileLegendHeight + 50) : 70,
      right: isMobile ? 10 : 160,
      bottom: 50,
      left: isMobile ? 10 : 300,
    };
    // Dynamic height - more space per test on mobile to fit label above bars
    const testHeight = Math.max(
      isMobile ? 60 : 50,
      (isMobile ? 14 : 15) * sources.length,
    );
    const height = Math.max(
      450,
      sortedTests.length * testHeight + margin.top + margin.bottom,
    );

    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    // Title - responsive for mobile
    const titleText = isMobile
      ? expandedCategory
      : `${expandedCategory} - ${t('chart.detailedResults')}`;
    svg
      .append('text')
      .attr('x', width / 2)
      .attr('y', isMobile ? 18 : 25)
      .attr('text-anchor', 'middle')
      .style('font-size', isMobile ? '12px' : '18px')
      .style('font-weight', 'bold')
      .style('fill', getCssVar('--chart-text-primary'))
      .text(titleText);

    if (!isMobile) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', 48)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('fill', getCssVar('--chart-text-secondary'))
        .text(
          `${t('chart.testCount', { count: categoryInfo.testCount })} • ${t('chart.benchmarksShown')} • ${t('chart.modelsSideBySide')}`,
        );
    }

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Scales - use testName as key since we group by testName across models
    const yScale = d3
      .scaleBand()
      .domain(sortedTests.map((t) => t.testName))
      .range([0, innerHeight])
      .padding(0.3);

    const xScale = d3.scaleLinear().domain([0, 1]).range([0, innerWidth]);

    // Create a sub-band scale for models within each test
    const modelScale = d3
      .scaleBand()
      .domain(sources.map((s) => getSourceIdentifier(s)))
      .range([0, yScale.bandwidth()])
      .padding(0.1);

    // Y Axis - Test names with ranking and color-coded dataset badges
    sortedTests.forEach((test, idx) => {
      const rank = idx + 1;
      const datasetColor = datasetColorScale(test.dataset) as string;
      const badgeY = (yScale(test.testName) || 0) + yScale.bandwidth() / 2;

      if (isMobile) {
        // Mobile: Put test name ABOVE the bars with full text
        // Rank and full test name at the top of each test's bar section
        const testTop = yScale(test.testName) || 0;
        g.append('text')
          .attr('x', 0)
          .attr('y', testTop - 3)
          .attr('text-anchor', 'start')
          .attr('dominant-baseline', 'auto')
          .style('font-size', '9px')
          .style('font-weight', 'bold')
          .style('fill', datasetColor)
          .text(`#${rank} ${test.testName}`)
          .append('title')
          .text(`${test.dataset}/${test.testName}`);
      } else {
        // Desktop: Full layout with rank, dataset badge, and test name
        // Rank badge
        g.append('text')
          .attr('x', -margin.left + 10)
          .attr('y', badgeY - 6)
          .attr('text-anchor', 'start')
          .attr('dominant-baseline', 'middle')
          .style('font-size', '10px')
          .style('font-weight', 'bold')
          .style(
            'fill',
            rank <= 3 ? '#faad14' : getCssVar('--chart-text-muted'),
          )
          .text(`#${rank}`);

        // Color-coded dataset badge background
        const datasetText =
          test.dataset.length > 10
            ? test.dataset.slice(0, 8) + '..'
            : test.dataset;

        g.append('rect')
          .attr('x', -margin.left + 36)
          .attr('y', badgeY - 14)
          .attr('width', datasetText.length * 6.5 + 8)
          .attr('height', 16)
          .attr('fill', datasetColor)
          .attr('opacity', 0.2)
          .attr('rx', 3)
          .style('cursor', 'help')
          .append('title')
          .text(`${t('chart.benchmarkLabel')}: ${test.dataset}`);

        // Dataset badge text
        g.append('text')
          .attr('x', -margin.left + 40)
          .attr('y', badgeY - 6)
          .attr('text-anchor', 'start')
          .attr('dominant-baseline', 'middle')
          .style('font-size', '9px')
          .style('font-weight', 'bold')
          .style('fill', datasetColor)
          .style('cursor', 'help')
          .text(datasetText)
          .append('title')
          .text(`${t('chart.benchmarkLabel')}: ${test.dataset}`);

        // Test name
        g.append('text')
          .attr('x', -margin.left + 36)
          .attr('y', badgeY + 10)
          .attr('text-anchor', 'start')
          .attr('dominant-baseline', 'middle')
          .style('font-size', '11px')
          .style('fill', getCssVar('--chart-text-primary'))
          .text(
            test.testName.length > 42
              ? test.testName.slice(0, 40) + '...'
              : test.testName,
          )
          .append('title')
          .text(`${test.dataset}/${test.testName}`);
      }
    });

    // Draw bars - models side-by-side, each showing min/avg/max
    const barGroupHeight = modelScale.bandwidth();
    const barHeight = barGroupHeight / 3; // 3 bars: min, avg, max

    sortedTests.forEach((test) => {
      const testY = yScale(test.testName) || 0;

      sources.forEach((source) => {
        const sourceId = getSourceIdentifier(source);
        const stats = test.values.get(sourceId);
        if (!stats) return;

        const isHighlighted =
          !highlightedModel || highlightedModel === sourceId;
        const modelY = testY + (modelScale(sourceId) || 0);
        const color = colorScale(sourceId) as string;

        // Color indicator bar (thin vertical bar on the left edge)
        g.append('rect')
          .attr('class', 'model-indicator')
          .attr('data-source-id', sourceId)
          .attr('x', -3)
          .attr('y', modelY)
          .attr('width', 2)
          .attr('height', barGroupHeight * 0.9)
          .attr('fill', color)
          .attr('opacity', isHighlighted ? 0.8 : 0.3)
          .attr('rx', 1)
          .style('cursor', 'pointer')
          .on('mouseenter', function () {
            setHighlightedModel(sourceId);
          })
          .on('mouseleave', function () {
            setHighlightedModel(null);
          });

        // Min bar (top, lightest)
        g.append('rect')
          .attr('class', 'model-min')
          .attr('data-source-id', sourceId)
          .attr('x', 0)
          .attr('y', modelY)
          .attr('width', 0) // Start with 0 width for animation
          .transition()
          .duration(500)
          .attr('width', xScale(stats.min))
          .selection() // Go back to selection to apply other attributes
          .attr('height', barHeight * 0.9)
          .attr('fill', color)
          .attr('opacity', isHighlighted ? 0.35 : 0.12)
          .attr('rx', 1)
          .style('cursor', 'pointer')
          .on('mouseenter', function () {
            setHighlightedModel(sourceId);
          })
          .on('mouseleave', function () {
            setHighlightedModel(null);
          })
          .append('title')
          .text(() => {
            const varianceLabel =
              source.variance !== 'default' ? ` (${source.variance})` : '';
            return `${source.modelName}${varianceLabel}\n${t('chart.min')}: ${formatValue(stats.min, scale0100)}`;
          });

        // Avg bar (middle, medium opacity)
        g.append('rect')
          .attr('class', 'model-avg')
          .attr('data-source-id', sourceId)
          .attr('x', 0)
          .attr('y', modelY + barHeight)
          .attr('width', 0)
          .transition()
          .duration(500)
          .attr('width', xScale(stats.avg))
          .selection()
          .attr('height', barHeight * 0.9)
          .attr('fill', color)
          .attr('opacity', isHighlighted ? 0.75 : 0.22)
          .attr('rx', 1)
          .style('cursor', 'pointer')
          .on('mouseenter', function () {
            setHighlightedModel(sourceId);
          })
          .on('mouseleave', function () {
            setHighlightedModel(null);
          })
          .append('title')
          .text(() => {
            const varianceLabel =
              source.variance !== 'default' ? ` (${source.variance})` : '';
            return `${source.modelName}${varianceLabel}\n${t('chart.average')}: ${formatValue(stats.avg, scale0100)}`;
          });

        // Max bar (bottom, darkest)
        g.append('rect')
          .attr('class', 'model-max')
          .attr('data-source-id', sourceId)
          .attr('x', 0)
          .attr('y', modelY + 2 * barHeight)
          .attr('width', 0)
          .transition()
          .duration(500)
          .attr('width', xScale(stats.max))
          .selection()
          .attr('height', barHeight * 0.9)
          .attr('fill', color)
          .attr('opacity', isHighlighted ? 1.0 : 0.32)
          .attr('rx', 1)
          .style('cursor', 'pointer')
          .on('mouseenter', function () {
            setHighlightedModel(sourceId);
          })
          .on('mouseleave', function () {
            setHighlightedModel(null);
          })
          .append('title')
          .text(() => {
            const varianceLabel =
              source.variance !== 'default' ? ` (${source.variance})` : '';
            return `${source.modelName}${varianceLabel}\n${t('chart.max')}: ${formatValue(stats.max, scale0100)}`;
          });

        // Label for avg bar (only if space allows)
        // Label for avg bar (always append, control visibility via update)
        if (xScale(stats.min) > 35) {
          g.append('text')
            .attr('class', 'model-avg-label')
            .attr('data-source-id', sourceId)
            .attr('x', xScale(stats.min) - 2)
            .attr('y', modelY + barHeight + barHeight / 2)
            .attr('text-anchor', 'end')
            .attr('dominant-baseline', 'middle')
            .style('font-size', '9px') // Increased from 7px for better readability
            .style('font-weight', 'bold')
            .style('fill', 'white')
            .style('pointer-events', 'none')
            .attr('opacity', isHighlighted ? 1 : 0) // Hide by default if not highlighted
            .text(formatValue(stats.avg, scale0100));
        }
      });
    });

    // X Axis
    const xAxis = d3
      .axisBottom(xScale)
      .scale(xScale)
      .ticks(isMobile ? 5 : 10)
      .tickFormat((d) => formatValue(d as number, scale0100));

    g.append('g')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(xAxis)
      .style('font-size', '11px');

    // X Axis Label
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 40)
      .attr('text-anchor', 'middle')
      .style('font-size', isMobile ? '10px' : '13px')
      .style('font-weight', 'bold')
      .style('fill', getCssVar('--chart-text-primary'))
      .text(t('chart.accuracyScore'));

    // Mobile: Horizontal legend at top (below title)
    if (isMobile) {
      const mobileLegend = svg
        .append('g')
        .attr('transform', `translate(10, 30)`);

      let currentX = 0;
      let rowY = 16;
      const maxWidth = width - 20;

      mobileLegend
        .append('text')
        .attr('x', 0)
        .attr('y', 8)
        .style('font-size', '9px')
        .style('font-weight', 'bold')
        .style('fill', getCssVar('--chart-text-primary'))
        .text(t('chart.legendModels'));

      sources.forEach((source) => {
        const color = colorScale(getSourceIdentifier(source)) as string;
        const varianceLabel =
          source.variance !== 'default' ? ` (${source.variance})` : '';
        const fullName = `${source.modelName}${varianceLabel}`;
        const itemWidth = fullName.length * 5.5 + 18;

        if (currentX + itemWidth > maxWidth && currentX > 0) {
          currentX = 0;
          rowY += 16;
        }

        const item = mobileLegend
          .append('g')
          .attr('transform', `translate(${currentX}, ${rowY})`);

        item
          .append('rect')
          .attr('width', 10)
          .attr('height', 10)
          .attr('fill', color)
          .attr('rx', 2);

        item
          .append('text')
          .attr('x', 14)
          .attr('y', 8)
          .style('font-size', '8px')
          .style('fill', getCssVar('--chart-text-primary'))
          .text(fullName);

        currentX += itemWidth;
      });

      // Benchmark Legend (Datasets)
      rowY += 30;
      currentX = 0;

      mobileLegend
        .append('text')
        .attr('x', 0)
        .attr('y', rowY - 8)
        .style('font-size', '9px')
        .style('font-weight', 'bold')
        .style('fill', getCssVar('--chart-text-primary'))
        .text(t('chart.legendBenchmarks'));

      uniqueDatasets.forEach((dataset) => {
        const itemWidth = dataset.length * 5.5 + 20;

        if (currentX + itemWidth > maxWidth && currentX > 0) {
          currentX = 0;
          rowY += 16;
        }

        const isSelected = selectedBenchmark === dataset;
        const isDimmed = selectedBenchmark && !isSelected;

        const item = mobileLegend
          .append('g')
          .attr('transform', `translate(${currentX}, ${rowY})`)
          .style('cursor', 'pointer')
          .on('click', () => {
            setSelectedBenchmark(isSelected ? null : dataset);
          });

        item
          .append('rect')
          .attr('width', 10)
          .attr('height', 10)
          .attr('fill', datasetColorScale(dataset) as string)
          .attr('opacity', isSelected ? 1 : isDimmed ? 0.2 : 0.6)
          .attr('rx', 2);

        if (isSelected) {
          item
            .append('circle')
            .attr('cx', 5)
            .attr('cy', 5)
            .attr('r', 2)
            .attr('fill', 'white');
        }

        item
          .append('text')
          .attr('x', 14)
          .attr('y', 8)
          .style('font-size', '8px')
          .style('fill', getCssVar('--chart-text-primary'))
          .attr('opacity', isDimmed ? 0.4 : 1)
          .text(dataset);

        currentX += itemWidth;
      });
    } else {
      // Desktop: Side legend for Models
      const legend = svg
        .append('g')
        .attr(
          'transform',
          `translate(${width - margin.right + 12}, ${margin.top})`,
        );

      legend
        .append('text')
        .attr('x', 0)
        .attr('y', 0)
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .style('fill', getCssVar('--chart-text-primary'))
        .text(`${t('chart.legendModels')}:`);
      sources.forEach((source, i) => {
        const sourceId = getSourceIdentifier(source);
        const legendRow = legend
          .append('g')
          .attr('transform', `translate(0, ${(i + 1) * 22})`)
          .style('cursor', 'pointer')
          .on('mouseenter', () => setHighlightedModel(sourceId))
          .on('mouseleave', () => setHighlightedModel(null));

        legendRow
          .append('rect')
          .attr('width', 14)
          .attr('height', 14)
          .attr('fill', colorScale(sourceId) as string)
          .attr('opacity', 0.85)
          .attr('rx', 2);

        legendRow
          .append('text')
          .attr('class', 'model-legend-text') // Class for easy selection
          .attr('data-source-id', sourceId)
          .attr('x', 18)
          .attr('y', 11)
          .style('font-size', '10px')
          .style('fill', getCssVar('--chart-text-primary'))
          .style(
            'font-weight',
            highlightedModel === sourceId ? 'bold' : 'normal',
          )
          .text(() => {
            const varianceLabel =
              source.variance !== 'default' ? ` (${source.variance})` : '';
            const fullName = `${source.modelName}${varianceLabel}`;
            return fullName.length > 16
              ? fullName.slice(0, 14) + '...'
              : fullName;
          });
      });

      // Legend for Benchmarks/Datasets (desktop only)
      const datasetLegend = svg
        .append('g')
        .attr(
          'transform',
          `translate(${width - margin.right + 12}, ${margin.top + sources.length * 22 + 40})`,
        );

      datasetLegend
        .append('text')
        .attr('x', 0)
        .attr('y', 0)
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .style('fill', getCssVar('--chart-text-primary'))
        .text(t('chart.legendBenchmarks'));
      uniqueDatasets.forEach((dataset, i) => {
        const isSelected = selectedBenchmark === dataset;
        const isDimmed = selectedBenchmark && !isSelected;

        const datasetRow = datasetLegend
          .append('g')
          .attr('transform', `translate(0, ${(i + 1) * 22})`)
          .style('cursor', 'pointer')
          .on('click', () => {
            setSelectedBenchmark(isSelected ? null : dataset);
          });

        datasetRow
          .append('rect')
          .attr('width', 14)
          .attr('height', 14)
          .attr('fill', datasetColorScale(dataset) as string)
          .attr('opacity', isSelected ? 1 : isDimmed ? 0.2 : 0.3)
          .attr('rx', 2);

        if (isSelected) {
          datasetRow
            .append('circle')
            .attr('cx', 7)
            .attr('cy', 7)
            .attr('r', 3)
            .attr('fill', 'white');
        }

        datasetRow
          .append('text')
          .attr('opacity', isDimmed ? 0.4 : 1)
          .attr('x', 18)
          .attr('y', 11)
          .style('font-size', '10px')
          .style('fill', getCssVar('--chart-text-primary'))
          .text(dataset.length > 16 ? dataset.slice(0, 14) + '...' : dataset)
          .append('title')
          .text(dataset);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    expandedCategory,
    categoryStats,
    sources,
    scale0100,
    testSortMode,
    selectedBenchmark,
    colorScale,
    isDarkMode, // Re-render chart when theme changes
  ]);

  // Separate effect for model highlighting to avoid full re-render (and re-animation)
  useEffect(() => {
    if (!detailChartRef.current) return;
    const container = d3.select(detailChartRef.current);

    sources.forEach((source) => {
      const sourceId = getSourceIdentifier(source);
      const isHighlighted = !highlightedModel || highlightedModel === sourceId;
      const duration = 200;

      // Update bars opacity
      container
        .selectAll(`.model-indicator[data-source-id="${sourceId}"]`)
        .transition()
        .duration(duration)
        .attr('opacity', isHighlighted ? 0.8 : 0.3);

      container
        .selectAll(`.model-min[data-source-id="${sourceId}"]`)
        .transition()
        .duration(duration)
        .attr('opacity', isHighlighted ? 0.35 : 0.12);

      container
        .selectAll(`.model-avg[data-source-id="${sourceId}"]`)
        .transition()
        .duration(duration)
        .attr('opacity', isHighlighted ? 0.75 : 0.22);

      container
        .selectAll(`.model-max[data-source-id="${sourceId}"]`)
        .transition()
        .duration(duration)
        .attr('opacity', isHighlighted ? 1.0 : 0.32);

      // Update avg label visibility
      container
        .selectAll(`.model-avg-label[data-source-id="${sourceId}"]`)
        .transition()
        .duration(duration)
        .attr('opacity', isHighlighted ? 1 : 0);

      // Update Legend Text Weight
      container
        .selectAll(`.model-legend-text[data-source-id="${sourceId}"]`)
        .style(
          'font-weight',
          highlightedModel === sourceId ? 'bold' : 'normal',
        );
    });
  }, [highlightedModel, sources]);

  return (
    <div className='space-y-4'>
      {/* Radar Chart View - Always Visible */}
      <Card
        title={
          <span>
            <RadarChartOutlined style={{ marginRight: 8 }} />
            {t('chart.radarTitle')}
          </span>
        }
        className={'!mb-5'}
      >
        <div className='mb-3 text-sm text-gray-600 bg-blue-50 p-3 rounded border border-blue-200'>
          <strong>💡 {t('chart.tipLabel')}</strong> {t('chart.tipText')}
        </div>
        <CompactDashboard
          sources={sources}
          scale0100={scale0100}
          selectedCategory={expandedCategory}
          highlightedModel={highlightedModel}
          onCategoryClick={(category) => {
            setExpandedCategory(
              expandedCategory === category ? null : category,
            );
          }}
          onModelHighlight={(model) => {
            setHighlightedModel(model);
          }}
        />
      </Card>

      {/* Expanded Detail Chart */}
      {expandedCategory && (
        <>
          <Card size='small' title={t('chart.testViewControls')}>
            <div className='flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap'>
              <div className='flex items-center gap-2 flex-wrap'>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>
                  {t('chart.sortTests')}
                </span>
                <Radio.Group
                  value={testSortMode}
                  onChange={(e) => setTestSortMode(e.target.value)}
                  buttonStyle='solid'
                  size='small'
                >
                  <Radio.Button value='accuracy'>
                    <SortDescendingOutlined /> {t('chart.accuracy')}
                  </Radio.Button>
                  <Radio.Button value='benchmark'>
                    <AppstoreOutlined /> {t('chart.byBenchmark')}
                  </Radio.Button>
                  <Radio.Button value='name'>
                    <SortAscendingOutlined /> A-Z
                  </Radio.Button>
                </Radio.Group>
              </div>
              <Button
                size='small'
                icon={<UpOutlined />}
                onClick={() => setExpandedCategory(null)}
              >
                {t('chart.collapse')}
              </Button>
            </div>
          </Card>
          <Card
            title={
              <span>
                <BarChartOutlined style={{ marginRight: 8 }} />
                {t('chart.detailedResults')}: {expandedCategory}
              </span>
            }
            className='!mt-5'
          >
            <div
              ref={detailChartRef}
              style={{ width: '100%', minHeight: 450 }}
            />
          </Card>
        </>
      )}
    </div>
  );
};

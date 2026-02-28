import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useTheme } from '../contexts/ThemeContext';
import type { DataSource, CategoryKey } from '../types';
import {
  flattenDatasetResults,
  groupByCategory,
  getSourceIdentifier,
} from '../features/transform';
import { formatValue } from '../features/transform';

// Helper to get CSS variable values for D3 charts
const getCssVar = (varName: string): string => {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
};

interface CompactDashboardProps {
  sources: DataSource[];
  scale0100: boolean;
  onCategoryClick?: (category: string) => void;
  selectedCategory?: string | null;
  highlightedModel?: string | null;
  onModelHighlight?: (model: string | null) => void;
}

interface CategoryData {
  category: CategoryKey;
  mean: number;
  count: number;
}

interface RadarDataPoint {
  axis: string;
  value: number;
}

// Proper D3 Radar Chart Implementation using lineRadial
function drawRadarChart(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  categoryData: CategoryData[],
  sources: DataSource[],
  width: number,
  height: number,
  scale0100: boolean,
  highlightedModel: string | null,
  selectedCategory: string | null,
  activeBenchmarks: Set<string>,
  availableBenchmarks: string[],
  onCategoryClick: (category: string) => void,
  onModelClick: (model: string) => void,
  onBenchmarkToggle: (benchmark: string) => void,
  t: TFunction,
  isDarkMode: boolean,
) {
  // Responsive margins based on width
  const isMobile = width < 940;
  // Calculate dynamic top margin to avoid "half cut" chart
  // Labels extend outwards by ~15% of radius (rScale(1) * 1.15)
  // We need to ensure margin.top accommodates the title + label overflow
  const sideMargins = isMobile ? 60 : 440; // left + right
  const estimatedRadius = (width - sideMargins) / 2;
  const labelOverflow = estimatedRadius * 0.15;
  const titleHeight = 50; // Title Y is ~20-25, plus font size
  const calculatedTopMargin = titleHeight + labelOverflow + 10;

  const margin = {
    top: isMobile ? calculatedTopMargin : 100,
    right: isMobile ? 30 : 220,
    bottom: isMobile ? 40 : 80,
    left: isMobile ? 30 : 220,
  };
  const radius =
    Math.min(
      width - margin.left - margin.right,
      isMobile ? 10000 : height - margin.top - margin.bottom,
    ) / 2;
  const centerX = width / 2;
  // On mobile, align to top (margin.top + radius)
  const centerY = isMobile ? margin.top + radius : height / 2 + 20;

  // Use all categories - no limit
  const topCategories = categoryData;
  const allAxis = topCategories.map((d) => d.category);
  const total = allAxis.length;
  const angleSlice = (Math.PI * 2) / total;

  // Color scale
  const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

  // Radius scale
  const rScale = d3.scaleLinear().domain([0, 1]).range([0, radius]);

  // Main group
  const g = svg
    .append('g')
    .attr('transform', `translate(${centerX}, ${centerY})`);

  // Draw circular grid
  const levels = 5;
  for (let level = 1; level <= levels; level++) {
    const levelRadius = (radius / levels) * level;

    g.append('circle')
      .attr('r', levelRadius)
      .attr('fill', 'none')
      .attr('stroke', isDarkMode ? 'rgba(255, 255, 255, 0.2)' : '#CDCDCD')
      .attr('stroke-width', level === levels ? 2 : 1)
      .attr('opacity', 0.5);

    // Add value labels
    if (level < levels) {
      g.append('text')
        .attr('x', 5)
        .attr('y', -levelRadius)
        .attr('dy', '0.4em')
        .style('font-size', '10px')
        .attr('fill', isDarkMode ? 'rgba(255, 255, 255, 0.5)' : '#737373')
        .text(formatValue(level / levels, scale0100));
    }
  }

  // Draw axes
  const axis = g
    .selectAll('.axis')
    .data(allAxis)
    .enter()
    .append('g')
    .attr('class', 'axis');

  axis
    .append('line')
    .attr('x1', 0)
    .attr('y1', 0)
    .attr('x2', (_d, i) => rScale(1) * Math.cos(angleSlice * i - Math.PI / 2))
    .attr('y2', (_d, i) => rScale(1) * Math.sin(angleSlice * i - Math.PI / 2))
    .attr('stroke', (d) =>
      selectedCategory === d
        ? '#1890ff'
        : isDarkMode
          ? 'rgba(255, 255, 255, 0.2)'
          : '#CDCDCD',
    )
    .attr('stroke-width', (d) => (selectedCategory === d ? 2 : 1));

  // Draw axis labels (clickable)
  axis
    .append('text')
    .attr('class', 'axis-label')
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .attr('x', (_d, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      return rScale(1) * 1.15 * Math.cos(angle);
    })
    .attr('y', (_d, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      return rScale(1) * 1.15 * Math.sin(angle);
    })
    .text((d) => {
      const categoryInfo = topCategories.find((c) => c.category === d);
      const translatedName = t(
        `categories.${d}` as `categories.${CategoryKey}`,
      );
      const maxLen = isMobile ? 12 : 18;
      const shortName =
        translatedName.length > maxLen
          ? translatedName.substring(0, maxLen - 3) + '...'
          : translatedName;
      return categoryInfo ? `${shortName} (${categoryInfo.count})` : shortName;
    })
    .style('font-size', isMobile ? '9px' : '11px')
    .style('font-weight', (d) => (selectedCategory === d ? 'bold' : 'normal'))
    .style('fill', (d) =>
      selectedCategory === d ? '#1890ff' : getCssVar('--chart-text-primary'),
    )
    .style('cursor', 'pointer')
    .each(function (d, i) {
      // Add background box for better readability
      const textNode = this as SVGTextElement;
      const bbox = textNode.getBBox();
      const angle = angleSlice * i - Math.PI / 2;
      const x = rScale(1) * 1.15 * Math.cos(angle);
      const y = rScale(1) * 1.15 * Math.sin(angle);

      const parentNode = textNode.parentNode as SVGGElement;
      d3.select(parentNode)
        .insert('rect', 'text')
        .attr('x', x - bbox.width / 2 - 4)
        .attr('y', y - bbox.height / 2 - 2)
        .attr('width', bbox.width + 8)
        .attr('height', bbox.height + 4)
        .attr(
          'fill',
          selectedCategory === d
            ? isDarkMode
              ? '#1a3653'
              : '#e6f7ff'
            : isDarkMode
              ? '#1a1f2e'
              : 'white',
        )
        .attr(
          'stroke',
          selectedCategory === d
            ? '#1890ff'
            : isDarkMode
              ? 'rgba(255, 255, 255, 0.2)'
              : '#d9d9d9',
        )
        .attr('stroke-width', 1)
        .attr('rx', 3)
        .style('cursor', 'pointer')
        .on('click', () => onCategoryClick(d));
    })
    .on('click', (_event, d) => onCategoryClick(d))
    .append('title')
    .text((d) => {
      const categoryInfo = topCategories.find((c) => c.category === d);
      const translatedName = t(
        `categories.${d}` as `categories.${CategoryKey}`,
      );
      return `${translatedName}\n${t('chart.testsCount', { count: categoryInfo?.count || 0 })}\n${t('chart.clickToFocus')}`;
    });

  // Prepare data for each source
  const radarData = sources.map((source) => {
    const sourceId = getSourceIdentifier(source);
    const results = flattenDatasetResults(source.rawData).filter((r) =>
      activeBenchmarks.has(r.category.split('/')[0]),
    );
    const grouped = groupByCategory(results);

    return {
      source: sourceId,
      isOfficial: source.isOfficial,
      modelName: source.modelName,
      variance: source.variance,
      values: allAxis.map((axis) => {
        const categoryResults = grouped[axis] || [];
        const meanAccuracy =
          categoryResults.length > 0
            ? d3.mean(categoryResults, (d) => d.accuracy_mean) || 0
            : 0;
        return {
          axis,
          value: meanAccuracy,
        };
      }),
    };
  });

  // Function to generate polygon coordinates using lineRadial
  // Properly configure the angle to match axis positions exactly
  const radarLine = d3
    .lineRadial<RadarDataPoint>()
    .radius((d) => rScale(d.value))
    .angle((_d, i) => i * angleSlice)
    .curve(d3.curveLinearClosed); // Use curveLinearClosed for proper polygon closure

  // Draw radar blobs
  radarData.forEach((data, idx) => {
    const color = colorScale(idx.toString());
    const isHighlighted = !highlightedModel || highlightedModel === data.source;
    const opacity = isHighlighted ? 1 : 0.2;

    // Radar area (filled polygon) - curveLinearClosed handles closing automatically
    const radarPath = g
      .append('path')
      .datum(data.values)
      .attr('class', `radar-area radar-area-${idx}`)
      .attr('d', radarLine)
      .style('fill', color)
      .style('fill-opacity', 0.2 * opacity)
      .style('stroke', color)
      .style('stroke-width', isHighlighted ? 2.5 : 1.5)
      .style('opacity', opacity)
      .style('cursor', 'pointer')
      .on('mouseenter', function () {
        // Temporarily highlight this model on hover
        d3.select(this).style('fill-opacity', 0.4).style('stroke-width', 3.5);
      })
      .on('mouseleave', function () {
        // Restore original style
        d3.select(this)
          .style('fill-opacity', 0.2 * opacity)
          .style('stroke-width', isHighlighted ? 2.5 : 1.5);
      })
      .on('click', function () {
        // Toggle model highlight on click
        onModelClick(data.source);
      });

    radarPath.append('title').text(() => {
      const varianceLabel =
        data.variance !== 'default' ? ` (${data.variance})` : '';
      return `${radarData.find((d) => d.source === data.source)?.source ? sources.find((s) => getSourceIdentifier(s) === data.source)?.provider + ' — ' : ''}${data.modelName}${varianceLabel}${data.isOfficial ? ` (${t('chart.officialTag')})` : ''}${sources.find((s) => getSourceIdentifier(s) === data.source)?.openSource ? ' (OSS)' : ''}\n${t('chart.clickToToggleHighlight')}`;
    });

    // Radar circles (data points)
    g.selectAll(`.radar-circle-${idx}`)
      .data(data.values)
      .enter()
      .append('circle')
      .attr('class', `radar-circle radar-circle-${idx}`)
      .attr('r', isHighlighted ? 4.5 : 3)
      .attr(
        'cx',
        (d, i) => rScale(d.value) * Math.cos(angleSlice * i - Math.PI / 2),
      )
      .attr(
        'cy',
        (d, i) => rScale(d.value) * Math.sin(angleSlice * i - Math.PI / 2),
      )
      .style('fill', color)
      .style('stroke', 'white')
      .style('stroke-width', 2)
      .style('opacity', opacity)
      .style('cursor', 'pointer')
      .on('mouseenter', function (event, d) {
        // Enlarge circle
        d3.select(this).attr('r', 7).style('stroke-width', 3);

        // Highlight the entire radar path temporarily
        g.select(`.radar-area-${idx}`)
          .style('fill-opacity', 0.4)
          .style('stroke-width', 3.5);

        // Show tooltip
        const [mouseX, mouseY] = d3.pointer(event, svg.node());
        const tooltip = svg
          .append('g')
          .attr('class', 'tooltip-radar')
          .attr('transform', `translate(${mouseX + 10}, ${mouseY - 10})`);

        const varianceLabel =
          data.variance !== 'default' ? ` (${data.variance})` : '';
        const sourceData = sources.find(
          (s) => getSourceIdentifier(s) === data.source,
        );
        const providerLabel = sourceData?.provider
          ? `${sourceData.provider} — `
          : '';
        const text = `${providerLabel}${data.modelName}${varianceLabel}\n${d.axis}: ${formatValue(d.value, scale0100)}`;
        const lines = text.split('\n');

        tooltip
          .selectAll('text')
          .data(lines)
          .enter()
          .append('text')
          .attr('y', (_d, i) => i * 16)
          .attr('dy', '0.35em')
          .style('font-size', '12px')
          .style('font-weight', (_d, i) => (i === 0 ? 'bold' : 'normal'))
          .text((d) => d);

        const bbox = (tooltip.node() as SVGGElement).getBBox();
        tooltip
          .insert('rect', 'text')
          .attr('x', bbox.x - 4)
          .attr('y', bbox.y - 4)
          .attr('width', bbox.width + 8)
          .attr('height', bbox.height + 8)
          .attr('fill', 'white')
          .attr('stroke', color)
          .attr('stroke-width', 2)
          .attr('rx', 4);
      })
      .on('mouseleave', function () {
        // Reset circle size
        d3.select(this)
          .attr('r', isHighlighted ? 4.5 : 3)
          .style('stroke-width', 2);

        // Reset radar path
        g.select(`.radar-area-${idx}`)
          .style('fill-opacity', 0.2 * opacity)
          .style('stroke-width', isHighlighted ? 2.5 : 1.5);

        svg.selectAll('.tooltip-radar').remove();
      })
      .on('click', function () {
        // Toggle model highlight on click
        onModelClick(data.source);
      })
      .append('title')
      .text((d) => {
        const varianceLabel =
          data.variance !== 'default' ? ` (${data.variance})` : '';
        return `${data.modelName}${varianceLabel}\n${d.axis}: ${formatValue(d.value, scale0100)}\n${t('chart.clickToToggleHighlight')}`;
      });
  });

  // Add title - responsive for mobile
  svg
    .append('text')
    .attr('x', width / 2)
    .attr('y', isMobile ? 20 : 25)
    .attr('text-anchor', 'middle')
    .style('font-size', isMobile ? '14px' : '18px')
    .style('font-weight', 'bold')
    .style('fill', getCssVar('--chart-text-primary'))
    .text(
      isMobile
        ? (t as (k: string) => string)('chart.radarTitleShort')
        : t('chart.radarTitle'),
    );

  if (!isMobile) {
    svg
      .append('text')
      .attr('x', width / 2)
      .attr('y', 48)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', getCssVar('--chart-text-secondary'))
      .text(t('chart.radarSubtitle'));
  }

  // Legend (clickable) - Grouped by provider
  // Only show legend on larger screens
  if (!isMobile) {
    const legendG = svg
      .append('g')
      .attr('transform', `translate(${width - 200}, 100)`);

    legendG
      .append('text')
      .attr('x', 0)
      .attr('y', -10)
      .style('font-size', '13px')
      .style('font-weight', 'bold')
      .style('fill', getCssVar('--chart-text-primary'))
      .text(t('chart.legendModels'));

    legendG
      .append('text')
      .attr('x', 0)
      .attr('y', 5)
      .style('font-size', '10px')
      .style('fill', getCssVar('--chart-text-secondary'))
      .text(t('chart.legendClickToHighlight'));

    // Group sources by provider
    const groupedByProvider = sources.reduce(
      (acc, source, idx) => {
        const provider = source.provider;
        if (!acc[provider]) {
          acc[provider] = [];
        }
        acc[provider].push({ source, index: idx });
        return acc;
      },
      {} as Record<string, Array<{ source: DataSource; index: number }>>,
    );

    let currentY = 25;

    // Render each provider group
    Object.entries(groupedByProvider).forEach(([provider, items]) => {
      // Provider header
      legendG
        .append('text')
        .attr('x', 0)
        .attr('y', currentY)
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .style('fill', getCssVar('--chart-text-secondary'))
        .text(provider);

      currentY += 20;

      // Render each model in the group
      items.forEach(({ source, index: i }) => {
        const sourceId = getSourceIdentifier(source);
        const color = colorScale(i.toString());
        const isHighlighted =
          !highlightedModel || highlightedModel === sourceId;
        const isSelected = highlightedModel === sourceId;

        const legendItem = legendG
          .append('g')
          .attr('transform', `translate(10, ${currentY})`)
          .attr('class', 'legend-item')
          .style('cursor', 'pointer')
          .style('opacity', isHighlighted ? 1 : 0.4)
          .on('click', () => onModelClick(sourceId))
          .on('mouseenter', function () {
            d3.select(this).style('opacity', 1);
          })
          .on('mouseleave', function () {
            d3.select(this).style('opacity', isHighlighted ? 1 : 0.4);
          });

        // Line sample
        legendItem
          .append('line')
          .attr('x1', 0)
          .attr('x2', 25)
          .attr('y1', 0)
          .attr('y2', 0)
          .attr('stroke', color)
          .attr('stroke-width', isSelected ? 3 : 2);

        // Circle sample
        legendItem
          .append('circle')
          .attr('cx', 12.5)
          .attr('cy', 0)
          .attr('r', isSelected ? 5 : 4)
          .attr('fill', color)
          .attr('stroke', 'white')
          .attr('stroke-width', 2);

        // Model name without provider
        const varianceLabel =
          source.variance !== 'default' ? ` (${source.variance})` : '';
        const fullModelName = `${source.modelName}${varianceLabel}`;
        const modelLabel =
          fullModelName.length > 20
            ? fullModelName.substring(0, 17) + '...'
            : fullModelName;

        legendItem
          .append('text')
          .attr('x', 33)
          .attr('y', 0)
          .attr('dy', '0.35em')
          .style('font-size', '10px')
          .style('font-weight', isSelected ? 'bold' : 'normal')
          .style(
            'fill',
            isSelected ? '#1890ff' : getCssVar('--chart-text-primary'),
          )
          .text(
            modelLabel +
              (source.isOfficial ? ' ⭐' : '') +
              (source.openSource ? ' 🟢' : ''),
          );

        legendItem
          .append('title')
          .text(
            fullModelName +
              (source.isOfficial ? ` (${t('chart.officialTag')})` : '') +
              (source.openSource ? ' (OSS)' : ''),
          );

        currentY += 25;
      });

      currentY += 10; // Extra spacing between provider groups
    });

    // -------- NEW DESKTOP BENCHMARK LEGEND --------
    currentY += 20;

    legendG
      .append('text')
      .attr('x', 0)
      .attr('y', currentY)
      .style('font-size', '13px')
      .style('font-weight', 'bold')
      .style('fill', getCssVar('--chart-text-primary'))
      .text(t('chart.legendBenchmarks', { defaultValue: 'Benchmarks' }));

    currentY += 20;

    availableBenchmarks.forEach((bm) => {
      const isActive = activeBenchmarks.has(bm);
      const bmItem = legendG
        .append('g')
        .attr('transform', `translate(10, ${currentY})`)
        .style('cursor', 'pointer')
        .style('opacity', isActive ? 1 : 0.4)
        .on('click', () => onBenchmarkToggle(bm))
        .on('mouseenter', function () {
          d3.select(this).style('opacity', 1);
        })
        .on('mouseleave', function () {
          d3.select(this).style('opacity', isActive ? 1 : 0.4);
        });

      // Checkbox square
      bmItem
        .append('rect')
        .attr('x', 0)
        .attr('y', -6)
        .attr('width', 12)
        .attr('height', 12)
        .attr('rx', 3)
        .attr('fill', isActive ? '#1890ff' : 'transparent')
        .attr(
          'stroke',
          isActive ? '#1890ff' : getCssVar('--chart-text-secondary'),
        )
        .attr('stroke-width', 1.5);

      if (isActive) {
        // Checkmark perfectly centered in the 12x12 rect (center 6,0)
        bmItem
          .append('path')
          .attr('d', 'M3.5,0.5 L5.5,2.5 L9.5,-2.5')
          .attr('fill', 'none')
          .attr('stroke', 'white')
          .attr('stroke-width', 1.5);
      }

      bmItem
        .append('text')
        .attr('x', 20)
        .attr('y', 0)
        .attr('dy', '0.35em')
        .style('font-size', '10px')
        .style('font-weight', isActive ? 'bold' : 'normal')
        .style('fill', isActive ? '#1890ff' : getCssVar('--chart-text-primary'))
        .text(bm);

      bmItem
        .append('title')
        .text(
          `${bm}\n${t('chart.clickToToggle', { defaultValue: 'Click to toggle' })}`,
        );

      currentY += 20;
    });
  } else {
    // Mobile legend - rendered at bottom as a compact horizontal list
    const mobileRadius = radius;
    const mobileLegendY = centerY + mobileRadius + 60;

    const mobileLegendG = svg
      .append('g')
      .attr('transform', `translate(10, ${mobileLegendY})`);

    mobileLegendG
      .append('text')
      .attr('x', 0)
      .attr('y', 0)
      .style('font-size', '11px')
      .style('font-weight', 'bold')
      .style('fill', getCssVar('--chart-text-primary'))
      .text(t('chart.legendModels'));

    let currentX = 0;
    let rowY = 20;
    const maxWidth = width - 20;

    sources.forEach((source, i) => {
      const sourceId = getSourceIdentifier(source);
      const color = colorScale(i.toString());
      const isHighlighted = !highlightedModel || highlightedModel === sourceId;
      const varianceLabel =
        source.variance !== 'default' ? ` (${source.variance})` : '';
      const fullLabel = `${source.modelName}${varianceLabel}`;
      // Add space for icons
      const iconSpace =
        (source.isOfficial ? 12 : 0) + (source.openSource ? 12 : 0);
      const itemWidth = fullLabel.length * 5.5 + 25 + iconSpace;

      // Check if item fits on current row
      if (currentX + itemWidth > maxWidth && currentX > 0) {
        currentX = 0;
        rowY += 18;
      }

      const legendItem = mobileLegendG
        .append('g')
        .attr('transform', `translate(${currentX}, ${rowY})`)
        .style('cursor', 'pointer')
        .style('opacity', isHighlighted ? 1 : 0.5)
        .on('click', () => onModelClick(sourceId));

      legendItem
        .append('line')
        .attr('x1', 0)
        .attr('x2', 12)
        .attr('y1', 0)
        .attr('y2', 0)
        .attr('stroke', color)
        .attr('stroke-width', 2);

      legendItem
        .append('circle')
        .attr('cx', 6)
        .attr('cy', 0)
        .attr('r', 3)
        .attr('fill', color);

      legendItem
        .append('text')
        .attr('x', 16)
        .attr('y', 0)
        .attr('dy', '0.35em')
        .style('font-size', '8px')
        .style('fill', getCssVar('--chart-text-primary'))
        .text(
          fullLabel +
            (source.isOfficial ? ' ⭐' : '') +
            (source.openSource ? ' 🟢' : ''),
        );

      legendItem
        .append('title')
        .text(
          fullLabel +
            (source.isOfficial ? ` (${t('chart.officialTag')})` : '') +
            (source.openSource ? ' (OSS)' : ''),
        );

      currentX += itemWidth;
    });

    // -------- NEW MOBILE BENCHMARK LEGEND --------
    rowY += 40; // Space between model legend and benchmark legend

    mobileLegendG
      .append('text')
      .attr('x', 0)
      .attr('y', rowY)
      .style('font-size', '11px')
      .style('font-weight', 'bold')
      .style('fill', getCssVar('--chart-text-primary'))
      .text(t('chart.legendBenchmarks', { defaultValue: 'Benchmarks' }));

    rowY += 20;
    currentX = 0;

    availableBenchmarks.forEach((bm) => {
      const isActive = activeBenchmarks.has(bm);
      const itemWidth = bm.length * 6 + 30; // 12 for checkbox + 18 for spacing/text

      // Check if item fits on current row
      if (currentX + itemWidth > maxWidth && currentX > 0) {
        currentX = 0;
        rowY += 18;
      }

      const bmItem = mobileLegendG
        .append('g')
        .attr('transform', `translate(${currentX}, ${rowY})`)
        .style('cursor', 'pointer')
        .style('opacity', isActive ? 1 : 0.4)
        .on('click', () => onBenchmarkToggle(bm));

      // Checkbox square
      bmItem
        .append('rect')
        .attr('x', 0)
        .attr('y', -5) // Centered vertically around y=0
        .attr('width', 10)
        .attr('height', 10)
        .attr('rx', 2)
        .attr('fill', isActive ? '#1890ff' : 'transparent')
        .attr(
          'stroke',
          isActive ? '#1890ff' : getCssVar('--chart-text-secondary'),
        )
        .attr('stroke-width', 1.5);

      if (isActive) {
        // Checkmark perfectly centered in the 10x10 rect (center 5,0)
        bmItem
          .append('path')
          .attr('d', 'M2.5,0.5 L4.5,2.5 L7.5,-2')
          .attr('fill', 'none')
          .attr('stroke', 'white')
          .attr('stroke-width', 1.5);
      }

      bmItem
        .append('text')
        .attr('x', 16)
        .attr('y', 0)
        .attr('dy', '0.35em')
        .style('font-size', '8px')
        .style('font-weight', isActive ? 'bold' : 'normal')
        .style('fill', isActive ? '#1890ff' : getCssVar('--chart-text-primary'))
        .text(bm);

      bmItem
        .append('title')
        .text(
          `${bm}\n${t('chart.clickToToggle', { defaultValue: 'Click to toggle' })}`,
        );

      currentX += itemWidth;
    });

    // Dynamically update SVG height AND viewBox to fit the mobile legend
    const requiredHeight = rowY + mobileLegendY + 60;
    if (requiredHeight > height) {
      svg.attr('height', requiredHeight);
      svg.attr('viewBox', `0 0 ${width} ${requiredHeight}`);
    }
  } // End of legend group
}

export const CompactDashboard: React.FC<CompactDashboardProps> = ({
  sources,
  scale0100,
  onCategoryClick,
  selectedCategory: externalSelectedCategory,
  highlightedModel: externalHighlightedModel,
  onModelHighlight,
}) => {
  const { t } = useTranslation();
  const { isDarkMode } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalSelectedCategory, setInternalSelectedCategory] = useState<
    string | null
  >(null);
  const [internalHighlightedModel, setInternalHighlightedModel] = useState<
    string | null
  >(null);
  const [unselectedBenchmarks, setUnselectedBenchmarks] = useState<Set<string>>(
    new Set(),
  );

  const availableBenchmarks = useMemo(() => {
    const benchmarks = new Set<string>();
    for (const source of sources) {
      const results = flattenDatasetResults(source.rawData);
      for (const result of results) {
        benchmarks.add(result.category.split('/')[0]);
      }
    }
    return Array.from(benchmarks).sort();
  }, [sources]);

  const activeBenchmarks = availableBenchmarks.filter(
    (b) => !unselectedBenchmarks.has(b),
  );

  const toggleBenchmark = (benchmark: string) => {
    setUnselectedBenchmarks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(benchmark)) {
        newSet.delete(benchmark);
      } else {
        newSet.add(benchmark);
      }
      return newSet;
    });
  };

  // Use external selected category if provided, otherwise use internal state
  const selectedCategory =
    externalSelectedCategory !== undefined
      ? externalSelectedCategory
      : internalSelectedCategory;
  const highlightedModel =
    externalHighlightedModel !== undefined
      ? externalHighlightedModel
      : internalHighlightedModel;

  useEffect(() => {
    if (!containerRef.current || sources.length === 0) return;

    const container = containerRef.current;
    d3.select(container).selectAll('*').remove();

    const width = container.clientWidth;
    const isMobile = width < 940;
    // On mobile, height should be proportional to width to avoid large vertical gaps
    // On desktop, keep 700px
    const height = isMobile ? width + 200 : 700;

    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    // Process data
    const allResults: Array<{
      category: string;
      accuracy: number;
      source: string;
      testId: string;
    }> = [];

    const activeBenchmarksSet = new Set(activeBenchmarks);

    for (const source of sources) {
      const results = flattenDatasetResults(source.rawData).filter((r) =>
        activeBenchmarksSet.has(r.category.split('/')[0]),
      );
      const grouped = groupByCategory(results);

      for (const [category, categoryResults] of Object.entries(grouped)) {
        for (const result of categoryResults) {
          allResults.push({
            category,
            accuracy: result.accuracy_mean,
            source: source.modelName,
            testId: result.category,
          });
        }
      }
    }

    // Calculate category stats
    const categoryStats = d3.group(allResults, (d) => d.category);
    const categories = Array.from(categoryStats.keys()).sort();

    const categoryData: CategoryData[] = categories
      .map((cat) => {
        const tests = categoryStats.get(cat) || [];
        const accuracies = tests.map((t) => t.accuracy);
        const uniqueTests = new Set(tests.map((t) => t.testId));
        return {
          category: cat as CategoryKey,
          mean: d3.mean(accuracies) || 0,
          count: uniqueTests.size,
        };
      })
      .sort((a, b) => b.mean - a.mean);

    drawRadarChart(
      svg,
      categoryData,
      sources,
      width,
      height,
      scale0100,
      highlightedModel,
      selectedCategory,
      activeBenchmarksSet,
      availableBenchmarks,
      (category) => {
        // Update internal state if not controlled by parent
        if (externalSelectedCategory === undefined) {
          setInternalSelectedCategory(
            internalSelectedCategory === category ? null : category,
          );
        }
        // Notify parent if callback provided
        if (onCategoryClick) {
          onCategoryClick(category);
        }
      },
      (model) => {
        // Update internal state if not controlled by parent
        if (externalHighlightedModel === undefined) {
          setInternalHighlightedModel(
            internalHighlightedModel === model ? null : model,
          );
        }
        // Notify parent if callback provided
        if (onModelHighlight) {
          onModelHighlight(highlightedModel === model ? null : model);
        }
      },
      (benchmark) => toggleBenchmark(benchmark),
      t,
      isDarkMode,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sources,
    scale0100,
    selectedCategory,
    highlightedModel,
    onCategoryClick,
    onModelHighlight,
    externalSelectedCategory,
    externalHighlightedModel,
    internalSelectedCategory,
    internalHighlightedModel,
    isDarkMode, // Re-render chart when theme changes
    unselectedBenchmarks,
  ]);

  if (sources.length === 0) {
    return (
      <div className='text-gray-500 text-center py-8'>
        {t('chart.noDataAvailable')}
      </div>
    );
  }

  return (
    <div className='w-full'>
      <div
        ref={containerRef}
        className='w-full min-h-[500px] md:min-h-[700px]'
        style={{}}
      />
    </div>
  );
};

import React, { useState } from 'react';
import { Switch, Checkbox, Divider, Button, Input } from 'antd';
import {
  SlidersOutlined,
  CheckSquareOutlined,
  SearchOutlined,
  DownloadOutlined,
  UploadOutlined,
  SunOutlined,
  MoonOutlined,
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
  scale0100: boolean;
  onScaleToggle: (checked: boolean) => void;
  pivotData: PivotRow[];
  hideHeader?: boolean;
  isDarkMode?: boolean;
  toggleTheme?: () => void;
}

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
  onFilesUpload,
  sources,
  selectedSourceIds,
  onSourceSelectionChange,
  scale0100,
  onScaleToggle,
  pivotData,
  hideHeader = false,
  isDarkMode,
  toggleTheme,
}) => {
  const { t } = useTranslation();
  const handleSelectAll = () => {
    onSourceSelectionChange(sources.map((s) => s.id));
  };

  const handleClearAll = () => {
    onSourceSelectionChange([]);
  };

  const handleToggleSource = (id: string, checked: boolean) => {
    if (checked) {
      onSourceSelectionChange([...selectedSourceIds, id]);
    } else {
      onSourceSelectionChange(selectedSourceIds.filter((sid) => sid !== id));
    }
  };

  const [searchText, setSearchText] = useState('');

  const filteredSources = sources.filter((source) => {
    const searchLower = searchText.toLowerCase();
    return (
      source.provider.toLowerCase().includes(searchLower) ||
      source.modelName.toLowerCase().includes(searchLower) ||
      source.variance.toLowerCase().includes(searchLower) ||
      source.timestamp.toLowerCase().includes(searchLower)
    );
  });

  // Group filtered sources by provider
  const groupedByProvider = filteredSources.reduce(
    (acc, source) => {
      const provider = source.provider;
      if (!acc[provider]) {
        acc[provider] = [];
      }
      acc[provider].push(source);
      return acc;
    },
    {} as Record<string, DataSource[]>,
  );

  return (
    <div className='p-5'>
      {/* Mobile Quick Actions - Language Switcher (shown when hideHeader is true, i.e. in drawer) */}
      {hideHeader && (
        <>
          {/* Settings Section */}
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

              {/* Theme Toggle - restored for mobile */}
              {hideHeader && toggleTheme && isDarkMode !== undefined && (
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
            </div>
          </div>
          <Divider className='!my-3' />
        </>
      )}

      {/* File Upload Section */}
      <div className='mb-5'>
        <div className='section-header text-sm mb-3'>
          <UploadOutlined className='!text-amber-500' />
          <span>{t('controls.uploadFiles')}</span>
        </div>
        <FileUploader onFilesSelected={onFilesUpload} />
      </div>

      <Divider className='!my-3' />

      {/* Model Selection for Comparison */}
      {sources.length > 0 && (
        <>
          <div className='mb-5'>
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
                  onClick={handleClearAll}
                  className='!p-0 !h-auto !text-xs'
                >
                  {t('controls.none')}
                </Button>
              </div>
            </div>

            <Input
              placeholder={t('controls.searchPlaceholder')}
              prefix={<SearchOutlined className='text-gray-400' />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              className='mb-3'
              size='small'
            />

            <div
              className={
                (hideHeader ? 'max-h-85' : 'max-h-70') +
                ' overflow-y-auto space-y-3 pr-1'
              }
            >
              {Object.entries(groupedByProvider).map(
                ([provider, providerSources]) => (
                  <div key={provider}>
                    {/* Provider Header */}
                    <div className='text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1'>
                      <span className='w-2 h-2 rounded-full bg-amber-400'></span>
                      {provider}
                    </div>
                    {/* Models in this provider group */}
                    <div className='space-y-1.5'>
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
                          >
                            <span className='text-sm font-medium text-gray-700'>
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
                          <div className='flex items-center gap-1.5 mt-1 ml-6'>
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
                          <div className='text-xs text-gray-400 mt-1 ml-6'>
                            {source.timestamp}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        </>
      )}

      <Divider className='!my-3' />

      {/* Scale Toggle */}
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

      {/* Download Buttons */}
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

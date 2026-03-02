import { ConfigProvider, App as AntApp, theme } from 'antd';
import { useTranslation } from 'react-i18next';
import enUS from 'antd/locale/en_US';
import zhTW from 'antd/locale/zh_TW';
import { Home } from './pages/Home';
import { ThemeProvider } from './contexts/ThemeProvider';
import { useTheme } from './contexts/ThemeContext';
import './i18n/config';

// Light theme tokens
const lightThemeTokens = {
  token: {
    // Primary bright yellow from logo
    colorPrimary: '#FFD400',
    colorPrimaryHover: '#FFD933',
    colorPrimaryActive: '#FFBC00',
    colorPrimaryBg: 'rgba(255, 212, 0, 0.08)',
    colorPrimaryBgHover: 'rgba(255, 212, 0, 0.12)',
    colorPrimaryBorder: 'rgba(255, 212, 0, 0.3)',
    colorPrimaryBorderHover: '#FFD400',

    // Link colors
    colorLink: '#CCAA00',
    colorLinkHover: '#FFD400',
    colorLinkActive: '#B89900',

    // Success - keep green
    colorSuccess: '#52c41a',

    // Warning - amber
    colorWarning: '#faad14',

    // Error - red
    colorError: '#ff4d4f',

    // Info - golden
    colorInfo: '#F5A623',

    // Typography
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: 14,

    // Border radius
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 6,

    // Shadows
    boxShadow: '0 1px 3px rgba(212, 146, 10, 0.08)',
    boxShadowSecondary: '0 4px 12px rgba(212, 146, 10, 0.1)',
  },
  components: {
    Card: {
      colorBgContainer: 'rgba(255, 255, 255, 0.92)',
      borderRadiusLG: 12,
    },
    Button: {
      borderRadius: 8,
      controlHeight: 36,
    },
    Input: {
      borderRadius: 8,
    },
    Select: {
      borderRadius: 8,
    },
    Switch: {
      colorPrimary: '#FFD400',
      colorPrimaryHover: '#FFD933',
    },
    Radio: {
      colorPrimary: '#FFD400',
      buttonSolidCheckedBg: '#FFD400',
      buttonSolidCheckedHoverBg: '#FFD933',
    },
    Checkbox: {
      colorPrimary: '#FFD400',
      colorPrimaryHover: '#FFD933',
    },
    Table: {
      headerBg: 'rgba(255, 212, 0, 0.08)',
      headerColor: '#1A1A1A',
      rowHoverBg: 'rgba(255, 212, 0, 0.06)',
    },
    Divider: {
      colorSplit: 'rgba(0, 0, 0, 0.06)',
    },
    List: {
      colorBorder: 'rgba(0, 0, 0, 0.06)',
    },
  },
};

// Dark theme tokens (extends light with overrides)
const darkThemeTokens = {
  token: {
    ...lightThemeTokens.token,
    // Dark mode specific overrides
    colorBgContainer: '#1a1f2e',
    colorBgElevated: '#242936',
    colorBgLayout: '#0a0e1a',
    colorBgSpotlight: '#2d3446',
    colorBorder: 'rgba(255, 255, 255, 0.12)',
    colorBorderSecondary: 'rgba(255, 255, 255, 0.08)',
    colorText: '#ffffff',
    colorTextSecondary: '#b0b8c4',
    colorTextTertiary: '#6b7280',
    colorTextQuaternary: '#4b5563',

    // Shadows for dark mode
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
    boxShadowSecondary: '0 4px 12px rgba(0, 0, 0, 0.4)',
  },
  components: {
    ...lightThemeTokens.components,
    Card: {
      colorBgContainer: 'rgba(26, 31, 46, 0.95)',
      borderRadiusLG: 12,
    },
    Table: {
      headerBg: 'rgba(255, 212, 0, 0.08)',
      headerColor: '#ffffff',
      rowHoverBg: 'rgba(255, 212, 0, 0.06)',
      colorBgContainer: 'transparent',
    },
    Divider: {
      colorSplit: 'rgba(255, 255, 255, 0.08)',
    },
    List: {
      colorBorder: 'rgba(255, 255, 255, 0.08)',
    },
    Drawer: {
      colorBgElevated: '#101623',
    },
  },
};

function AppContent() {
  const { i18n } = useTranslation();
  const { isDarkMode } = useTheme();
  const locale = i18n.language === 'zh-TW' ? zhTW : enUS;

  const themeConfig = isDarkMode
    ? {
        algorithm: theme.darkAlgorithm,
        ...darkThemeTokens,
      }
    : lightThemeTokens;

  return (
    <ConfigProvider locale={locale} theme={themeConfig}>
      <AntApp>
        <Home />
      </AntApp>
    </ConfigProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;

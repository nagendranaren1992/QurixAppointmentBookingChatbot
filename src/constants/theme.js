// Qurix Brand Theme
// Color palette inspired by Qurix healthcare platform (qurix.com)
// Adjust hex values to match your exact brand guidelines if needed.

export const COLORS = {
  // Primary brand colors (deep professional blue commonly used by Qurix)
  primary: '#0B5FFF',
  primaryDark: '#0846C2',
  primaryLight: '#E8F0FF',

  // Secondary accent (medical teal/cyan)
  secondary: '#06B6D4',
  secondaryLight: '#E0F7FA',

  // Neutrals
  white: '#FFFFFF',
  background: '#F5F7FB',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  divider: '#EDF0F5',

  // Text
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textOnPrimary: '#FFFFFF',

  // Status
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Chat bubbles
  botBubble: '#FFFFFF',
  userBubble: '#0B5FFF',
  botText: '#0F172A',
  userText: '#FFFFFF',

  // Shadows
  shadow: 'rgba(11, 95, 255, 0.08)',
  shadowDark: 'rgba(15, 23, 42, 0.12)',
};

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
};

export const SIZES = {
  base: 8,
  small: 12,
  medium: 14,
  large: 16,
  xlarge: 18,
  xxlarge: 24,
  radius: 12,
  radiusSmall: 8,
  radiusLarge: 20,
};

export const SHADOWS = {
  small: {
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const BRAND = {
  name: 'Qurix',
  tagline: 'Healthcare Assistant',
  // Logo is bundled locally — import via `<BrandLogo />` from src/components.
  // The path below is for reference / external links only.
  logoPath: './assets/qurix_logo.svg',
  supportPhone: '+91-7075740042',
  supportEmail: 'hello@qurix.com',
};

export default { COLORS, FONTS, SIZES, SHADOWS, BRAND };

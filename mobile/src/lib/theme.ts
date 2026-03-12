import { StyleSheet } from 'react-native';

export const palette = {
  background: '#09090B',
  card: '#111113',
  cardMuted: '#1A1A1E',
  foreground: '#FAFAFA',
  muted: '#71717A',
  border: 'rgba(255,255,255,0.07)',
  primary: '#22C55E',
  primaryStrong: '#16A34A',
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  secondaryText: '#A1A1AA',
};

export const spacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

export const radii = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const shadows = StyleSheet.create({
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
});

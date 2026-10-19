import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, useColorScheme } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Tone } from '@/lib/labels';

// Design tokens (spec §2.3): navy primary, white cards with light borders, 12–16px radii.

const light = {
  bg: '#F3F5F8',
  card: '#FFFFFF',
  cardAlt: '#F8FAFC',
  border: '#E3E8EF',
  text: '#0F172A',
  textMuted: '#5B6678',
  textFaint: '#8C96A6',
  primary: '#0B2A4A',
  primaryText: '#FFFFFF',
  primarySoft: '#E6EDF5',
  accent: '#C8962E',
  danger: '#C62828',
  dangerSoft: '#FDECEC',
  overlay: 'rgba(15,23,42,0.45)',
  inputBg: '#FFFFFF',
  sidebar: '#0B2A4A',
  sidebarText: '#C9D6E5',
  sidebarActive: '#16406B',
};

const dark: typeof light = {
  bg: '#0B1220',
  card: '#121B2C',
  cardAlt: '#172235',
  border: '#24324A',
  text: '#E8EDF5',
  textMuted: '#A3B0C4',
  textFaint: '#738099',
  primary: '#5B9BE0',
  primaryText: '#071526',
  primarySoft: '#16314F',
  accent: '#E0B252',
  danger: '#F2706B',
  dangerSoft: '#3A1A1C',
  overlay: 'rgba(0,0,0,0.6)',
  inputBg: '#0E1626',
  sidebar: '#08101D',
  sidebarText: '#A9B8CC',
  sidebarActive: '#16314F',
};

export type Colors = typeof light;

const tonesLight: Record<Tone, { bg: string; fg: string }> = {
  amber: { bg: '#FEF3C7', fg: '#92400E' },
  green: { bg: '#DCFCE7', fg: '#166534' },
  red: { bg: '#FEE2E2', fg: '#991B1B' },
  grey: { bg: '#EEF1F5', fg: '#475569' },
  blue: { bg: '#DBEAFE', fg: '#1E40AF' },
};
const tonesDark: Record<Tone, { bg: string; fg: string }> = {
  amber: { bg: '#3B2A0A', fg: '#FCD34D' },
  green: { bg: '#0F2E1C', fg: '#86EFAC' },
  red: { bg: '#3A1414', fg: '#FCA5A5' },
  grey: { bg: '#1E293B', fg: '#CBD5E1' },
  blue: { bg: '#172554', fg: '#93C5FD' },
};

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const fonts = {
  serif: Platform.select({ android: 'serif', ios: 'Georgia', default: 'Georgia, serif' }),
};

type Mode = 'system' | 'light' | 'dark';

export const useThemePref = create<{ mode: Mode; setMode: (m: Mode) => void }>()(
  persist((set) => ({ mode: 'system', setMode: (mode) => set({ mode }) }), {
    name: 'africon-admin-theme',
    storage: createJSONStorage(() => AsyncStorage),
  }),
);

export function useTheme() {
  const system = useColorScheme();
  const mode = useThemePref((s) => s.mode);
  const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');
  return { c: isDark ? dark : light, tones: isDark ? tonesDark : tonesLight, isDark };
}

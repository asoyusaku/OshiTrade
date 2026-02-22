import { create } from 'zustand';

const DEFAULT_PRIMARY = '#FF6B9D';

type ThemeStore = {
  oshiColor: string | null;
  setOshiColor: (color: string | null) => void;
};

export const useThemeStore = create<ThemeStore>((set) => ({
  oshiColor: null,
  setOshiColor: (color) => set({ oshiColor: color }),
}));

// hex色からRGBを取得
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 255, g: 107, b: 157 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
}

// 明るい色を暗くする（primaryDark用）
function darken(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

// 色を明るくする（primaryLight用）
function lighten(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

// 色の明度を計算
function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// 明るすぎる色をアクセントカラーとして使える程度に暗くする
function ensureAccentReadable(hex: string): string {
  const lum = luminance(hex);
  if (lum < 0.65) return hex; // そのまま使える
  // 明るさに応じて段階的に暗くする（白背景上で見えるように）
  const darkenAmount = Math.min((lum - 0.55) * 0.8, 0.45);
  return darken(hex, darkenAmount);
}

export function useColors() {
  const { oshiColor } = useThemeStore();

  // 推しカラーが設定されていない場合はデフォルト、明るい色は自動調整
  const primary = oshiColor ? ensureAccentReadable(oshiColor) : DEFAULT_PRIMARY;

  return {
    primary,
    primaryDark: darken(primary, 0.2),
    primaryLight: oshiColor ? lighten(oshiColor, 0.4) : lighten(primary, 0.4),
    secondary: '#6B5CE7',
    background: '#FFFFFF',
    surface: '#F8F9FA',
    text: '#1A1A2E',
    textSecondary: '#6C757D',
    border: '#E9ECEF',
    success: '#28A745',
    warning: '#FFC107',
    error: '#DC3545',
    white: '#FFFFFF',
  };
}

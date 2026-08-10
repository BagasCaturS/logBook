export interface ThemeDef {
  id: string;
  name: string;
  /** swatch colors shown in the picker: [primary, background, accent] */
  colors: [string, string, string];
  /** theme is dark-only; auto dark-mode switch does not apply */
  alwaysDark?: boolean;
}

export const THEMES: ThemeDef[] = [
  { id: "jurnal", name: "Jurnal", colors: ["#92400E", "#FFFBEB", "#6366F1"] },
  { id: "mint", name: "Mint", colors: ["#0D9488", "#F0FDFA", "#EA580C"] },
  { id: "ocean", name: "Ocean", colors: ["#0F172A", "#F8FAFC", "#0369A1"] },
  { id: "forest", name: "Forest", colors: ["#15803D", "#F0FDF4", "#D97706"] },
  { id: "gold", name: "Gold", colors: ["#8A6D3B", "#FAF8F3", "#1F2937"] },
  { id: "soft", name: "Soft", colors: ["#F97316", "#FFF7ED", "#2563EB"] },
  { id: "berry", name: "Berry", colors: ["#7E22CE", "#FAF5FF", "#DB2777"] },
  { id: "sunset", name: "Sunset", colors: ["#E11D48", "#FFF1F2", "#F97316"] },
  { id: "midnight", name: "Midnight", colors: ["#22C55E", "#020617", "#334155"], alwaysDark: true },
  { id: "vintage", name: "Vintage", colors: ["#DC2626", "#1F1829", "#22C55E"], alwaysDark: true },
];

export const DEFAULT_THEME = "jurnal";

export function isValidTheme(id: string | undefined): id is string {
  return !!id && THEMES.some((t) => t.id === id);
}

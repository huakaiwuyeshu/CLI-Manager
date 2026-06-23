import { invoke } from "@tauri-apps/api/core";

export interface SystemFontFamily {
  family: string;
}

export interface FontFamilyOption {
  value: string;
  label: string;
}

const CSS_GENERIC_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "emoji",
  "math",
  "fangsong",
]);

export async function listSystemFonts(): Promise<SystemFontFamily[]> {
  return invoke<SystemFontFamily[]>("list_system_fonts");
}

export function toCssFontFamilyName(family: string) {
  const trimmed = family.trim();
  if (!trimmed) return "";
  if (CSS_GENERIC_FAMILIES.has(trimmed.toLowerCase())) return trimmed;
  if (/^".*"$|^'.*'$/.test(trimmed)) return trimmed;
  if (/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(trimmed)) return trimmed;
  return JSON.stringify(trimmed);
}

export function withFontFallback(family: string, fallback: string) {
  const cssFamily = toCssFontFamilyName(family);
  return cssFamily ? `${cssFamily}, ${fallback}` : fallback;
}

export function mergeFontFamilyOptions(
  currentValue: string,
  builtinOptions: readonly FontFamilyOption[],
  systemFonts: readonly SystemFontFamily[],
  fallback: string
): FontFamilyOption[] {
  const options: FontFamilyOption[] = [];
  const seen = new Set<string>();
  const systemOptions = systemFonts
    .map((font) => font.family.trim())
    .filter(Boolean)
    .map((family) => ({ value: withFontFallback(family, fallback), label: family }));
  const availableValues = new Set([...builtinOptions, ...systemOptions].map((option) => option.value));

  const add = (option: FontFamilyOption) => {
    if (!option.value || seen.has(option.value)) return;
    seen.add(option.value);
    options.push(option);
  };

  if (currentValue && !availableValues.has(currentValue)) {
    add({ value: currentValue, label: "当前自定义（保留）" });
  }

  builtinOptions.forEach(add);
  systemOptions.forEach(add);

  return options;
}

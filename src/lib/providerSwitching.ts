import type { Project } from "./types";

export type ProviderSwitchAppType = "claude" | "codex";

export interface CodexProviderOverride {
  providerId: string;
  providerName: string | null;
  profileName: string;
  vendorHint?: string | null;
}

export interface ClaudeProviderOverride {
  providerId: string;
  providerName: string | null;
  settingsPath: string;
  vendorHint?: string | null;
}

export interface ProjectProviderOverrides {
  claude?: ClaudeProviderOverride;
  codex?: CodexProviderOverride;
}

const UNCONFIGURED_CLI_TOOL_VALUES = new Set(["none", "未选择", "未選擇"]);

export function hasConfiguredCliTool(project: Pick<Project, "cli_tool">): boolean {
  const cliTool = project.cli_tool.trim().toLowerCase();
  return cliTool.length > 0 && !UNCONFIGURED_CLI_TOOL_VALUES.has(cliTool);
}

export function getProviderSwitchAppType(project: Pick<Project, "cli_tool">): ProviderSwitchAppType | null {
  const cliTool = project.cli_tool.trim().toLowerCase();
  if (cliTool === "codex") return "codex";
  if (cliTool.includes("claude")) return "claude";
  return null;
}

export function isExactCodexProject(project: Pick<Project, "cli_tool">): boolean {
  return project.cli_tool.trim().toLowerCase() === "codex";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeCodexOverride(value: unknown): CodexProviderOverride | undefined {
  if (!isRecord(value)) return undefined;
  const providerId = typeof value.providerId === "string" ? value.providerId.trim() : "";
  const profileName = typeof value.profileName === "string" ? value.profileName.trim() : "";
  if (!providerId || !profileName) return undefined;
  return {
    providerId,
    profileName,
    providerName: typeof value.providerName === "string" && value.providerName.trim() ? value.providerName : null,
    vendorHint: typeof value.vendorHint === "string" && value.vendorHint.trim() ? value.vendorHint.trim() : null,
  };
}

function normalizeClaudeOverride(value: unknown): ClaudeProviderOverride | undefined {
  if (!isRecord(value)) return undefined;
  const providerId = typeof value.providerId === "string" ? value.providerId.trim() : "";
  const settingsPath = typeof value.settingsPath === "string" ? value.settingsPath.trim() : "";
  if (!providerId || !settingsPath) return undefined;
  return {
    providerId,
    settingsPath,
    providerName: typeof value.providerName === "string" && value.providerName.trim() ? value.providerName : null,
    vendorHint: typeof value.vendorHint === "string" && value.vendorHint.trim() ? value.vendorHint.trim() : null,
  };
}

export function parseProjectProviderOverrides(raw: string | null | undefined): ProjectProviderOverrides {
  if (!raw?.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    const claude = normalizeClaudeOverride(parsed.claude);
    const codex = normalizeCodexOverride(parsed.codex);
    return {
      ...(claude ? { claude } : {}),
      ...(codex ? { codex } : {}),
    };
  } catch {
    return {};
  }
}

export function stringifyProjectProviderOverrides(overrides: ProjectProviderOverrides): string {
  const next: Record<string, unknown> = {};
  if (overrides.claude) {
    next.claude = {
      providerId: overrides.claude.providerId,
      providerName: overrides.claude.providerName,
      settingsPath: overrides.claude.settingsPath,
    };
    if (overrides.claude.vendorHint) {
      (next.claude as Record<string, unknown>).vendorHint = overrides.claude.vendorHint;
    }
  }
  if (overrides.codex) {
    next.codex = {
      providerId: overrides.codex.providerId,
      providerName: overrides.codex.providerName,
      profileName: overrides.codex.profileName,
    };
    if (overrides.codex.vendorHint) {
      (next.codex as Record<string, unknown>).vendorHint = overrides.codex.vendorHint;
    }
  }
  return JSON.stringify(next);
}

export function getCodexProviderOverride(project: Pick<Project, "provider_overrides">): CodexProviderOverride | undefined {
  return parseProjectProviderOverrides(project.provider_overrides).codex;
}

export function getClaudeProviderOverride(project: Pick<Project, "provider_overrides">): ClaudeProviderOverride | undefined {
  return parseProjectProviderOverrides(project.provider_overrides).claude;
}

export function withClaudeProviderOverride(
  raw: string | null | undefined,
  override: ClaudeProviderOverride | null
): string {
  const overrides = parseProjectProviderOverrides(raw);
  if (override) {
    overrides.claude = override;
  } else {
    delete overrides.claude;
  }
  return stringifyProjectProviderOverrides(overrides);
}

export function withCodexProviderOverride(
  raw: string | null | undefined,
  override: CodexProviderOverride | null
): string {
  const overrides = parseProjectProviderOverrides(raw);
  if (override) {
    overrides.codex = override;
  } else {
    delete overrides.codex;
  }
  return stringifyProjectProviderOverrides(overrides);
}

export function parseProjectEnvVars(project: Pick<Project, "env_vars">): Record<string, string> | undefined {
  try {
    const parsed: unknown = JSON.parse(project.env_vars || "{}");
    if (!isRecord(parsed)) return undefined;
    const entries = Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string");
    if (entries.length > 0) return Object.fromEntries(entries);
  } catch {
    // Ignore invalid env JSON and let terminal start without project env overrides.
  }
  return undefined;
}

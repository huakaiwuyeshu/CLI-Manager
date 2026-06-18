import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import {
  ActionIcon,
  Box,
  Button,
  Divider,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Boxes,
  Braces,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Cpu,
  Database,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Globe,
  Hash,
  KeyRound,
  Link2,
  RefreshCw,
  Settings,
  Tag,
  Undo2,
} from "@/components/icons";
import { ProviderBadge } from "@/components/provider/ProviderRow";
import { VendorIcon, inferVendor, type VendorKey } from "@/components/VendorIcon";
import { useSettingsStore } from "@/stores/settingsStore";

// 深度合并对象（target 覆盖 source）
function deepMerge(source: any, target: any): any {
  if (typeof target !== "object" || target === null) return target;
  if (typeof source !== "object" || source === null) return target;

  const result = { ...source };
  for (const key of Object.keys(target)) {
    if (typeof target[key] === "object" && target[key] !== null && !Array.isArray(target[key])) {
      result[key] = deepMerge(result[key], target[key]);
    } else {
      result[key] = target[key];
    }
  }
  return result;
}

interface CcSwitchProvider {
  id: string;
  appType: string;
  name: string;
  category: string | null;
  websiteUrl: string | null;
  notes: string | null;
  sortIndex: number | null;
  createdAt: number | null;
  isCurrent: boolean;
  baseUrl: string | null;
  model: string | null;
  apiFormat: string | null;
  maskedEnv: Record<string, string>;
  configParseError: boolean;
  rawSettingsConfig: string;
}

interface CcSwitchProvidersResponse {
  dbPath: string;
  providers: CcSwitchProvider[];
}

interface CcSwitchCommonConfig {
  appType: string;
  configJson: string;
}

interface CcSwitchCommonConfigResponse {
  dbPath: string;
  commonConfigs: CcSwitchCommonConfig[];
}

type Tone = "primary" | "neutral" | "success" | "warning" | "danger";

const TONE_COLOR: Record<Tone, string> = {
  primary: "var(--primary)",
  neutral: "var(--on-surface-variant)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
};

// 供应商页样式：参考 docs/UI「Editorial Analyst」设计，但全部映射到主题 token，
// 以便在 App 的 18 套主题（9 亮 + 9 暗）与暗色模式下一致工作。
const providerPageStyles = `
.prov-code-block {
  background: var(--surface-container-highest);
  border: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
  border-radius: 16px;
  padding: 18px;
  overflow-y: auto;
  font-family: var(--font-ui-mono);
}

.prov-code-block pre {
  margin: 0;
  padding: 0;
  font-size: 12px;
  line-height: 1.65;
  color: var(--on-surface);
  white-space: pre-wrap;
  word-break: break-all;
}

/* 暗色主题：贴近 VSCode 经典高亮 */
[data-theme="dark"] .prov-code-block .json-key { color: #9cdcfe; }
[data-theme="dark"] .prov-code-block .json-string { color: #ce9178; }
[data-theme="dark"] .prov-code-block .json-number { color: #b5cea8; }
[data-theme="dark"] .prov-code-block .json-boolean { color: #569cd6; }

/* 浅色主题：浅底 + 深色高亮，避免深底突兀 */
[data-theme="light"] .prov-code-block .json-key { color: #0451a5; }
[data-theme="light"] .prov-code-block .json-string { color: #a31515; }
[data-theme="light"] .prov-code-block .json-number { color: #098658; }
[data-theme="light"] .prov-code-block .json-boolean { color: #0000ff; }

/* 详情头部：右上角柔光（参考稿的 primary blur 光晕），用 primary token */
.prov-detail-hero {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border-radius: 24px;
  background: var(--surface-container-lowest);
  outline: 1px solid color-mix(in srgb, var(--border) 14%, transparent);
}
.prov-detail-hero::before {
  content: "";
  position: absolute;
  top: -120px;
  right: -120px;
  width: 360px;
  height: 360px;
  border-radius: 999px;
  pointer-events: none;
  z-index: -1;
  background: radial-gradient(circle, color-mix(in srgb, var(--primary) 12%, transparent), transparent 70%);
  filter: blur(40px);
}

/* 环境变量卡：tonal layering，无硬边框 */
.prov-env-card {
  background: var(--surface-container-lowest);
  border-radius: 16px;
  padding: 14px 16px;
  outline: 1px solid color-mix(in srgb, var(--border) 12%, transparent);
  transition: outline-color var(--animate-duration-fast), background-color var(--animate-duration-fast);
}
.prov-env-card:hover {
  outline-color: color-mix(in srgb, var(--primary) 28%, transparent);
}
.prov-env-key {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
}

/* 配置 Tab：底部下划线高亮（editorial），取代 Mantine outline 边框 */
.prov-tab {
  appearance: none;
  background: transparent;
  border: 0;
  border-bottom: 2px solid transparent;
  padding: 8px 4px;
  margin-right: 20px;
  font-weight: 600;
  font-size: 13px;
  color: var(--on-surface-variant);
  cursor: pointer;
  transition: color var(--animate-duration-fast), border-color var(--animate-duration-fast);
}
.prov-tab:hover { color: var(--on-surface); }
.prov-tab[data-active="true"] {
  color: var(--primary);
  border-bottom-color: var(--primary);
}
`;

const ERROR_HINTS: Record<string, string> = {
  db_not_found: "未找到 cc-switch 数据库文件，请确认已安装 cc-switch，或手动选择 cc-switch.db。",
  unsupported_format: "所选文件不是 .db 数据库文件，请重新选择。",
};

function formatError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  for (const [code, hint] of Object.entries(ERROR_HINTS)) {
    if (message.startsWith(code)) return hint;
  }
  return `读取 cc-switch 数据库失败：${message}`;
}

// 苹果设置页标志性的圆角图标砖（filled / soft 两种）
function IconTile({
  icon: Icon,
  tone = "primary",
  variant = "soft",
  size = 34,
}: {
  icon: LucideIcon;
  tone?: Tone;
  variant?: "soft" | "solid";
  size?: number;
}) {
  const color = TONE_COLOR[tone];
  const solid = variant === "solid";
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        backgroundColor: solid ? color : `color-mix(in srgb, ${color} 14%, transparent)`,
        color: solid ? (tone === "primary" ? "var(--on-primary)" : "#fff") : color,
        boxShadow: solid ? `0 6px 16px color-mix(in srgb, ${color} 30%, transparent)` : "none",
      }}
    >
      <Icon size={Math.round(size * 0.54)} strokeWidth={2.2} />
    </span>
  );
}

// 综合 model / baseUrl / appType / 名称 / 分类 推断供应商所属厂商
function inferProviderVendor(provider: CcSwitchProvider): VendorKey | null {
  return (
    inferVendor(provider.model) ??
    inferVendor(provider.baseUrl) ??
    inferVendor(provider.appType) ??
    inferVendor(provider.name) ??
    inferVendor(provider.category)
  );
}

// 环境变量按 key 语义映射不同图标（替代「全是钥匙」）
function envIcon(key: string): LucideIcon {
  const k = key.toUpperCase();
  if (/(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH|BEARER)/.test(k)) return KeyRound;
  if (/(URL|ENDPOINT|HOST|BASE|DOMAIN|URI|ADDR)/.test(k)) return Link2;
  if (/(MODEL|ENGINE|DEPLOYMENT)/.test(k)) return Cpu;
  if (/(PROXY|HTTP|NETWORK)/.test(k)) return Globe;
  if (/(TIMEOUT|INTERVAL|DELAY|TTL|EXPIRE|RETRY)/.test(k)) return Clock;
  if (/(VERSION|API_VERSION)/.test(k)) return Tag;
  if (/(ORG|PROJECT|ACCOUNT|TENANT|WORKSPACE|GROUP)/.test(k)) return Boxes;
  if (/(REGION|ZONE|LOCATION|AREA)/.test(k)) return Globe;
  if (/(MAX|LIMIT|TOKENS|SIZE|COUNT|NUM|TEMPERATURE|TOP_)/.test(k)) return Hash;
  return Braces;
}

function CopyButton({ value, label = "已复制" }: { value: string; label?: string }) {
  return (
    <ActionIcon
      size="xs"
      variant="subtle"
      onClick={() => {
        navigator.clipboard.writeText(value);
        toast.success(label);
      }}
      title="复制"
    >
      <Copy size={12} />
    </ActionIcon>
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function JsonCodeBlock({ json, maxHeight = "400px" }: { json: string; maxHeight?: string }) {
  // 简单的 JSON 语法高亮（纯 CSS）；先转义 HTML 再注入 span，避免 XSS
  const highlightedJson = useMemo(() => {
    // escapeHtml 仅转义 & < >，引号保留，正则可直接匹配
    return escapeHtml(json)
      .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:') // 键名
      .replace(/: "([^"]*)"/g, ': <span class="json-string">"$1"</span>') // 字符串值
      .replace(/: (-?\d+(?:\.\d+)?)/g, ': <span class="json-number">$1</span>') // 数字
      .replace(/: (true|false|null)/g, ': <span class="json-boolean">$1</span>'); // 布尔/null
  }, [json]);

  return (
    <Box className="prov-code-block ui-thin-scroll" style={{ maxHeight }}>
      <pre dangerouslySetInnerHTML={{ __html: highlightedJson }} />
    </Box>
  );
}

function ProviderListItem({
  provider,
  isSelected,
  onClick,
}: {
  provider: CcSwitchProvider;
  isSelected: boolean;
  onClick: () => void;
}) {
  // 右侧徽章：优先显示 isCurrent，否则显示 category（若有）
  let badge: { label: string; tone: "primary" | "neutral" } | undefined;
  if (isSelected && provider.isCurrent) {
    badge = { label: "ACTIVE", tone: "primary" };
  } else if (provider.isCurrent) {
    badge = { label: "当前", tone: "primary" };
  } else if (provider.category) {
    badge = { label: provider.category, tone: "neutral" };
  }

  const vendor = inferProviderVendor(provider);
  const subtitle = provider.category ?? provider.model ?? undefined;

  return (
    <UnstyledButton
      type="button"
      onClick={onClick}
      data-selected={isSelected ? "true" : "false"}
      aria-pressed={isSelected}
      className="ui-focus-ring flex w-full items-center gap-3 text-left transition-all"
      style={{
        padding: "11px 12px",
        borderRadius: 16,
        backgroundColor: isSelected
          ? "color-mix(in srgb, var(--primary) 10%, var(--surface-container-lowest))"
          : "var(--surface-container-lowest)",
        border: isSelected
          ? "1px solid color-mix(in srgb, var(--primary) 42%, transparent)"
          : "1px solid color-mix(in srgb, var(--border) 22%, transparent)",
        boxShadow: isSelected ? "0 4px 14px color-mix(in srgb, var(--primary) 12%, transparent)" : "none",
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.backgroundColor = "var(--surface-container-low)";
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.backgroundColor = "var(--surface-container-lowest)";
      }}
    >
      <span
        className="inline-flex shrink-0 items-center justify-center"
        style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "var(--surface-container-high)", color: "var(--on-surface)" }}
      >
        <VendorIcon vendor={vendor} size={24} fallback={Boxes} />
      </span>
      <Box className="min-w-0 flex-1">
        <Text className="truncate" fz={14} fw={700} c={isSelected ? "var(--primary)" : "var(--on-surface)"}>
          {provider.name}
        </Text>
        {subtitle && (
          <Text className="truncate" fz={11} c="var(--text-muted)" mt={1}>
            {subtitle}
          </Text>
        )}
      </Box>
      {badge && (
        <ProviderBadge tone={badge.tone}>{badge.label}</ProviderBadge>
      )}
      <ChevronRight size={16} style={{ color: "var(--text-muted)" }} className="shrink-0" />
    </UnstyledButton>
  );
}

function ProviderDetailPanel({ provider }: { provider: CcSwitchProvider }) {
  const ccSwitchDbPath = useSettingsStore((s) => s.ccSwitchDbPath);
  const envEntries = Object.entries(provider.maskedEnv);
  const websiteUrl = provider.websiteUrl;
  const vendor = inferProviderVendor(provider);
  // 优化 9: 环境变量折叠状态
  const [envExpanded, setEnvExpanded] = useState(false);
  const displayedEnv = envExpanded ? envEntries : envEntries.slice(0, 5);
  const hasMoreEnv = envEntries.length > 5;
  // 配置 Tab 当前选中项（自管理，取代 Mantine Tabs）
  const [activeConfigTab, setActiveConfigTab] = useState("merged");

  // 通用配置加载
  const [commonConfigs, setCommonConfigs] = useState<CcSwitchCommonConfig[]>([]);
  const [commonConfigsLoaded, setCommonConfigsLoaded] = useState(false);

  // 加载通用配置
  useEffect(() => {
    const loadCommonConfigs = async () => {
      try {
        const response = await invoke<CcSwitchCommonConfigResponse>(
          "ccswitch_list_common_configs",
          { dbPath: ccSwitchDbPath ?? undefined }
        );
        setCommonConfigs(response.commonConfigs);
      } catch {
        setCommonConfigs([]);
      } finally {
        setCommonConfigsLoaded(true);
      }
    };
    void loadCommonConfigs();
  }, [ccSwitchDbPath]);

  // 解析供应商配置
  const providerConfig = useMemo(() => {
    try {
      return JSON.parse(provider.rawSettingsConfig);
    } catch {
      return null;
    }
  }, [provider.rawSettingsConfig]);

  // 匹配当前 appType 的通用配置（common_config_{appType}）
  const commonConfig = useMemo(() => {
    const match = commonConfigs.find((c) => c.appType === provider.appType);
    if (!match) return null;
    try {
      return JSON.parse(match.configJson);
    } catch {
      return match.configJson; // 解析失败时保留原始文本
    }
  }, [commonConfigs, provider.appType]);

  // 合并配置：通用配置 → 供应商配置（供应商优先覆盖）
  const mergedConfig = useMemo(() => {
    if (!commonConfigsLoaded || !providerConfig) return null;
    if (!commonConfig || typeof commonConfig === "string") return providerConfig;

    // 深度合并：通用配置打底，供应商配置覆盖
    return deepMerge(commonConfig, providerConfig);
  }, [providerConfig, commonConfig, commonConfigsLoaded]);

  // 切换供应商时重置折叠状态与配置 Tab
  useEffect(() => {
    setEnvExpanded(false);
    setActiveConfigTab("merged");
  }, [provider.id]);

  const configTabs: { value: string; label: string; hint: string; json: string | null; copyLabel: string }[] = [
    {
      value: "merged",
      label: "完整配置",
      hint:
        commonConfigsLoaded && commonConfig
          ? "通用配置 + 供应商配置合并结果（供应商优先）"
          : "供应商配置（无通用配置）",
      json: mergedConfig ? JSON.stringify(mergedConfig, null, 2) : null,
      copyLabel: "已复制完整配置",
    },
    {
      value: "provider",
      label: "供应商配置",
      hint: "供应商原始配置",
      json: providerConfig ? JSON.stringify(providerConfig, null, 2) : null,
      copyLabel: "已复制",
    },
    ...(commonConfigsLoaded && commonConfig
      ? [
          {
            value: "common",
            label: `通用配置 (${provider.appType})`,
            hint: `common_config_${provider.appType}（来自 settings 表）`,
            json: typeof commonConfig === "string" ? commonConfig : JSON.stringify(commonConfig, null, 2),
            copyLabel: "已复制通用配置",
          },
        ]
      : []),
  ];
  const activeTab = configTabs.find((t) => t.value === activeConfigTab) ?? configTabs[0];

  return (
    <Stack gap="lg">
      {/* 详情头部 Hero（editorial：大标题左对齐 + 关键元数据 flush-right 网格） */}
      <Box className="prov-detail-hero" p="xl">
        <Stack gap="lg">
          <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
            <Group gap="md" align="flex-start" wrap="nowrap" className="min-w-0">
              <span
                className="inline-flex shrink-0 items-center justify-center"
                style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: "var(--surface-container-high)", color: "var(--on-surface)" }}
              >
                <VendorIcon vendor={vendor} size={30} fallback={Boxes} />
              </span>
              <Box className="min-w-0">
                <Group gap="sm" align="center" wrap="wrap">
                  <Text
                    className="font-headline tracking-tight"
                    fz={32}
                    fw={800}
                    c="var(--on-surface)"
                    lh={1.1}
                    style={{ wordBreak: "break-word" }}
                  >
                    {provider.name}
                  </Text>
                  {provider.isCurrent && <ProviderBadge tone="primary">全局当前</ProviderBadge>}
                  {provider.configParseError && <ProviderBadge tone="danger">配置解析失败</ProviderBadge>}
                </Group>
                <Group gap="xs" mt={8}>
                  {provider.category && <ProviderBadge tone="neutral">{provider.category}</ProviderBadge>}
                  {provider.apiFormat && <ProviderBadge tone="primary">{provider.apiFormat}</ProviderBadge>}
                </Group>
              </Box>
            </Group>
            {websiteUrl && (
              <Button
                size="compact-sm"
                variant="subtle"
                leftSection={<Globe size={14} />}
                className="shrink-0"
                onClick={() => {
                  void openUrl(websiteUrl).catch((err) => {
                    toast.error("无法打开链接", { description: String(err) });
                  });
                }}
              >
                官网
              </Button>
            )}
          </Group>

          {provider.configParseError && (
            <Box
              className="rounded-xl px-3 py-2"
              style={{
                backgroundColor: "color-mix(in srgb, var(--danger) 10%, transparent)",
                outline: "1px solid color-mix(in srgb, var(--danger) 26%, transparent)",
              }}
            >
              <Text size="xs" c="var(--danger)">
                该供应商配置解析失败，env 数据可能不完整，无法应用到项目。
              </Text>
            </Box>
          )}

          {/* 关键元数据网格（无分隔线，靠间距与 label 弱化分区） */}
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" verticalSpacing="md">
            {provider.baseUrl && (
              <MetaField label="BASE API ENDPOINT" icon={Link2}>
                <Group gap={6} wrap="nowrap" className="min-w-0">
                  <Text
                    component="code"
                    ff="var(--font-ui-mono)"
                    fz={13}
                    c="var(--on-surface)"
                    className="min-w-0 flex-1 break-all leading-5"
                    title={provider.baseUrl}
                  >
                    {provider.baseUrl}
                  </Text>
                  <CopyButton value={provider.baseUrl} />
                </Group>
              </MetaField>
            )}
            {provider.model && (
              <MetaField label="DEFAULT MODEL" icon={Cpu}>
                <Text fz={15} fw={700} c="var(--on-surface)" className="break-all leading-5">
                  {provider.model}
                </Text>
              </MetaField>
            )}
            {provider.notes && (
              <MetaField label="备注" icon={FileText}>
                <Text fz={13} c="var(--on-surface)" className="break-all leading-5">
                  {provider.notes}
                </Text>
              </MetaField>
            )}
          </SimpleGrid>
        </Stack>
      </Box>

      {/* 环境变量区（tonal layering 卡片网格） */}
      {envEntries.length > 0 && (
        <Box>
          <Group gap="sm" mb="md" align="center">
            <IconTile icon={KeyRound} tone="primary" size={28} />
            <Text className="font-headline tracking-tight" fz={20} fw={800} c="var(--on-surface)">
              环境变量
            </Text>
            <span
              className="inline-flex items-center rounded-lg px-2.5 py-0.5 text-sm font-bold"
              style={{
                backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
                color: "var(--primary)",
              }}
            >
              {envEntries.length}
            </span>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            {displayedEnv.map(([key, value]) => (
              <Box key={key} className="prov-env-card">
                <Group justify="space-between" wrap="nowrap" gap="sm" align="flex-start">
                  <Group gap="sm" wrap="nowrap" align="flex-start" className="min-w-0 flex-1">
                    <IconTile icon={envIcon(key)} tone="primary" size={24} />
                    <Box className="min-w-0 flex-1">
                      <Text className="prov-env-key" component="div">
                        {key}
                      </Text>
                      <Text
                        component="code"
                        ff="var(--font-ui-mono)"
                        fz={13}
                        fw={600}
                        c="var(--on-surface)"
                        className="break-all leading-5"
                        mt={4}
                      >
                        {value}
                      </Text>
                    </Box>
                  </Group>
                  <CopyButton value={`${key}=${value}`} />
                </Group>
              </Box>
            ))}
          </SimpleGrid>
          {hasMoreEnv && (
            <Button
              variant="subtle"
              fullWidth
              mt="sm"
              rightSection={<ChevronDown size={16} />}
              onClick={() => setEnvExpanded(!envExpanded)}
            >
              {envExpanded ? "收起" : `展开全部（还有 ${envEntries.length - 5} 个）`}
            </Button>
          )}
        </Box>
      )}

      {/* 配置区（editorial 下划线 Tab + 大圆角代码块） */}
      <Box className="prov-detail-hero" p="lg">
        <Group gap="sm" align="center" mb="md">
          <IconTile icon={Braces} tone="primary" size={28} />
          <Text className="font-headline tracking-tight" fz={16} fw={800} c="var(--on-surface)">
            配置
          </Text>
        </Group>
        <Group gap={0} mb="md" wrap="wrap">
          {configTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className="prov-tab font-headline"
              data-active={tab.value === activeTab.value ? "true" : "false"}
              onClick={() => setActiveConfigTab(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </Group>
        <Group justify="space-between" mb="sm" align="center">
          <Text size="xs" c="var(--text-muted)" fs="italic">
            {activeTab.hint}
          </Text>
          <CopyButton value={activeTab.json ?? provider.rawSettingsConfig} label={activeTab.copyLabel} />
        </Group>
        {activeTab.json ? (
          <JsonCodeBlock json={activeTab.json} />
        ) : (
          <Box
            className="rounded-2xl px-4 py-3"
            style={{ backgroundColor: "var(--surface-container-highest)" }}
          >
            <Text size="xs" c="var(--text-muted)">
              {activeTab.value === "merged" ? "加载中..." : "配置解析失败"}
            </Text>
          </Box>
        )}
      </Box>
    </Stack>
  );
}

function MetaField({ label, icon: Icon, children }: { label: string; icon?: LucideIcon; children: ReactNode }) {
  return (
    <Stack gap={6} className="min-w-0">
      <Group gap={6} align="center">
        {Icon && <Icon size={13} style={{ color: "var(--text-muted)" }} />}
        <Text
          component="div"
          fz={11}
          fw={700}
          c="var(--text-muted)"
          style={{ letterSpacing: "0.18em", textTransform: "uppercase" }}
        >
          {label}
        </Text>
      </Group>
      {children}
    </Stack>
  );
}

function EmptyStateGuideCard() {
  const steps: { icon: LucideIcon; text: string }[] = [
    { icon: Download, text: "安装 cc-switch" },
    { icon: Settings, text: "配置你的供应商" },
    { icon: RefreshCw, text: "回到此页点击刷新" },
  ];

  return (
    <section className="ui-surface-card rounded-2xl border border-border p-6">
      <Stack gap="lg">
        <Group gap="md" align="center" wrap="nowrap">
          <IconTile icon={Database} tone="primary" variant="solid" size={44} />
          <Box className="min-w-0">
            <Text size="lg" fw={700} c="var(--on-surface)">
              欢迎使用供应商设置
            </Text>
            <Text size="sm" c="var(--text-muted)">
              cc-switch 是一款供应商切换工具，可以帮助你管理多个 AI 服务提供商的配置。
            </Text>
          </Box>
        </Group>

        <Divider />

        <Box>
          <Text size="sm" fw={600} c="var(--on-surface)" mb="sm">
            开始使用
          </Text>
          <Stack gap="sm">
            {steps.map((step) => (
              <Group key={step.text} gap="sm" align="center">
                <IconTile icon={step.icon} tone="primary" size={28} />
                <Text size="sm" c="var(--on-surface)">
                  {step.text}
                </Text>
              </Group>
            ))}
          </Stack>
        </Box>

        <Button
          variant="light"
          leftSection={<ExternalLink size={15} />}
          className="self-start"
          onClick={() => {
            void openUrl("https://github.com/deanxv/cc-switch").catch((err) => {
              toast.error("无法打开链接", { description: String(err) });
            });
          }}
        >
          访问 cc-switch 官网
        </Button>
      </Stack>
    </section>
  );
}

export function ProviderSettingsPage({ searchValue }: { searchValue: string }) {
  const ccSwitchDbPath = useSettingsStore((s) => s.ccSwitchDbPath);
  const updateSetting = useSettingsStore((s) => s.update);
  const [data, setData] = useState<CcSwitchProvidersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appTypeFilter, setAppTypeFilter] = useState("claude");
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);

  const loadProviders = useCallback(async (showToast = false) => {
    setLoading(true);
    setError(null);
    try {
      const response = await invoke<CcSwitchProvidersResponse>("ccswitch_list_providers", {
        dbPath: ccSwitchDbPath ?? undefined,
      });
      setData(response);
      // 优化 7: 刷新成功反馈（仅在手动刷新时显示）
      if (showToast) {
        toast.success(`已刷新，共 ${response.providers.length} 个供应商`);
      }
    } catch (err) {
      setData(null);
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }, [ccSwitchDbPath]);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  const pickDbFile = async () => {
    let selected: string | string[] | null = null;
    try {
      selected = await openDialog({
        multiple: false,
        directory: false,
        filters: [{ name: "SQLite 数据库", extensions: ["db"] }],
      });
    } catch (err) {
      toast.error("无法打开文件选择器", { description: String(err) });
      return;
    }
    if (typeof selected === "string" && selected.trim()) {
      await updateSetting("ccSwitchDbPath", selected);
    }
  };

  const resetDbPath = async () => {
    await updateSetting("ccSwitchDbPath", null);
  };

  const appTypeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const provider of data?.providers ?? []) {
      counts.set(provider.appType, (counts.get(provider.appType) ?? 0) + 1);
    }
    const types = [...counts.keys()].sort((a, b) =>
      a === "claude" ? -1 : b === "claude" ? 1 : a.localeCompare(b)
    );
    return types.map((type) => ({
      value: type,
      label: `${type} (${counts.get(type)})`,
    }));
  }, [data]);

  useEffect(() => {
    if (appTypeOptions.length === 0) return;
    if (!appTypeOptions.some((option) => option.value === appTypeFilter)) {
      setAppTypeFilter(appTypeOptions[0].value);
    }
  }, [appTypeOptions, appTypeFilter]);

  const providersByType = useMemo(() => {
    return (data?.providers ?? []).reduce((acc, p) => {
      if (!acc[p.appType]) acc[p.appType] = [];
      acc[p.appType].push(p);
      return acc;
    }, {} as Record<string, CcSwitchProvider[]>);
  }, [data]);

  const visibleProviders = useMemo(() => {
    const list = providersByType[appTypeFilter] ?? [];
    const keyword = searchValue.trim().toLowerCase();
    if (!keyword) return list;
    return list.filter((provider) => {
      return [
        provider.name,
        provider.baseUrl,
        provider.category,
        provider.model,
        provider.websiteUrl,
        provider.notes,
      ]
        .filter((field): field is string => typeof field === "string")
        .some((field) => field.toLowerCase().includes(keyword));
    });
  }, [providersByType, appTypeFilter, searchValue]);

  useEffect(() => {
    if (visibleProviders.length === 0) {
      setSelectedProviderId(null);
    } else if (!selectedProviderId || !visibleProviders.some((p) => p.id === selectedProviderId)) {
      setSelectedProviderId(visibleProviders[0].id);
    }
  }, [visibleProviders, selectedProviderId]);

  const selectedProvider = visibleProviders.find((p) => p.id === selectedProviderId) ?? null;

  return (
    <Stack gap="md" className="flex-1">
      <style>{providerPageStyles}</style>
      <section className="ui-surface-card rounded-2xl border border-border p-3">
        <Stack gap="xs">
          <Group justify="space-between" align="center" gap="md" wrap="nowrap">
            <Group gap="sm" align="center" wrap="nowrap" className="min-w-0 flex-1">
              <IconTile icon={Database} tone="primary" variant="solid" size={36} />
              <Box className="min-w-0 flex-1">
                <Group gap="xs" mb={2} align="center">
                  <Text size="sm" fw={600} c="var(--on-surface)">
                    cc-switch 数据库
                  </Text>
                  <ProviderBadge tone={data ? "primary" : "neutral"}>
                    <span
                      style={{
                        display: "inline-block",
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        marginRight: 5,
                        backgroundColor: data ? "var(--success)" : "var(--text-muted)",
                      }}
                    />
                    {data ? "已连接" : "未连接"}
                  </ProviderBadge>
                </Group>
                <Text size="xs" c="var(--text-muted)">
                  只读解析 cc-switch 的供应商配置；密钥已脱敏，留空使用默认路径
                  ~/.cc-switch/cc-switch.db。
                </Text>
              </Box>
            </Group>
            <Group gap="xs" className="shrink-0">
              <Button size="compact-sm" variant="default" leftSection={<FolderOpen size={14} />} onClick={() => void pickDbFile()}>
                选择文件
              </Button>
              {ccSwitchDbPath && (
                <Button size="compact-sm" variant="subtle" color="gray" leftSection={<Undo2 size={14} />} onClick={() => void resetDbPath()}>
                  使用默认路径
                </Button>
              )}
              <Button size="compact-sm" variant="default" leftSection={<RefreshCw size={14} />} onClick={() => void loadProviders(true)} loading={loading}>
                刷新
              </Button>
            </Group>
          </Group>
          <Box className="rounded bg-surface-container-lowest/70 px-3 py-2">
            <Text
              component="code"
              size="xs"
              ff="var(--font-ui-mono)"
              c="var(--on-surface)"
              className="break-all leading-5"
            >
              {data?.dbPath ?? ccSwitchDbPath ?? "默认路径"}
            </Text>
          </Box>
        </Stack>
      </section>

      {error && (
        <section
          className="ui-surface-card rounded-2xl border border-border p-3"
          style={{ outline: "1px solid color-mix(in srgb, var(--danger) 38%, transparent)" }}
        >
          <Group gap="xs" align="start">
            <AlertTriangle size={16} className="shrink-0 text-danger" />
            <Text size="sm" c="var(--danger)" className="flex-1">
              {error}
            </Text>
          </Group>
        </section>
      )}

      {!data && !loading && !error && <EmptyStateGuideCard />}

      {loading && !data && (
        <Group justify="center" py="xl">
          <Loader size="sm" />
        </Group>
      )}

      {data && appTypeOptions.length > 0 && (
        <Box
          className="self-start overflow-x-auto"
          style={{
            backgroundColor: "var(--surface-container-low)",
            padding: "6px",
            borderRadius: "16px",
          }}
        >
          <Group gap={4} wrap="nowrap">
            {appTypeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setAppTypeFilter(option.value)}
                className="shrink-0 px-4 py-2 font-headline font-bold text-xs transition-all"
                style={{
                  borderRadius: "12px",
                  backgroundColor:
                    appTypeFilter === option.value
                      ? "color-mix(in srgb, var(--primary) 18%, var(--surface-container-lowest))"
                      : "transparent",
                  color:
                    appTypeFilter === option.value
                      ? "var(--primary)"
                      : "var(--on-surface-variant)",
                  boxShadow:
                    appTypeFilter === option.value
                      ? "0 1px 3px color-mix(in srgb, var(--primary) 12%, transparent)"
                      : "none",
                }}
                onMouseEnter={(e) => {
                  if (appTypeFilter !== option.value) {
                    e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--surface) 50%, transparent)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (appTypeFilter !== option.value) {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                {option.label}
              </button>
            ))}
          </Group>
        </Box>
      )}

      {/* 优化 8: 供应商数量提示 */}
      {data && visibleProviders.length > 0 && (
        <Text size="xs" c="var(--text-muted)">
          共 {visibleProviders.length} 个供应商
        </Text>
      )}

      {data && visibleProviders.length === 0 && !loading && (
        <Text size="sm" c="var(--text-muted)" py="md">
          {searchValue.trim()
            ? `未找到匹配「${searchValue.trim()}」的供应商，已搜索：名称、BASE_URL、分类、模型、官网、备注`
            : "该类型下没有供应商。"}
        </Text>
      )}

      {data && visibleProviders.length > 0 && (
        <Box className="flex min-h-0 flex-1 gap-4">
          <Box className="min-w-[280px] max-w-[400px] w-[30%] shrink-0 space-y-2.5 overflow-y-auto">
            {visibleProviders.map((provider) => (
              <ProviderListItem
                key={`${provider.appType}-${provider.id}`}
                provider={provider}
                isSelected={provider.id === selectedProviderId}
                onClick={() => setSelectedProviderId(provider.id)}
              />
            ))}
          </Box>
          <Box className="min-w-0 flex-1 overflow-y-auto">
            {selectedProvider ? (
              <ProviderDetailPanel provider={selectedProvider} />
            ) : (
              <Text size="sm" c="var(--text-muted)" py="md">
                请选择一个供应商
              </Text>
            )}
          </Box>
        </Box>
      )}
    </Stack>
  );
}

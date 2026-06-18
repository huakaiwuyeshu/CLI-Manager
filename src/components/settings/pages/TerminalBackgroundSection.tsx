import { useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import {
  Box,
  Button,
  Card,
  Group,
  Select,
  SimpleGrid,
  Slider,
  Stack,
  Switch,
  Text,
  UnstyledButton,
} from "@mantine/core";
import {
  useSettingsStore,
  type TerminalBackgroundFit,
  type TerminalBackgroundPosition,
  type TerminalBackgroundSettings,
} from "../../../stores/settingsStore";
import { backgroundAssetUrl } from "../../../lib/assetUrl";
import { formatFileSize } from "../../../lib/utils";
import { logError } from "../../../lib/logger";

interface SavedBackground {
  relativePath: string;
  sizeBytes: number;
  warning?: string;
}

const FIT_OPTIONS: { value: TerminalBackgroundFit; label: string }[] = [
  { value: "cover", label: "Cover（铺满裁剪）" },
  { value: "contain", label: "Contain（完整显示）" },
  { value: "center", label: "Center（原始尺寸）" },
  { value: "tile", label: "Tile（平铺）" },
];

const POSITION_GRID: TerminalBackgroundPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "center-left",
  "center",
  "center-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

const POSITION_LABEL: Record<TerminalBackgroundPosition, string> = {
  "top-left": "左上",
  "top-center": "上",
  "top-right": "右上",
  "center-left": "左",
  center: "居中",
  "center-right": "右",
  "bottom-left": "左下",
  "bottom-center": "下",
  "bottom-right": "右下",
};

export function TerminalBackgroundSection() {
  const terminalBackground = useSettingsStore((s) => s.terminalBackground);
  const update = useSettingsStore((s) => s.update);
  const terminalBackgroundMissing = useSettingsStore((s) => s.terminalBackgroundMissing);
  const clearTerminalBackgroundMissing = useSettingsStore((s) => s.clearTerminalBackgroundMissing);
  const [saving, setSaving] = useState(false);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [thumbFailed, setThumbFailed] = useState(false);

  const { enabled, imagePath, imageSizeBytes, opacity, fit, position, blur, overlayDarken } =
    terminalBackground;

  useEffect(() => {
    let cancelled = false;
    setThumbFailed(false);
    if (!imagePath) {
      setThumbUrl(null);
      return;
    }
    backgroundAssetUrl(imagePath).then((url) => {
      if (!cancelled) setThumbUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [imagePath]);

  // Patch helper — every UI control updates by spreading the current object plus a delta.
  const patch = (delta: Partial<TerminalBackgroundSettings>) => {
    void update("terminalBackground", { ...terminalBackground, ...delta });
  };

  const handlePickImage = async () => {
    if (saving) return;
    let selected: string | string[] | null;
    try {
      selected = await openDialog({
        multiple: false,
        directory: false,
        filters: [{ name: "图片", extensions: ["jpg", "jpeg", "png", "gif"] }],
      });
    } catch (err) {
      toast.error("无法打开文件选择器", { description: String(err) });
      logError("openDialog failed for terminal background", { err });
      return;
    }
    if (!selected || typeof selected !== "string") return;

    setSaving(true);
    try {
      const saved = await invoke<SavedBackground>("save_background_image", {
        sourcePath: selected,
      });
      const prev = imagePath;
      await update("terminalBackground", {
        ...terminalBackground,
        imagePath: saved.relativePath,
        imageSizeBytes: saved.sizeBytes,
      });
      clearTerminalBackgroundMissing();
      // 用户更换图片时清理旧文件，避免 backgrounds/ 目录无限膨胀。
      // 注意：只在 imagePath 真正变化时清理，且仅保留新图。
      if (prev && prev !== saved.relativePath) {
        try {
          await invoke("cleanup_unused_backgrounds", {
            keepRelativePaths: [saved.relativePath],
          });
        } catch (err) {
          logError("cleanup_unused_backgrounds failed", { err });
        }
      }
      if (saved.warning === "file_too_large") {
        toast.warning("背景图较大", {
          description: "图片大于 5MB，可能影响启动速度",
        });
      }
    } catch (err) {
      const msg = String(err);
      if (msg.includes("unsupported_format")) {
        toast.error("不支持的图片格式", { description: "请选择 JPEG / PNG / GIF" });
      } else {
        toast.error("背景图保存失败", { description: msg });
        logError("save_background_image failed", { err, source: selected });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    if (!imagePath && !terminalBackgroundMissing) return;
    if (!window.confirm("移除背景图?")) return;
    void (async () => {
      await update("terminalBackground", {
        ...terminalBackground,
        imagePath: null,
        imageSizeBytes: null,
      });
      clearTerminalBackgroundMissing();
      try {
        await invoke("cleanup_unused_backgrounds", { keepRelativePaths: [] });
      } catch (err) {
        logError("cleanup_unused_backgrounds failed", { err });
      }
    })();
  };

  const detailsDisabled = !enabled;

  return (
    <section className="ui-surface-card rounded-2xl border border-border p-4">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
          <Box>
            <Text size="sm" fw={600} c="var(--on-surface)">
              终端背景
            </Text>
            <Text mt={4} size="xs" c="var(--on-surface-variant)">
              使用本地图片作为终端背景。支持 JPEG / PNG / GIF。
            </Text>
          </Box>
          <Switch
            color="cliPrimary"
            checked={enabled}
            onChange={(event) => patch({ enabled: event.currentTarget.checked })}
            aria-label={enabled ? "关闭终端背景图" : "启用终端背景图"}
          />
        </Group>

        {enabled && terminalBackgroundMissing && (
          <Card className="border border-warning/40 bg-warning/10" p="sm" radius="lg" role="alert">
            <Text size="xs" c="var(--warning)">
              此前选择的背景图已丢失（可能被外部删除或移动）。请重新选择图片或关闭背景。
            </Text>
          </Card>
        )}

        {enabled && !imagePath && !terminalBackgroundMissing && (
          <Card className="border border-dashed border-border bg-surface-container-low" p="sm" radius="lg">
            <Text size="xs" c="var(--on-surface-variant)">
              尚未选择图片。点击下方“选择图片”上传一张本地图片以启用背景。
            </Text>
          </Card>
        )}

        <Stack gap="md" style={detailsDisabled ? { opacity: 0.55, pointerEvents: "none" } : undefined} aria-disabled={detailsDisabled}>
          <Card className="border border-border bg-surface-container-lowest" p="sm" radius="lg">
            <Stack gap="sm">
              <Text size="xs" fw={600} c="var(--on-surface)">
                图片
              </Text>
              <Group align="flex-start" gap="md" wrap="nowrap">
                <Box
                  className="ui-selection-card flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-container-low text-[10px] text-on-surface-variant"
                  w={96}
                  h={64}
                  aria-label="背景图预览"
                >
                  {thumbUrl && !thumbFailed ? (
                    <img
                      src={thumbUrl}
                      alt="背景缩略图"
                      className="h-full w-full object-cover"
                      onError={() => setThumbFailed(true)}
                    />
                  ) : thumbFailed ? (
                    <Text size="xs" ta="center" c="var(--warning)">
                      加载失败
                    </Text>
                  ) : (
                    <Text size="xs" c="var(--on-surface-variant)">
                      无图
                    </Text>
                  )}
                </Box>
                <Stack gap="xs" style={{ minWidth: 0, flex: 1 }}>
                  <Group gap="xs">
                    <Button
                      variant="light"
                      color="cliPrimary"
                      size="xs"
                      onClick={() => void handlePickImage()}
                      disabled={saving}
                    >
                      {saving ? "保存中..." : imagePath ? "更换图片" : "选择图片..."}
                    </Button>
                    {imagePath && (
                      <Button variant="subtle" color="red" size="xs" onClick={handleClear} disabled={saving}>
                        清除
                      </Button>
                    )}
                    {thumbFailed && imagePath && (
                      <Button variant="subtle" color="cliPrimary" size="xs" onClick={() => void handlePickImage()}>
                        重选
                      </Button>
                    )}
                  </Group>
                  <Text size="xs" c="var(--on-surface-variant)" style={{ overflowWrap: "anywhere" }}>
                    {imagePath ? (
                      <>
                        当前文件：<span className="font-mono">{imagePath}</span>
                        {typeof imageSizeBytes === "number" && (
                          <span className="ml-1 text-text-muted">（{formatFileSize(imageSizeBytes)}）</span>
                        )}
                      </>
                    ) : (
                      "尚未选择图片"
                    )}
                  </Text>
                  {thumbFailed && imagePath && (
                    <Text size="xs" c="var(--warning)">
                      无法加载图片。文件可能已被外部删除，请重新选择。
                    </Text>
                  )}
                </Stack>
              </Group>
            </Stack>
          </Card>

          <Card className="border border-border bg-surface-container-lowest" p="sm" radius="lg">
            <Stack gap="sm">
              <Text size="xs" fw={600} c="var(--on-surface)">
                显示设置
              </Text>
              <SliderRow
                label="透明度"
                min={0}
                max={100}
                step={1}
                value={opacity}
                suffix="%"
                ariaLabel="背景图透明度"
                onChange={(v) => patch({ opacity: v })}
              />
              <Select<TerminalBackgroundFit>
                label="适配模式"
                value={fit}
                onChange={(value) => {
                  if (value) patch({ fit: value });
                }}
                data={FIT_OPTIONS}
                allowDeselect={false}
                size="xs"
                aria-label="适配模式"
              />
              <SliderRow
                label="模糊"
                min={0}
                max={20}
                step={1}
                value={blur}
                suffix="px"
                ariaLabel="背景图模糊"
                onChange={(v) => patch({ blur: v })}
              />
              <SliderRow
                label="暗化覆盖"
                min={0}
                max={80}
                step={1}
                value={overlayDarken}
                suffix="%"
                ariaLabel="暗化覆盖强度"
                onChange={(v) => patch({ overlayDarken: v })}
              />
            </Stack>
          </Card>

          <Card className="border border-border bg-surface-container-lowest" p="sm" radius="lg">
            <Stack gap="xs">
              <Text size="xs" fw={600} c="var(--on-surface)">
                位置对齐
              </Text>
              <Text size="xs" c="var(--on-surface-variant)">
                适配为 Center 时尤其有用，其它模式下也保留作为偏好。
              </Text>
              <SimpleGrid cols={3} spacing={6} w={128}>
                {POSITION_GRID.map((pos) => {
                  const active = position === pos;
                  return (
                    <UnstyledButton
                      key={pos}
                      type="button"
                      onClick={() => patch({ position: pos })}
                      className="ui-interactive ui-focus-ring ui-selection-card flex h-10 w-10 items-center justify-center rounded-lg border text-[10px]"
                      data-selected={active ? "true" : "false"}
                      aria-pressed={active}
                      aria-label={`位置：${POSITION_LABEL[pos]}`}
                      title={POSITION_LABEL[pos]}
                    >
                      <Box
                        component="span"
                        w={8}
                        h={8}
                        style={{
                          borderRadius: 999,
                          backgroundColor: active ? "var(--primary)" : "var(--on-surface-variant)",
                          opacity: active ? 1 : 0.45,
                        }}
                      />
                    </UnstyledButton>
                  );
                })}
              </SimpleGrid>
            </Stack>
          </Card>
        </Stack>
      </Stack>
    </section>
  );
}

interface SliderRowProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  suffix?: string;
  ariaLabel: string;
  onChange: (next: number) => void;
}

function SliderRow({ label, min, max, step, value, suffix, ariaLabel, onChange }: SliderRowProps) {
  return (
    <Stack gap={6}>
      <Group justify="space-between" align="center">
        <Text size="xs" c="var(--on-surface-variant)">
          {label}
        </Text>
        <Text size="xs" ff="var(--font-ui-mono)" c="var(--on-surface)" className="tabular-nums">
          {value}
          {suffix ?? ""}
        </Text>
      </Group>
      <Slider
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        color="cliPrimary"
        aria-label={ariaLabel}
      />
    </Stack>
  );
}

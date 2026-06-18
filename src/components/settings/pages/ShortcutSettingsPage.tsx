import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Box, Button, Card, Group, Kbd, Stack, Text } from "@mantine/core";
import {
  DEFAULT_KEYBOARD_SHORTCUTS,
  useSettingsStore,
  type ShortcutAction,
  type KeyboardShortcutMap,
  type TabSwitchShortcutModifier,
  type TerminalNewlineShortcut,
} from "../../../stores/settingsStore";
import { eventToCombo } from "../../../hooks/useKeyboardShortcuts";

const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
  newTerminal: "新建终端",
  closeTerminal: "关闭终端",
  nextTab: "下一个标签",
  prevTab: "上一个标签",
  commandPalette: "命令面板",
  sessionHistory: "会话历史",
  toggleTerminalFullscreen: "终端全屏",
};

const TERMINAL_NEWLINE_OPTIONS: { value: TerminalNewlineShortcut; label: string }[] = [
  { value: "Shift+Enter", label: "Shift + Enter" },
  { value: "Ctrl+Enter", label: "Ctrl + Enter" },
  { value: "Alt+Enter", label: "Alt + Enter" },
];

const TAB_SWITCH_OPTIONS: { value: TabSwitchShortcutModifier; label: string }[] = [
  { value: "Alt", label: "Alt + 方向键" },
  { value: "Ctrl", label: "Ctrl + 方向键" },
  { value: "Shift", label: "Shift + 方向键" },
];

interface ShortcutSettingsPageProps {
  searchValue: string;
}

export function ShortcutSettingsPage({ searchValue }: ShortcutSettingsPageProps) {
  const shortcuts = useSettingsStore((s) => s.keyboardShortcuts);
  const terminalNewlineShortcut = useSettingsStore((s) => s.terminalNewlineShortcut);
  const update = useSettingsStore((s) => s.update);
  const [recording, setRecording] = useState<ShortcutAction | null>(null);

  const currentTabSwitchModifier = useMemo<TabSwitchShortcutModifier | null>(() => {
    const option = TAB_SWITCH_OPTIONS.find(
      (opt) => shortcuts.prevTab === `${opt.value}+ArrowLeft` && shortcuts.nextTab === `${opt.value}+ArrowRight`
    );
    return option?.value ?? null;
  }, [shortcuts.prevTab, shortcuts.nextTab]);

  const updateTabSwitchModifier = useCallback(
    (modifier: TabSwitchShortcutModifier) => {
      void update("keyboardShortcuts", {
        ...shortcuts,
        prevTab: `${modifier}+ArrowLeft`,
        nextTab: `${modifier}+ArrowRight`,
      });
      setRecording(null);
    },
    [shortcuts, update]
  );

  const handleRecord = useCallback(
    (event: KeyboardEvent) => {
      if (!recording) return;
      event.preventDefault();
      event.stopPropagation();
      const combo = eventToCombo(event);
      if (!combo) return;
      const next: KeyboardShortcutMap = { ...shortcuts, [recording]: combo };
      void update("keyboardShortcuts", next);
      setRecording(null);
    },
    [recording, shortcuts, update]
  );

  useEffect(() => {
    if (!recording) return;
    window.addEventListener("keydown", handleRecord, true);
    return () => window.removeEventListener("keydown", handleRecord, true);
  }, [recording, handleRecord]);

  const resetDefaults = () => {
    void update("keyboardShortcuts", DEFAULT_KEYBOARD_SHORTCUTS);
    setRecording(null);
  };

  const clearShortcut = useCallback(
    (action: ShortcutAction) => {
      void update("keyboardShortcuts", { ...shortcuts, [action]: "" });
      setRecording(null);
    },
    [shortcuts, update]
  );

  const keyword = searchValue.trim().toLowerCase();
  const visibleActions = useMemo(() => {
    const all = Object.keys(SHORTCUT_LABELS) as ShortcutAction[];
    if (!keyword) return all;
    return all.filter((action) => SHORTCUT_LABELS[action].toLowerCase().includes(keyword));
  }, [keyword]);

  const conflictMap = useMemo(() => {
    const comboToActions = new Map<string, ShortcutAction[]>();
    (Object.keys(SHORTCUT_LABELS) as ShortcutAction[]).forEach((action) => {
      const key = shortcuts[action].trim().toLowerCase();
      if (!key) return;
      const group = comboToActions.get(key) ?? [];
      group.push(action);
      comboToActions.set(key, group);
    });
    const conflictByAction = new Map<ShortcutAction, string>();
    comboToActions.forEach((actions) => {
      if (actions.length <= 1) return;
      actions.forEach((action) => {
        const peer = actions.find((candidate) => candidate !== action);
        if (peer) {
          conflictByAction.set(action, `与「${SHORTCUT_LABELS[peer]}」冲突`);
        }
      });
    });
    return conflictByAction;
  }, [shortcuts]);

  return (
    <Stack gap="md">
      <section className="ui-surface-card rounded-2xl border border-border p-4">
        <Stack gap="sm">
          <Box>
            <Text size="sm" fw={600} c="var(--on-surface)">
              终端键位
            </Text>
            <Text mt={4} size="xs" c="var(--on-surface-variant)">
              在终端中按下该组合键时，向 PTY 发送换行符 <code>\n</code>（适配 Claude Code、Codex 等 AI CLI 的“换行不提交”）。单按 Enter 行为不变。
            </Text>
          </Box>
          <Group gap="xs" aria-label="终端换行快捷键">
            {TERMINAL_NEWLINE_OPTIONS.map((opt) => {
              const active = terminalNewlineShortcut === opt.value;
              return (
                <Button
                  key={opt.value}
                  type="button"
                  size="xs"
                  variant={active ? "light" : "default"}
                  color={active ? "cliPrimary" : "gray"}
                  onClick={() => {
                    if (!active) void update("terminalNewlineShortcut", opt.value);
                  }}
                  aria-pressed={active}
                >
                  {opt.label}
                </Button>
              );
            })}
          </Group>
        </Stack>
      </section>

      <section className="ui-surface-card rounded-2xl border border-border p-4">
        <Stack gap="sm">
          <Box>
            <Text size="sm" fw={600} c="var(--on-surface)">
              终端标签切换
            </Text>
            <Text mt={4} size="xs" c="var(--on-surface-variant)">
              左方向键切到上一个标签，右方向键切到下一个标签。
            </Text>
          </Box>
          <Group gap="xs">
            {TAB_SWITCH_OPTIONS.map((opt) => {
              const active = currentTabSwitchModifier === opt.value;
              return (
                <Button
                  key={opt.value}
                  type="button"
                  size="xs"
                  variant={active ? "light" : "default"}
                  color={active ? "cliPrimary" : "gray"}
                  onClick={() => {
                    if (!active) updateTabSwitchModifier(opt.value);
                  }}
                  aria-pressed={active}
                >
                  {opt.label}
                </Button>
              );
            })}
          </Group>
          {currentTabSwitchModifier === null && (
            <Text size="xs" c="var(--on-surface-variant)">
              当前为自定义标签切换快捷键，可在下方单独修改。
            </Text>
          )}
        </Stack>
      </section>

      <section className="ui-surface-card rounded-2xl border border-border p-4">
        <Stack gap="sm">
          <Group justify="space-between" align="center" gap="md">
            <Text size="sm" fw={600} c="var(--on-surface)">
              快捷键绑定
            </Text>
            <Button type="button" size="xs" variant="default" color="gray" onClick={resetDefaults}>
              恢复默认
            </Button>
          </Group>

          <Stack gap="xs">
          {visibleActions.map((action) => {
            const conflict = conflictMap.get(action);
            const isRecording = recording === action;
            return (
              <Card
                key={action}
                className={`border ${conflict ? "border-warning/60" : "border-border"}`}
                p="sm"
                radius="lg"
                style={{
                  backgroundColor: conflict
                    ? "color-mix(in srgb, var(--warning) 10%, var(--surface-container-high) 90%)"
                    : "var(--surface-container-high)",
                }}
              >
                <Group justify="space-between" align="center" gap="md" wrap="nowrap">
                  <Box className="min-w-0">
                    <Text size="sm" fw={500} c="var(--on-surface)">
                      {SHORTCUT_LABELS[action]}
                    </Text>
                    {conflict && (
                      <Text mt={2} size="xs" c="var(--warning)">
                        {conflict}
                      </Text>
                    )}
                  </Box>
                  <Group gap="xs" className="shrink-0">
                    {isRecording ? (
                      <>
                        <Badge color="cliPrimary" variant="filled" className="animate-pulse">
                          请按下快捷键...
                        </Badge>
                        <Button
                          type="button"
                          size="xs"
                          variant="default"
                          color="gray"
                          onClick={() => clearShortcut(action)}
                        >
                          清空
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="subtle"
                          color="cliPrimary"
                          onClick={() => setRecording(null)}
                        >
                          取消
                        </Button>
                      </>
                    ) : (
                      <>
                        <Kbd
                          className="min-w-[108px] text-center"
                          style={{ color: shortcuts[action].trim() ? "var(--on-surface)" : "var(--on-surface-variant)" }}
                        >
                          {shortcuts[action].trim() || "未设置"}
                        </Kbd>
                        <Button
                          type="button"
                          size="xs"
                          variant="subtle"
                          color="cliPrimary"
                          onClick={() => setRecording(action)}
                        >
                          修改
                        </Button>
                      </>
                    )}
                  </Group>
                </Group>
              </Card>
            );
          })}
          {visibleActions.length === 0 && (
            <Card className="border border-dashed border-border bg-surface-container-lowest text-center" p="lg" radius="lg">
              <Text size="xs" c="var(--on-surface-variant)">
              未找到匹配的快捷键动作
              </Text>
            </Card>
          )}
          </Stack>
        </Stack>
      </section>
    </Stack>
  );
}

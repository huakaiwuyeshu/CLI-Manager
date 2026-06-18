import { useEffect, useMemo, useState } from "react";
import { Badge, Box, Button, Card, Group, Select, Stack, Text, TextInput, UnstyledButton } from "@mantine/core";
import { useTemplateStore } from "../../../stores/templateStore";
import { useProjectStore } from "../../../stores/projectStore";
import { useTerminalStore } from "../../../stores/terminalStore";
import type { CommandTemplate } from "../../../lib/types";

type Scope = "global" | "project" | "session";

interface TemplateSettingsPageProps {
  searchValue: string;
}

interface TemplateEditorForm {
  name: string;
  command: string;
  description: string;
  scope: Scope;
  projectId: string | null;
}

const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
  { value: "global", label: "全局" },
  { value: "project", label: "项目" },
  { value: "session", label: "会话" },
];

function resolveScope(template: CommandTemplate): Scope {
  if (template.session_id) return "session";
  if (template.project_id) return "project";
  return "global";
}

export function TemplateSettingsPage({ searchValue }: TemplateSettingsPageProps) {
  const {
    templates,
    sessionTemplates,
    fetchTemplates,
    createTemplate,
    createSessionTemplate,
    updateTemplate,
    updateSessionTemplate,
    deleteTemplate,
    deleteSessionTemplate,
    pruneSessionTemplates,
  } = useTemplateStore();
  const { projects } = useProjectStore();
  const { sessions, activeSessionId } = useTerminalStore();

  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [form, setForm] = useState<TemplateEditorForm>({
    name: "",
    command: "",
    description: "",
    scope: "global",
    projectId: null,
  });

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    pruneSessionTemplates(sessions.map((session) => session.id));
  }, [sessions, pruneSessionTemplates]);

  const currentSessionTemplates = activeSessionId ? (sessionTemplates[activeSessionId] ?? []) : [];
  const allTemplates = useMemo(
    () => [...templates, ...currentSessionTemplates],
    [templates, currentSessionTemplates]
  );

  const scopeLabel = (template: CommandTemplate): string => {
    if (template.session_id) return "会话";
    if (!template.project_id) return "全局";
    const project = projects.find((item) => item.id === template.project_id);
    return project ? `项目:${project.name}` : "项目";
  };

  const keyword = searchValue.trim().toLowerCase();
  const visibleTemplates = useMemo(() => {
    if (!keyword) return allTemplates;
    return allTemplates.filter((template) => {
      const scopeText = scopeLabel(template).toLowerCase();
      return (
        template.name.toLowerCase().includes(keyword)
        || template.command.toLowerCase().includes(keyword)
        || template.description.toLowerCase().includes(keyword)
        || scopeText.includes(keyword)
      );
    });
  }, [allTemplates, keyword]);

  const selectedTemplate = useMemo(
    () => allTemplates.find((item) => item.id === selectedId) ?? null,
    [allTemplates, selectedId]
  );
  const projectOptions = useMemo(
    () => [
      { value: "", label: "请选择项目" },
      ...projects.map((project) => ({ value: project.id, label: project.name })),
    ],
    [projects]
  );
  const scopeOptions = useMemo(
    () => SCOPE_OPTIONS.map((option) => ({
      ...option,
      disabled: option.value === "session" && !activeSessionId,
    })),
    [activeSessionId]
  );

  const resetToCreate = () => {
    setMode("create");
    setSelectedId(null);
    setConfirmingDelete(false);
    setForm({
      name: "",
      command: "",
      description: "",
      scope: "global",
      projectId: activeSession?.projectId ?? null,
    });
  };

  const openEditor = (template: CommandTemplate) => {
    setMode("edit");
    setSelectedId(template.id);
    setConfirmingDelete(false);
    setForm({
      name: template.name,
      command: template.command,
      description: template.description,
      scope: resolveScope(template),
      projectId: template.project_id,
    });
  };

  const handleSave = async () => {
    const name = form.name.trim();
    const command = form.command.trim();
    const description = form.description.trim();
    if (!name || !command) return;
    if (mode === "create" && form.scope === "project" && !form.projectId) return;
    if (mode === "create" && form.scope === "session" && !activeSessionId) return;

    setSaving(true);
    try {
      if (mode === "create") {
        if (form.scope === "session") {
          await createSessionTemplate(activeSessionId!, {
            session_id: activeSessionId!,
            project_id: activeSession?.projectId ?? null,
            name,
            command,
            description,
          });
        } else {
          await createTemplate({
            project_id: form.scope === "project" ? form.projectId : null,
            name,
            command,
            description,
          });
        }
        resetToCreate();
        return;
      }

      if (!selectedTemplate) return;
      const editingTemplate = selectedTemplate;
      if (editingTemplate.session_id) {
        await updateSessionTemplate(editingTemplate.session_id, editingTemplate.id, {
          name,
          command,
          description,
        });
      } else {
        await updateTemplate(editingTemplate.id, {
          name,
          command,
          description,
        });
      }
      openEditor({ ...editingTemplate, name, command, description });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;
    if (selectedTemplate.session_id) {
      deleteSessionTemplate(selectedTemplate.session_id, selectedTemplate.id);
    } else {
      await deleteTemplate(selectedTemplate.id);
    }
    resetToCreate();
  };

  const saveDisabled = saving
    || !form.name.trim()
    || !form.command.trim()
    || (mode === "create" && form.scope === "project" && !form.projectId)
    || (mode === "create" && form.scope === "session" && !activeSessionId);

  return (
    <div className="grid grid-cols-[280px_minmax(0,1fr)] gap-4">
      <section className="ui-surface-card min-w-0 rounded-2xl border border-border p-3">
        <Stack gap="sm">
          <Group justify="space-between" align="center" gap="sm">
            <Text size="sm" fw={600} c="var(--on-surface)">
              模板列表
            </Text>
            <Button type="button" size="xs" variant="subtle" color="cliPrimary" onClick={resetToCreate}>
              新建模板
            </Button>
          </Group>

          <Stack gap={6}>
          {visibleTemplates.map((template) => {
            const active = selectedId === template.id && mode === "edit";
            return (
              <UnstyledButton
                key={template.id}
                onClick={() => openEditor(template)}
                className={`ui-interactive w-full rounded-xl border px-3 py-2 text-left ${
                  active ? "border-primary bg-surface-container-highest" : "border-border bg-surface-container-high"
                }`}
              >
                <Group gap="xs" wrap="nowrap">
                  <Text size="xs" fw={600} c="var(--on-surface)" truncate>
                    {template.name}
                  </Text>
                  <Badge size="xs" variant="light" color={active ? "cliPrimary" : "gray"} className="shrink-0">
                    {scopeLabel(template)}
                  </Badge>
                </Group>
                <Text mt={4} size="xs" c="var(--on-surface-variant)" truncate>
                  {template.command}
                </Text>
              </UnstyledButton>
            );
          })}
          {visibleTemplates.length === 0 && (
            <Card className="border border-dashed border-border bg-surface-container-lowest text-center" p="lg" radius="lg">
              <Text size="xs" c="var(--on-surface-variant)">
              暂无匹配模板，可从右侧新建。
              </Text>
            </Card>
          )}
          </Stack>
        </Stack>
      </section>

      <section className="ui-surface-card min-w-0 rounded-2xl border border-border p-0">
        <Box className="sticky top-0 z-10 border-b border-border bg-surface-container px-4 py-3">
          <Group justify="space-between" align="flex-start" gap="md">
            <Box>
              <Text size="sm" fw={600} c="var(--on-surface)">
              {mode === "create" ? "新建模板" : "编辑模板"}
              </Text>
              <Text mt={2} size="xs" c="var(--on-surface-variant)">
              新建与编辑共用同一表单，避免行为分叉。
              </Text>
            </Box>
            <Group gap="xs" justify="flex-end">
            {mode === "edit" && (
              <Button
                type="button"
                size="xs"
                variant="default"
                color="gray"
                onClick={resetToCreate}
              >
                取消编辑
              </Button>
            )}
            <Button
              type="button"
              size="xs"
              color="cliPrimary"
              onClick={() => void handleSave()}
              disabled={saveDisabled}
            >
              {saving ? "保存中..." : "确认保存"}
            </Button>
            {mode === "edit" && (
              confirmingDelete ? (
                <>
                  <Button
                    type="button"
                    size="xs"
                    variant="default"
                    color="gray"
                    onClick={() => setConfirmingDelete(false)}
                  >
                    取消删除
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    color="red"
                    onClick={() => void handleDelete()}
                  >
                    确认删除
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  size="xs"
                  variant="light"
                  color="red"
                  onClick={() => setConfirmingDelete(true)}
                >
                  删除
                </Button>
              )
            )}
            </Group>
          </Group>
        </Box>

        <Stack gap="sm" p="md">
          <TextInput
              label="名称"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.currentTarget.value }))}
              placeholder="例如：启动后端服务"
              size="xs"
              aria-label="模板名称"
          />

          <TextInput
              label="命令"
              value={form.command}
              onChange={(event) => setForm((prev) => ({ ...prev, command: event.currentTarget.value }))}
              placeholder="支持 ${projectPath}, ${projectName}"
              size="xs"
              aria-label="模板命令"
          />

          <TextInput
              label="描述"
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.currentTarget.value }))}
              placeholder="可选"
              size="xs"
              aria-label="模板描述"
          />

          <Box>
            <Select<Scope>
              label="作用域"
              value={form.scope}
              onChange={(value) => {
                if (value) setForm((prev) => ({ ...prev, scope: value }));
              }}
              data={scopeOptions}
              allowDeselect={false}
              disabled={mode === "edit"}
              size="xs"
              aria-label="模板作用域"
            />
            {!activeSessionId && form.scope === "session" && (
              <Text mt={4} size="xs" c="var(--warning)">
                当前无活跃会话，不能创建会话模板。
              </Text>
            )}
            {mode === "edit" && (
              <Text mt={4} size="xs" c="var(--on-surface-variant)">
                编辑模式锁定作用域，避免跨作用域迁移造成误操作。
              </Text>
            )}
          </Box>

          {form.scope === "project" && (
            <Select<string>
                label="目标项目"
                value={form.projectId ?? ""}
                onChange={(value) => setForm((prev) => ({ ...prev, projectId: value || null }))}
                data={projectOptions}
                allowDeselect={false}
                disabled={mode === "edit"}
                size="xs"
                aria-label="目标项目"
            />
          )}

          {form.scope === "session" && (
            <Card className="border border-border bg-surface-container-lowest" p="sm" radius="lg">
              <Text size="xs" c="var(--on-surface-variant)">
              {activeSessionId
                ? `将绑定到当前会话：${activeSessionId}`
                : "请先激活一个会话后再创建会话模板。"}
              </Text>
            </Card>
          )}

        </Stack>
      </section>
    </div>
  );
}

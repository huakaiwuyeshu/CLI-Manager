import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  PasswordInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  UnstyledButton,
} from "@mantine/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  useSyncStore,
  type AutoSyncAction,
  type SyncDataDomain,
  type SyncMode,
  type SyncPreview,
} from "../../../stores/syncStore";
import {
  Cloud,
  Download,
  Upload,
  AlertTriangle,
  Check,
  Folder,
} from "../../icons";
import { toast } from "sonner";

const SYNC_MODE_OPTIONS: { value: SyncMode; label: string; description: string }[] = [
  { value: "cloud", label: "云同步", description: "通过 WebDAV 协议同步到云端" },
  { value: "local", label: "本地同步", description: "将配置打包为 zip 保存到本地目录" },
];

const AUTO_SYNC_OPTIONS: { value: AutoSyncAction; label: string }[] = [
  { value: "off", label: "关闭" },
  { value: "upload", label: "上传" },
  { value: "download", label: "下载" },
];

const DOMAIN_OPTIONS: { value: SyncDataDomain; label: string }[] = [
  { value: "projects", label: "项目" },
  { value: "groups", label: "分组" },
  { value: "command_templates", label: "命令模板" },
];

export function SyncSettingsPage() {
  const {
    webdavUrl,
    webdavUsername,
    hasPassword,
    status,
    lastSyncAt,
    conflictInfo,
    loaded,
    syncMode,
    localSyncDir,
    remoteDir,
    deviceName,
    knownDeviceNames,
    autoSyncOnStartup,
    autoSyncOnClose,
    load,
    setConfig,
    clearPassword,
    testConnection,
    setDeviceName,
    setAutoSyncOnStartup,
    setAutoSyncOnClose,
    upload,
    download,
    getPreview,
    resolveConflict,
    clearConflict,
    setSyncMode,
    setLocalSyncDir,
    setRemoteDir,
    localExport,
    localImport,
  } = useSyncStore();

  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deviceNameInput, setDeviceNameInput] = useState("");
  const [remoteDirInput, setRemoteDirInput] = useState("");
  const [preview, setPreview] = useState<SyncPreview | null>(null);
  const [previewMode, setPreviewMode] = useState<"upload" | "download" | null>(null);
  const [previewDeviceName, setPreviewDeviceName] = useState("");
  const [selectedDomains, setSelectedDomains] = useState<SyncDataDomain[]>([
    "projects",
    "groups",
    "command_templates",
  ]);
  const [showImportConfirm, setShowImportConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) {
      void load();
    }
  }, [loaded, load]);

  useEffect(() => {
    if (loaded) {
      setUrl(webdavUrl);
      setUsername(webdavUsername);
      setDeviceNameInput(deviceName);
      setRemoteDirInput(remoteDir);
      setPreviewDeviceName(deviceName);
    }
  }, [loaded, webdavUrl, webdavUsername, deviceName, remoteDir]);

  const handleTest = async () => {
    if (!url.trim() || !username.trim() || !password.trim()) {
      toast.error("请填写完整的连接信息");
      return;
    }

    setTesting(true);
    try {
      const result = await testConnection(url.trim(), username.trim(), password);
      if (result.success) {
        toast.success("连接成功");
        await setConfig(url.trim(), username.trim(), password);
        setShowPassword(false);
      } else {
        toast.error("连接失败", { description: result.message });
      }
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!url.trim()) {
      toast.error("请填写 WebDAV URL");
      return;
    }

    if (password.trim()) {
      await setConfig(url.trim(), username.trim(), password);
      toast.success("配置已保存（包含密码）");
    } else {
      await setConfig(url.trim(), username.trim());
      toast.success("配置已保存");
    }
  };

  const handleSaveDeviceName = async () => {
    try {
      await setDeviceName(deviceNameInput);
      toast.success("设备名称已保存");
    } catch (error) {
      toast.error("保存失败", { description: error instanceof Error ? error.message : String(error) });
    }
  };

  const handleSaveRemoteDir = async () => {
    try {
      await setRemoteDir(remoteDirInput.trim());
      toast.success("远程目录已保存");
    } catch (error) {
      toast.error("保存失败", { description: error instanceof Error ? error.message : String(error) });
    }
  };

  const openPreview = async (mode: "upload" | "download") => {
    if (!hasPassword) {
      toast.error("请先配置并测试 WebDAV 连接");
      return;
    }
    try {
      const nextPreview = await getPreview(previewDeviceName || deviceName);
      if (mode === "download" && nextPreview.remote.missing) {
        toast.error("无法从云端同步");
        return;
      }
      setPreview(nextPreview);
      setPreviewMode(mode);
      setSelectedDomains(["projects", "groups", "command_templates"]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(mode === "upload" ? "读取同步摘要失败" : "读取云端快照失败", { description: message });
    }
  };

  const confirmPreviewAction = async () => {
    if (!previewMode) return;
    if (previewMode === "download" && preview?.remote.missing) {
      toast.error("无法从云端同步");
      return;
    }
    try {
      if (previewMode === "upload") {
        await upload();
        toast.success("上传成功");
      } else {
        await download(true, { deviceName: previewDeviceName || deviceName, domains: selectedDomains });
        toast.success("下载成功");
      }
      setPreview(null);
      setPreviewMode(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(previewMode === "upload" ? "上传失败" : "下载失败", { description: message });
    }
  };

  const toggleDomain = (domain: SyncDataDomain) => {
    setSelectedDomains((current) =>
      current.includes(domain) ? current.filter((item) => item !== domain) : [...current, domain]
    );
  };

  const handlePickLocalDir = async () => {
    try {
      const result = await openDialog({ directory: true, multiple: false, title: "选择本地同步目录" });
      if (typeof result === "string" && result.length > 0) {
        await setLocalSyncDir(result);
      }
    } catch (error) {
      toast.error("选择目录失败", { description: String(error) });
    }
  };

  const handleLocalExport = async () => {
    if (!localSyncDir) {
      toast.error("请先选择本地同步目录");
      return;
    }
    try {
      const path = await localExport();
      toast.success("本地导出成功", { description: path });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error("本地导出失败", { description: message });
    }
  };

  const handleLocalImportPick = async () => {
    try {
      const result = await openDialog({
        directory: false,
        multiple: false,
        title: "选择要导入的同步 zip 文件",
        filters: [{ name: "同步包", extensions: ["zip"] }],
        defaultPath: localSyncDir || undefined,
      });
      if (typeof result === "string" && result.length > 0) {
        setShowImportConfirm(result);
      }
    } catch (error) {
      toast.error("选择文件失败", { description: String(error) });
    }
  };

  const confirmLocalImport = async () => {
    const zipPath = showImportConfirm;
    setShowImportConfirm(null);
    if (!zipPath) return;
    try {
      await localImport(zipPath);
      toast.success("本地导入成功");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error("本地导入失败", { description: message });
    }
  };

  const formatLastSync = () => {
    if (!lastSyncAt) return "从未同步";
    const date = new Date(lastSyncAt);
    return date.toLocaleString("zh-CN");
  };

  return (
    <Stack gap="md">
      {conflictInfo && (
        <Card className="border border-yellow-500/30 bg-yellow-500/10" p="md" radius="lg">
          <Group align="flex-start" gap="sm" wrap="nowrap">
            <ThemeIcon variant="light" color="yellow" size="sm">
              <AlertTriangle size={16} />
            </ThemeIcon>
            <Stack gap="sm" className="flex-1">
              <Box>
                <Text fw={600} c="yellow">
                  检测到同步冲突
                </Text>
                <Text mt={4} size="sm" c="var(--on-surface-variant)">
                本地和远程都有更新，请选择保留哪个版本。
                </Text>
              </Box>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <Card className="bg-surface-container-high" p="sm" radius="lg">
                  <Text fw={600}>本地版本</Text>
                  <Text mt={4} size="sm" c="var(--on-surface-variant)">
                    {new Date(conflictInfo.local_modified).toLocaleString("zh-CN")}
                  </Text>
                  <Text mt={8} size="xs">
                    {conflictInfo.local_projects} 个项目 · {conflictInfo.local_groups} 个分组 ·{" "}
                    {conflictInfo.local_templates} 个模板
                  </Text>
                </Card>
                <Card className="bg-surface-container-high" p="sm" radius="lg">
                  <Text fw={600}>远程版本</Text>
                  <Text mt={4} size="sm" c="var(--on-surface-variant)">
                    {new Date(conflictInfo.remote_modified).toLocaleString("zh-CN")}
                  </Text>
                  <Text mt={8} size="xs">
                    {conflictInfo.remote_projects} 个项目 · {conflictInfo.remote_groups} 个分组 ·{" "}
                    {conflictInfo.remote_templates} 个模板
                  </Text>
                </Card>
              </SimpleGrid>
              <Group gap="xs">
                <Button size="xs" color="cliPrimary" onClick={() => resolveConflict(true)}>
                  保留本地
                </Button>
                <Button size="xs" variant="default" color="gray" onClick={() => resolveConflict(false)}>
                  使用远程
                </Button>
                <Button size="xs" variant="subtle" color="gray" onClick={clearConflict}>
                  取消
                </Button>
              </Group>
            </Stack>
          </Group>
        </Card>
      )}

      <section className="ui-surface-card rounded-2xl border border-border p-4">
        <Stack gap="sm">
          <Text size="sm" fw={600} c="var(--on-surface)">
            同步方式
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
          {SYNC_MODE_OPTIONS.map((opt) => {
            const active = syncMode === opt.value;
            return (
              <UnstyledButton
                key={opt.value}
                onClick={() => void setSyncMode(opt.value)}
                className="ui-interactive ui-focus-ring ui-selection-card rounded-xl border text-left"
                data-selected={active ? "true" : "false"}
                aria-pressed={active}
                w="100%"
                style={{
                  display: "block",
                  minHeight: 76,
                  minWidth: 0,
                  padding: "14px 16px",
                  whiteSpace: "normal",
                }}
              >
                <Stack gap={4} style={{ minWidth: 0 }}>
                  <Text size="sm" fw={600} c="var(--on-surface)" style={{ lineHeight: 1.25 }}>
                    {opt.label}
                  </Text>
                  <Text size="xs" lh={1.45} c="var(--on-surface-variant)" style={{ overflowWrap: "anywhere" }}>
                    {opt.description}
                  </Text>
                </Stack>
              </UnstyledButton>
            );
          })}
          </SimpleGrid>
        </Stack>
      </section>

      {syncMode === "cloud" && (
        <>
          <section className="ui-surface-card rounded-2xl border border-border p-4">
            <Stack gap="md">
              <Text size="sm" fw={600} c="var(--on-surface)">
                WebDAV 配置
              </Text>

              <TextInput
                  label="服务器地址"
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.currentTarget.value)}
                  placeholder="https://dav.example.com/webdav"
                  size="sm"
                  aria-label="WebDAV 服务器地址"
              />

              <Box>
                <Group align="flex-end" gap="xs" wrap="nowrap">
                  <TextInput
                    label="远程目录"
                    type="text"
                    value={remoteDirInput}
                    onChange={(event) => setRemoteDirInput(event.currentTarget.value)}
                    placeholder="cli-manager（默认）"
                    size="sm"
                    className="flex-1"
                    aria-label="远程目录"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    color="gray"
                    onClick={handleSaveRemoteDir}
                  >
                    保存目录
                  </Button>
                </Group>
                <Text mt={4} size="xs" c="var(--on-surface-variant)">
                  自定义云端存储目录，留空则使用默认 cli-manager。修改后重新上传/下载以切换命名空间。
                </Text>
              </Box>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <TextInput
                    label="用户名"
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.currentTarget.value)}
                    placeholder="username"
                    size="sm"
                    aria-label="WebDAV 用户名"
                />
                <PasswordInput
                    label="密码"
                    value={password}
                    onChange={(event) => setPassword(event.currentTarget.value)}
                    placeholder="••••••••"
                    visible={showPassword}
                    onVisibilityChange={setShowPassword}
                    size="sm"
                    aria-label="WebDAV 密码"
                />
              </SimpleGrid>

              <Box>
                <Group align="flex-end" gap="xs" wrap="nowrap">
                  <TextInput
                    label="当前设备名称"
                    type="text"
                    value={deviceNameInput}
                    onChange={(event) => setDeviceNameInput(event.currentTarget.value)}
                    placeholder="当前设备"
                    size="sm"
                    className="flex-1"
                    aria-label="当前设备名称"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    color="gray"
                    onClick={handleSaveDeviceName}
                  >
                    保存设备名
                  </Button>
                </Group>
                <Text mt={4} size="xs" c="var(--on-surface-variant)">
                  云端快照会按设备名称隔离，避免不同设备路径互相覆盖。
                </Text>
              </Box>

              <Group gap="xs">
                <Button
                  size="xs"
                  color="cliPrimary"
                  onClick={handleTest}
                  disabled={testing || !url.trim() || !username.trim() || !password.trim()}
                >
                  {testing ? "测试中..." : "测试连接"}
                </Button>
                <Button
                  size="xs"
                  variant="default"
                  color="gray"
                  onClick={handleSave}
                >
                  保存配置
                </Button>
                {hasPassword && (
                  <Button
                    size="xs"
                    variant="subtle"
                    color="red"
                    onClick={clearPassword}
                  >
                    清除密码
                  </Button>
                )}
              </Group>

              {hasPassword && (
                <Group gap="xs" c="var(--success)">
                  <Check size={16} />
                  <Text size="sm">已配置 WebDAV 连接</Text>
                </Group>
              )}
            </Stack>
          </section>

          <section className="ui-surface-card rounded-2xl border border-border p-4">
            <Stack gap="md">
              <Text size="sm" fw={600} c="var(--on-surface)">
                云端同步操作
              </Text>
            {!hasPassword && (
              <Card className="border border-yellow-500/30 bg-yellow-500/10" p="sm" radius="lg">
                <Text size="sm" c="yellow">
                请先完成 WebDAV 配置并点击"测试连接"验证成功后再进行同步操作。
                </Text>
              </Card>
            )}

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Select<AutoSyncAction>
                  label="应用打开时"
                  value={autoSyncOnStartup}
                  onChange={(value) => {
                    if (value) void setAutoSyncOnStartup(value);
                  }}
                  data={AUTO_SYNC_OPTIONS}
                  allowDeselect={false}
                  size="sm"
              />
              <Select<AutoSyncAction>
                  label="应用关闭时"
                  value={autoSyncOnClose}
                  onChange={(value) => {
                    if (value) void setAutoSyncOnClose(value);
                  }}
                  data={AUTO_SYNC_OPTIONS}
                  allowDeselect={false}
                  size="sm"
              />
            </SimpleGrid>

            <Select<string>
                label="恢复设备快照"
                value={previewDeviceName}
                onChange={(value) => setPreviewDeviceName(value ?? "")}
                data={knownDeviceNames.map((name) => ({ value: name, label: name }))}
                allowDeselect={false}
                size="sm"
            />

            <Group gap="sm">
              <Button
                size="sm"
                color="cliPrimary"
                leftSection={status === "syncing" ? undefined : <Upload size={16} />}
                onClick={() => void openPreview("upload")}
                disabled={!hasPassword || status === "syncing"}
              >
                {status === "syncing" ? "同步中" : "上传到云端"}
              </Button>
              <Button
                size="sm"
                variant="default"
                color="gray"
                leftSection={status === "syncing" ? undefined : <Download size={16} />}
                onClick={() => void openPreview("download")}
                disabled={!hasPassword || status === "syncing"}
              >
                {status === "syncing" ? "同步中" : "从云端下载"}
              </Button>
            </Group>

            <Group gap="xs" c="var(--on-surface-variant)">
              <Cloud size={16} />
              <Text size="sm">上次同步：{formatLastSync()}</Text>
            </Group>
            </Stack>
          </section>

          <Card className="border border-border bg-surface-container-high" p="md" radius="lg">
            <Text fw={600} c="var(--on-surface)">使用说明</Text>
            <Stack mt="xs" gap={4}>
              <Text size="sm" c="var(--on-surface-variant)">支持 WebDAV 协议，可使用坚果云、InfiniCLOUD、群晖 NAS 等服务。</Text>
              <Text size="sm" c="var(--on-surface-variant)">上传将覆盖远程配置，下载将覆盖本地配置。</Text>
              <Text size="sm" c="var(--on-surface-variant)">建议在切换设备前先上传，在新设备上下载。</Text>
              <Text size="sm" c="var(--on-surface-variant)">密码使用系统安全存储，不会被明文保存。</Text>
            </Stack>
          </Card>
        </>
      )}

      {syncMode === "local" && (
        <>
          <section className="ui-surface-card rounded-2xl border border-border p-4">
            <Stack gap="md">
              <Text size="sm" fw={600} c="var(--on-surface)">
                本地同步目录
              </Text>
              <Group align="flex-end" gap="xs" wrap="nowrap">
                <TextInput
                  label="目录"
                  type="text"
                  value={localSyncDir}
                  readOnly
                  placeholder="尚未选择目录"
                  className="flex-1"
                  size="sm"
                  aria-label="本地同步目录"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  color="gray"
                  leftSection={<Folder size={16} />}
                  onClick={handlePickLocalDir}
                >
                  选择目录
                </Button>
              </Group>
              {localSyncDir && (
                <Group gap="xs" c="var(--success)">
                  <Check size={16} />
                  <Text size="sm">已配置本地同步目录</Text>
                </Group>
              )}
            </Stack>
          </section>

          <section className="ui-surface-card rounded-2xl border border-border p-4">
            <Stack gap="md">
              <Text size="sm" fw={600} c="var(--on-surface)">
                本地同步操作
              </Text>

            {!localSyncDir && (
              <Card className="border border-yellow-500/30 bg-yellow-500/10" p="sm" radius="lg">
                <Text size="sm" c="yellow">
                请先选择本地同步目录，再执行导出操作。
                </Text>
              </Card>
            )}

            <Group gap="sm">
              <Button
                size="sm"
                color="cliPrimary"
                leftSection={status === "syncing" ? undefined : <Upload size={16} />}
                onClick={handleLocalExport}
                disabled={!localSyncDir || status === "syncing"}
              >
                {status === "syncing" ? "同步中" : "导出到本地（zip）"}
              </Button>
              <Button
                size="sm"
                variant="default"
                color="gray"
                leftSection={status === "syncing" ? undefined : <Download size={16} />}
                onClick={handleLocalImportPick}
                disabled={status === "syncing"}
              >
                {status === "syncing" ? "同步中" : "从 zip 导入"}
              </Button>
            </Group>

            <Group gap="xs" c="var(--on-surface-variant)">
              <Folder size={16} />
              <Text size="sm">上次同步：{formatLastSync()}</Text>
            </Group>
            </Stack>
          </section>

          <Card className="border border-border bg-surface-container-high" p="md" radius="lg">
            <Text fw={600} c="var(--on-surface)">使用说明</Text>
            <Stack mt="xs" gap={4}>
              <Text size="sm" c="var(--on-surface-variant)">导出文件名格式：cli-manager-sync-YYYYMMDD-HHmmss.zip（保留历史）。</Text>
              <Text size="sm" c="var(--on-surface-variant)">导入时将覆盖本地所有项目、分组和模板配置，操作不可撤销。</Text>
              <Text size="sm" c="var(--on-surface-variant)">可将目录指向云盘同步盘（OneDrive / 坚果云 / Dropbox 等）以实现跨设备同步。</Text>
              <Text size="sm" c="var(--on-surface-variant)">同步内容仅包括项目、分组、命令模板，不包括 WebDAV 密码与终端会话。</Text>
            </Stack>
          </Card>
        </>
      )}

      <Modal
        opened={Boolean(preview && previewMode)}
        onClose={() => {
          setPreview(null);
          setPreviewMode(null);
        }}
        title={previewMode === "upload" ? "确认上传到云端" : "确认从云端下载"}
        size="xl"
        centered
      >
        {preview && previewMode && (
          <Stack gap="md">
            <Group align="flex-start" gap="sm" wrap="nowrap">
              <ThemeIcon variant="light" color="yellow" size="sm">
                <AlertTriangle size={16} />
              </ThemeIcon>
              <Text size="sm" c="var(--on-surface-variant)">
                  执行前请核对本地与云端摘要。{previewMode === "upload" ? "云端快照缺失时将创建当前设备快照。" : "下载可按数据域选择覆盖范围。"}
              </Text>
            </Group>

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
              {[preview.local, preview.remote].map((item, index) => (
                <Card key={index === 0 ? "local" : "remote"} className="bg-surface-container-low" p="sm" radius="lg">
                  <Text fw={600} c="var(--on-surface)">{index === 0 ? "本地内容" : "云端内容"}</Text>
                  <Text mt={4} size="sm" c="var(--on-surface-variant)">设备：{item.deviceName}</Text>
                  <Text size="sm" c="var(--on-surface-variant)">
                    时间：{item.missing ? "云端暂无快照" : new Date(item.lastModified).toLocaleString("zh-CN")}
                  </Text>
                  {item.missing && (
                    <Card mt="xs" className="border border-yellow-500/30 bg-yellow-500/10" p="xs" radius="md">
                      <Text size="xs" c="yellow">
                      当前设备云端快照为空，确认上传后会新建快照。
                      </Text>
                    </Card>
                  )}
                  <Text mt="xs" size="xs" c="var(--on-surface-variant)">
                    {item.projects} 个项目 · {item.groups} 个分组 · {item.commandTemplates} 个模板
                  </Text>
                  <Stack mt="xs" gap={4}>
                    <Text size="xs" c="var(--on-surface-variant)">项目：{item.projectNames.join("、") || "无"}</Text>
                    <Text size="xs" c="var(--on-surface-variant)">分组：{item.groupNames.join("、") || "无"}</Text>
                    <Text size="xs" c="var(--on-surface-variant)">模板：{item.templateNames.join("、") || "无"}</Text>
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>

            {previewMode === "download" && (
              <Card className="bg-surface-container-low" p="sm" radius="lg">
                <Stack gap="xs">
                  <Text size="sm" fw={600} c="var(--on-surface)">选择覆盖范围</Text>
                  <Group gap="sm">
                  {DOMAIN_OPTIONS.map((option) => (
                    <Checkbox
                      key={option.value}
                      checked={selectedDomains.includes(option.value)}
                      onChange={() => toggleDomain(option.value)}
                      label={option.label}
                      color="cliPrimary"
                    />
                  ))}
                  </Group>
                </Stack>
              </Card>
            )}

            <Group justify="flex-end" gap="xs">
              <Button
                size="xs"
                variant="default"
                color="gray"
                onClick={() => {
                  setPreview(null);
                  setPreviewMode(null);
                }}
              >
                取消
              </Button>
              <Button
                size="xs"
                color="cliPrimary"
                onClick={() => void confirmPreviewAction()}
                disabled={previewMode === "download" && selectedDomains.length === 0}
              >
                确认执行
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <Modal
        opened={Boolean(showImportConfirm)}
        onClose={() => setShowImportConfirm(null)}
        title="确认导入"
        size="sm"
        centered
      >
        {showImportConfirm && (
          <Stack gap="md">
            <Group align="flex-start" gap="sm" wrap="nowrap">
              <ThemeIcon variant="light" color="yellow" size="sm">
                <AlertTriangle size={16} />
              </ThemeIcon>
              <Text size="sm" c="var(--on-surface-variant)" style={{ overflowWrap: "anywhere" }}>
                  从 <span className="font-mono">{showImportConfirm}</span> 导入将覆盖本地所有项目、分组和模板配置，此操作不可撤销。
              </Text>
            </Group>
            <Group justify="flex-end" gap="xs">
              <Button size="xs" variant="default" color="gray" onClick={() => setShowImportConfirm(null)}>
                取消
              </Button>
              <Button size="xs" color="red" onClick={confirmLocalImport}>
                确认导入
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}

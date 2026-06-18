use git2::{Repository, StatusOptions};
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::{AppHandle, State};

use crate::git_watcher::GitWatcherBridge;

/// 查询指定路径的当前 git 分支
///
/// 使用 libgit2 库直接查询仓库状态，避免文件 I/O 触发安全软件弹窗。
/// libgit2 是 Git 官方认证的库，被安全软件白名单信任，且比直接读文件更快（内部有缓存）。
/// 整段查询包在 `spawn_blocking` 内，不阻塞 tokio runtime 工作线程。
///
/// # Returns
/// * `Ok(Some(branch))` - 普通分支
/// * `Ok(None)` - 非 git 仓库、detached HEAD、路径无效，或查询失败
#[tauri::command]
pub async fn get_current_git_branch(path: String) -> Result<Option<String>, String> {
    // 前置检查：路径为空或不存在时快速返回
    if path.is_empty() || !Path::new(&path).exists() {
        return Ok(None);
    }

    tokio::task::spawn_blocking(move || {
        // 尝试打开 git 仓库
        let repo = match Repository::open(&path) {
            Ok(r) => r,
            Err(_) => return Ok(None), // 非 git 仓库或无权限
        };

        // 获取 HEAD 引用
        let head = match repo.head() {
            Ok(h) => h,
            Err(_) => return Ok(None), // detached HEAD 或其他异常
        };

        // 提取短分支名（如 "main"、"feature/foo"）
        // shorthand() 对于 refs/heads/main 返回 "main"，对于 detached HEAD 返回 None
        Ok(head.shorthand().map(|s| s.to_string()))
    })
    .await
    .map_err(|e| format!("git 分支查询任务失败: {e}"))?
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitFileChange {
    pub path: String,
    pub status: String,
    pub staged: bool,
    pub added: i32,
    pub deleted: i32,
}

/// 获取指定路径的 Git 文件变更列表
///
/// 使用 libgit2 库查询工作区和暂存区的文件状态。
///
/// # Returns
/// * `Ok(Vec<GitFileChange>)` - 变更文件列表
/// * `Err(String)` - 错误信息
#[tauri::command]
pub async fn git_get_changes(project_path: String) -> Result<Vec<GitFileChange>, String> {
    log::info!("[git_get_changes] 开始查询 Git 变更, project_path: {}", project_path);

    tokio::task::spawn_blocking(move || {
        let path = Path::new(&project_path);

        if !path.exists() {
            let err_msg = format!("路径不存在: {}", project_path);
            log::error!("[git_get_changes] {}", err_msg);
            return Err(err_msg);
        }

        log::info!("[git_get_changes] 路径存在，尝试打开 Git 仓库");

        // 打开 git 仓库
        let repo = Repository::open(path)
            .map_err(|e| {
                let err_msg = format!("不是 Git 仓库或无法访问: {}", e);
                log::error!("[git_get_changes] {}", err_msg);
                err_msg
            })?;

        log::info!("[git_get_changes] Git 仓库打开成功");

        // 获取状态
        let mut opts = StatusOptions::new();
        opts.include_untracked(true);
        opts.recurse_untracked_dirs(true);

        let statuses = repo
            .statuses(Some(&mut opts))
            .map_err(|e| {
                let err_msg = format!("获取 Git 状态失败: {}", e);
                log::error!("[git_get_changes] {}", err_msg);
                err_msg
            })?;

        log::info!("[git_get_changes] 获取到 {} 个状态条目", statuses.len());

        // 一次性构造 repo 级 diff，得到所有文件的真实增删行数，避免逐文件多次 diff。
        let stats = compute_diff_line_stats(&repo);

        let mut changes = Vec::new();

        for entry in statuses.iter() {
            let status = entry.status();
            let file_path = entry.path().unwrap_or("").to_string();

            if file_path.is_empty() {
                continue;
            }

            // 解析状态
            let (status_char, staged) = parse_git2_status(status);

            // 从统计表按归一化路径取真实增删；二进制 / 纯模式变更查不到时为 (0, 0)。
            let (added, deleted) = stats
                .get(&normalize_path(&file_path))
                .copied()
                .unwrap_or((0, 0));

            changes.push(GitFileChange {
                path: file_path,
                status: status_char.to_string(),
                staged,
                added,
                deleted,
            });
        }

        log::info!("[git_get_changes] 查询完成，返回 {} 个变更文件", changes.len());
        Ok(changes)
    })
    .await
    .map_err(|e| {
        let err_msg = format!("Git 变更查询任务失败: {}", e);
        log::error!("[git_get_changes] {}", err_msg);
        err_msg
    })?
}

fn parse_git2_status(status: git2::Status) -> (&'static str, bool) {
    // 优先级：INDEX (staged) > WT (worktree)
    if status.is_index_new() {
        return ("A", true);
    }
    if status.is_index_modified() {
        return ("M", true);
    }
    if status.is_index_deleted() {
        return ("D", true);
    }
    if status.is_index_renamed() {
        return ("R", true);
    }

    if status.is_wt_modified() {
        return ("M", false);
    }
    if status.is_wt_deleted() {
        return ("D", false);
    }
    if status.is_wt_renamed() {
        return ("R", false);
    }
    if status.is_wt_new() {
        return ("U", false); // Untracked
    }

    ("M", false) // 默认
}

/// 把 git 路径归一化为正斜杠分隔，统一统计表 key 与 status 条目路径（Windows 兼容）。
fn normalize_path(p: &str) -> String {
    p.replace('\\', "/")
}

/// 一次性计算仓库内所有变更文件的真实增删行数（相对 HEAD，合并暂存区+工作区+未跟踪）。
///
/// 单次 `diff_tree_to_workdir_with_index` + `foreach` 累加，避免逐文件多次 diff 的 N 次扫描。
/// 二进制文件不进入 line callback，自然为 (0, 0)。失败时降级为空表（统计显示 0，不影响列表）。
///
/// # Returns
/// 路径（正斜杠归一化）→ (新增行数, 删除行数)
fn compute_diff_line_stats(repo: &Repository) -> std::collections::HashMap<String, (i32, i32)> {
    use std::collections::HashMap;

    let mut map: HashMap<String, (i32, i32)> = HashMap::new();

    let mut opts = git2::DiffOptions::new();
    opts.include_untracked(true);
    opts.recurse_untracked_dirs(true);
    opts.context_lines(0); // 统计只关心 +/- 行，无需上下文

    // HEAD tree 可能不存在（空仓库 / unborn 分支）：此时与 None tree 比较，全部视为新增。
    let head_tree = repo.head().ok().and_then(|h| h.peel_to_tree().ok());

    let diff = match repo.diff_tree_to_workdir_with_index(head_tree.as_ref(), Some(&mut opts)) {
        Ok(d) => d,
        Err(e) => {
            log::warn!("[git_get_changes] 构造 diff 失败，行数统计降级为 0: {e}");
            return map;
        }
    };

    let mut file_cb = |_delta: git2::DiffDelta, _progress: f32| true;
    let mut line_cb =
        |delta: git2::DiffDelta, _hunk: Option<git2::DiffHunk>, line: git2::DiffLine| {
            // 删除文件 new_file 可能无路径，回退到 old_file。
            let path = delta
                .new_file()
                .path()
                .or_else(|| delta.old_file().path())
                .map(|p| normalize_path(&p.to_string_lossy()));
            if let Some(path) = path {
                let entry = map.entry(path).or_insert((0, 0));
                // 仅统计真实增删行；上下文 ' '、EOFNL 标记 '>'/'<'/'='、头部 'F'/'H' 忽略。
                match line.origin() {
                    '+' => entry.0 += 1,
                    '-' => entry.1 += 1,
                    _ => {}
                }
            }
            true
        };

    if let Err(e) = diff.foreach(&mut file_cb, None, None, Some(&mut line_cb)) {
        log::warn!("[git_get_changes] 遍历 diff 失败，部分行数可能缺失: {e}");
    }

    map
}

/// 获取指定文件的 Git diff 内容
///
/// # Returns
/// * `Ok(String)` - unified diff 格式的文本
/// * `Err(String)` - 错误信息
#[tauri::command]
pub async fn git_get_file_diff(
    project_path: String,
    file_path: String,
    status: String,
) -> Result<String, String> {
    log::info!(
        "[git_get_file_diff] project_path: {}, file_path: {}, status: {}",
        project_path,
        file_path,
        status
    );

    tokio::task::spawn_blocking(move || {
        let path = Path::new(&project_path);

        if !path.exists() {
            return Err(format!("路径不存在: {}", project_path));
        }

        let repo = Repository::open(path).map_err(|e| format!("打开仓库失败: {}", e))?;

        // 针对不同状态使用不同策略
        match status.as_str() {
            "U" | "??" => {
                // 未跟踪文件：直接读取内容作为全新增
                let file_full_path = path.join(&file_path);
                let content = std::fs::read_to_string(&file_full_path)
                    .map_err(|e| format!("读取文件失败: {}", e))?;

                let lines = content.lines().collect::<Vec<_>>();
                let mut diff_text = format!("diff --git a/{} b/{}\n", file_path, file_path);
                diff_text.push_str("new file mode 100644\n");
                diff_text.push_str("--- /dev/null\n");
                diff_text.push_str(&format!("+++ b/{}\n", file_path));
                diff_text.push_str(&format!("@@ -0,0 +1,{} @@\n", lines.len()));

                for line in lines {
                    diff_text.push('+');
                    diff_text.push_str(line);
                    diff_text.push('\n');
                }

                Ok(diff_text)
            }
            "A" => {
                // 新增文件（已暂存）：对比 index vs worktree
                let mut diff_opts = git2::DiffOptions::new();
                diff_opts.pathspec(&file_path);
                diff_opts.context_lines(3);

                let diff = repo
                    .diff_index_to_workdir(None, Some(&mut diff_opts))
                    .map_err(|e| format!("生成 diff 失败: {}", e))?;

                format_diff_to_text(diff, &file_path)
            }
            "D" => {
                // 删除文件：对比 HEAD vs worktree（文件已不存在）
                let head = repo.head().map_err(|e| format!("获取 HEAD 失败: {}", e))?;
                let head_tree = head
                    .peel_to_tree()
                    .map_err(|e| format!("获取 HEAD tree 失败: {}", e))?;

                let mut diff_opts = git2::DiffOptions::new();
                diff_opts.pathspec(&file_path);
                diff_opts.context_lines(3);

                let diff = repo
                    .diff_tree_to_workdir_with_index(Some(&head_tree), Some(&mut diff_opts))
                    .map_err(|e| format!("生成 diff 失败: {}", e))?;

                format_diff_to_text(diff, &file_path)
            }
            _ => {
                // 修改文件（M）、重命名（R）：对比 HEAD vs worktree
                let head = repo.head().map_err(|e| format!("获取 HEAD 失败: {}", e))?;
                let head_tree = head
                    .peel_to_tree()
                    .map_err(|e| format!("获取 HEAD tree 失败: {}", e))?;

                let mut diff_opts = git2::DiffOptions::new();
                diff_opts.pathspec(&file_path);
                diff_opts.context_lines(3);

                let diff = repo
                    .diff_tree_to_workdir_with_index(Some(&head_tree), Some(&mut diff_opts))
                    .map_err(|e| format!("生成 diff 失败: {}", e))?;

                format_diff_to_text(diff, &file_path)
            }
        }
    })
    .await
    .map_err(|e| format!("任务失败: {}", e))?
}

fn format_diff_to_text(diff: git2::Diff, file_path: &str) -> Result<String, String> {
    let mut patch_text = String::new();

    diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        // git2 的 Patch 输出中，文件头（F）、hunk 头（H）等行内容已是完整文本，
        // 只有正文行（+/-/空格）需要补回起始字符，其余原样输出。
        match line.origin() {
            '+' | '-' | ' ' => patch_text.push(line.origin()),
            _ => {}
        }
        patch_text.push_str(std::str::from_utf8(line.content()).unwrap_or(""));
        true
    })
    .map_err(|e| format!("打印 diff 失败: {}", e))?;

    if patch_text.is_empty() {
        return Err(format!("文件 {} 无变更", file_path));
    }

    log::info!(
        "[git_get_file_diff] diff 生成成功，长度: {}",
        patch_text.len()
    );
    Ok(patch_text)
}

/// 校验前端传入的 repo 相对路径（前端不可信，防越界）。
///
/// 纯函数，便于单测。返回稳定错误字符串供前端分支。
fn validate_repo_relative_path(p: &str) -> Result<(), String> {
    if p.is_empty() {
        return Err("empty_path".into());
    }
    if p.contains("..") {
        return Err("path_escape".into());
    }
    // 绝对路径：前导分隔符或 Windows 盘符（如 C:）
    if p.starts_with('/') || p.starts_with('\\') {
        return Err("absolute_path".into());
    }
    if p.len() >= 2 && p.as_bytes()[1] == b':' {
        return Err("absolute_path".into());
    }
    Ok(())
}

/// 回滚（丢弃）单个**已跟踪**文件的未提交改动，恢复到 HEAD。
///
/// 破坏性、不可逆操作（未提交改动无法通过 git 找回），调用方须二次确认。
/// 全程使用 libgit2，不触碰 std::fs、不调命令行 git。
///
/// 策略：
/// * `M`/`D`/`R`：`reset_default` 取消暂存 → `checkout_head(force, path)` 还原工作区。
/// * `A`（已暂存新增）：仅 `reset_default` 取消暂存（变为未跟踪），**不删物理文件**。
/// * `U`/`??`（未跟踪）：拒绝（产品决策：不回滚未跟踪文件，避免误删新代码）。
#[tauri::command]
pub async fn git_discard_file(
    project_path: String,
    file_path: String,
    status: String,
) -> Result<(), String> {
    log::info!(
        "[git_discard_file] project_path: {}, file_path: {}, status: {}",
        project_path,
        file_path,
        status
    );

    // Layer A：路径字符串校验（前端不可信）。git2 pathspec 本身限定 repo 内，
    // 但仍做基础越界防御，符合用户文件安全清单。
    validate_repo_relative_path(&file_path)?;

    tokio::task::spawn_blocking(move || {
        let path = Path::new(&project_path);
        if !path.exists() {
            return Err("path_not_found".to_string());
        }

        let repo = Repository::open(path).map_err(|e| format!("open_repo_failed: {e}"))?;

        match status.as_str() {
            "U" | "??" => Err("untracked_not_supported".to_string()),
            "A" => {
                // 已暂存新增：仅取消暂存，保留工作区文件（变为未跟踪）。
                let head_commit = repo
                    .head()
                    .and_then(|h| h.peel_to_commit())
                    .map_err(|e| format!("head_failed: {e}"))?;
                repo.reset_default(Some(head_commit.as_object()), [file_path.as_str()])
                    .map_err(|e| format!("unstage_failed: {e}"))?;
                log::info!("[git_discard_file] 已取消暂存新增文件: {}", file_path);
                Ok(())
            }
            _ => {
                // M / D / R：先取消暂存（若有），再强制 checkout HEAD 还原工作区。
                if let Ok(commit) = repo.head().and_then(|h| h.peel_to_commit()) {
                    // reset_default 失败不致命（文件可能本就未暂存），仅记录。
                    if let Err(e) = repo.reset_default(Some(commit.as_object()), [file_path.as_str()]) {
                        log::warn!("[git_discard_file] reset_default 跳过: {e}");
                    }
                }

                let mut cb = git2::build::CheckoutBuilder::new();
                cb.force();
                cb.path(file_path.as_str());
                repo.checkout_head(Some(&mut cb))
                    .map_err(|e| format!("checkout_failed: {e}"))?;
                log::info!("[git_discard_file] 已还原文件到 HEAD: {}", file_path);
                Ok(())
            }
        }
    })
    .await
    .map_err(|e| format!("task_failed: {e}"))?
}

/// 解析 unified diff 的 hunk 头 `@@ -a,b +c,d @@ heading`。
/// 返回 (old_start, old_count, new_start, new_count, heading)。count 省略时为 1。
fn parse_hunk_header(header: &str) -> Result<(u32, u32, u32, u32, String), String> {
    let body = header.strip_prefix("@@ ").ok_or("bad_hunk_header")?;
    let close = body.find(" @@").ok_or("bad_hunk_header")?;
    let ranges = &body[..close];
    let heading = body[close + 3..].to_string();
    let mut parts = ranges.split(' ');
    let old_part = parts.next().ok_or("bad_hunk_header")?;
    let new_part = parts.next().ok_or("bad_hunk_header")?;
    let (old_start, old_count) = parse_range(old_part.strip_prefix('-').ok_or("bad_hunk_header")?)?;
    let (new_start, new_count) = parse_range(new_part.strip_prefix('+').ok_or("bad_hunk_header")?)?;
    Ok((old_start, old_count, new_start, new_count, heading))
}

fn parse_range(s: &str) -> Result<(u32, u32), String> {
    if let Some((start, count)) = s.split_once(',') {
        Ok((
            start.parse().map_err(|_| "bad_range")?,
            count.parse().map_err(|_| "bad_range")?,
        ))
    } else {
        Ok((s.parse().map_err(|_| "bad_range")?, 1))
    }
}

/// 反向单个 hunk：交换 old/new 行号区间，交换 +/- 行；上下文与 `\ No newline` 行原样保留。
fn reverse_hunk(hunk: &[&str]) -> Result<Vec<String>, String> {
    let header = *hunk.first().ok_or("empty_hunk")?;
    let cr = header.ends_with('\r');
    let header_clean = header.trim_end_matches('\r');
    let (old_start, old_count, new_start, new_count, heading) = parse_hunk_header(header_clean)?;
    let mut new_header = format!(
        "@@ -{},{} +{},{} @@{}",
        new_start, new_count, old_start, old_count, heading
    );
    if cr {
        new_header.push('\r');
    }

    let mut out = vec![new_header];
    for &line in &hunk[1..] {
        if line.is_empty() {
            out.push(String::new());
            continue;
        }
        let first = line.as_bytes()[0];
        let rest = &line[1..];
        let reversed = match first {
            b'+' => format!("-{}", rest),
            b'-' => format!("+{}", rest),
            // 上下文 ' '、无尾换行标记 '\' 等原样保留
            _ => line.to_string(),
        };
        out.push(reversed);
    }
    Ok(out)
}

/// 从完整 unified diff 文本中提取第 `hunk_index` 个 hunk，构造"反向 patch"。
/// 正向 apply 该反向 patch 即等于撤销这个 hunk 的改动。纯函数，便于单测。
fn build_reverse_hunk_patch(diff_text: &str, hunk_index: usize) -> Result<String, String> {
    let lines: Vec<&str> = diff_text.split('\n').collect();

    // 1. 文件头：首个 @@ 之前的所有行（diff --git / index / --- / +++）。
    let mut header: Vec<&str> = Vec::new();
    let mut idx = 0;
    while idx < lines.len() && !lines[idx].starts_with("@@") {
        header.push(lines[idx]);
        idx += 1;
    }

    // 2. 按 @@ 切分各 hunk。
    let mut hunks: Vec<Vec<&str>> = Vec::new();
    let mut current: Option<Vec<&str>> = None;
    while idx < lines.len() {
        let line = lines[idx];
        if line.starts_with("@@") {
            if let Some(h) = current.take() {
                hunks.push(h);
            }
            current = Some(vec![line]);
        } else if let Some(h) = current.as_mut() {
            h.push(line);
        }
        idx += 1;
    }
    if let Some(h) = current.take() {
        hunks.push(h);
    }

    if hunk_index >= hunks.len() {
        return Err(format!("hunk_index_out_of_range:{}:{}", hunk_index, hunks.len()));
    }

    let reversed = reverse_hunk(&hunks[hunk_index])?;

    let mut out: Vec<String> = header.iter().map(|s| s.to_string()).collect();
    out.extend(reversed);
    let mut result = out.join("\n");
    // patch 末行需以换行结尾，避免 libgit2 解析报 corrupt patch。
    if !result.ends_with('\n') {
        result.push('\n');
    }
    Ok(result)
}

/// 把反向 patch 应用到工作区：解析 → dry-run 校验 → 正式 apply。
/// dry-run 防止 stale diff 错位应用损坏工作区；失败返回稳定错误串。
fn apply_patch_to_workdir(project_path: &str, reverse_patch: &str) -> Result<(), String> {
    let path = Path::new(project_path);
    if !path.exists() {
        return Err("path_not_found".to_string());
    }
    let repo = Repository::open(path).map_err(|e| format!("open_repo_failed: {e}"))?;

    let diff = git2::Diff::from_buffer(reverse_patch.as_bytes())
        .map_err(|e| format!("parse_patch_failed: {e}"))?;

    // dry-run：先验证 patch 能否干净应用，避免 stale diff 损坏工作区。
    let mut check_opts = git2::ApplyOptions::new();
    check_opts.check(true);
    repo.apply(&diff, git2::ApplyLocation::WorkDir, Some(&mut check_opts))
        .map_err(|_| "patch_conflict_refresh_needed".to_string())?;

    // 正式应用到工作区。
    repo.apply(&diff, git2::ApplyLocation::WorkDir, None)
        .map_err(|e| format!("apply_failed: {e}"))?;

    Ok(())
}

/// 回滚 diff 中的单个 hunk（Hunk 级回滚入口）。
///
/// 破坏性操作。前端传入打开时的完整 diff 文本与 hunk 序号；后端构造反向 patch，
/// dry-run 校验后 apply 到工作区。
#[tauri::command]
pub async fn git_revert_hunk(
    project_path: String,
    diff_text: String,
    hunk_index: usize,
) -> Result<(), String> {
    log::info!(
        "[git_revert_hunk] project_path: {}, hunk_index: {}",
        project_path,
        hunk_index
    );

    let reverse_patch = build_reverse_hunk_patch(&diff_text, hunk_index)?;

    tokio::task::spawn_blocking(move || apply_patch_to_workdir(&project_path, &reverse_patch))
        .await
        .map_err(|e| format!("task_failed: {e}"))?
}

/// 前端选中的变更行：side="old" 对应被删除行（按 old 行号），side="new" 对应新增行（按 new 行号）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectedLine {
    pub side: String,
    pub line_number: u32,
}

/// 行级反向单个 hunk：仅回滚选中的行。返回 None 表示该 hunk 无选中行（应跳过）。
///
/// 规则（撤销选中改动）：
/// * 上下文行：保留为上下文。
/// * 选中的 `-` 行（HEAD 有 / workdir 无）：反向为 `+`（恢复）。
/// * 未选中的 `-` 行：从反向 patch 省略（workdir 本就没有）。
/// * 选中的 `+` 行（workdir 有 / HEAD 无）：反向为 `-`（删除）。
/// * 未选中的 `+` 行：降为上下文（workdir 仍有，需用于对齐）。
/// 行号区间按反向后的实际行数重算（反向 old 侧起点 = 原 new_start）。
fn reverse_hunk_lines(
    hunk: &[&str],
    selected: &std::collections::HashSet<(String, u32)>,
) -> Result<Option<String>, String> {
    let header = *hunk.first().ok_or("empty_hunk")?;
    let cr = header.ends_with('\r');
    let (old_start, _oc, new_start, _nc, heading) =
        parse_hunk_header(header.trim_end_matches('\r'))?;

    let mut cur_old = old_start;
    let mut cur_new = new_start;
    let mut body: Vec<String> = Vec::new();
    let mut rev_old_count = 0u32; // 反向后 old 侧行数（context + '-'）
    let mut rev_new_count = 0u32; // 反向后 new 侧行数（context + '+'）
    let mut any_selected = false;

    for &line in &hunk[1..] {
        if line.is_empty() {
            continue;
        }
        let first = line.as_bytes()[0];
        let content = &line[1..];
        match first {
            b' ' => {
                body.push(format!(" {content}"));
                rev_old_count += 1;
                rev_new_count += 1;
                cur_old += 1;
                cur_new += 1;
            }
            b'-' => {
                let hit = selected.contains(&("old".to_string(), cur_old));
                cur_old += 1;
                if hit {
                    body.push(format!("+{content}"));
                    rev_new_count += 1;
                    any_selected = true;
                }
                // 未选中：省略
            }
            b'+' => {
                let hit = selected.contains(&("new".to_string(), cur_new));
                cur_new += 1;
                if hit {
                    body.push(format!("-{content}"));
                    rev_old_count += 1;
                    any_selected = true;
                } else {
                    body.push(format!(" {content}"));
                    rev_old_count += 1;
                    rev_new_count += 1;
                }
            }
            b'\\' => {
                // 无尾换行标记：原样保留（关联前一行）。
                body.push(line.to_string());
            }
            _ => body.push(line.to_string()),
        }
    }

    if !any_selected {
        return Ok(None);
    }

    let mut new_header = format!(
        "@@ -{},{} +{},{} @@{}",
        new_start, rev_old_count, new_start, rev_new_count, heading
    );
    if cr {
        new_header.push('\r');
    }

    let mut out = vec![new_header];
    out.extend(body);
    Ok(Some(out.join("\n")))
}

/// 从完整 unified diff 文本构造行级反向 patch：仅回滚 `selected` 中的行。
/// 跨多个 hunk 的选择逐 hunk 处理并合并；无选中行的 hunk 跳过。纯函数，便于单测。
fn build_reverse_lines_patch(diff_text: &str, selected: &[(String, u32)]) -> Result<String, String> {
    let sel: std::collections::HashSet<(String, u32)> = selected.iter().cloned().collect();

    let lines: Vec<&str> = diff_text.split('\n').collect();
    let mut header: Vec<&str> = Vec::new();
    let mut idx = 0;
    while idx < lines.len() && !lines[idx].starts_with("@@") {
        header.push(lines[idx]);
        idx += 1;
    }

    let mut hunks: Vec<Vec<&str>> = Vec::new();
    let mut current: Option<Vec<&str>> = None;
    while idx < lines.len() {
        let line = lines[idx];
        if line.starts_with("@@") {
            if let Some(h) = current.take() {
                hunks.push(h);
            }
            current = Some(vec![line]);
        } else if let Some(h) = current.as_mut() {
            h.push(line);
        }
        idx += 1;
    }
    if let Some(h) = current.take() {
        hunks.push(h);
    }

    let mut rev_hunks: Vec<String> = Vec::new();
    for hunk in &hunks {
        if let Some(rev) = reverse_hunk_lines(hunk, &sel)? {
            rev_hunks.push(rev);
        }
    }

    if rev_hunks.is_empty() {
        return Err("no_lines_selected".to_string());
    }

    let mut out: Vec<String> = header.iter().map(|s| s.to_string()).collect();
    out.extend(rev_hunks);
    let mut result = out.join("\n");
    if !result.ends_with('\n') {
        result.push('\n');
    }
    Ok(result)
}

/// 回滚 diff 中选中的若干行（行级回滚入口）。破坏性操作，dry-run 兜底。
#[tauri::command]
pub async fn git_revert_lines(
    project_path: String,
    diff_text: String,
    selected_lines: Vec<SelectedLine>,
) -> Result<(), String> {
    log::info!(
        "[git_revert_lines] project_path: {}, lines: {}",
        project_path,
        selected_lines.len()
    );

    if selected_lines.is_empty() {
        return Err("no_lines_selected".to_string());
    }

    let sel: Vec<(String, u32)> = selected_lines
        .into_iter()
        .map(|s| (s.side, s.line_number))
        .collect();
    let reverse_patch = build_reverse_lines_patch(&diff_text, &sel)?;

    tokio::task::spawn_blocking(move || apply_patch_to_workdir(&project_path, &reverse_patch))
        .await
        .map_err(|e| format!("task_failed: {e}"))?
}

/// 暂存单个文件：worktree 存在 → add_path（新增/修改/未跟踪）；已删除 → remove_path。
#[tauri::command]
pub async fn git_stage_file(project_path: String, file_path: String) -> Result<(), String> {
    validate_repo_relative_path(&file_path)?;
    tokio::task::spawn_blocking(move || {
        let path = Path::new(&project_path);
        if !path.exists() {
            return Err("path_not_found".to_string());
        }
        let repo = Repository::open(path).map_err(|e| format!("open_repo_failed: {e}"))?;
        let mut index = repo.index().map_err(|e| format!("index_failed: {e}"))?;
        let rel = Path::new(&file_path);
        if path.join(&file_path).exists() {
            index.add_path(rel).map_err(|e| format!("stage_failed: {e}"))?;
        } else {
            index
                .remove_path(rel)
                .map_err(|e| format!("stage_remove_failed: {e}"))?;
        }
        index.write().map_err(|e| format!("index_write_failed: {e}"))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("task_failed: {e}"))?
}

/// 取消暂存单个文件：有 HEAD → reset 到 HEAD；unborn 分支 → 从 index 移除。
#[tauri::command]
pub async fn git_unstage_file(project_path: String, file_path: String) -> Result<(), String> {
    validate_repo_relative_path(&file_path)?;
    tokio::task::spawn_blocking(move || {
        let path = Path::new(&project_path);
        if !path.exists() {
            return Err("path_not_found".to_string());
        }
        let repo = Repository::open(path).map_err(|e| format!("open_repo_failed: {e}"))?;
        match repo.head().and_then(|h| h.peel_to_commit()) {
            Ok(commit) => {
                repo.reset_default(Some(commit.as_object()), [file_path.as_str()])
                    .map_err(|e| format!("unstage_failed: {e}"))?;
            }
            Err(_) => {
                // 尚无提交：直接从 index 移除该路径。
                let mut index = repo.index().map_err(|e| format!("index_failed: {e}"))?;
                index
                    .remove_path(Path::new(&file_path))
                    .map_err(|e| format!("unstage_remove_failed: {e}"))?;
                index.write().map_err(|e| format!("index_write_failed: {e}"))?;
            }
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("task_failed: {e}"))?
}

/// 全部暂存：add_all 收新增/修改/未跟踪，update_all 补已跟踪文件的删除。
#[tauri::command]
pub async fn git_stage_all(project_path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let path = Path::new(&project_path);
        if !path.exists() {
            return Err("path_not_found".to_string());
        }
        let repo = Repository::open(path).map_err(|e| format!("open_repo_failed: {e}"))?;
        let mut index = repo.index().map_err(|e| format!("index_failed: {e}"))?;
        index
            .add_all(["*"], git2::IndexAddOption::DEFAULT, None)
            .map_err(|e| format!("stage_all_failed: {e}"))?;
        index
            .update_all(["*"], None)
            .map_err(|e| format!("stage_all_update_failed: {e}"))?;
        index.write().map_err(|e| format!("index_write_failed: {e}"))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("task_failed: {e}"))?
}

/// 全部取消暂存：有 HEAD → index 重置为 HEAD tree；unborn → 清空 index。工作区不受影响。
#[tauri::command]
pub async fn git_unstage_all(project_path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let path = Path::new(&project_path);
        if !path.exists() {
            return Err("path_not_found".to_string());
        }
        let repo = Repository::open(path).map_err(|e| format!("open_repo_failed: {e}"))?;
        let mut index = repo.index().map_err(|e| format!("index_failed: {e}"))?;
        match repo.head().and_then(|h| h.peel_to_tree()) {
            Ok(tree) => {
                index
                    .read_tree(&tree)
                    .map_err(|e| format!("unstage_all_failed: {e}"))?;
            }
            Err(_) => {
                index.clear().map_err(|e| format!("index_clear_failed: {e}"))?;
            }
        }
        index.write().map_err(|e| format!("index_write_failed: {e}"))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("task_failed: {e}"))?
}

/// 批量暂存多个文件（目录批量勾选用）：单次 index 写入，避免逐文件往返刷新。
#[tauri::command]
pub async fn git_stage_paths(project_path: String, paths: Vec<String>) -> Result<(), String> {
    for p in &paths {
        validate_repo_relative_path(p)?;
    }
    tokio::task::spawn_blocking(move || {
        let path = Path::new(&project_path);
        if !path.exists() {
            return Err("path_not_found".to_string());
        }
        let repo = Repository::open(path).map_err(|e| format!("open_repo_failed: {e}"))?;
        let mut index = repo.index().map_err(|e| format!("index_failed: {e}"))?;
        for p in &paths {
            let rel = Path::new(p);
            if path.join(p).exists() {
                index.add_path(rel).map_err(|e| format!("stage_failed: {e}"))?;
            } else {
                index
                    .remove_path(rel)
                    .map_err(|e| format!("stage_remove_failed: {e}"))?;
            }
        }
        index.write().map_err(|e| format!("index_write_failed: {e}"))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("task_failed: {e}"))?
}

/// 批量取消暂存多个文件：有 HEAD → 一次 reset_default；unborn → 逐个从 index 移除。
#[tauri::command]
pub async fn git_unstage_paths(project_path: String, paths: Vec<String>) -> Result<(), String> {
    for p in &paths {
        validate_repo_relative_path(p)?;
    }
    tokio::task::spawn_blocking(move || {
        let path = Path::new(&project_path);
        if !path.exists() {
            return Err("path_not_found".to_string());
        }
        let repo = Repository::open(path).map_err(|e| format!("open_repo_failed: {e}"))?;
        match repo.head().and_then(|h| h.peel_to_commit()) {
            Ok(commit) => {
                repo.reset_default(Some(commit.as_object()), paths.iter().map(|s| s.as_str()))
                    .map_err(|e| format!("unstage_failed: {e}"))?;
            }
            Err(_) => {
                let mut index = repo.index().map_err(|e| format!("index_failed: {e}"))?;
                for p in &paths {
                    index
                        .remove_path(Path::new(p))
                        .map_err(|e| format!("unstage_remove_failed: {e}"))?;
                }
                index.write().map_err(|e| format!("index_write_failed: {e}"))?;
            }
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("task_failed: {e}"))?
}

/// 提交已暂存内容。空信息 / 无暂存 / 无 git 身份返回稳定错误。成功返回短 commit id。
#[tauri::command]
pub async fn git_commit(project_path: String, message: String) -> Result<String, String> {
    let msg = message.trim().to_string();
    if msg.is_empty() {
        return Err("empty_message".to_string());
    }
    tokio::task::spawn_blocking(move || {
        let path = Path::new(&project_path);
        if !path.exists() {
            return Err("path_not_found".to_string());
        }
        let repo = Repository::open(path).map_err(|e| format!("open_repo_failed: {e}"))?;

        let mut index = repo.index().map_err(|e| format!("index_failed: {e}"))?;
        let tree_oid = index
            .write_tree()
            .map_err(|e| format!("write_tree_failed: {e}"))?;

        // HEAD 当前 commit（unborn 时为 None）。
        let head_commit = repo.head().ok().and_then(|h| h.peel_to_commit().ok());

        // 无暂存内容检测：暂存树与 HEAD 树一致（或 unborn 下 index 为空）→ 拒绝空提交。
        match &head_commit {
            Some(c) => {
                let head_tree_oid = c.tree().map_err(|e| format!("head_tree_failed: {e}"))?.id();
                if head_tree_oid == tree_oid {
                    return Err("nothing_staged".to_string());
                }
            }
            None => {
                if index.is_empty() {
                    return Err("nothing_staged".to_string());
                }
            }
        }

        let tree = repo
            .find_tree(tree_oid)
            .map_err(|e| format!("find_tree_failed: {e}"))?;
        // 读取 user.name / user.email；缺失给出明确错误供前端引导配置。
        let sig = repo.signature().map_err(|_| "no_git_identity".to_string())?;
        let parents: Vec<&git2::Commit> = head_commit.as_ref().map(|c| vec![c]).unwrap_or_default();

        let oid = repo
            .commit(Some("HEAD"), &sig, &sig, &msg, &tree, &parents)
            .map_err(|e| format!("commit_failed: {e}"))?;

        Ok(oid.to_string().chars().take(7).collect::<String>())
    })
    .await
    .map_err(|e| format!("task_failed: {e}"))?
}

/// 仅提交指定路径（pathspec / `git commit --only -- <paths>`）。
///
/// 用于「选中部分文件提交」：未列入的已暂存文件（如取消勾选但保持跟踪的新增文件）
/// 不会被提交，且保持其暂存状态不变。shell out 系统 git 以获得 --only 语义。
#[tauri::command]
pub async fn git_commit_paths(
    project_path: String,
    message: String,
    paths: Vec<String>,
) -> Result<String, String> {
    let msg = message.trim().to_string();
    if msg.is_empty() {
        return Err("empty_message".to_string());
    }
    if paths.is_empty() {
        return Err("nothing_staged".to_string());
    }
    for p in &paths {
        validate_repo_relative_path(p)?;
    }
    tokio::task::spawn_blocking(move || {
        let mut args: Vec<&str> = vec!["commit", "-m", &msg, "--"];
        for p in &paths {
            args.push(p.as_str());
        }
        match run_git_cli(&project_path, &args) {
            Ok(_) => run_git_cli(&project_path, &["rev-parse", "--short", "HEAD"]),
            Err(e) => {
                let low = e.to_lowercase();
                if low.contains("who you are") || low.contains("identity") || low.contains("user.email") {
                    Err("no_git_identity".to_string())
                } else if low.contains("nothing to commit") || low.contains("no changes added") {
                    Err("nothing_staged".to_string())
                } else {
                    Err(e)
                }
            }
        }
    })
    .await
    .map_err(|e| format!("task_failed: {e}"))?
}

/// 当前分支与远端跟踪状态（只读，git2）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitBranchStatus {
    /// 分支短名（如 "main"）；detached HEAD 或 unborn 时为 None。
    pub branch: Option<String>,
    /// upstream 全名（如 "origin/main"）；无跟踪时为 None。
    pub upstream: Option<String>,
    /// 本地领先 upstream 的提交数（待推送）。
    pub ahead: usize,
    /// 本地落后 upstream 的提交数（待拉取）。
    pub behind: usize,
    /// 是否已配置 upstream 跟踪分支。
    pub has_upstream: bool,
    /// 是否处于 detached HEAD。
    pub detached: bool,
}

/// 查询当前分支名、upstream 及 ahead/behind。全只读，不触网。
///
/// 边界：非仓库 → 错误；unborn（无提交）→ branch=None 全 0；
/// detached HEAD → detached=true、branch=None；无 upstream → has_upstream=false、ahead/behind=0。
#[tauri::command]
pub async fn git_branch_status(project_path: String) -> Result<GitBranchStatus, String> {
    tokio::task::spawn_blocking(move || {
        let path = Path::new(&project_path);
        if !path.exists() {
            return Err("path_not_found".to_string());
        }
        let repo = Repository::open(path).map_err(|e| format!("open_repo_failed: {e}"))?;

        let empty = GitBranchStatus {
            branch: None,
            upstream: None,
            ahead: 0,
            behind: 0,
            has_upstream: false,
            detached: false,
        };

        // HEAD 不存在 → unborn 分支（尚无提交）。
        let head = match repo.head() {
            Ok(h) => h,
            Err(_) => return Ok(empty),
        };

        let detached = repo.head_detached().unwrap_or(false);
        let branch = head.shorthand().map(|s| s.to_string());
        let local_oid = head.target();

        if detached {
            return Ok(GitBranchStatus {
                branch: None,
                detached: true,
                ..empty
            });
        }

        // 查 upstream 与 ahead/behind。
        let mut upstream = None;
        let mut ahead = 0usize;
        let mut behind = 0usize;
        let mut has_upstream = false;

        if let Some(shorthand) = head.shorthand() {
            if let Ok(local_branch) = repo.find_branch(shorthand, git2::BranchType::Local) {
                if let Ok(up) = local_branch.upstream() {
                    has_upstream = true;
                    if let Ok(Some(name)) = up.name() {
                        upstream = Some(name.to_string());
                    }
                    if let (Some(local), Some(up_oid)) = (local_oid, up.get().target()) {
                        if let Ok((a, b)) = repo.graph_ahead_behind(local, up_oid) {
                            ahead = a;
                            behind = b;
                        }
                    }
                }
            }
        }

        Ok(GitBranchStatus {
            branch,
            upstream,
            ahead,
            behind,
            has_upstream,
            detached: false,
        })
    })
    .await
    .map_err(|e| format!("task_failed: {e}"))?
}

/// 把 git stderr 映射为稳定错误码 + 原始片段，供前端 toast 展示。
/// 形如 "not_fast_forward: <git 原文>"。
fn map_git_cli_error(stderr: &str) -> String {
    let s = stderr.to_lowercase();
    let code = if s.contains("authentication failed")
        || s.contains("could not read username")
        || s.contains("could not read password")
        || s.contains("permission denied")
        || s.contains("invalid username or password")
    {
        "auth_failed"
    } else if s.contains("non-fast-forward")
        || s.contains("fetch first")
        || s.contains("updates were rejected")
        || s.contains("[rejected]")
        || s.contains("not possible to fast-forward")
        || s.contains("diverging")
        || s.contains("divergent")
    {
        "not_fast_forward"
    } else if s.contains("no upstream") || s.contains("has no upstream") {
        "no_upstream"
    } else if s.contains("could not read from remote")
        || s.contains("does not appear to be a git repository")
        || s.contains("no configured push destination")
        || s.contains("no such remote")
        || s.contains("'origin' does not appear")
    {
        "no_remote"
    } else {
        "git_failed"
    };
    let snippet: String = stderr.trim().chars().take(300).collect();
    format!("{code}: {snippet}")
}

/// shell out 系统 `git` 执行网络操作，继承用户凭据管理器 / SSH / git config 代理。
/// 用 args 数组（非 shell）避免注入；成功返回合并输出，失败返回映射错误码。
fn run_git_cli(project_path: &str, args: &[&str]) -> Result<String, String> {
    let path = Path::new(project_path);
    if !path.exists() {
        return Err("path_not_found".to_string());
    }
    let output = std::process::Command::new("git")
        .current_dir(path)
        .args(args)
        .output()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                "git_not_found".to_string()
            } else {
                format!("spawn_failed: {e}")
            }
        })?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    if output.status.success() {
        Ok(format!("{stdout}{stderr}").trim().to_string())
    } else {
        Err(map_git_cli_error(&stderr))
    }
}

/// 校验分支名安全：非空、不以 '-' 开头（防被当作 git flag）、无空白/控制字符。
fn validate_branch_name(branch: &str) -> Result<(), String> {
    if branch.is_empty() {
        return Err("empty_branch".into());
    }
    if branch.starts_with('-') {
        return Err("invalid_branch".into());
    }
    if branch.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return Err("invalid_branch".into());
    }
    Ok(())
}

/// 推送当前分支。set_upstream=true 时 `push -u origin <branch>` 建立跟踪。
/// shell out 系统 git；失败错误码见 map_git_cli_error。
#[tauri::command]
pub async fn git_push(
    project_path: String,
    set_upstream: bool,
    branch: Option<String>,
) -> Result<String, String> {
    if set_upstream {
        let b = branch.clone().ok_or_else(|| "empty_branch".to_string())?;
        validate_branch_name(&b)?;
    }
    tokio::task::spawn_blocking(move || {
        if set_upstream {
            let b = branch.unwrap();
            run_git_cli(&project_path, &["push", "-u", "origin", &b])
        } else {
            run_git_cli(&project_path, &["push"])
        }
    })
    .await
    .map_err(|e| format!("task_failed: {e}"))?
}

/// 仅快进拉取（`git pull --ff-only`）。无法快进 → not_fast_forward，由前端引导去终端处理。
/// 绝不产生合并提交或冲突状态。
#[tauri::command]
pub async fn git_pull_ff_only(project_path: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || run_git_cli(&project_path, &["pull", "--ff-only"]))
        .await
        .map_err(|e| format!("task_failed: {e}"))?
}

/// 开始监听项目目录文件变化（fs-watcher）。失败返回错误，前端据此降级为慢轮询。
#[tauri::command]
pub async fn git_watch_start(
    app_handle: AppHandle,
    bridge: State<'_, GitWatcherBridge>,
    project_path: String,
) -> Result<(), String> {
    bridge.start(app_handle, project_path)
}

/// 停止文件监听并释放 watcher。
#[tauri::command]
pub async fn git_watch_stop(bridge: State<'_, GitWatcherBridge>) -> Result<(), String> {
    bridge.stop()
}

#[cfg(test)]
mod tests {
    use super::{build_reverse_hunk_patch, build_reverse_lines_patch, validate_repo_relative_path};

    #[test]
    fn accepts_normal_relative_path() {
        assert!(validate_repo_relative_path("src/main.rs").is_ok());
        assert!(validate_repo_relative_path("a/b/c.txt").is_ok());
    }

    #[test]
    fn rejects_parent_escape() {
        assert_eq!(
            validate_repo_relative_path("../etc/passwd").unwrap_err(),
            "path_escape"
        );
        assert_eq!(
            validate_repo_relative_path("src/../../x").unwrap_err(),
            "path_escape"
        );
    }

    #[test]
    fn rejects_absolute_path() {
        assert_eq!(
            validate_repo_relative_path("/etc/passwd").unwrap_err(),
            "absolute_path"
        );
        assert_eq!(
            validate_repo_relative_path("C:/Windows").unwrap_err(),
            "absolute_path"
        );
        assert_eq!(
            validate_repo_relative_path("\\server\\share").unwrap_err(),
            "absolute_path"
        );
    }

    #[test]
    fn rejects_empty() {
        assert_eq!(validate_repo_relative_path("").unwrap_err(), "empty_path");
    }

    const SAMPLE_DIFF: &str = "\
diff --git a/foo.txt b/foo.txt
index 1111111..2222222 100644
--- a/foo.txt
+++ b/foo.txt
@@ -1,3 +1,3 @@
 line1
-old2
+new2
 line3
@@ -10,2 +10,3 @@
 line10
+inserted
 line11
";

    #[test]
    fn reverses_first_hunk_only() {
        let patch = build_reverse_hunk_patch(SAMPLE_DIFF, 0).unwrap();
        // 文件头保留
        assert!(patch.contains("--- a/foo.txt"));
        assert!(patch.contains("+++ b/foo.txt"));
        // 对称 hunk，行号区间不变
        assert!(patch.contains("@@ -1,3 +1,3 @@"));
        // +/- 互换：原 -old2 → +old2，原 +new2 → -new2
        assert!(patch.contains("+old2"));
        assert!(patch.contains("-new2"));
        // 上下文保留
        assert!(patch.contains(" line1"));
        // 仅含第 0 个 hunk，不含第 1 个 hunk
        assert!(!patch.contains("inserted"));
        assert!(patch.ends_with('\n'));
    }

    #[test]
    fn reverses_second_hunk_and_swaps_counts() {
        let patch = build_reverse_hunk_patch(SAMPLE_DIFF, 1).unwrap();
        // 原 @@ -10,2 +10,3 @@ 反向为 @@ -10,3 +10,2 @@
        assert!(patch.contains("@@ -10,3 +10,2 @@"));
        // 原 +inserted → -inserted
        assert!(patch.contains("-inserted"));
        // 不含第 0 个 hunk 的内容
        assert!(!patch.contains("new2"));
    }

    #[test]
    fn rejects_out_of_range_hunk() {
        let err = build_reverse_hunk_patch(SAMPLE_DIFF, 5).unwrap_err();
        assert!(err.starts_with("hunk_index_out_of_range"));
    }

    #[test]
    fn handles_omitted_count_in_header() {
        // 单行变更，count 省略：@@ -5 +5 @@
        let diff = "--- a/x\n+++ b/x\n@@ -5 +5 @@\n-a\n+b\n";
        let patch = build_reverse_hunk_patch(diff, 0).unwrap();
        // 省略 count 视为 1，反向后为 @@ -5,1 +5,1 @@
        assert!(patch.contains("@@ -5,1 +5,1 @@"));
        assert!(patch.contains("+a"));
        assert!(patch.contains("-b"));
    }

    #[test]
    fn line_revert_removes_selected_insert_only() {
        // 仅选中新增行 new2（new 行号 2）：删除 new2，但不恢复未选中的 old2。
        let sel = vec![("new".to_string(), 2u32)];
        let patch = build_reverse_lines_patch(SAMPLE_DIFF, &sel).unwrap();
        assert!(patch.contains("@@ -1,3 +1,2 @@"));
        assert!(patch.contains("-new2"));
        assert!(patch.contains(" line1"));
        assert!(patch.contains(" line3"));
        // old2 未选中 → 省略
        assert!(!patch.contains("old2"));
    }

    #[test]
    fn line_revert_restores_selected_delete_only() {
        // 仅选中删除行 old2（old 行号 2）：恢复 old2，未选中的 new2 降为上下文保留。
        let sel = vec![("old".to_string(), 2u32)];
        let patch = build_reverse_lines_patch(SAMPLE_DIFF, &sel).unwrap();
        assert!(patch.contains("@@ -1,3 +1,4 @@"));
        assert!(patch.contains("+old2"));
        assert!(patch.contains(" new2"));
    }

    #[test]
    fn line_revert_skips_hunks_without_selection() {
        // 仅选中第二个 hunk 的 inserted（new 行号 11）：只反向第二个 hunk。
        let sel = vec![("new".to_string(), 11u32)];
        let patch = build_reverse_lines_patch(SAMPLE_DIFF, &sel).unwrap();
        assert!(patch.contains("@@ -10,3 +10,2 @@"));
        assert!(patch.contains("-inserted"));
        // 第一个 hunk 无选中 → 跳过
        assert!(!patch.contains("@@ -1,"));
        assert!(!patch.contains("new2"));
    }

    #[test]
    fn line_revert_no_match_errors() {
        let sel = vec![("new".to_string(), 999u32)];
        assert_eq!(
            build_reverse_lines_patch(SAMPLE_DIFF, &sel).unwrap_err(),
            "no_lines_selected"
        );
    }
}

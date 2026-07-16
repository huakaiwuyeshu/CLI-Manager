use crate::app_paths;
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use semver::Version;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs;
use std::io::Cursor;
use std::path::{Component, Path, PathBuf};
use std::time::{Duration, SystemTime};
use tauri::{
    AppHandle, LogicalSize, Manager, PhysicalPosition, Runtime,
};
use uuid::Uuid;
use zip::ZipArchive;

const PET_SCHEMA_VERSION: u32 = 1;
const PET_WINDOW_LABEL: &str = "desktop-pet";
const PET_WINDOW_BASE_WIDTH: f64 = 190.0;
const PET_WINDOW_BASE_HEIGHT: f64 = 210.0;
const PET_WINDOW_MARGIN: i32 = 24;
const MAX_CATALOG_ITEMS: usize = 200;
const MAX_ARCHIVE_BYTES: usize = 25 * 1024 * 1024;
const MAX_EXTRACTED_BYTES: u64 = 30 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES: usize = 40;
const CATALOG_CACHE_MAX_AGE: Duration = Duration::from_secs(6 * 60 * 60);
const REMOTE_CATALOG_URL: &str =
    "https://raw.githubusercontent.com/GAMPA228/CLI-Manager/master/public/pet-catalog/catalog.json";
const EMBEDDED_CATALOG: &str = include_str!("../../../public/pet-catalog/catalog.json");
const TERMINAL_ROBOT_PACK: &[u8] =
    include_bytes!("../../../public/pet-catalog/packages/terminal-robot-1.0.0.clipet");
const PIXEL_FOX_PACK: &[u8] =
    include_bytes!("../../../public/pet-catalog/packages/pixel-fox-1.0.0.clipet");
const MINT_SLIME_PACK: &[u8] =
    include_bytes!("../../../public/pet-catalog/packages/mint-slime-1.0.0.clipet");
const TERMINAL_ROBOT_PREVIEW: &str =
    include_str!("../../../public/pet-catalog/previews/terminal-robot.svg");
const PIXEL_FOX_PREVIEW: &str = include_str!("../../../public/pet-catalog/previews/pixel-fox.svg");
const MINT_SLIME_PREVIEW: &str =
    include_str!("../../../public/pet-catalog/previews/mint-slime.svg");

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalizedText {
    #[serde(rename = "zh-CN")]
    pub zh_cn: String,
    #[serde(rename = "en-US")]
    pub en_us: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PetCanvas {
    pub width: u32,
    pub height: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PetStateAsset {
    pub file: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PetManifest {
    pub schema_version: u32,
    pub id: String,
    pub version: String,
    pub name: LocalizedText,
    pub description: LocalizedText,
    pub author: String,
    pub license: String,
    pub engine: String,
    pub canvas: PetCanvas,
    pub states: BTreeMap<String, PetStateAsset>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PetCatalogEntry {
    pub id: String,
    pub version: String,
    pub name: LocalizedText,
    pub description: LocalizedText,
    pub author: String,
    pub license: String,
    pub min_app_version: String,
    pub preview_url: String,
    #[serde(default)]
    pub preview_data_url: Option<String>,
    pub download_url: String,
    pub sha256: String,
    pub size_bytes: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PetCatalog {
    schema_version: u32,
    updated_at: String,
    items: Vec<PetCatalogEntry>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PetCatalogResponse {
    pub items: Vec<PetCatalogEntry>,
    pub source: String,
    pub warning: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPet {
    pub manifest: PetManifest,
    pub base_dir: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PetPosition {
    pub x: i32,
    pub y: i32,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopPetWindowConfig {
    pub enabled: bool,
    pub always_on_top: bool,
    pub scale: f64,
    pub position: Option<PetPosition>,
}

fn pets_root() -> Result<PathBuf, String> {
    app_paths::pets_dir()
}

fn installed_root(root: &Path) -> PathBuf {
    root.join("installed")
}

fn temp_root(root: &Path) -> PathBuf {
    root.join("temp")
}

fn cache_path(root: &Path) -> PathBuf {
    root.join("catalog-cache.json")
}

fn ensure_pet_dirs(root: &Path) -> Result<(), String> {
    for path in [root.to_path_buf(), installed_root(root), temp_root(root)] {
        fs::create_dir_all(&path).map_err(|err| format!("pet_dir_create_failed: {err}"))?;
    }
    Ok(())
}

fn valid_pet_id(value: &str) -> bool {
    let value = value.trim();
    !value.is_empty()
        && value.len() <= 80
        && value.bytes().all(|byte| {
            byte.is_ascii_lowercase() || byte.is_ascii_digit() || matches!(byte, b'.' | b'-' | b'_')
        })
}

fn safe_relative_file(value: &str) -> Option<PathBuf> {
    if value.is_empty() || value.len() > 180 || value.contains('\\') {
        return None;
    }
    let path = Path::new(value);
    if path.is_absolute() {
        return None;
    }
    let mut has_normal = false;
    for component in path.components() {
        match component {
            Component::Normal(_) => has_normal = true,
            _ => return None,
        }
    }
    has_normal.then(|| path.to_path_buf())
}

fn allowed_asset_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .map(|value| matches!(value.to_ascii_lowercase().as_str(), "png" | "webp" | "svg"))
        .unwrap_or(false)
}

fn validate_svg(text: &str) -> Result<(), String> {
    let lowered = text.to_ascii_lowercase();
    let forbidden = [
        "<script",
        "<foreignobject",
        "<iframe",
        "<object",
        "<embed",
        "javascript:",
        "data:text/html",
        "onload=",
        "onclick=",
        "onerror=",
        "url(http",
        "href=\"http",
        "href='http",
        "xlink:href=\"http",
        "xlink:href='http",
    ];
    if forbidden.iter().any(|needle| lowered.contains(needle)) {
        return Err("pet_svg_unsafe_content".to_string());
    }
    if !lowered.contains("<svg") {
        return Err("pet_svg_invalid".to_string());
    }
    Ok(())
}

fn validate_manifest(manifest: &PetManifest, base_dir: &Path) -> Result<(), String> {
    if manifest.schema_version != PET_SCHEMA_VERSION {
        return Err("pet_manifest_schema_unsupported".to_string());
    }
    if !valid_pet_id(&manifest.id) {
        return Err("pet_manifest_id_invalid".to_string());
    }
    Version::parse(&manifest.version).map_err(|_| "pet_manifest_version_invalid".to_string())?;
    if manifest.name.zh_cn.trim().is_empty()
        || manifest.name.en_us.trim().is_empty()
        || manifest.author.trim().is_empty()
        || manifest.license.trim().is_empty()
    {
        return Err("pet_manifest_metadata_invalid".to_string());
    }
    if manifest.engine != "image-v1" {
        return Err("pet_manifest_engine_unsupported".to_string());
    }
    if !(64..=512).contains(&manifest.canvas.width) || !(64..=512).contains(&manifest.canvas.height)
    {
        return Err("pet_manifest_canvas_invalid".to_string());
    }
    if !manifest.states.contains_key("idle") {
        return Err("pet_manifest_idle_missing".to_string());
    }
    let allowed_states = ["idle", "working", "waiting", "success", "error", "sleeping"];
    for (state, asset) in &manifest.states {
        if !allowed_states.contains(&state.as_str()) {
            return Err("pet_manifest_state_invalid".to_string());
        }
        let relative = safe_relative_file(&asset.file)
            .ok_or_else(|| "pet_manifest_asset_path_invalid".to_string())?;
        if !allowed_asset_extension(&relative) {
            return Err("pet_manifest_asset_type_unsupported".to_string());
        }
        let absolute = base_dir.join(&relative);
        if !absolute.is_file() {
            return Err("pet_manifest_asset_missing".to_string());
        }
        if relative
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| value.eq_ignore_ascii_case("svg"))
            .unwrap_or(false)
        {
            let text = fs::read_to_string(&absolute)
                .map_err(|err| format!("pet_svg_read_failed: {err}"))?;
            validate_svg(&text)?;
        }
    }
    Ok(())
}

fn validate_catalog(catalog: &PetCatalog) -> Result<(), String> {
    if catalog.schema_version != PET_SCHEMA_VERSION || catalog.items.len() > MAX_CATALOG_ITEMS {
        return Err("pet_catalog_schema_invalid".to_string());
    }
    for item in &catalog.items {
        if !valid_pet_id(&item.id)
            || Version::parse(&item.version).is_err()
            || Version::parse(&item.min_app_version).is_err()
            || item.name.zh_cn.trim().is_empty()
            || item.name.en_us.trim().is_empty()
            || item.author.trim().is_empty()
            || item.license.trim().is_empty()
            || item.size_bytes == 0
            || item.size_bytes as usize > MAX_ARCHIVE_BYTES
            || item.sha256.len() != 64
            || !item.sha256.bytes().all(|byte| byte.is_ascii_hexdigit())
            || !item
                .download_url
                .starts_with("https://raw.githubusercontent.com/")
            || !item
                .preview_url
                .starts_with("https://raw.githubusercontent.com/")
        {
            return Err("pet_catalog_entry_invalid".to_string());
        }
    }
    Ok(())
}

fn parse_catalog(text: &str) -> Result<PetCatalog, String> {
    let catalog: PetCatalog =
        serde_json::from_str(text).map_err(|err| format!("pet_catalog_parse_failed: {err}"))?;
    validate_catalog(&catalog)?;
    Ok(catalog)
}

fn preview_data_url(id: &str) -> Option<String> {
    let svg = match id {
        "official.terminal-robot" => TERMINAL_ROBOT_PREVIEW,
        "official.pixel-fox" => PIXEL_FOX_PREVIEW,
        "official.mint-slime" => MINT_SLIME_PREVIEW,
        _ => return None,
    };
    Some(format!(
        "data:image/svg+xml;base64,{}",
        BASE64_STANDARD.encode(svg.as_bytes())
    ))
}

fn enrich_catalog(mut catalog: PetCatalog) -> PetCatalog {
    for item in &mut catalog.items {
        item.preview_data_url = preview_data_url(&item.id);
    }
    catalog
}

fn read_cached_catalog(root: &Path, require_fresh: bool) -> Result<Option<PetCatalog>, String> {
    let path = cache_path(root);
    if !path.is_file() {
        return Ok(None);
    }
    if require_fresh {
        let modified = fs::metadata(&path)
            .and_then(|value| value.modified())
            .map_err(|err| format!("pet_catalog_cache_metadata_failed: {err}"))?;
        let age = SystemTime::now()
            .duration_since(modified)
            .unwrap_or_default();
        if age > CATALOG_CACHE_MAX_AGE {
            return Ok(None);
        }
    }
    let text =
        fs::read_to_string(&path).map_err(|err| format!("pet_catalog_cache_read_failed: {err}"))?;
    parse_catalog(&text).map(Some)
}

fn write_catalog_cache(root: &Path, text: &str) -> Result<(), String> {
    let target = cache_path(root);
    let temp = root.join(format!("catalog-cache.{}.tmp", Uuid::new_v4()));
    let backup = root.join(format!("catalog-cache.{}.backup", Uuid::new_v4()));
    fs::write(&temp, text).map_err(|err| format!("pet_catalog_cache_write_failed: {err}"))?;

    if target.exists() {
        if let Err(err) = fs::rename(&target, &backup) {
            let _ = fs::remove_file(&temp);
            return Err(format!("pet_catalog_cache_backup_failed: {err}"));
        }
    }

    if let Err(err) = fs::rename(&temp, &target) {
        if backup.exists() {
            let _ = fs::rename(&backup, &target);
        }
        let _ = fs::remove_file(&temp);
        return Err(format!("pet_catalog_cache_replace_failed: {err}"));
    }
    if backup.exists() {
        if let Err(err) = fs::remove_file(&backup) {
            log::warn!(
                "desktop pet catalog cache backup cleanup skipped {}: {err}",
                backup.display()
            );
        }
    }
    Ok(())
}

async fn fetch_remote_catalog() -> Result<(PetCatalog, String), String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|err| format!("pet_catalog_client_failed: {err}"))?;
    let response = client
        .get(REMOTE_CATALOG_URL)
        .send()
        .await
        .map_err(|err| format!("pet_catalog_download_failed: {err}"))?
        .error_for_status()
        .map_err(|err| format!("pet_catalog_http_failed: {err}"))?;
    let text = response
        .text()
        .await
        .map_err(|err| format!("pet_catalog_body_failed: {err}"))?;
    let catalog = parse_catalog(&text)?;
    Ok((catalog, text))
}

async fn load_catalog(refresh: bool) -> Result<PetCatalogResponse, String> {
    let root = pets_root()?;
    ensure_pet_dirs(&root)?;
    if !refresh {
        if let Some(catalog) = read_cached_catalog(&root, true)? {
            return Ok(PetCatalogResponse {
                items: enrich_catalog(catalog).items,
                source: "cache".to_string(),
                warning: None,
            });
        }
    }

    match fetch_remote_catalog().await {
        Ok((catalog, text)) => {
            if let Err(err) = write_catalog_cache(&root, &text) {
                log::warn!("desktop pet catalog cache write skipped: {err}");
            }
            Ok(PetCatalogResponse {
                items: enrich_catalog(catalog).items,
                source: "remote".to_string(),
                warning: None,
            })
        }
        Err(remote_err) => {
            if let Some(catalog) = read_cached_catalog(&root, false)? {
                return Ok(PetCatalogResponse {
                    items: enrich_catalog(catalog).items,
                    source: "cache".to_string(),
                    warning: Some(remote_err),
                });
            }
            let catalog = parse_catalog(EMBEDDED_CATALOG)?;
            Ok(PetCatalogResponse {
                items: enrich_catalog(catalog).items,
                source: "bundled".to_string(),
                warning: Some(remote_err),
            })
        }
    }
}

fn embedded_package(id: &str, version: &str) -> Option<&'static [u8]> {
    match (id, version) {
        ("official.terminal-robot", "1.0.0") => Some(TERMINAL_ROBOT_PACK),
        ("official.pixel-fox", "1.0.0") => Some(PIXEL_FOX_PACK),
        ("official.mint-slime", "1.0.0") => Some(MINT_SLIME_PACK),
        _ => None,
    }
}

fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

async fn download_package(entry: &PetCatalogEntry) -> Result<Vec<u8>, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|err| format!("pet_download_client_failed: {err}"))?;
    let response = client
        .get(&entry.download_url)
        .send()
        .await
        .map_err(|err| format!("pet_download_failed: {err}"))?
        .error_for_status()
        .map_err(|err| format!("pet_download_http_failed: {err}"))?;
    if response
        .content_length()
        .map(|size| size as usize > MAX_ARCHIVE_BYTES)
        .unwrap_or(false)
    {
        return Err("pet_download_too_large".to_string());
    }
    let bytes = response
        .bytes()
        .await
        .map_err(|err| format!("pet_download_body_failed: {err}"))?;
    if bytes.len() > MAX_ARCHIVE_BYTES {
        return Err("pet_download_too_large".to_string());
    }
    Ok(bytes.to_vec())
}

fn path_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn read_installed_pet(version_dir: &Path) -> Result<InstalledPet, String> {
    let manifest_path = version_dir.join("manifest.json");
    let manifest_text = fs::read_to_string(&manifest_path)
        .map_err(|err| format!("pet_manifest_read_failed: {err}"))?;
    let manifest: PetManifest = serde_json::from_str(&manifest_text)
        .map_err(|err| format!("pet_manifest_parse_failed: {err}"))?;
    validate_manifest(&manifest, version_dir)?;
    Ok(InstalledPet {
        manifest,
        base_dir: path_string(version_dir),
    })
}

fn install_package_bytes_to_root(
    root: &Path,
    bytes: &[u8],
    expected_id: Option<&str>,
    expected_version: Option<&str>,
) -> Result<InstalledPet, String> {
    if bytes.is_empty() || bytes.len() > MAX_ARCHIVE_BYTES {
        return Err("pet_archive_size_invalid".to_string());
    }
    ensure_pet_dirs(root)?;
    let stage_dir = temp_root(root).join(Uuid::new_v4().to_string());
    fs::create_dir_all(&stage_dir).map_err(|err| format!("pet_stage_create_failed: {err}"))?;
    let extraction_result = (|| -> Result<(), String> {
        let mut archive = ZipArchive::new(Cursor::new(bytes))
            .map_err(|err| format!("pet_archive_open_failed: {err}"))?;
        if archive.len() == 0 || archive.len() > MAX_ARCHIVE_ENTRIES {
            return Err("pet_archive_entries_invalid".to_string());
        }
        let mut total_size = 0u64;
        for index in 0..archive.len() {
            let mut entry = archive
                .by_index(index)
                .map_err(|err| format!("pet_archive_entry_failed: {err}"))?;
            if entry.is_dir() {
                continue;
            }
            if entry
                .unix_mode()
                .map(|mode| mode & 0o170000 == 0o120000)
                .unwrap_or(false)
            {
                return Err("pet_archive_symlink_rejected".to_string());
            }
            total_size = total_size.saturating_add(entry.size());
            if total_size > MAX_EXTRACTED_BYTES {
                return Err("pet_archive_unpacked_too_large".to_string());
            }
            let enclosed = entry
                .enclosed_name()
                .ok_or_else(|| "pet_archive_path_invalid".to_string())?
                .to_path_buf();
            if enclosed.components().count() > 4 {
                return Err("pet_archive_path_too_deep".to_string());
            }
            let file_name = enclosed
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("");
            if file_name != "manifest.json" && !allowed_asset_extension(&enclosed) {
                return Err("pet_archive_file_type_unsupported".to_string());
            }
            let output_path = stage_dir.join(enclosed);
            if let Some(parent) = output_path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|err| format!("pet_archive_dir_failed: {err}"))?;
            }
            let mut output = fs::File::create(&output_path)
                .map_err(|err| format!("pet_archive_write_failed: {err}"))?;
            std::io::copy(&mut entry, &mut output)
                .map_err(|err| format!("pet_archive_extract_failed: {err}"))?;
        }
        Ok(())
    })();
    if let Err(err) = extraction_result {
        let _ = fs::remove_dir_all(&stage_dir);
        return Err(err);
    }

    let staged = match read_installed_pet(&stage_dir) {
        Ok(value) => value,
        Err(err) => {
            let _ = fs::remove_dir_all(&stage_dir);
            return Err(err);
        }
    };
    if expected_id
        .map(|value| value != staged.manifest.id)
        .unwrap_or(false)
    {
        let _ = fs::remove_dir_all(&stage_dir);
        return Err("pet_archive_id_mismatch".to_string());
    }
    if expected_version
        .map(|value| value != staged.manifest.version)
        .unwrap_or(false)
    {
        let _ = fs::remove_dir_all(&stage_dir);
        return Err("pet_archive_version_mismatch".to_string());
    }

    let id_dir = installed_root(root).join(&staged.manifest.id);
    fs::create_dir_all(&id_dir).map_err(|err| format!("pet_install_dir_failed: {err}"))?;
    let target_dir = id_dir.join(&staged.manifest.version);
    let backup_dir = id_dir.join(format!(".backup-{}", Uuid::new_v4()));
    if target_dir.exists() {
        fs::rename(&target_dir, &backup_dir)
            .map_err(|err| format!("pet_install_backup_failed: {err}"))?;
    }
    if let Err(err) = fs::rename(&stage_dir, &target_dir) {
        if backup_dir.exists() {
            let _ = fs::rename(&backup_dir, &target_dir);
        }
        let _ = fs::remove_dir_all(&stage_dir);
        return Err(format!("pet_install_commit_failed: {err}"));
    }
    if backup_dir.exists() {
        let _ = fs::remove_dir_all(&backup_dir);
    }
    read_installed_pet(&target_dir)
}

fn newest_installed_pet(root: &Path, pet_id: &str) -> Result<Option<InstalledPet>, String> {
    if !valid_pet_id(pet_id) {
        return Err("pet_id_invalid".to_string());
    }
    let id_dir = installed_root(root).join(pet_id);
    if !id_dir.is_dir() {
        return Ok(None);
    }
    let mut candidates = Vec::new();
    for entry in fs::read_dir(&id_dir).map_err(|err| format!("pet_list_failed: {err}"))? {
        let entry = entry.map_err(|err| format!("pet_list_entry_failed: {err}"))?;
        if !entry.path().is_dir() || entry.file_name().to_string_lossy().starts_with('.') {
            continue;
        }
        match read_installed_pet(&entry.path()) {
            Ok(pet) if pet.manifest.id == pet_id => {
                if let Ok(version) = Version::parse(&pet.manifest.version) {
                    candidates.push((version, pet));
                }
            }
            Ok(_) => log::warn!(
                "desktop pet directory id mismatch: {}",
                entry.path().display()
            ),
            Err(err) => log::warn!(
                "desktop pet ignored invalid install {}: {err}",
                entry.path().display()
            ),
        }
    }
    candidates.sort_by(|left, right| right.0.cmp(&left.0));
    Ok(candidates.into_iter().next().map(|(_, pet)| pet))
}

#[tauri::command]
pub async fn desktop_pet_catalog(refresh: Option<bool>) -> Result<PetCatalogResponse, String> {
    load_catalog(refresh.unwrap_or(false)).await
}

#[tauri::command]
pub fn desktop_pet_list_installed() -> Result<Vec<InstalledPet>, String> {
    let root = pets_root()?;
    ensure_pet_dirs(&root)?;
    let mut pets = Vec::new();
    for id_entry in
        fs::read_dir(installed_root(&root)).map_err(|err| format!("pet_list_failed: {err}"))?
    {
        let id_entry = id_entry.map_err(|err| format!("pet_list_entry_failed: {err}"))?;
        let id = id_entry.file_name().to_string_lossy().into_owned();
        if !id_entry.path().is_dir() || !valid_pet_id(&id) {
            continue;
        }
        if let Some(pet) = newest_installed_pet(&root, &id)? {
            pets.push(pet);
        }
    }
    pets.sort_by(|left, right| left.manifest.id.cmp(&right.manifest.id));
    Ok(pets)
}

#[tauri::command]
pub fn desktop_pet_get_installed(pet_id: String) -> Result<Option<InstalledPet>, String> {
    let root = pets_root()?;
    ensure_pet_dirs(&root)?;
    newest_installed_pet(&root, pet_id.trim())
}

#[tauri::command]
pub async fn desktop_pet_install(app: AppHandle, pet_id: String) -> Result<InstalledPet, String> {
    let catalog = load_catalog(false).await?;
    let entry = catalog
        .items
        .into_iter()
        .find(|item| item.id == pet_id)
        .ok_or_else(|| "pet_catalog_item_not_found".to_string())?;
    let current_version = Version::parse(&app.package_info().version.to_string())
        .map_err(|_| "pet_app_version_invalid".to_string())?;
    let minimum_version = Version::parse(&entry.min_app_version)
        .map_err(|_| "pet_catalog_min_version_invalid".to_string())?;
    if current_version < minimum_version {
        return Err("pet_app_version_too_old".to_string());
    }

    let bytes = match download_package(&entry).await {
        Ok(bytes) if sha256_hex(&bytes) == entry.sha256.to_ascii_lowercase() => bytes,
        Ok(_) => {
            let embedded = embedded_package(&entry.id, &entry.version)
                .ok_or_else(|| "pet_download_checksum_mismatch".to_string())?;
            if sha256_hex(embedded) != entry.sha256.to_ascii_lowercase() {
                return Err("pet_download_checksum_mismatch".to_string());
            }
            embedded.to_vec()
        }
        Err(download_err) => {
            let embedded = embedded_package(&entry.id, &entry.version).ok_or(download_err)?;
            if sha256_hex(embedded) != entry.sha256.to_ascii_lowercase() {
                return Err("pet_download_checksum_mismatch".to_string());
            }
            embedded.to_vec()
        }
    };
    install_package_bytes_to_root(&pets_root()?, &bytes, Some(&entry.id), Some(&entry.version))
}

#[tauri::command]
pub fn desktop_pet_import(path: String) -> Result<InstalledPet, String> {
    let source = PathBuf::from(path);
    let metadata = fs::metadata(&source).map_err(|err| format!("pet_import_open_failed: {err}"))?;
    if !metadata.is_file() || metadata.len() == 0 || metadata.len() as usize > MAX_ARCHIVE_BYTES {
        return Err("pet_import_size_invalid".to_string());
    }
    let bytes = fs::read(&source).map_err(|err| format!("pet_import_read_failed: {err}"))?;
    install_package_bytes_to_root(&pets_root()?, &bytes, None, None)
}

#[tauri::command]
pub fn desktop_pet_uninstall(pet_id: String) -> Result<(), String> {
    let pet_id = pet_id.trim();
    if !valid_pet_id(pet_id) {
        return Err("pet_id_invalid".to_string());
    }
    let root = pets_root()?;
    let target = installed_root(&root).join(pet_id);
    if target.is_dir() {
        fs::remove_dir_all(&target).map_err(|err| format!("pet_uninstall_failed: {err}"))?;
    }
    Ok(())
}

fn window_size(scale: f64) -> (f64, f64) {
    let scale = scale.clamp(0.75, 1.5);
    (
        PET_WINDOW_BASE_WIDTH * scale,
        PET_WINDOW_BASE_HEIGHT * scale,
    )
}

fn place_default<R: Runtime>(window: &tauri::WebviewWindow<R>) {
    let Ok(Some(monitor)) = window.primary_monitor() else {
        return;
    };
    let Ok(window_size) = window.outer_size().or_else(|_| window.inner_size()) else {
        return;
    };
    let monitor_position = monitor.position();
    let monitor_size = monitor.size();
    let x = monitor_position.x + monitor_size.width as i32
        - window_size.width as i32
        - PET_WINDOW_MARGIN;
    let y = monitor_position.y + monitor_size.height as i32
        - window_size.height as i32
        - PET_WINDOW_MARGIN
        - 40;
    let _ = window.set_position(PhysicalPosition::new(x, y));
}

#[tauri::command]
pub fn desktop_pet_window_sync(
    app: AppHandle,
    config: DesktopPetWindowConfig,
) -> Result<(), String> {
    let Some(window) = app.get_webview_window(PET_WINDOW_LABEL) else {
        return if config.enabled {
            Err("pet_window_missing".to_string())
        } else {
            Ok(())
        };
    };
    if !config.enabled {
        window
            .hide()
            .map_err(|err| format!("pet_window_hide_failed: {err}"))?;
        return Ok(());
    }

    let (width, height) = window_size(config.scale);
    window
        .set_size(LogicalSize::new(width, height))
        .map_err(|err| format!("pet_window_resize_failed: {err}"))?;
    window
        .set_always_on_top(config.always_on_top)
        .map_err(|err| format!("pet_window_topmost_failed: {err}"))?;
    if let Some(position) = config.position {
        window
            .set_position(PhysicalPosition::new(position.x, position.y))
            .map_err(|err| format!("pet_window_position_failed: {err}"))?;
    } else {
        place_default(&window);
    }
    window
        .show()
        .map_err(|err| format!("pet_window_show_failed: {err}"))
}

#[tauri::command]
pub fn desktop_pet_window_reset_position(app: AppHandle) -> Result<(), String> {
    let Some(window) = app.get_webview_window(PET_WINDOW_LABEL) else {
        return Ok(());
    };
    place_default(&window);
    Ok(())
}

#[tauri::command]
pub fn desktop_pet_window_hide(app: AppHandle) -> Result<(), String> {
    let Some(window) = app.get_webview_window(PET_WINDOW_LABEL) else {
        return Ok(());
    };
    window
        .hide()
        .map_err(|err| format!("pet_window_hide_failed: {err}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pet_ids_and_paths_reject_unsafe_values() {
        assert!(valid_pet_id("official.pixel-fox"));
        assert!(!valid_pet_id("../pixel-fox"));
        assert!(safe_relative_file("assets/pet.svg").is_some());
        assert!(safe_relative_file("../pet.svg").is_none());
        assert!(safe_relative_file("C:/pet.svg").is_none());
    }

    #[test]
    fn embedded_catalog_and_package_hashes_match() {
        let catalog = parse_catalog(EMBEDDED_CATALOG).unwrap();
        for item in catalog.items {
            let bytes = embedded_package(&item.id, &item.version).unwrap();
            assert_eq!(sha256_hex(bytes), item.sha256);
        }
    }

    #[test]
    fn catalog_cache_replaces_existing_file_on_windows() {
        let root = tempfile::tempdir().unwrap();
        ensure_pet_dirs(root.path()).unwrap();
        write_catalog_cache(root.path(), "first").unwrap();
        write_catalog_cache(root.path(), "second").unwrap();
        assert_eq!(
            fs::read_to_string(cache_path(root.path())).unwrap(),
            "second"
        );
        assert!(fs::read_dir(root.path()).unwrap().all(|entry| {
            let name = entry.unwrap().file_name().to_string_lossy().into_owned();
            !name.ends_with(".tmp") && !name.ends_with(".backup")
        }));
    }

    #[test]
    fn embedded_packages_extract_and_validate() {
        let root = tempfile::tempdir().unwrap();
        for (id, version, bytes) in [
            ("official.terminal-robot", "1.0.0", TERMINAL_ROBOT_PACK),
            ("official.pixel-fox", "1.0.0", PIXEL_FOX_PACK),
            ("official.mint-slime", "1.0.0", MINT_SLIME_PACK),
        ] {
            let installed =
                install_package_bytes_to_root(root.path(), bytes, Some(id), Some(version)).unwrap();
            assert_eq!(installed.manifest.id, id);
            assert!(Path::new(&installed.base_dir).join("pet.svg").is_file());
        }
    }

    #[test]
    fn svg_validation_rejects_script_and_remote_references() {
        assert!(validate_svg("<svg><path d='M0 0'/></svg>").is_ok());
        assert!(validate_svg("<svg><script>alert(1)</script></svg>").is_err());
        assert!(validate_svg("<svg><image href='https://example.com/a.png'/></svg>").is_err());
    }
}

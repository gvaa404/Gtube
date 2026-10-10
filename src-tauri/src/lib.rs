use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    env, fs,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex},
    thread,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::Emitter;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyStatus {
    pub name: String,
    pub available: bool,
    pub path: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub default_download_dir: String,
    pub preferred_audio_format: String,
    pub preferred_video_format: String,
    pub default_quality: String,
    pub download_concurrency: u8,
    pub ffmpeg_path: String,
    pub yt_dlp_path: String,
    pub mpv_path: String,
    pub theme: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadJob {
    pub id: String,
    pub title: String,
    pub state: String,
    pub progress: u8,
    pub speed: String,
    pub eta: String,
    pub format: String,
    pub destination: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub thumbnail: String,
    pub duration: String,
    pub channel: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoMetadata {
    pub id: String,
    pub title: String,
    pub thumbnail: String,
    pub duration: String,
    pub channel: String,
    pub webpage_url: String,
    pub formats: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaLibraryEntry {
    pub id: String,
    pub title: String,
    pub kind: String,
    pub path: String,
    pub size: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: String,
    pub title: String,
    pub result: String,
    pub timestamp: String,
}

#[derive(Clone)]
pub struct AppState {
    jobs: Arc<Mutex<HashMap<String, DownloadJob>>>,
    children: Arc<Mutex<HashMap<String, Child>>>,
    settings: Arc<Mutex<AppSettings>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            jobs: Arc::default(),
            children: Arc::default(),
            settings: Arc::new(Mutex::new(AppSettings {
                default_download_dir: "~/Downloads/GTube".into(),
                preferred_audio_format: "mp3".into(),
                preferred_video_format: "mp4".into(),
                default_quality: "1080p".into(),
                download_concurrency: 1,
                ffmpeg_path: "ffmpeg".into(),
                yt_dlp_path: "yt-dlp".into(),
                mpv_path: "mpv".into(),
                theme: "dark".into(),
            })),
        }
    }
}

fn tool_path(name: &str) -> String {
    env::var(format!(
        "GTUBE_{}_PATH",
        name.replace('-', "_").to_uppercase()
    ))
    .unwrap_or_else(|_| name.to_string())
}

fn run_tool(path: &str, args: &[&str]) -> Result<std::process::Output, String> {
    Command::new(path)
        .args(args)
        .output()
        .map_err(|e| format!("Unable to start {path}: {e}"))
}

fn detect_tool(tool_name: &str, version_args: &[&str]) -> DependencyStatus {
    let path = tool_path(tool_name);
    match run_tool(&path, version_args) {
        Ok(output) if output.status.success() => DependencyStatus {
            name: tool_name.to_string(),
            available: true,
            path,
            version: String::from_utf8_lossy(&output.stdout)
                .lines()
                .next()
                .unwrap_or("unknown")
                .trim()
                .to_string(),
        },
        _ => DependencyStatus {
            name: tool_name.to_string(),
            available: false,
            path: "not found".to_string(),
            version: "missing".to_string(),
        },
    }
}

fn expand_path(value: &str) -> PathBuf {
    if let Some(rest) = value.strip_prefix("~/") {
        if let Ok(home) = env::var("HOME") {
            return Path::new(&home).join(rest);
        }
    }
    PathBuf::from(value)
}

fn youtube_url(input: &str) -> Result<String, String> {
    let value = input.trim();
    let parsed = url::Url::parse(value).map_err(|_| "Enter a valid YouTube URL.".to_string())?;
    let host = parsed.host_str().unwrap_or("").to_ascii_lowercase();
    let allowed = matches!(
        host.as_str(),
        "youtube.com" | "www.youtube.com" | "m.youtube.com" | "music.youtube.com" | "youtu.be"
    );
    if !allowed || parsed.scheme() != "https" {
        return Err("Only HTTPS YouTube URLs are supported.".to_string());
    }
    let valid_watch =
        parsed.path() == "/watch" && parsed.query_pairs().any(|(k, v)| k == "v" && !v.is_empty());
    let valid = (host == "youtu.be" && parsed.path().len() > 1)
        || (host != "youtu.be"
            && (valid_watch
                || parsed.path().starts_with("/shorts/")
                || parsed.path().starts_with("/embed/")));
    if !valid {
        return Err("The URL is not a supported YouTube video URL.".to_string());
    }
    Ok(value.to_string())
}

fn format_duration(seconds: Option<f64>) -> String {
    let total = seconds.unwrap_or(0.0).max(0.0) as u64;
    format!(
        "{:02}:{:02}:{:02}",
        total / 3600,
        (total % 3600) / 60,
        total % 60
    )
}

fn now_id(prefix: &str) -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    format!("{prefix}-{millis}")
}

mod commands {
    use super::*;

    #[tauri::command]
    pub fn dependency_status() -> Vec<DependencyStatus> {
        vec![
            detect_tool("yt-dlp", &["--version"]),
            detect_tool("ffmpeg", &["-version"]),
            detect_tool("ffprobe", &["-version"]),
            detect_tool("mpv", &["--version"]),
        ]
    }

    #[tauri::command]
    pub fn validate_url(url: String) -> Result<String, String> {
        youtube_url(&url)
    }

    #[tauri::command]
    pub fn search_videos(query: String) -> Result<Vec<SearchResult>, String> {
        let query = query.trim();
        if query.is_empty() {
            return Err("Search text is required.".to_string());
        }
        let output = run_tool(
            &tool_path("yt-dlp"),
            &[
                "--flat-playlist",
                "--dump-single-json",
                "--no-warnings",
                &format!("ytsearch10:{query}"),
            ],
        )?;
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
        }
        let json: serde_json::Value = serde_json::from_slice(&output.stdout)
            .map_err(|e| format!("yt-dlp returned invalid search data: {e}"))?;
        let entries = json["entries"]
            .as_array()
            .ok_or("No search results were returned.")?;
        Ok(entries
            .iter()
            .filter_map(|item| {
                let id = item["id"].as_str()?.to_string();
                Some(SearchResult {
                    id: id.clone(),
                    title: item["title"].as_str().unwrap_or("Untitled").to_string(),
                    thumbnail: item["thumbnail"].as_str().unwrap_or("").to_string(),
                    duration: format_duration(item["duration"].as_f64()),
                    channel: item["channel"]
                        .as_str()
                        .or(item["uploader"].as_str())
                        .unwrap_or("Unknown channel")
                        .to_string(),
                    url: format!("https://www.youtube.com/watch?v={id}"),
                })
            })
            .collect())
    }

    #[tauri::command]
    pub fn get_metadata(url: String) -> Result<VideoMetadata, String> {
        let url = youtube_url(&url)?;
        let output = run_tool(
            &tool_path("yt-dlp"),
            &[
                "--dump-single-json",
                "--no-warnings",
                "--skip-download",
                &url,
            ],
        )?;
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
        }
        let json: serde_json::Value = serde_json::from_slice(&output.stdout)
            .map_err(|e| format!("yt-dlp returned invalid metadata: {e}"))?;
        let formats = json["formats"]
            .as_array()
            .map(|items| {
                items
                    .iter()
                    .filter_map(|f| {
                        f["format_note"]
                            .as_str()
                            .or(f["ext"].as_str())
                            .map(str::to_string)
                    })
                    .collect()
            })
            .unwrap_or_default();
        Ok(VideoMetadata {
            id: json["id"].as_str().unwrap_or("").to_string(),
            title: json["title"].as_str().unwrap_or("Untitled").to_string(),
            thumbnail: json["thumbnail"].as_str().unwrap_or("").to_string(),
            duration: format_duration(json["duration"].as_f64()),
            channel: json["channel"]
                .as_str()
                .or(json["uploader"].as_str())
                .unwrap_or("Unknown channel")
                .to_string(),
            webpage_url: json["webpage_url"].as_str().unwrap_or(&url).to_string(),
            formats,
        })
    }

    #[tauri::command]
    pub fn get_settings(state: tauri::State<'_, AppState>) -> Result<AppSettings, String> {
        state
            .settings
            .lock()
            .map(|settings| settings.clone())
            .map_err(|_| "Settings are unavailable.".into())
    }

    #[tauri::command]
    pub fn save_settings(
        state: tauri::State<'_, AppState>,
        settings: AppSettings,
    ) -> Result<AppSettings, String> {
        if settings.default_download_dir.trim().is_empty() {
            return Err("Download directory is required.".into());
        }
        if !["mp3", "m4a", "flac"].contains(&settings.preferred_audio_format.as_str())
            || !["mp4", "webm"].contains(&settings.preferred_video_format.as_str())
        {
            return Err("Unsupported media format.".into());
        }
        *state
            .settings
            .lock()
            .map_err(|_| "Settings are unavailable.".to_string())? = settings.clone();
        Ok(settings)
    }

    #[tauri::command]
    pub fn get_download_jobs(state: tauri::State<'_, AppState>) -> Vec<DownloadJob> {
        state
            .jobs
            .lock()
            .map(|jobs| jobs.values().cloned().collect())
            .unwrap_or_default()
    }

    #[tauri::command]
    pub fn download_media(
        app: tauri::AppHandle,
        state: tauri::State<'_, AppState>,
        url: String,
        destination: String,
        media_type: String,
        format: String,
    ) -> Result<String, String> {
        let url = youtube_url(&url)?;
        if !["audio", "video"].contains(&media_type.as_str()) {
            return Err("Unsupported media type.".into());
        }
        if !["mp3", "m4a", "flac", "mp4", "webm"].contains(&format.as_str()) {
            return Err("Unsupported media format.".into());
        }
        let dir = expand_path(&destination);
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Unable to create download directory: {e}"))?;
        let id = now_id("download");
        let job = DownloadJob {
            id: id.clone(),
            title: url.clone(),
            state: "Running".into(),
            progress: 0,
            speed: "0 B/s".into(),
            eta: "--:--".into(),
            format: format.clone(),
            destination: dir.display().to_string(),
        };
        state
            .jobs
            .lock()
            .map_err(|_| "Download state is unavailable.".to_string())?
            .insert(id.clone(), job);
        let jobs = state.jobs.clone();
        let children = state.children.clone();
        let yt_dlp_path = state
            .settings
            .lock()
            .map_err(|_| "Settings are unavailable.".to_string())?
            .yt_dlp_path
            .clone();
        let thread_id = id.clone();
        thread::spawn(move || {
            let output_template = dir.join("%(title)s.%(ext)s");
            let template = output_template.to_string_lossy().to_string();
            let mut args = vec![
                "--newline",
                "--no-warnings",
                "--progress",
                "--progress-template",
                "download:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta)s",
                "-o",
                &template,
            ];
            if media_type == "audio" {
                args.extend(["-x", "--audio-format", &format]);
            } else {
                args.extend(["--merge-output-format", &format]);
            }
            args.push(&url);
            let spawn = Command::new(yt_dlp_path)
                .args(args)
                .stdout(Stdio::piped())
                .stderr(Stdio::inherit())
                .spawn();
            let Ok(mut child) = spawn else {
                update_job(
                    &jobs,
                    &thread_id,
                    "Failed",
                    0,
                    "yt-dlp could not be started",
                    "--:--",
                );
                return;
            };
            let stdout = child.stdout.take();
            if let Some(stdout) = stdout {
                let progress_jobs = jobs.clone();
                let progress_id = thread_id.clone();
                thread::spawn(move || {
                    use std::io::{BufRead, BufReader};
                    for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                        if let Some(value) = line.strip_prefix("download:") {
                            let fields: Vec<&str> = value.split('|').collect();
                            let progress = fields
                                .first()
                                .and_then(|v| v.trim().trim_end_matches('%').parse::<f32>().ok())
                                .unwrap_or(0.0)
                                .clamp(0.0, 100.0) as u8;
                            update_job(
                                &progress_jobs,
                                &progress_id,
                                "Running",
                                progress,
                                fields.get(1).copied().unwrap_or(""),
                                fields.get(2).copied().unwrap_or("--:--"),
                            );
                        }
                    }
                });
            }
            if let Ok(mut map) = children.lock() {
                map.insert(thread_id.clone(), child);
            }
            let status = loop {
                thread::sleep(std::time::Duration::from_millis(150));
                let result = children
                    .lock()
                    .ok()
                    .and_then(|mut map| map.get_mut(&thread_id).and_then(|c| c.try_wait().ok()));
                if let Some(result) = result {
                    break result;
                }
            };
            let success = status.map(|value| value.success()).unwrap_or(false);
            if success {
                update_job(&jobs, &thread_id, "Completed", 100, "", "00:00");
            } else if jobs
                .lock()
                .ok()
                .and_then(|m| m.get(&thread_id).map(|j| j.state.clone()))
                .as_deref()
                != Some("Cancelled")
            {
                update_job(
                    &jobs,
                    &thread_id,
                    "Failed",
                    0,
                    "yt-dlp download failed",
                    "--:--",
                );
            }
            if let Ok(mut map) = children.lock() {
                map.remove(&thread_id);
            }
            let _ = app.emit("download-finished", thread_id);
        });
        Ok(id)
    }

    #[tauri::command]
    pub fn cancel_download(state: tauri::State<'_, AppState>, id: String) -> Result<(), String> {
        let mut children = state
            .children
            .lock()
            .map_err(|_| "Download state is unavailable.".to_string())?;
        if let Some(child) = children.get_mut(&id) {
            child
                .kill()
                .map_err(|e| format!("Unable to cancel download: {e}"))?;
        }
        update_job(&state.jobs, &id, "Cancelled", 0, "", "--:--");
        Ok(())
    }

    #[tauri::command]
    pub fn play_media(state: tauri::State<'_, AppState>, url: String) -> Result<(), String> {
        let url = youtube_url(&url)?;
        let mpv_path = state
            .settings
            .lock()
            .map_err(|_| "Settings are unavailable.".to_string())?
            .mpv_path
            .clone();
        Command::new(mpv_path)
            .arg("--")
            .arg(url)
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("Unable to start mpv: {e}"))
    }

    #[tauri::command]
    pub fn get_library() -> Vec<MediaLibraryEntry> {
        Vec::new()
    }
    #[tauri::command]
    pub fn get_history() -> Vec<HistoryEntry> {
        Vec::new()
    }
}

fn update_job(
    jobs: &Arc<Mutex<HashMap<String, DownloadJob>>>,
    id: &str,
    state: &str,
    progress: u8,
    speed: &str,
    eta: &str,
) {
    if let Ok(mut map) = jobs.lock() {
        if let Some(job) = map.get_mut(id) {
            job.state = state.into();
            job.progress = progress;
            job.speed = speed.into();
            job.eta = eta.into();
        }
    }
}

pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::dependency_status,
            commands::validate_url,
            commands::search_videos,
            commands::get_metadata,
            commands::get_settings,
            commands::save_settings,
            commands::get_download_jobs,
            commands::download_media,
            commands::cancel_download,
            commands::play_media,
            commands::get_library,
            commands::get_history
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}

#[cfg(test)]
mod tests {
    use super::youtube_url;
    #[test]
    fn accepts_youtube_video_url() {
        assert!(youtube_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ").is_ok());
    }
    #[test]
    fn rejects_non_youtube_url() {
        assert!(youtube_url("https://example.com/video.mp4").is_err());
    }
}

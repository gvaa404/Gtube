use serde::{Deserialize, Serialize};
use std::process::Command;

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

mod commands {
  use super::{AppSettings, DependencyStatus, DownloadJob, HistoryEntry, MediaLibraryEntry};

  #[tauri::command]
  pub fn dependency_status() -> Vec<DependencyStatus> {
    vec![
      super::detect_tool("yt-dlp", &["--version"]),
      super::detect_tool("ffmpeg", &["-version"]),
      super::detect_tool("ffprobe", &["-version"]),
      super::detect_tool("mpv", &["--version"]),
    ]
  }

  #[tauri::command]
  pub fn validate_url(url: String) -> Result<String, String> {
    super::validate_media_url(&url)
  }

  #[tauri::command]
  pub fn get_settings() -> AppSettings {
    AppSettings {
      default_download_dir: "~/Downloads/GTube".to_string(),
      preferred_audio_format: "mp3".to_string(),
      preferred_video_format: "mp4".to_string(),
      default_quality: "1080p".to_string(),
      download_concurrency: 1,
      ffmpeg_path: "ffmpeg".to_string(),
      yt_dlp_path: "yt-dlp".to_string(),
      mpv_path: "mpv".to_string(),
      theme: "dark".to_string(),
    }
  }

  #[tauri::command]
  pub fn save_settings(settings: AppSettings) -> Result<AppSettings, String> {
    if settings.default_download_dir.trim().is_empty() {
      return Err("Download directory is required".to_string());
    }
    Ok(settings)
  }

  #[tauri::command]
  pub fn get_download_jobs() -> Vec<DownloadJob> {
    vec![
      DownloadJob {
        id: "job-1".to_string(),
        title: "Synthwave Live Session".to_string(),
        state: "Running".to_string(),
        progress: 72,
        speed: "3.1 MB/s".to_string(),
        eta: "00:42".to_string(),
        format: "mp3".to_string(),
        destination: "~/Downloads/GTube".to_string(),
      },
      DownloadJob {
        id: "job-2".to_string(),
        title: "Deep Space Documentary".to_string(),
        state: "Queued".to_string(),
        progress: 18,
        speed: "0.0 KB/s".to_string(),
        eta: "--:--".to_string(),
        format: "mp4".to_string(),
        destination: "~/Downloads/GTube".to_string(),
      },
    ]
  }

  #[tauri::command]
  pub fn get_library() -> Vec<MediaLibraryEntry> {
    vec![
      MediaLibraryEntry {
        id: "lib-1".to_string(),
        title: "Night Drive".to_string(),
        kind: "audio".to_string(),
        path: "~/Music/Night Drive.mp3".to_string(),
        size: "6.2 MB".to_string(),
      },
      MediaLibraryEntry {
        id: "lib-2".to_string(),
        title: "City Lights".to_string(),
        kind: "video".to_string(),
        path: "~/Videos/City Lights.mp4".to_string(),
        size: "128 MB".to_string(),
      },
    ]
  }

  #[tauri::command]
  pub fn get_history() -> Vec<HistoryEntry> {
    vec![
      HistoryEntry {
        id: "hist-1".to_string(),
        title: "After Sunset mix".to_string(),
        result: "Completed".to_string(),
        timestamp: "Today, 18:42".to_string(),
      },
      HistoryEntry {
        id: "hist-2".to_string(),
        title: "Launch sequence".to_string(),
        result: "Failed".to_string(),
        timestamp: "Yesterday, 21:10".to_string(),
      },
    ]
  }
}

fn detect_tool(tool_name: &str, version_args: &[&str]) -> DependencyStatus {
  let which = Command::new("which").arg(tool_name).output();
  let path = match which {
    Ok(status) if status.status.success() => {
      let output = String::from_utf8_lossy(&status.stdout).trim().to_string();
      if output.is_empty() { "not found".to_string() } else { output }
    }
    _ => "not found".to_string(),
  };

  let available = matches!(Command::new(tool_name).args(version_args).output(), Ok(output) if output.status.success());
  let version = if available {
    match Command::new(tool_name).args(version_args).output() {
      Ok(output) => String::from_utf8_lossy(&output.stdout).lines().next().unwrap_or("unknown").to_string(),
      Err(_) => "unknown".to_string(),
    }
  } else {
    "missing".to_string()
  };

  DependencyStatus {
    name: tool_name.to_string(),
    available,
    path,
    version,
  }
}

pub fn validate_media_url(input: &str) -> Result<String, String> {
  let value = input.trim();
  if value.is_empty() {
    return Err("URL is required".to_string());
  }
  if !value.starts_with("http://") && !value.starts_with("https://") {
    return Err("URL must start with http:// or https://".to_string());
  }
  Ok(value.to_string())
}

pub fn job_state_after_event(state: &str, event: &str) -> String {
  match (state, event) {
    ("Waiting", "start") | ("Queued", "start") => "Running".to_string(),
    ("Running", "cancel") => "Cancelling".to_string(),
    _ => state.to_string(),
  }
}

#[cfg(test)]
mod tests {
  use super::{job_state_after_event, validate_media_url};

  #[test]
  fn validates_supported_media_urls() {
    assert!(validate_media_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ").is_ok());
    assert!(validate_media_url("https://example.com/video.mp4").is_ok());
    assert!(validate_media_url("not-a-url").is_err());
  }

  #[test]
  fn updates_job_state_safely() {
    let next = job_state_after_event("Waiting", "start");
    assert_eq!(next, "Running");
    let final_state = job_state_after_event("Running", "cancel");
    assert_eq!(final_state, "Cancelling");
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
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
      commands::get_settings,
      commands::save_settings,
      commands::get_download_jobs,
      commands::get_library,
      commands::get_history
    ])
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}

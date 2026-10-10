import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import './App.css'

type Section = 'home' | 'music' | 'videos' | 'downloads' | 'library' | 'history' | 'settings'

type DependencyInfo = {
  name: string
  available: boolean
  path: string
  version: string
}

type Settings = {
  default_download_dir: string
  preferred_audio_format: string
  preferred_video_format: string
  default_quality: string
  download_concurrency: number
  ffmpeg_path: string
  yt_dlp_path: string
  mpv_path: string
  theme: string
}

type DownloadJob = {
  id: string
  title: string
  state: string
  progress: number
  speed: string
  eta: string
  format: string
  destination: string
}

type MediaItem = {
  id: string
  title: string
  kind: string
  path: string
  size: string
}

type HistoryItem = {
  id: string
  title: string
  result: string
  timestamp: string
}

const navItems: { key: Section; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'music', label: 'Music' },
  { key: 'videos', label: 'Videos' },
  { key: 'downloads', label: 'Downloads' },
  { key: 'library', label: 'Library' },
  { key: 'history', label: 'History' },
  { key: 'settings', label: 'Settings' },
]

const defaultSettings: Settings = {
  default_download_dir: '~/Downloads/GTube',
  preferred_audio_format: 'mp3',
  preferred_video_format: 'mp4',
  default_quality: '1080p',
  download_concurrency: 1,
  ffmpeg_path: 'ffmpeg',
  yt_dlp_path: 'yt-dlp',
  mpv_path: 'mpv',
  theme: 'dark',
}

const defaultDependencies: DependencyInfo[] = [
  { name: 'yt-dlp', available: false, path: 'not found', version: 'missing' },
  { name: 'ffmpeg', available: false, path: 'not found', version: 'missing' },
  { name: 'ffprobe', available: false, path: 'not found', version: 'missing' },
  { name: 'mpv', available: false, path: 'not found', version: 'missing' },
]

const recentDownloads = [
  { id: 'dl-1', title: 'Midnight Signal', format: 'MP3' },
  { id: 'dl-2', title: 'Orbit Timeline', format: 'MP4' },
]

const recentTracks = [
  { id: 'track-1', title: 'Neon Harbor', artist: 'Astra Vale', duration: '3:42' },
  { id: 'track-2', title: 'Sunset Circuit', artist: 'Luma Run', duration: '4:18' },
]

const queueItems = [
  { id: 'q-1', title: 'Aurora Line', type: 'Audio' },
  { id: 'q-2', title: 'Horizon Flight', type: 'Video' },
]

const videoCandidates = ['1080p MP4', '720p MP4', 'Audio only (m4a)']

const defaultJobs: DownloadJob[] = [
  { id: 'job-1', title: 'Synthwave Live Session', state: 'Running', progress: 72, speed: '3.1 MB/s', eta: '00:42', format: 'mp3', destination: '~/Downloads/GTube' },
  { id: 'job-2', title: 'Deep Space Documentary', state: 'Queued', progress: 18, speed: '0.0 KB/s', eta: '--:--', format: 'mp4', destination: '~/Downloads/GTube' },
]

const defaultLibrary: MediaItem[] = [
  { id: 'lib-1', title: 'Night Drive', kind: 'audio', path: '~/Music/Night Drive.mp3', size: '6.2 MB' },
  { id: 'lib-2', title: 'City Lights', kind: 'video', path: '~/Videos/City Lights.mp4', size: '128 MB' },
]

const defaultHistory: HistoryItem[] = [
  { id: 'hist-1', title: 'After Sunset mix', result: 'Completed', timestamp: 'Today, 18:42' },
  { id: 'hist-2', title: 'Launch sequence', result: 'Failed', timestamp: 'Yesterday, 21:10' },
]

function App() {
  const [section, setSection] = useState<Section>('home')
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [dependencies, setDependencies] = useState<DependencyInfo[]>(defaultDependencies)
  const [jobs, setJobs] = useState<DownloadJob[]>(defaultJobs)
  const [library, setLibrary] = useState<MediaItem[]>(defaultLibrary)
  const [history, setHistory] = useState<HistoryItem[]>(defaultHistory)
  const [urlInput, setUrlInput] = useState('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  const [statusMessage, setStatusMessage] = useState('Ready for media discovery and downloads.')

  useEffect(() => {
    const loadAppState = async () => {
      try {
        const dependencyResult = await invoke<DependencyInfo[]>('dependency_status')
        if (Array.isArray(dependencyResult) && dependencyResult.length > 0) {
          setDependencies(dependencyResult)
        }
      } catch {
        setDependencies(defaultDependencies)
      }

      try {
        const settingsResult = await invoke<Settings>('get_settings')
        setSettings(settingsResult)
      } catch {
        setSettings(defaultSettings)
      }

      try {
        const jobsResult = await invoke<DownloadJob[]>('get_download_jobs')
        if (Array.isArray(jobsResult) && jobsResult.length > 0) {
          setJobs(jobsResult)
        }
      } catch {
        setJobs(defaultJobs)
      }

      try {
        const libraryResult = await invoke<MediaItem[]>('get_library')
        if (Array.isArray(libraryResult) && libraryResult.length > 0) {
          setLibrary(libraryResult)
        }
      } catch {
        setLibrary(defaultLibrary)
      }

      try {
        const historyResult = await invoke<HistoryItem[]>('get_history')
        if (Array.isArray(historyResult) && historyResult.length > 0) {
          setHistory(historyResult)
        }
      } catch {
        setHistory(defaultHistory)
      }
    }

    void loadAppState()
  }, [])

  const checkUrl = async () => {
    try {
      const validUrl = await invoke<string>('validate_url', { url: urlInput })
      setStatusMessage(`Validated URL: ${validUrl}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The provided URL is invalid.'
      setStatusMessage(message)
    }
  }

  const saveSettings = async () => {
    try {
      const saved = await invoke<Settings>('save_settings', { settings })
      setSettings(saved)
      setStatusMessage('Settings saved successfully.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save settings.'
      setStatusMessage(message)
    }
  }

  const renderHome = () => (
    <div className="content-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Home</p>
          <h2>Discover and download media</h2>
        </div>
        <button className="primary-button" type="button">
          Quick download
        </button>
      </div>

      <div className="search-grid">
        <label className="input-block wide">
          <span>Search</span>
          <input type="text" placeholder="Search music, videos, or playlists" />
        </label>
        <label className="input-block wide">
          <span>Paste media URL</span>
          <input
            type="url"
            value={urlInput}
            onChange={(event) => setUrlInput(event.target.value)}
            placeholder="https://..."
          />
        </label>
        <button className="secondary-button" type="button" onClick={checkUrl}>
          Validate URL
        </button>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <p>Recent downloads</p>
          {recentDownloads.map((item) => (
            <div key={item.id} className="mini-row">
              <span>{item.title}</span>
              <strong>{item.format}</strong>
            </div>
          ))}
        </div>
        <div className="metric-card">
          <p>Recently played</p>
          {recentTracks.map((item) => (
            <div key={item.id} className="mini-row">
              <span>{item.title}</span>
              <strong>{item.duration}</strong>
            </div>
          ))}
        </div>
        <div className="metric-card">
          <p>Quick actions</p>
          <div className="action-buttons">
            <button type="button">Download audio</button>
            <button type="button">Download video</button>
            <button type="button">Open library</button>
          </div>
        </div>
      </div>

      <div className="status-banner">{statusMessage}</div>
    </div>
  )

  const renderMusic = () => (
    <div className="content-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Music</p>
          <h2>Library and discovery</h2>
        </div>
        <button className="primary-button" type="button">
          Add from URL
        </button>
      </div>

      <div className="queue-panel">
        {recentTracks.map((track) => (
          <div key={track.id} className="track-row">
            <div>
              <strong>{track.title}</strong>
              <small>{track.artist}</small>
            </div>
            <div className="track-action">
              <span>{track.duration}</span>
              <button type="button">Play</button>
            </div>
          </div>
        ))}
      </div>

      <div className="queue-panel compact">
        <h3>Up next</h3>
        {queueItems.map((item) => (
          <div key={item.id} className="track-row">
            <div>
              <strong>{item.title}</strong>
              <small>{item.type}</small>
            </div>
            <button type="button">Queue</button>
          </div>
        ))}
      </div>

      <div className="mini-player">
        <div>
          <p>Now playing</p>
          <strong>Neon Harbor</strong>
        </div>
        <div className="player-controls">
          <button type="button">⏮</button>
          <button type="button">⏸</button>
          <button type="button">⏭</button>
        </div>
        <input type="range" min="0" max="100" defaultValue="55" />
      </div>
    </div>
  )

  const renderVideos = () => (
    <div className="content-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Videos</p>
          <h2>Playback and format inspection</h2>
        </div>
        <button className="primary-button" type="button">
          Inspect source
        </button>
      </div>

      <div className="video-preview">
        <div className="video-thumb" />
        <div className="video-meta">
          <h3>Night drive over the city</h3>
          <p>Available formats</p>
          <ul>
            {videoCandidates.map((candidate) => (
              <li key={candidate}>{candidate}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="search-grid single-row">
        <label className="input-block wide">
          <span>Video URL</span>
          <input type="url" value={urlInput} onChange={(event) => setUrlInput(event.target.value)} />
        </label>
        <button className="secondary-button" type="button" onClick={checkUrl}>Play</button>
      </div>
    </div>
  )

  const renderDownloads = () => (
    <div className="content-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Downloads</p>
          <h2>Queue and history</h2>
        </div>
      </div>

      <div className="jobs-list">
        {jobs.map((job) => (
          <div key={job.id} className="job-card">
            <div className="job-header">
              <strong>{job.title}</strong>
              <span className="tag">{job.state}</span>
            </div>
            <div className="progress-wrap">
              <div className="progress-bar" style={{ width: `${job.progress}%` }} />
            </div>
            <div className="job-meta">
              <span>{job.progress}%</span>
              <span>{job.speed}</span>
              <span>ETA {job.eta}</span>
            </div>
            <div className="job-footer">
              <span>{job.format}</span>
              <span>{job.destination}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const renderLibrary = () => (
    <div className="content-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Library</p>
          <h2>Local media files</h2>
        </div>
      </div>

      <div className="library-grid">
        {library.map((item) => (
          <div key={item.id} className="library-card">
            <div className="library-type">{item.kind}</div>
            <h3>{item.title}</h3>
            <p>{item.path}</p>
            <div className="library-actions">
              <button type="button">Open</button>
              <button type="button">Folder</button>
              <span>{item.size}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const renderHistory = () => (
    <div className="content-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">History</p>
          <h2>Past downloads and results</h2>
        </div>
      </div>

      <div className="history-list">
        {history.map((entry) => (
          <div key={entry.id} className="history-row">
            <div>
              <strong>{entry.title}</strong>
              <small>{entry.timestamp}</small>
            </div>
            <span className={`result ${entry.result.toLowerCase()}`}>{entry.result}</span>
          </div>
        ))}
      </div>
    </div>
  )

  const renderSettings = () => (
    <div className="content-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h2>Preferences and paths</h2>
        </div>
        <button className="primary-button" type="button" onClick={saveSettings}>Save</button>
      </div>

      <div className="settings-grid">
        <label className="input-block">
          <span>Default directory</span>
          <input value={settings.default_download_dir} onChange={(event) => setSettings({ ...settings, default_download_dir: event.target.value })} />
        </label>
        <label className="input-block">
          <span>Audio format</span>
          <select value={settings.preferred_audio_format} onChange={(event) => setSettings({ ...settings, preferred_audio_format: event.target.value })}>
            <option value="mp3">MP3</option>
            <option value="m4a">M4A</option>
            <option value="flac">FLAC</option>
          </select>
        </label>
        <label className="input-block">
          <span>Video format</span>
          <select value={settings.preferred_video_format} onChange={(event) => setSettings({ ...settings, preferred_video_format: event.target.value })}>
            <option value="mp4">MP4</option>
            <option value="webm">WebM</option>
          </select>
        </label>
        <label className="input-block">
          <span>Default quality</span>
          <select value={settings.default_quality} onChange={(event) => setSettings({ ...settings, default_quality: event.target.value })}>
            <option value="720p">720p</option>
            <option value="1080p">1080p</option>
            <option value="best">Best</option>
          </select>
        </label>
        <label className="input-block">
          <span>Concurrency</span>
          <input type="number" min="1" max="4" value={settings.download_concurrency} onChange={(event) => setSettings({ ...settings, download_concurrency: Number(event.target.value) || 1 })} />
        </label>
        <label className="input-block">
          <span>FFmpeg path</span>
          <input value={settings.ffmpeg_path} onChange={(event) => setSettings({ ...settings, ffmpeg_path: event.target.value })} />
        </label>
        <label className="input-block">
          <span>yt-dlp path</span>
          <input value={settings.yt_dlp_path} onChange={(event) => setSettings({ ...settings, yt_dlp_path: event.target.value })} />
        </label>
        <label className="input-block">
          <span>MPV path</span>
          <input value={settings.mpv_path} onChange={(event) => setSettings({ ...settings, mpv_path: event.target.value })} />
        </label>
        <label className="input-block">
          <span>Theme</span>
          <select value={settings.theme} onChange={(event) => setSettings({ ...settings, theme: event.target.value })}>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
      </div>

      <div className="dependency-list">
        {dependencies.map((tool) => (
          <div key={tool.name} className="dependency-item">
            <strong>{tool.name}</strong>
            <span className={tool.available ? 'ok' : 'warn'}>{tool.available ? 'Available' : 'Missing'}</span>
            <small>{tool.version}</small>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">G</div>
          <div>
            <strong>Gtube</strong>
            <small>Desktop media hub</small>
          </div>
        </div>

        <nav className="nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={section === item.key ? 'nav-button active' : 'nav-button'}
              onClick={() => setSection(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-panel">
        {section === 'home' && renderHome()}
        {section === 'music' && renderMusic()}
        {section === 'videos' && renderVideos()}
        {section === 'downloads' && renderDownloads()}
        {section === 'library' && renderLibrary()}
        {section === 'history' && renderHistory()}
        {section === 'settings' && renderSettings()}
      </main>
    </div>
  )
}

export default App

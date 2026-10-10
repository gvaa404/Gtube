import { useEffect, useState, type ReactNode } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import './App.css'

type Section = 'home' | 'music' | 'videos' | 'downloads' | 'library' | 'history' | 'settings'
type DependencyInfo = { name: string; available: boolean; path: string; version: string }
type Settings = { default_download_dir: string; preferred_audio_format: string; preferred_video_format: string; default_quality: string; download_concurrency: number; ffmpeg_path: string; yt_dlp_path: string; mpv_path: string; theme: string }
type DownloadJob = { id: string; title: string; state: string; progress: number; speed: string; eta: string; format: string; destination: string }
type SearchResult = { id: string; title: string; thumbnail: string; duration: string; channel: string; url: string }
type VideoMetadata = { id: string; title: string; thumbnail: string; duration: string; channel: string; webpage_url: string; formats: string[] }

const navItems: { key: Section; label: string }[] = [
  { key: 'home', label: 'Home' }, { key: 'music', label: 'Music' }, { key: 'videos', label: 'Videos' },
  { key: 'downloads', label: 'Downloads' }, { key: 'library', label: 'Library' }, { key: 'history', label: 'History' }, { key: 'settings', label: 'Settings' },
]
const initialSettings: Settings = { default_download_dir: '~/Downloads/GTube', preferred_audio_format: 'mp3', preferred_video_format: 'mp4', default_quality: '1080p', download_concurrency: 1, ffmpeg_path: 'ffmpeg', yt_dlp_path: 'yt-dlp', mpv_path: 'mpv', theme: 'dark' }
const initialDependencies: DependencyInfo[] = ['yt-dlp', 'ffmpeg', 'ffprobe', 'mpv'].map(name => ({ name, available: false, path: 'not found', version: 'missing' }))

function errorText(error: unknown) {
  return typeof error === 'string' ? error : error instanceof Error ? error.message : 'The operation failed.'
}

function App() {
  const [section, setSection] = useState<Section>('home')
  const [settings, setSettings] = useState(initialSettings)
  const [dependencies, setDependencies] = useState(initialDependencies)
  const [jobs, setJobs] = useState<DownloadJob[]>([])
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [urlInput, setUrlInput] = useState('')
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null)
  const [statusMessage, setStatusMessage] = useState('Ready for media discovery and downloads.')
  const [busy, setBusy] = useState(false)

  const refreshJobs = async () => {
    try { setJobs(await invoke<DownloadJob[]>('get_download_jobs')) } catch (error) { setStatusMessage(errorText(error)) }
  }

  useEffect(() => {
    void Promise.all([
      invoke<DependencyInfo[]>('dependency_status').then(setDependencies).catch(error => setStatusMessage(errorText(error))),
      invoke<Settings>('get_settings').then(setSettings).catch(error => setStatusMessage(errorText(error))),
      invoke<DownloadJob[]>('get_download_jobs').then(setJobs).catch(error => setStatusMessage(errorText(error))),
    ])
    const unlisten = listen<string>('download-finished', () => void refreshJobs())
    const polling = window.setInterval(() => {
      void invoke<DownloadJob[]>('get_download_jobs').then(setJobs).catch(error => setStatusMessage(errorText(error)))
    }, 1000)
    return () => {
      window.clearInterval(polling)
      void unlisten.then(stop => stop())
    }
  }, [])

  const searchVideos = async () => {
    if (!search.trim()) { setStatusMessage('Enter a search term.'); return }
    setBusy(true); setStatusMessage('Searching YouTube…')
    try { setResults(await invoke<SearchResult[]>('search_videos', { query: search })); setStatusMessage('Search complete.') } catch (error) { setStatusMessage(errorText(error)) } finally { setBusy(false) }
  }
  const inspect = async () => {
    setBusy(true)
    try { setMetadata(await invoke<VideoMetadata>('get_metadata', { url: urlInput })); setStatusMessage('Metadata loaded.') } catch (error) { setStatusMessage(errorText(error)) } finally { setBusy(false) }
  }
  const validate = async () => {
    try { setStatusMessage(`Validated URL: ${await invoke<string>('validate_url', { url: urlInput })}`) } catch (error) { setStatusMessage(errorText(error)) }
  }
  const download = async (url: string, mediaType: 'audio' | 'video') => {
    try {
      const format = mediaType === 'audio' ? settings.preferred_audio_format : settings.preferred_video_format
      await invoke('download_media', { url, destination: settings.default_download_dir, media_type: mediaType, format })
      setSection('downloads'); setStatusMessage('Download started. Progress will update from yt-dlp.'); await refreshJobs()
    } catch (error) { setStatusMessage(errorText(error)) }
  }
  const play = async (url: string) => {
    try { await invoke('play_media', { url }); setStatusMessage('Opened media in MPV.') } catch (error) { setStatusMessage(errorText(error)) }
  }

  const searchPanel = <><div className="search-grid">
    <label className="input-block wide"><span>Search YouTube</span><input value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void searchVideos() }} placeholder="Search music, videos, or playlists" /></label>
    <label className="input-block wide"><span>Paste YouTube URL</span><input type="url" value={urlInput} onChange={event => setUrlInput(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." /></label>
    <button className="secondary-button" type="button" onClick={searchVideos} disabled={busy}>Search</button>
  </div>
  <div className="search-grid single-row"><span /><div className="action-buttons inline"><button type="button" onClick={validate}>Validate URL</button><button type="button" onClick={inspect} disabled={busy}>Inspect metadata</button></div></div>
  {results.length > 0 && <div className="results-list">{results.map(result => <article className="result-card" key={result.id}><img src={result.thumbnail} alt="" /><div><strong>{result.title}</strong><small>{result.channel} · {result.duration}</small><div className="action-buttons inline"><button type="button" onClick={() => void play(result.url)}>Play</button><button type="button" onClick={() => void download(result.url, 'audio')}>Audio</button><button type="button" onClick={() => void download(result.url, 'video')}>Video</button></div></div></article>)}</div>}
  {metadata && <div className="video-preview"><img src={metadata.thumbnail} alt="" /><div className="video-meta"><h3>{metadata.title}</h3><p>{metadata.channel} · {metadata.duration}</p><p>Formats: {metadata.formats.slice(0, 8).join(', ') || 'reported by yt-dlp'}</p><div className="action-buttons inline"><button type="button" onClick={() => void play(metadata.webpage_url)}>Play</button><button type="button" onClick={() => void download(metadata.webpage_url, 'audio')}>Download audio</button><button type="button" onClick={() => void download(metadata.webpage_url, 'video')}>Download video</button></div></div></div>}</>

  const renderDownloads = () => <div className="content-panel"><div className="panel-header"><div><p className="eyebrow">Downloads</p><h2>Live download queue</h2></div><button className="secondary-button" type="button" onClick={() => void refreshJobs()}>Refresh</button></div><div className="jobs-list">{jobs.length === 0 ? <p>No downloads yet.</p> : jobs.map(job => <div className="job-card" key={job.id}><div className="job-header"><strong>{job.title}</strong><span className="tag">{job.state}</span></div><div className="progress-wrap"><div className="progress-bar" style={{ width: `${job.progress}%` }} /></div><div className="job-meta"><span>{job.progress}%</span><span>{job.speed}</span><span>ETA {job.eta}</span>{job.state === 'Running' && <button type="button" onClick={() => void invoke('cancel_download', { id: job.id }).then(refreshJobs).catch(error => setStatusMessage(errorText(error)))}>Cancel</button>}{(job.state === 'Failed' || job.state === 'Cancelled') && <button type="button" onClick={() => void download(job.title, job.format === 'mp3' || job.format === 'm4a' || job.format === 'flac' ? 'audio' : 'video')}>Retry</button>}</div><div className="job-footer"><span>{job.format}</span><span>{job.destination}</span></div></div>)}</div></div>
  const renderSettings = () => <div className="content-panel"><div className="panel-header"><div><p className="eyebrow">Settings</p><h2>Preferences and paths</h2></div><button className="primary-button" type="button" onClick={() => void invoke<Settings>('save_settings', { settings }).then(setSettings).then(() => setStatusMessage('Settings saved.')).catch(error => setStatusMessage(errorText(error)))}>Save</button></div><div className="settings-grid">
    {([['default_download_dir', 'Default directory'], ['ffmpeg_path', 'FFmpeg path'], ['yt_dlp_path', 'yt-dlp path'], ['mpv_path', 'MPV path']] as const).map(([key, label]) => <label className="input-block" key={key}><span>{label}</span><input value={settings[key]} onChange={event => setSettings({ ...settings, [key]: event.target.value })} /></label>)}
    <label className="input-block"><span>Audio format</span><select value={settings.preferred_audio_format} onChange={event => setSettings({ ...settings, preferred_audio_format: event.target.value })}><option>mp3</option><option>m4a</option><option>flac</option></select></label><label className="input-block"><span>Video format</span><select value={settings.preferred_video_format} onChange={event => setSettings({ ...settings, preferred_video_format: event.target.value })}><option>mp4</option><option>webm</option></select></label>
  </div><div className="dependency-list">{dependencies.map(tool => <div className="dependency-item" key={tool.name}><strong>{tool.name}</strong><span className={tool.available ? 'ok' : 'warn'}>{tool.available ? 'Available' : 'Missing'}</span><small>{tool.version} · {tool.path}</small></div>)}</div></div>

  let content: ReactNode
  if (section === 'downloads') content = renderDownloads()
  else if (section === 'settings') content = renderSettings()
  else content = <div className="content-panel"><div className="panel-header"><div><p className="eyebrow">{section}</p><h2>Discover and download media</h2></div></div>{searchPanel}<div className="status-banner">{statusMessage}</div></div>
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark">G</div><div><strong>Gtube</strong><small>Desktop media hub</small></div></div><nav className="nav">{navItems.map(item => <button key={item.key} type="button" className={section === item.key ? 'nav-button active' : 'nav-button'} onClick={() => setSection(item.key)}>{item.label}</button>)}</nav></aside><main className="main-panel">{content}</main></div>
}

export default App

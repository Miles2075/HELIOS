import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  Code2,
  ExternalLink,
  Eye,
  FileAudio,
  Film,
  Image as ImageIcon,
  Layers,
  Loader2,
  LocateFixed,
  Maximize2,
  Mic,
  Pause,
  Play,
  Presentation,
  RefreshCw,
  Search,
  Sigma,
  Sparkles,
  Upload,
  Video,
  Volume2,
  X,
} from 'lucide-react'
import {
  createSampleWavFile,
  extractLectureVisuals,
  getLectureAudioUrl,
  getLectureVisuals,
  getVisualImageUrl,
  importYouTubeLecture,
  listLectures,
  searchLecture,
  transcribeLecture,
  uploadLecture,
} from '../api/client'

function formatTimestamp(sec) {
  const s = Math.max(0, Number(sec) || 0)
  const mins = Math.floor(s / 60)
  const rem = (s % 60).toFixed(1).padStart(4, '0')
  return `${String(mins).padStart(2, '0')}:${rem}`
}

function formatDuration(sec) {
  if (!sec) return '—'
  const mins = Math.floor(sec / 60)
  const rem = Math.round(sec % 60)
  return mins >= 60
    ? `${Math.floor(mins / 60)}h ${mins % 60}m`
    : `${mins}m ${rem}s`
}

export default function LectureSync({ backendOnline, onActivity }) {
  const [lectures, setLectures] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [importingYt, setImportingYt] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [error, setError] = useState('')
  const [lastApiPayload, setLastApiPayload] = useState(null)
  const [showJson, setShowJson] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)

  // Visuals extraction state (diagrams, equations, graphs, slides)
  const [visuals, setVisuals] = useState([])
  const [loadingVisuals, setLoadingVisuals] = useState(false)
  const [activeTab, setActiveTab] = useState('split') // 'split' | 'visuals' | 'transcript'
  const [visualFilter, setVisualFilter] = useState('all') // 'all' | 'equation' | 'graph' | 'diagram' | 'slide' | 'whiteboard'
  const [selectedVisualModal, setSelectedVisualModal] = useState(null)
  const [autoSync, setAutoSync] = useState(true)
  const [visibleLimit, setVisibleLimit] = useState(150)

  const fileInputRef = useRef(null)
  const audioRef = useRef(null)
  const videoRef = useRef(null)
  const activeTranscriptRef = useRef(null)
  const activeVisualRef = useRef(null)

  useEffect(() => {
    let active = true
    listLectures()
      .then((rows) => {
        if (!active || !rows.length) return
        const mapped = rows.map((r) => ({
          ...r,
          sizeKb: r.size_kb || 0,
          audioUrl: getLectureAudioUrl(r.lecture_id),
        }))
        setLectures(mapped)
        setSelectedId((prev) => prev ?? mapped[0].lecture_id)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selectedId) return
    let active = true
    getLectureVisuals(selectedId)
      .then((items) => {
        if (active) setVisuals(items || [])
      })
      .catch(() => {
        if (active) setVisuals([])
      })
    return () => {
      active = false
    }
  }, [selectedId])

  const handleExtractVisuals = async () => {
    if (!selectedLecture) return
    setError('')
    setLoadingVisuals(true)
    try {
      const items = await extractLectureVisuals(selectedLecture.lecture_id)
      setVisuals(items || [])
      if (items && items.length > 0) {
        setActiveTab('split')
      }
      setLastApiPayload({
        endpoint: `POST /api/lecture/${selectedLecture.lecture_id}/extract-visuals`,
        response: { count: items.length, visuals: items },
      })
      onActivity?.(
        `Extracted ${items.length} visual items from '${selectedLecture.filename}'`,
        'lecture',
        'lecture-sync'
      )
    } catch (err) {
      setError(err.message || 'Visual extraction failed.')
    } finally {
      setLoadingVisuals(false)
    }
  }

  const selectedLecture = lectures.find((l) => l.lecture_id === selectedId) || null

  // Intelligent Tab Defaulting & Window Reset
  useEffect(() => {
    setVisibleLimit(150)
    if (!selectedLecture) return
    const isVideo = isVideoFile(selectedLecture.filename)
    if (!isVideo) {
      setActiveTab('transcript')
    } else if (visuals.length === 0 && activeTab === 'visuals') {
      setActiveTab('transcript')
    }
  }, [selectedId, visuals.length])

  // Playback Auto-Sync: Gently scroll active slide & transcript segment into view
  useEffect(() => {
    if (!autoSync || !isPlaying) return
    activeTranscriptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    activeVisualRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [currentTime, autoSync, isPlaying])

  // Expand visible segment window if playback approaches the end of rendered range
  useEffect(() => {
    if (!selectedLecture?.segments?.length) return
    const curIdx = selectedLecture.segments.findIndex(
      (s) => currentTime >= s.start_time && currentTime < s.end_time
    )
    if (curIdx >= visibleLimit - 25) {
      setVisibleLimit((v) => Math.max(v, curIdx + 120))
    }
  }, [currentTime, visibleLimit, selectedLecture?.segments])

  const handleFileUpload = async (file) => {
    if (!file) return
    setError('')
    setUploading(true)
    try {
      const res = await uploadLecture(file)
      const audioUrl = getLectureAudioUrl(res.lecture_id)
      const newLecture = {
        lecture_id: res.lecture_id,
        filename: res.filename,
        status: 'uploaded',
        duration: 0,
        segments: [],
        audioUrl,
        sizeKb: Math.max(1, Math.round(file.size / 1024)),
      }
      setLectures((prev) => [newLecture, ...prev])
      setSelectedId(res.lecture_id)
      setSearchResults(null)
      setQuery('')
      setLastApiPayload({ endpoint: 'POST /api/lecture/upload', response: res })
      onActivity?.(`Uploaded lecture '${res.filename}'`, 'lecture', 'lecture-sync')
    } catch (err) {
      setError(err.message || 'Failed to upload lecture.')
    } finally {
      setUploading(false)
    }
  }

  const handleYouTubeImport = async (e) => {
    e?.preventDefault()
    const url = youtubeUrl.trim()
    if (!url) return
    setError('')
    setImportingYt(true)
    try {
      const res = await importYouTubeLecture(url)
      const audioUrl = getLectureAudioUrl(res.lecture_id)
      const newLecture = {
        lecture_id: res.lecture_id,
        filename: res.filename,
        status: 'uploaded',
        duration: 0,
        segments: [],
        audioUrl,
        sizeKb: 0,
      }
      setLectures((prev) => [newLecture, ...prev])
      setSelectedId(res.lecture_id)
      setSearchResults(null)
      setQuery('')
      setYoutubeUrl('')
      setLastApiPayload({ endpoint: 'POST /api/lecture/youtube', response: res })
      onActivity?.(`Imported YouTube video '${res.filename}'`, 'lecture', 'lecture-sync')
    } catch (err) {
      setError(err.message || 'Failed to import YouTube video.')
    } finally {
      setImportingYt(false)
    }
  }

  const isVideoFile = (filename = '') => {
    const ext = filename.split('.').pop()?.toLowerCase()
    return ['mp4', 'webm', 'mov', 'mkv'].includes(ext)
  }

  const handleTranscribe = async (lectureId, force = false) => {
    setError('')
    setTranscribing(true)
    try {
      const res = await transcribeLecture(lectureId, force)
      setLectures((prev) =>
        prev.map((l) =>
          l.lecture_id === lectureId
            ? {
                ...l,
                status: res.status,
                duration: res.duration,
                segments: res.segments || [],
              }
            : l
        )
      )
      setSearchResults(null)
      setLastApiPayload({ endpoint: 'POST /api/lecture/transcribe', response: res })
      const lec = lectures.find((l) => l.lecture_id === lectureId)
      onActivity?.(
        `Transcribed ${lec?.filename || `Lecture #${lectureId}`}`,
        'lecture',
        'lecture-sync'
      )
    } catch (err) {
      if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        setError(
          'Transcription is processing on the backend in a worker thread. For long lectures (>30 mins), Whisper takes a few moments. Re-fetching status...'
        )
        try {
          const rows = await listLectures()
          if (rows?.length) {
            setLectures(
              rows.map((r) => ({
                ...r,
                sizeKb: r.size_kb || 0,
                audioUrl: getLectureAudioUrl(r.lecture_id),
              }))
            )
          }
        } catch {}
      } else {
        setError(err.message || 'Transcription failed.')
      }
    } finally {
      setTranscribing(false)
    }
  }

  const handleSearch = async (e) => {
    e?.preventDefault()
    if (!selectedLecture) return
    if (!query.trim()) {
      setSearchResults(null)
      return
    }
    setError('')
    setSearching(true)
    try {
      const res = await searchLecture(selectedLecture.lecture_id, query.trim())
      setSearchResults(res.results || [])
      setLastApiPayload({ endpoint: 'POST /api/lecture/search', response: res })
      onActivity?.(`Searched lecture for '${query.trim()}'`, 'lecture', 'lecture-sync')
    } catch (err) {
      setError(err.message || 'Transcript search failed.')
    } finally {
      setSearching(false)
    }
  }

  const handleSampleUpload = async () => {
    const sampleFile = createSampleWavFile(`physics_lecture_${lectures.length + 1}.wav`)
    await handleFileUpload(sampleFile)
  }

  const seekToSegment = (startTime) => {
    const player = videoRef.current || audioRef.current
    if (!player) return
    player.currentTime = startTime
    player.play().catch(() => {})
    setIsPlaying(true)
  }

  const togglePlay = () => {
    const player = videoRef.current || audioRef.current
    if (!player) return
    if (player.paused) {
      player.play().catch(() => {})
      setIsPlaying(true)
    } else {
      player.pause()
      setIsPlaying(false)
    }
  }

  const highlightText = (text, q) => {
    if (!q.trim()) return text
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === q.trim().toLowerCase() ? (
        <mark
          key={i}
          className="px-1 rounded font-semibold"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent-bright)' }}
        >
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

  const displayedSegments = searchResults !== null ? searchResults : selectedLecture?.segments || []
  const isSearching = Boolean(searchResults !== null || (query && query.trim().length > 0))

  const quickChips = useMemo(() => {
    if (!selectedLecture || selectedLecture.status !== 'completed') return []
    const stop = new Set([
      'today', 'discuss', 'about', 'which', 'their', 'there', 'these', 'those',
      'object', 'remains', 'unless', 'acted', 'states', 'using', 'first', 'lecture',
      'audio', 'welcome', 'course', 'harvard', 'introduction', 'programming', 'python'
    ])
    const sampleSegments = (selectedLecture.segments || []).slice(0, 400)
    const words = sampleSegments
      .flatMap((s) => (s.text || '').match(/[A-Za-z]{5,}/g) || [])
      .filter((w) => !stop.has(w.toLowerCase()))
    const dynamic = [...new Set(words.map((w) => w.replace(/[^A-Za-z]/g, '')))].slice(0, 4)
    return dynamic.length > 0 ? dynamic : ['Newton', 'inertia', 'first law']
  }, [selectedLecture?.lecture_id, selectedLecture?.status])

  const filteredVisuals = visuals.filter((v) => {
    const matchesCat = visualFilter === 'all' || v.visual_type === visualFilter
    if (!matchesCat) return false
    if (!query.trim()) return true
    const q = query.trim().toLowerCase()
    return (
      (v.title || '').toLowerCase().includes(q) ||
      (v.description || '').toLowerCase().includes(q) ||
      (v.ocr_text || '').toLowerCase().includes(q) ||
      (v.latex || '').toLowerCase().includes(q) ||
      (v.visual_type || '').toLowerCase().includes(q)
    )
  })

  const getVisualBadge = (type) => {
    switch (type) {
      case 'equation':
        return {
          icon: <Sigma className="w-3.5 h-3.5" />,
          label: 'Equation',
          bg: 'rgba(168, 85, 247, 0.16)',
          border: 'rgba(168, 85, 247, 0.45)',
          text: '#c084fc',
        }
      case 'graph':
        return {
          icon: <BarChart3 className="w-3.5 h-3.5" />,
          label: 'Graph',
          bg: 'rgba(16, 185, 129, 0.16)',
          border: 'rgba(16, 185, 129, 0.45)',
          text: '#34d399',
        }
      case 'diagram':
        return {
          icon: <ImageIcon className="w-3.5 h-3.5" />,
          label: 'Diagram',
          bg: 'rgba(59, 130, 246, 0.16)',
          border: 'rgba(59, 130, 246, 0.45)',
          text: '#60a5fa',
        }
      case 'whiteboard':
        return {
          icon: <Code2 className="w-3.5 h-3.5" />,
          label: 'Board Note',
          bg: 'rgba(244, 63, 94, 0.16)',
          border: 'rgba(244, 63, 94, 0.45)',
          text: '#fb7185',
        }
      default:
        return {
          icon: <Presentation className="w-3.5 h-3.5" />,
          label: 'Slide',
          bg: 'rgba(245, 158, 11, 0.16)',
          border: 'rgba(245, 158, 11, 0.45)',
          text: '#fbbf24',
        }
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* Module Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span
              className="w-9 h-9 rounded-xl flex items-center justify-center border"
              style={{
                background: 'var(--accent-soft)',
                borderColor: 'var(--accent-border)',
                color: 'var(--accent)',
              }}
            >
              <Mic className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold m-0">Lecture Sync</h1>
              <p className="text-xs sm:text-sm m-0" style={{ color: 'var(--text-secondary)' }}>
                Upload MP3/WAV lectures, generate timestamped transcripts, and search audio logs.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border"
            style={{
              background: backendOnline ? 'var(--emerald-soft)' : 'rgba(251, 113, 133, 0.14)',
              borderColor: backendOnline ? 'rgba(52, 211, 153, 0.4)' : 'rgba(251, 113, 133, 0.4)',
              color: backendOnline ? 'var(--emerald)' : 'var(--danger)',
            }}
          >
            <span className="w-2 h-2 rounded-full bg-current animate-soft-pulse" />
            {backendOnline ? 'Live FastAPI Backend (/api/lecture/*)' : 'Backend Offline'}
          </span>

          <button
            type="button"
            onClick={() => setShowJson((s) => !s)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer"
            style={{
              background: showJson ? 'var(--accent-soft)' : 'var(--bg-card)',
              borderColor: showJson ? 'var(--accent-border)' : 'var(--border-subtle)',
              color: showJson ? 'var(--accent-bright)' : 'var(--text-secondary)',
            }}
          >
            <Code2 className="w-3.5 h-3.5" />
            {showJson ? 'Hide API JSON' : 'Inspect API JSON'}
          </button>
        </div>
      </div>

      {error && (
        <div
          className="p-3.5 rounded-xl border flex items-center gap-2.5 text-sm"
          style={{
            background: 'rgba(251, 113, 133, 0.12)',
            borderColor: 'rgba(251, 113, 133, 0.4)',
            color: 'var(--danger)',
          }}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5">
        {/* LEFT COLUMN: Upload & Lecture Library */}
        <div className="flex flex-col gap-4">
          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              handleFileUpload(e.dataTransfer.files?.[0])
            }}
            className="helios-card p-5 text-center transition-all"
            style={{
              borderStyle: 'dashed',
              borderColor: dragOver ? 'var(--accent)' : 'var(--border-strong)',
              background: dragOver ? 'var(--accent-soft)' : 'var(--bg-card)',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav,.mp4,.m4a,.webm,.mov,.mkv,audio/*,video/*"
              className="hidden"
              onChange={(e) => {
                handleFileUpload(e.target.files?.[0])
                e.target.value = ''
              }}
            />

            <div
              className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center border"
              style={{
                background: 'var(--accent-soft)',
                borderColor: 'var(--accent-border)',
                color: 'var(--accent)',
              }}
            >
              {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            </div>

            <h3 className="mt-3 text-sm font-bold m-0">Upload Audio or Video Lecture</h3>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              Drag &amp; drop <strong style={{ color: 'var(--text-primary)' }}>MP3, WAV, MP4, WebM</strong> here
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="helios-btn-primary w-full py-2.5 px-4 rounded-xl text-xs cursor-pointer"
              >
                {uploading ? 'Uploading to FastAPI...' : 'Choose Audio / Video File'}
              </button>

              <button
                type="button"
                disabled={uploading}
                onClick={handleSampleUpload}
                className="w-full py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 cursor-pointer hover:opacity-90"
                style={{
                  background: 'var(--bg-card-elevated)',
                  borderColor: 'var(--border-strong)',
                  color: 'var(--text-primary)',
                }}
              >
                <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
                Generate &amp; Upload Demo Audio
              </button>
            </div>
          </div>

          {/* YouTube Video URL Import */}
          <div className="helios-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Film className="w-4 h-4" style={{ color: 'var(--danger)' }} />
              <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                Import from YouTube
              </span>
            </div>
            <form onSubmit={handleYouTubeImport} className="flex flex-col gap-2">
              <input
                type="text"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-3 py-2 rounded-xl text-xs border outline-none font-mono-code"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border-strong)',
                  color: 'var(--text-primary)',
                }}
              />
              <button
                type="submit"
                disabled={importingYt || !youtubeUrl.trim()}
                className="w-full py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                style={{
                  background: 'var(--accent-soft)',
                  borderColor: 'var(--accent-border)',
                  color: 'var(--accent-bright)',
                }}
              >
                {importingYt ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Extracting YouTube Audio...
                  </>
                ) : (
                  <>
                    <Video className="w-3.5 h-3.5" />
                    Import &amp; Transcribe YouTube
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Uploaded Lectures List */}
          <div className="helios-card p-4">
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-[11px] font-bold tracking-[0.14em] uppercase"
                style={{ color: 'var(--text-secondary)' }}
              >
                UPLOADED LECTURES ({lectures.length})
              </span>
            </div>

            {lectures.length === 0 ? (
              <div className="py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                No lectures uploaded yet. Upload an audio file or click{' '}
                <strong style={{ color: 'var(--accent)' }}>Generate &amp; Upload Demo WAV</strong> to
                test the live backend.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {lectures.map((lec) => {
                  const active = lec.lecture_id === selectedId
                  return (
                    <button
                      key={lec.lecture_id}
                      type="button"
                      onClick={() => {
                        setSelectedId(lec.lecture_id)
                        setSearchResults(null)
                        setQuery('')
                        setIsPlaying(false)
                      }}
                      className="p-3 rounded-xl border text-left transition-all cursor-pointer"
                      style={{
                        background: active ? 'var(--accent-soft)' : 'var(--bg-card-elevated)',
                        borderColor: active ? 'var(--accent-border)' : 'var(--border-subtle)',
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileAudio className="w-4 h-4 shrink-0" style={{ color: 'var(--accent)' }} />
                          <span className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                            {lec.filename}
                          </span>
                        </div>
                        <span
                          className="font-mono-code text-[10px] px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--bg-app)', color: 'var(--text-secondary)' }}
                        >
                          #{lec.lecture_id}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[11px]">
                        <span
                          className="inline-flex items-center gap-1 font-medium"
                          style={{
                            color: lec.status === 'completed' ? 'var(--emerald)' : 'var(--gold)',
                          }}
                        >
                          {lec.status === 'completed' ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          {lec.status === 'completed' ? 'Transcribed' : 'Ready to transcribe'}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {lec.sizeKb ? `${lec.sizeKb} KB` : formatDuration(lec.duration)}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Player, Transcribe, Search & Segments */}
        <div className="flex flex-col gap-4 min-w-0">
          {!selectedLecture ? (
            <div className="helios-card p-10 flex flex-col items-center justify-center text-center min-h-[380px]">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center border mb-4"
                style={{
                  background: 'var(--accent-soft)',
                  borderColor: 'var(--accent-border)',
                  color: 'var(--accent)',
                }}
              >
                <Volume2 className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold m-0">Select or Upload a Lecture</h2>
              <p className="mt-2 text-sm max-w-md" style={{ color: 'var(--text-secondary)' }}>
                This workspace connects directly to your running FastAPI Lecture Sync endpoints (
                <code className="font-mono-code text-xs">/upload</code>,{' '}
                <code className="font-mono-code text-xs">/transcribe</code>, and{' '}
                <code className="font-mono-code text-xs">/search</code>).
              </p>
              <button
                type="button"
                onClick={handleSampleUpload}
                className="helios-btn-primary mt-5 px-5 py-2.5 rounded-xl text-sm inline-flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                Try Live Pipeline with Demo Audio
              </button>
            </div>
          ) : (
            <>
              {/* Audio Player & Transcribe Controls */}
              <div className="helios-card p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-mono-code text-[11px] px-2 py-0.5 rounded-md font-semibold"
                        style={{
                          background: 'var(--accent-soft)',
                          color: 'var(--accent-bright)',
                        }}
                      >
                        Lecture ID {selectedLecture.lecture_id}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Duration: {formatDuration(selectedLecture.duration)}
                      </span>
                    </div>
                    <h2 className="mt-1.5 text-lg font-bold truncate m-0">
                      {selectedLecture.filename}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <button
                      type="button"
                      disabled={loadingVisuals}
                      onClick={handleExtractVisuals}
                      className="px-4 py-2.5 rounded-xl text-xs sm:text-sm inline-flex items-center justify-center gap-2 cursor-pointer font-bold border transition-all"
                      style={{
                        background: 'var(--accent-soft)',
                        borderColor: 'var(--accent)',
                        color: 'var(--accent-bright)',
                      }}
                      title="Extract diagrams, equations, graphs, and lecture slides"
                    >
                      {loadingVisuals ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Extracting Visuals...
                        </>
                      ) : (
                        <>
                          <Presentation className="w-4 h-4" />
                          {visuals.length > 0 ? `Visuals (${visuals.length})` : 'Extract Visuals'}
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={transcribing}
                      onClick={() =>
                        handleTranscribe(
                          selectedLecture.lecture_id,
                          selectedLecture.status === 'completed'
                        )
                      }
                      className="helios-btn-primary px-5 py-2.5 rounded-xl text-xs sm:text-sm inline-flex items-center justify-center gap-2 cursor-pointer shrink-0"
                    >
                      {transcribing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Transcribing...
                        </>
                      ) : selectedLecture.status === 'completed' ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Re-fetch Transcript
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Transcribe Lecture
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Video or Audio Player */}
                {selectedLecture.audioUrl && (
                  isVideoFile(selectedLecture.filename) ? (
                    <div
                      className="mt-4 p-3 rounded-xl border flex flex-col items-center gap-2"
                      style={{
                        background: 'var(--bg-card-elevated)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      <video
                        ref={videoRef}
                        src={selectedLecture.audioUrl}
                        controls
                        playsInline
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                        className="w-full max-h-[340px] rounded-lg bg-black object-contain"
                      />
                    </div>
                  ) : (
                    <div
                      className="mt-4 p-3.5 rounded-xl border flex items-center gap-3"
                      style={{
                        background: 'var(--bg-card-elevated)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={togglePlay}
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 cursor-pointer"
                        style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                      </button>

                      <audio
                        ref={audioRef}
                        src={selectedLecture.audioUrl}
                        controls
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                        className="w-full h-9 accent-pink-400"
                      />
                    </div>
                  )
                )}
              </div>

              {/* Search Transcript Bar */}
              <div className="helios-card p-5">
                <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <Search
                      className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2"
                      style={{ color: 'var(--text-muted)' }}
                    />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search transcript (e.g., Newton, inertia, first law)..."
                      disabled={selectedLecture.status !== 'completed'}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border outline-none"
                      style={{
                        background: 'var(--bg-input)',
                        borderColor: 'var(--border-strong)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={selectedLecture.status !== 'completed' || searching}
                    className="helios-btn-primary px-5 py-2.5 rounded-xl text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Search
                  </button>
                  {searchResults !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('')
                        setSearchResults(null)
                      }}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold border cursor-pointer"
                      style={{
                        background: 'var(--bg-card-elevated)',
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Clear
                    </button>
                  )}
                </form>

                {/* Quick suggestion chips */}
                {selectedLecture.status === 'completed' && quickChips.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      Quick queries:
                    </span>
                    {quickChips.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => {
                          setQuery(chip)
                          searchLecture(selectedLecture.lecture_id, chip)
                            .then((res) => {
                              setSearchResults(res.results || [])
                              setLastApiPayload({ endpoint: 'POST /api/lecture/search', response: res })
                            })
                            .catch((err) => setError(err.message))
                        }}
                        className="text-[11px] px-2.5 py-1 rounded-full border cursor-pointer hover:opacity-90"
                        style={{
                          background: 'var(--bg-card-elevated)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--accent-bright)',
                        }}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}

                {/* View Mode & Visual Filters Bar */}
                <div className="mt-5 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b pb-3.5" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex items-center gap-1.5 p-1 rounded-xl border flex-wrap" style={{ background: 'var(--bg-app)', borderColor: 'var(--border-subtle)' }}>
                    {/* Tab 1: Synced Split View */}
                    <button
                      type="button"
                      onClick={() => setActiveTab('split')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        activeTab === 'split' ? 'shadow-sm' : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{
                        background: activeTab === 'split' ? 'var(--accent)' : 'transparent',
                        color: activeTab === 'split' ? 'var(--accent-text)' : 'var(--text-secondary)',
                      }}
                      title="Synchronized dual view of lecture slides/equations and speech transcript"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Synced Split View</span>
                      {isSearching ? (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold"
                          style={{
                            background: activeTab === 'split' ? 'rgba(0,0,0,0.22)' : 'var(--accent-soft)',
                            color: activeTab === 'split' ? 'currentColor' : 'var(--accent-bright)',
                          }}
                        >
                          {filteredVisuals.length + (searchResults?.length || 0)} matches
                        </span>
                      ) : visuals.length > 0 ? (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-medium opacity-90 inline-flex items-center gap-1"
                          style={{
                            background: activeTab === 'split' ? 'rgba(0,0,0,0.2)' : 'var(--bg-card-elevated)',
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          <span>{visuals.length} Visuals</span>
                        </span>
                      ) : (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-mono opacity-60"
                          style={{
                            background: activeTab === 'split' ? 'rgba(0,0,0,0.2)' : 'var(--bg-card-elevated)',
                          }}
                        >
                          No Visuals
                        </span>
                      )}
                    </button>

                    {/* Tab 2: Extracted Visuals Gallery */}
                    <button
                      type="button"
                      onClick={() => setActiveTab('visuals')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        activeTab === 'visuals' ? 'shadow-sm' : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{
                        background: activeTab === 'visuals' ? 'var(--accent)' : 'transparent',
                        color: activeTab === 'visuals' ? 'var(--accent-text)' : 'var(--text-secondary)',
                      }}
                      title="Visual cards, diagrams, equations, and presentation slides extracted from the video"
                    >
                      <Presentation className="w-3.5 h-3.5" />
                      <span>Extracted Visuals</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold"
                        style={{
                          background: activeTab === 'visuals' ? 'rgba(0,0,0,0.22)' : 'var(--accent-soft)',
                          color: activeTab === 'visuals' ? 'currentColor' : 'var(--accent-bright)',
                        }}
                      >
                        {isSearching
                          ? `${filteredVisuals.length} matches`
                          : visuals.length > 0
                          ? `${visuals.length} ${visuals.length === 1 ? 'frame' : 'frames'}`
                          : '0 frames'}
                      </span>
                    </button>

                    {/* Tab 3: Transcript */}
                    <button
                      type="button"
                      onClick={() => setActiveTab('transcript')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        activeTab === 'transcript' ? 'shadow-sm' : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{
                        background: activeTab === 'transcript' ? 'var(--accent)' : 'transparent',
                        color: activeTab === 'transcript' ? 'var(--accent-text)' : 'var(--text-secondary)',
                      }}
                      title={`${(selectedLecture?.segments?.length || 0).toLocaleString()} timestamped speech segments`}
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>Transcript</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold"
                        style={{
                          background: activeTab === 'transcript' ? 'rgba(0,0,0,0.22)' : 'var(--accent-soft)',
                          color: activeTab === 'transcript' ? 'currentColor' : 'var(--accent-bright)',
                        }}
                      >
                        {isSearching
                          ? `${searchResults ? searchResults.length : displayedSegments.length} matches`
                          : selectedLecture?.segments?.length
                          ? selectedLecture.segments.length > 999
                            ? `${(selectedLecture.segments.length / 1000).toFixed(1)}k lines`
                            : `${selectedLecture.segments.length} lines`
                          : '0 lines'}
                      </span>
                    </button>
                  </div>

                  {/* Auto-Sync Playback Tracker Pill */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAutoSync(!autoSync)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                        autoSync
                          ? 'border-[var(--accent)] text-[var(--accent-bright)] bg-[var(--accent-soft)] shadow-sm'
                          : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] bg-[var(--bg-card-elevated)]'
                      }`}
                      title="Automatically follow lecture playback and scroll the active slide & transcript segment into view"
                    >
                      <LocateFixed className={`w-3.5 h-3.5 ${autoSync && isPlaying ? 'animate-pulse text-[var(--accent)]' : ''}`} />
                      <span>{autoSync ? 'Auto-Sync Active' : 'Auto-Sync Off'}</span>
                    </button>
                  </div>
                </div>

                {/* Category Filter Chips for Visuals */}
                {(activeTab === 'visuals' || activeTab === 'split') && visuals.length > 0 && (
                  <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                    {[
                      { key: 'all', label: 'All Visuals' },
                      { key: 'equation', label: 'Equations', icon: <Sigma className="w-3 h-3" /> },
                      { key: 'graph', label: 'Graphs', icon: <BarChart3 className="w-3 h-3" /> },
                      { key: 'diagram', label: 'Diagrams', icon: <ImageIcon className="w-3 h-3" /> },
                      { key: 'slide', label: 'Slides', icon: <Presentation className="w-3 h-3" /> },
                      { key: 'whiteboard', label: 'Board Notes', icon: <Code2 className="w-3 h-3" /> },
                    ].map((cat) => {
                      const count = cat.key === 'all' ? visuals.length : visuals.filter((v) => v.visual_type === cat.key).length
                      if (cat.key !== 'all' && count === 0) return null
                      return (
                        <button
                          key={cat.key}
                          type="button"
                          onClick={() => setVisualFilter(cat.key)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border cursor-pointer inline-flex items-center gap-1 ${
                            visualFilter === cat.key
                              ? 'font-bold'
                              : 'opacity-70 hover:opacity-100'
                          }`}
                          style={{
                            background: visualFilter === cat.key ? 'var(--accent-soft)' : 'var(--bg-app)',
                            borderColor: visualFilter === cat.key ? 'var(--accent)' : 'var(--border-subtle)',
                            color: visualFilter === cat.key ? 'var(--accent-bright)' : 'var(--text-muted)',
                          }}
                        >
                          {cat.icon}
                          {cat.label} ({count})
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Content Section: Visuals, Transcript, or Split */}
                <div className="mt-5">
                  {/* SPLIT VIEW */}
                  {activeTab === 'split' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {/* Left: Extracted Visuals Column */}
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold tracking-[0.14em] uppercase flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
                            <Presentation className="w-3.5 h-3.5" />
                            EXTRACTED VISUALS & DIAGRAMS ({filteredVisuals.length})
                          </span>
                          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            Click image or timestamp to seek
                          </span>
                        </div>

                        {filteredVisuals.length === 0 ? (
                          <div
                            className="p-8 rounded-xl border text-center text-xs flex flex-col items-center gap-2"
                            style={{
                              background: 'var(--bg-card-elevated)',
                              borderColor: 'var(--border-subtle)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            <Presentation className="w-6 h-6 opacity-40" />
                            <span>
                              {selectedLecture && !isVideoFile(selectedLecture.filename)
                                ? 'This is an audio lecture (no video stream). Academic concept & equation cards can be generated from the speech transcript.'
                                : 'No visual frames extracted yet from lecture video.'}
                            </span>
                            <button
                              type="button"
                              onClick={handleExtractVisuals}
                              disabled={loadingVisuals}
                              className="mt-2 px-3 py-1.5 rounded-lg text-xs font-bold border inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                              style={{
                                background: 'var(--accent-soft)',
                                borderColor: 'var(--accent)',
                                color: 'var(--accent-bright)',
                              }}
                            >
                              {loadingVisuals ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Analyzing Keyframes...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>
                                    {selectedLecture && !isVideoFile(selectedLecture.filename)
                                      ? 'Generate Academic Cards'
                                      : 'Extract Visuals & Diagrams Now'}
                                  </span>
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3.5 max-h-[720px] overflow-y-auto pr-1">
                            {filteredVisuals.map((v) => {
                              const badge = getVisualBadge(v.visual_type)
                              const isNearCurrent = Math.abs(currentTime - v.timestamp) < 6.0
                              return (
                                <div
                                  key={v.id}
                                  ref={isNearCurrent ? activeVisualRef : null}
                                  className="p-3.5 rounded-xl border flex flex-col gap-2.5 transition-all group"
                                  style={{
                                    background: isNearCurrent ? 'var(--accent-soft)' : 'var(--bg-card-elevated)',
                                    borderColor: isNearCurrent ? 'var(--accent)' : 'var(--border-subtle)',
                                    boxShadow: isNearCurrent ? '0 0 12px var(--accent-soft)' : 'none',
                                  }}
                                >
                                  {/* Card Top Meta */}
                                  <div className="flex items-center justify-between gap-2">
                                    <span
                                      className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md inline-flex items-center gap-1"
                                      style={{
                                        background: badge.bg,
                                        borderColor: badge.border,
                                        color: badge.text,
                                        borderWidth: 1,
                                      }}
                                    >
                                      {badge.icon}
                                      {badge.label}
                                    </span>

                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => seekToSegment(v.timestamp)}
                                        className="font-mono-code text-[11px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-1 cursor-pointer transition-all hover:scale-105"
                                        style={{
                                          background: 'var(--bg-app)',
                                          color: 'var(--accent-bright)',
                                          border: '1px solid var(--border-subtle)',
                                        }}
                                        title="Seek video player to this visual frame"
                                      >
                                        <Play className="w-2.5 h-2.5" />
                                        {formatTimestamp(v.timestamp)}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setSelectedVisualModal(v)}
                                        className="p-1 rounded-md opacity-60 hover:opacity-100 cursor-pointer"
                                        style={{ background: 'var(--bg-app)', color: 'var(--text-secondary)' }}
                                        title="Full-screen inspect"
                                      >
                                        <Maximize2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Visual Frame Image */}
                                  <div
                                    onClick={() => setSelectedVisualModal(v)}
                                    className="relative rounded-lg overflow-hidden border cursor-pointer aspect-video bg-black flex items-center justify-center group-hover:border-[var(--accent)] transition-all"
                                    style={{ borderColor: 'var(--border-subtle)' }}
                                  >
                                    <img
                                      src={v.image_url}
                                      alt={v.title}
                                      loading="lazy"
                                      className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                      <span className="px-2 py-1 rounded bg-black/70 text-[11px] text-white flex items-center gap-1 font-semibold">
                                        <Eye className="w-3 h-3" /> Inspect Frame
                                      </span>
                                    </div>
                                  </div>

                                  {/* Title & Description */}
                                  <div>
                                    <h3 className="text-sm font-bold m-0" style={{ color: 'var(--text-primary)' }}>
                                      {highlightText(v.title, query)}
                                    </h3>
                                    <p className="text-xs mt-1 m-0 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                      {highlightText(v.description, query)}
                                    </p>
                                  </div>

                                  {/* LaTeX Equation Box if present */}
                                  {v.latex && (
                                    <div
                                      className="p-2.5 rounded-lg border font-mono text-xs flex flex-col gap-1"
                                      style={{
                                        background: 'var(--bg-app)',
                                        borderColor: 'rgba(168, 85, 247, 0.35)',
                                      }}
                                    >
                                      <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: '#c084fc' }}>
                                        Extracted LaTeX Equation:
                                      </span>
                                      <div className="text-xs font-bold text-amber-300 overflow-x-auto py-0.5">
                                        $${v.latex}$$
                                      </div>
                                    </div>
                                  )}

                                  {/* OCR Snippet */}
                                  {v.ocr_text && (
                                    <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                                      <span className="font-semibold">Text on Screen:</span> {v.ocr_text}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {/* Right: Timestamped Transcript Column */}
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold tracking-[0.14em] uppercase flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
                            <Mic className="w-3.5 h-3.5" />
                            SPEECH TRANSCRIPT {isSearching ? `(${displayedSegments.length} MATCHES)` : ''}
                          </span>
                          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            Click to sync audio/video
                          </span>
                        </div>

                        {selectedLecture.status !== 'completed' ? (
                          <div
                            className="p-6 rounded-xl border text-center text-xs"
                            style={{
                              background: 'var(--bg-card-elevated)',
                              borderColor: 'var(--border-subtle)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            Click <strong style={{ color: 'var(--accent-bright)' }}>Transcribe Lecture</strong> above to generate timestamped transcript segments.
                          </div>
                        ) : displayedSegments.length === 0 ? (
                          <div
                            className="p-6 rounded-xl border text-center text-xs"
                            style={{
                              background: 'var(--bg-card-elevated)',
                              borderColor: 'var(--border-subtle)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            No transcript segments matched &ldquo;{query}&rdquo;.
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2.5 max-h-[720px] overflow-y-auto pr-1">
                            {displayedSegments.slice(0, visibleLimit).map((seg, idx) => {
                              const isCurrent = currentTime >= seg.start_time && currentTime < seg.end_time
                              return (
                                <div
                                  key={`${seg.start_time}-${idx}`}
                                  ref={isCurrent ? activeTranscriptRef : null}
                                  onClick={() => seekToSegment(seg.start_time)}
                                  className="p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center gap-2.5 cursor-pointer transition-all"
                                  style={{
                                    background: isCurrent ? 'var(--accent-soft)' : 'var(--bg-card-elevated)',
                                    borderColor: isCurrent ? 'var(--accent)' : 'var(--border-subtle)',
                                    boxShadow: isCurrent ? '0 0 10px var(--accent-soft)' : 'none',
                                  }}
                                >
                                  <span
                                    className="font-mono-code text-[11px] font-semibold px-2 py-0.5 rounded-lg shrink-0 inline-flex items-center gap-1.5 w-fit"
                                    style={{
                                      background: 'var(--bg-app)',
                                      color: 'var(--accent-bright)',
                                    }}
                                  >
                                    <Play className="w-2.5 h-2.5" />
                                    {formatTimestamp(seg.start_time)} → {formatTimestamp(seg.end_time)}
                                  </span>
                                  <p className="text-xs sm:text-sm m-0 leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                                    {highlightText(seg.text, query)}
                                  </p>
                                </div>
                              )
                            })}
                            {displayedSegments.length > visibleLimit && (
                              <div className="py-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => setVisibleLimit((v) => v + 250)}
                                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer hover:opacity-90"
                                  style={{
                                    background: 'var(--accent-soft)',
                                    borderColor: 'var(--accent)',
                                    color: 'var(--accent-bright)',
                                  }}
                                >
                                  Load More Segments ({visibleLimit} of {displayedSegments.length.toLocaleString()})
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* VISUALS GALLERY ONLY VIEW */}
                  {activeTab === 'visuals' && (
                    <div>
                      <div className="flex items-center justify-between mb-3.5">
                        <span className="text-[11px] font-bold tracking-[0.14em] uppercase" style={{ color: 'var(--accent)' }}>
                          EXTRACTED VISUALS, DIAGRAMS & SLIDES ({filteredVisuals.length})
                        </span>
                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          Click any frame or timestamp to jump video playback
                        </span>
                      </div>

                      {filteredVisuals.length === 0 ? (
                        <div
                          className="p-10 rounded-xl border text-center text-xs flex flex-col items-center gap-3"
                          style={{
                            background: 'var(--bg-card-elevated)',
                            borderColor: 'var(--border-subtle)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <Presentation className="w-8 h-8 opacity-40" />
                          <p className="m-0 font-medium">
                            {visualFilter !== 'all'
                              ? `No ${visualFilter} visuals found in this lecture.`
                              : selectedLecture && !isVideoFile(selectedLecture.filename)
                              ? 'This is an audio-only lecture. Generate academic blackboard & concept cards from speech.'
                              : 'No visual frames extracted yet from video.'}
                          </p>
                          <button
                            type="button"
                            onClick={handleExtractVisuals}
                            disabled={loadingVisuals}
                            className="px-4 py-2 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            style={{
                              background: 'var(--accent-soft)',
                              borderColor: 'var(--accent)',
                              color: 'var(--accent-bright)',
                            }}
                          >
                            {loadingVisuals ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Extracting Visuals...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>
                                  {selectedLecture && !isVideoFile(selectedLecture.filename)
                                    ? 'Generate Concept Cards'
                                    : 'Extract Keyframe Visuals'}
                                </span>
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {filteredVisuals.map((v) => {
                            const badge = getVisualBadge(v.visual_type)
                            const isNearCurrent = Math.abs(currentTime - v.timestamp) < 6.0
                            return (
                              <div
                                key={v.id}
                                className="p-4 rounded-xl border flex flex-col gap-3 transition-all group"
                                style={{
                                  background: isNearCurrent ? 'var(--accent-soft)' : 'var(--bg-card-elevated)',
                                  borderColor: isNearCurrent ? 'var(--accent)' : 'var(--border-subtle)',
                                  boxShadow: isNearCurrent ? '0 0 12px var(--accent-soft)' : 'none',
                                }}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span
                                    className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md inline-flex items-center gap-1"
                                    style={{
                                      background: badge.bg,
                                      borderColor: badge.border,
                                      color: badge.text,
                                      borderWidth: 1,
                                    }}
                                  >
                                    {badge.icon}
                                    {badge.label}
                                  </span>

                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => seekToSegment(v.timestamp)}
                                      className="font-mono-code text-[11px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-1 cursor-pointer transition-all hover:scale-105"
                                      style={{
                                        background: 'var(--bg-app)',
                                        color: 'var(--accent-bright)',
                                        border: '1px solid var(--border-subtle)',
                                      }}
                                    >
                                      <Play className="w-2.5 h-2.5" />
                                      {formatTimestamp(v.timestamp)}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedVisualModal(v)}
                                      className="p-1 rounded-md opacity-60 hover:opacity-100 cursor-pointer"
                                      style={{ background: 'var(--bg-app)', color: 'var(--text-secondary)' }}
                                    >
                                      <Maximize2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>

                                <div
                                  onClick={() => setSelectedVisualModal(v)}
                                  className="relative rounded-lg overflow-hidden border cursor-pointer aspect-video bg-black flex items-center justify-center group-hover:border-[var(--accent)] transition-all"
                                  style={{ borderColor: 'var(--border-subtle)' }}
                                >
                                  <img
                                    src={v.image_url}
                                    alt={v.title}
                                    loading="lazy"
                                    className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                                  />
                                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="px-2.5 py-1 rounded bg-black/70 text-xs text-white flex items-center gap-1 font-semibold">
                                      <Eye className="w-3.5 h-3.5" /> Inspect Frame
                                    </span>
                                  </div>
                                </div>

                                <div>
                                  <h3 className="text-sm font-bold m-0" style={{ color: 'var(--text-primary)' }}>
                                    {highlightText(v.title, query)}
                                  </h3>
                                  <p className="text-xs mt-1 m-0 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                    {highlightText(v.description, query)}
                                  </p>
                                </div>

                                {v.latex && (
                                  <div
                                    className="p-2.5 rounded-lg border font-mono text-xs flex flex-col gap-1"
                                    style={{
                                      background: 'var(--bg-app)',
                                      borderColor: 'rgba(168, 85, 247, 0.35)',
                                    }}
                                  >
                                    <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: '#c084fc' }}>
                                      Extracted LaTeX Equation:
                                    </span>
                                    <div className="text-xs font-bold text-amber-300 overflow-x-auto py-0.5">
                                      $${v.latex}$$
                                    </div>
                                  </div>
                                )}

                                {v.ocr_text && (
                                  <div className="text-[11px] truncate mt-auto" style={{ color: 'var(--text-muted)' }}>
                                    <span className="font-semibold">Text on Screen:</span> {v.ocr_text}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TRANSCRIPT ONLY VIEW */}
                  {activeTab === 'transcript' && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-bold tracking-[0.14em] uppercase" style={{ color: 'var(--accent)' }}>
                          {isSearching
                            ? `SEARCH MATCHES (${displayedSegments.length})`
                            : 'FULL LECTURE TRANSCRIPT'}
                        </span>
                        {displayedSegments.length > 0 && (
                          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            {formatTimestamp(selectedLecture.duration || 0)} total · Click timestamp to jump playback
                          </span>
                        )}
                      </div>

                      {selectedLecture.status !== 'completed' ? (
                        <div
                          className="p-6 rounded-xl border text-center text-xs"
                          style={{
                            background: 'var(--bg-card-elevated)',
                            borderColor: 'var(--border-subtle)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          Click <strong style={{ color: 'var(--accent-bright)' }}>Transcribe Lecture</strong> above to generate timestamped segments.
                        </div>
                      ) : displayedSegments.length === 0 ? (
                        <div
                          className="p-6 rounded-xl border text-center text-xs"
                          style={{
                            background: 'var(--bg-card-elevated)',
                            borderColor: 'var(--border-subtle)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          No transcript segments matched &ldquo;{query}&rdquo;.
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2.5">
                          {displayedSegments.slice(0, visibleLimit).map((seg, idx) => {
                            const isCurrent = currentTime >= seg.start_time && currentTime < seg.end_time
                            return (
                              <div
                                key={`${seg.start_time}-${idx}`}
                                ref={isCurrent ? activeTranscriptRef : null}
                                onClick={() => seekToSegment(seg.start_time)}
                                className="p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center gap-3 cursor-pointer transition-all"
                                style={{
                                  background: isCurrent ? 'var(--accent-soft)' : 'var(--bg-card-elevated)',
                                  borderColor: isCurrent ? 'var(--accent-border)' : 'var(--border-subtle)',
                                }}
                              >
                                <span
                                  className="font-mono-code text-[11px] font-semibold px-2.5 py-1 rounded-lg shrink-0 inline-flex items-center gap-1.5 w-fit"
                                  style={{
                                    background: 'var(--bg-app)',
                                    color: 'var(--accent-bright)',
                                  }}
                                >
                                  <Play className="w-3 h-3" />
                                  {formatTimestamp(seg.start_time)} → {formatTimestamp(seg.end_time)}
                                </span>
                                <p className="text-sm m-0 leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                                  {highlightText(seg.text, query)}
                                </p>
                              </div>
                            )
                          })}
                          {displayedSegments.length > visibleLimit && (
                            <div className="py-3 text-center">
                              <button
                                type="button"
                                onClick={() => setVisibleLimit((v) => v + 300)}
                                className="px-4 py-2 rounded-xl text-xs font-bold border cursor-pointer hover:opacity-90"
                                style={{
                                  background: 'var(--accent-soft)',
                                  borderColor: 'var(--accent)',
                                  color: 'var(--accent-bright)',
                                }}
                              >
                                Load More Segments ({visibleLimit} of {displayedSegments.length.toLocaleString()})
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* High-Resolution Visual Inspection Modal Lightbox */}
                {selectedVisualModal && (
                  <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
                    <div
                      className="relative w-full max-w-4xl rounded-2xl border p-5 flex flex-col gap-4 shadow-2xl max-h-[90vh] overflow-y-auto"
                      style={{
                        background: 'var(--bg-card)',
                        borderColor: 'var(--border-strong)',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {(() => {
                            const b = getVisualBadge(selectedVisualModal.visual_type)
                            return (
                              <span
                                className="text-xs uppercase font-bold tracking-wider px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5"
                                style={{
                                  background: b.bg,
                                  borderColor: b.border,
                                  color: b.text,
                                  borderWidth: 1,
                                }}
                              >
                                {b.icon} {b.label}
                              </span>
                            )
                          })()}
                          <span className="font-mono-code text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: 'var(--bg-app)', color: 'var(--accent-bright)' }}>
                            {formatTimestamp(selectedVisualModal.timestamp)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              seekToSegment(selectedVisualModal.timestamp)
                              setSelectedVisualModal(null)
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                            style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
                          >
                            <Play className="w-3.5 h-3.5" /> Jump Video Here
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedVisualModal(null)}
                            className="p-1.5 rounded-lg border cursor-pointer opacity-70 hover:opacity-100"
                            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Modal Image */}
                      <div className="rounded-xl overflow-hidden border bg-black aspect-video flex items-center justify-center" style={{ borderColor: 'var(--border-subtle)' }}>
                        <img
                          src={selectedVisualModal.image_url}
                          alt={selectedVisualModal.title}
                          className="w-full h-full object-contain"
                        />
                      </div>

                      {/* Title & Detailed Information */}
                      <div className="flex flex-col gap-2">
                        <h2 className="text-lg font-bold m-0" style={{ color: 'var(--text-primary)' }}>
                          {selectedVisualModal.title}
                        </h2>
                        <p className="text-sm m-0 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {selectedVisualModal.description}
                        </p>
                      </div>

                      {/* LaTeX Block */}
                      {selectedVisualModal.latex && (
                        <div
                          className="p-3.5 rounded-xl border font-mono text-xs flex flex-col gap-1.5"
                          style={{
                            background: 'var(--bg-app)',
                            borderColor: 'rgba(168, 85, 247, 0.4)',
                          }}
                        >
                          <span className="text-[11px] uppercase font-bold tracking-wider" style={{ color: '#c084fc' }}>
                            Extracted Mathematical Equation (LaTeX):
                          </span>
                          <div className="text-sm font-bold text-amber-300 py-1 overflow-x-auto">
                            $${selectedVisualModal.latex}$$
                          </div>
                        </div>
                      )}

                      {/* OCR Text */}
                      {selectedVisualModal.ocr_text && (
                        <div className="p-3 rounded-lg border text-xs" style={{ background: 'var(--bg-app)', borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                          <span className="font-semibold block mb-0.5">On-Screen Text / Code / Board Annotations:</span>
                          <span className="font-mono">{selectedVisualModal.ocr_text}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Live API Contract JSON Inspector */}
          {showJson && lastApiPayload && (
            <div className="helios-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono-code text-xs font-semibold" style={{ color: 'var(--emerald)' }}>
                  {lastApiPayload.endpoint}
                </span>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  API_CONTRACT.md validated JSON
                </span>
              </div>
              <pre
                className="font-mono-code text-xs p-3.5 rounded-xl overflow-x-auto m-0"
                style={{
                  background: 'var(--bg-app)',
                  color: 'var(--text-secondary)',
                }}
              >
                {JSON.stringify(lastApiPayload.response, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Code2,
  FileAudio,
  Film,
  Loader2,
  Mic,
  Pause,
  Play,
  Search,
  Sparkles,
  Upload,
  Video,
  Volume2,
} from 'lucide-react'
import {
  createSampleWavFile,
  getLectureAudioUrl,
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

  const fileInputRef = useRef(null)
  const audioRef = useRef(null)
  const videoRef = useRef(null)

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

  const selectedLecture = lectures.find((l) => l.lecture_id === selectedId) || null

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
      setError(err.message || 'Transcription failed.')
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
                {selectedLecture.status === 'completed' && (() => {
                  const stop = new Set(['today', 'discuss', 'about', 'which', 'their', 'there', 'these', 'those', 'object', 'remains', 'unless', 'acted', 'states', 'using', 'first', 'lecture', 'audio', 'welcome'])
                  const words = (selectedLecture.segments || [])
                    .flatMap((s) => (s.text || '').match(/[A-Za-z]{5,}/g) || [])
                    .filter((w) => !stop.has(w.toLowerCase()))
                  const dynamicChips = [...new Set(words.map((w) => w.replace(/[^A-Za-z]/g, '')))].slice(0, 4)
                  const chips = dynamicChips.length > 0 ? dynamicChips : ['Newton', 'inertia', 'first law']
                  return (
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      Quick queries:
                    </span>
                    {chips.map((chip) => (
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
                  )
                })()}

                {/* Timestamped Segments */}
                <div className="mt-5">
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className="text-[11px] font-bold tracking-[0.14em] uppercase"
                      style={{ color: 'var(--accent)' }}
                    >
                      {searchResults !== null
                        ? `SEARCH MATCHES (${displayedSegments.length})`
                        : `TIMESTAMPED TRANSCRIPT (${displayedSegments.length} SEGMENTS)`}
                    </span>
                    {displayedSegments.length > 0 && (
                      <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        Click a timestamp to jump audio
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
                      Click <strong style={{ color: 'var(--accent-bright)' }}>Transcribe Lecture</strong>{' '}
                      above to invoke <code className="font-mono-code">POST /api/lecture/transcribe</code>{' '}
                      and generate timestamped segments.
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
                      {displayedSegments.map((seg, idx) => {
                        const isCurrent =
                          currentTime >= seg.start_time && currentTime < seg.end_time
                        return (
                          <div
                            key={`${seg.start_time}-${idx}`}
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
                    </div>
                  )}
                </div>
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

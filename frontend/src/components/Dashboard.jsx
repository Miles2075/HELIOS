import { useState } from 'react'
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Database,
  ExternalLink,
  FileText,
  Flame,
  FolderCheck,
  Layers,
  Lightbulb,
  Lock,
  Mic,
  Network,
  Play,
  RefreshCw,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
  Video,
  Zap,
} from 'lucide-react'
import { COURSES_MASTERY, MEMORY_SPARKS } from '../data/mockCorpus'

export default function Dashboard({
  onNavigate,
  activeDocument,
  recentActivity,
  stats,
  backendOnline,
  onFlashcardReveal,
}) {
  const [sparkIndex, setSparkIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)

  const currentSpark = MEMORY_SPARKS[sparkIndex]

  const handleReveal = () => {
    if (!revealed) {
      setRevealed(true)
      onFlashcardReveal?.()
    } else {
      setRevealed(false)
    }
  }

  const handleNextSpark = () => {
    setRevealed(false)
    setSparkIndex((prev) => (prev + 1) % MEMORY_SPARKS.length)
  }

  // The 5 Core Intelligence Engines with deep justifications
  const intelligenceModules = [
    {
      id: 'smart-search',
      title: 'Smart Search',
      subtitle: 'Dense RAG · Split-Pane Reader · Real-Time Excerpt Highlighting',
      desc: 'Ask complex natural language questions across all course textbooks, research papers, and lecture notes. Uses high-dimensional cosine similarity matching with anti-hallucination guardrails and a synchronized split-pane reader with real-time excerpt highlights.',
      engine: 'ChromaDB · all-MiniLM-L6-v2 · PyPDF · Hybrid RRF',
      icon: Search,
      accent: 'var(--accent)',
      accentSoft: 'var(--accent-soft)',
      accentBorder: 'var(--accent-border)',
      highlights: ['Split-pane page reader', 'Interactive citation highlights', 'Hybrid RRF (Dense + BM25)'],
      quickAction: 'Query Course Notes',
    },
    {
      id: 'lecture-sync',
      title: 'Lecture Sync',
      subtitle: 'Multimodal Lecture Sync · Visual Slides & Blackboard Extraction',
      desc: 'Ingests classroom recordings (.mp3, .wav), lecture videos (.mp4, .mkv), or YouTube links. Transcribes dialogue with Faster-Whisper, extracts on-screen blackboard equations & slides via PyAV, and syncs timestamped audio.',
      engine: 'faster-whisper · PyAV Keyframes · yt-dlp',
      icon: Mic,
      accent: 'var(--accent)',
      accentSoft: 'var(--accent-soft)',
      accentBorder: 'var(--accent-border)',
      highlights: ['Blackboard & slide extraction', 'Timestamped click-to-seek', 'YouTube lecture importer'],
      quickAction: 'Open Lecture Sync',
    },
    {
      id: 'quiz-master',
      title: 'Quiz Master',
      subtitle: 'Fog of War Story Campaign · Progressive Chapter Unlock Engine',
      desc: 'Turns lecture videos and course syllabi into an interactive Fog of War Mindmap. Students clear milestone stages to unlock chapters backed by the professor actual slides and video timestamps.',
      engine: 'Pydantic V2 · Fog of War Stage Gating · Schema Validation',
      icon: FileText,
      accent: 'var(--accent)',
      accentSoft: 'var(--accent-soft)',
      accentBorder: 'var(--accent-border)',
      highlights: ['Fog of War chapter unlocking', 'Lecture-synced slide milestones', 'Domain-accurate distractors'],
      quickAction: 'Start Story Campaign',
    },
    {
      id: 'data-storyteller',
      title: 'Data Storyteller',
      subtitle: 'PDF Data Stories · Topic Groups & Lab Spreadsheet Analytics',
      desc: 'Visualizes the empirical data story of any PDF (density score, 3-phase narrative arc, data markers) and clusters similar course documents into clean, non-confusing topic cards alongside spreadsheet analytics.',
      engine: 'Pandas · ChromaDB Clusters · Document Story Arc',
      icon: BarChart3,
      accent: 'var(--gold)',
      accentSoft: 'var(--gold-soft)',
      accentBorder: 'rgba(245, 158, 11, 0.4)',
      highlights: ['PDF empirical data stories', 'Clean topic group cards', 'Auto cleaning & correlations'],
      quickAction: 'Visualize Document Stories',
    },
    {
      id: 'brain-map',
      title: 'Brain Map',
      subtitle: '3D Cosmic Knowledge Graph & Concept Topologies',
      desc: 'Visualizes the topological dependency network of academic subjects. Maps prerequisites, core theorems, and cross-course relationships in an interactive 3D WebGL cosmic space powered by graph centrality algorithms.',
      engine: 'Three.js 3D WebGL · NetworkX · Physics Simulation',
      icon: Brain,
      accent: 'var(--emerald)',
      accentSoft: 'var(--emerald-soft)',
      accentBorder: 'rgba(16, 185, 129, 0.4)',
      highlights: ['Interactive 3D cosmic view', 'Course prerequisite paths', 'Node centrality & metrics'],
      quickAction: 'Explore 3D Knowledge Web',
    },
  ]

  const getActivityIcon = (type) => {
    switch (type) {
      case 'quiz':
        return <FileText className="w-4 h-4" style={{ color: 'var(--accent)' }} />
      case 'search':
        return <Search className="w-4 h-4" style={{ color: 'var(--accent)' }} />
      case 'lecture':
        return <Mic className="w-4 h-4" style={{ color: 'var(--accent)' }} />
      case 'data':
        return <BarChart3 className="w-4 h-4" style={{ color: 'var(--gold)' }} />
      case 'brain':
        return <Brain className="w-4 h-4" style={{ color: 'var(--emerald)' }} />
      default:
        return <Sparkles className="w-4 h-4" style={{ color: 'var(--accent)' }} />
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 pb-8">
      {/* LEFT / MAIN COLUMN */}
      <div className="flex flex-col gap-6 min-w-0">
        
        {/* ========================================================================= */}
        {/* 1. HERO PLATFORM STATEMENT: WHAT IS HELIOS & WHY IT EXISTS */}
        {/* ========================================================================= */}
        <section
          className="helios-card p-6 sm:p-8 relative overflow-hidden border"
          style={{
            background:
              'radial-gradient(ellipse 90% 60% at 90% -10%, var(--accent-soft), transparent 70%), var(--bg-card)',
            borderColor: 'var(--border-strong)',
          }}
        >
          {/* Top Classification Pill */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <span
              className="text-[11px] font-bold tracking-[0.18em] uppercase px-3 py-1 rounded-full border inline-flex items-center gap-1.5"
              style={{
                background: 'var(--accent-soft)',
                borderColor: 'var(--accent)',
                color: 'var(--accent-bright)',
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              HELIOS ACADEMIC INTELLIGENCE PLATFORM · LOCAL-FIRST ARCHITECTURE
            </span>

            <div className="flex items-center gap-2 text-xs font-semibold">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: backendOnline ? 'var(--emerald)' : 'var(--danger)' }}
              />
              <span style={{ color: backendOnline ? 'var(--emerald)' : 'var(--danger)' }}>
                {backendOnline ? 'Core Backend Online (Port 8000)' : 'Backend Service Offline'}
              </span>
            </div>
          </div>

          {/* Primary App Identification */}
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight m-0" style={{ color: 'var(--text-primary)' }}>
            Welcome to <span style={{ color: 'var(--accent-bright)' }}>HELIOS</span>
          </h1>
          <p className="mt-2.5 text-sm sm:text-base leading-relaxed max-w-3xl m-0" style={{ color: 'var(--text-secondary)' }}>
            <strong>Holistic Educational Learning &amp; Intelligence Operating System</strong> — an end-to-end, zero-cost academic intelligence suite built for university students, educators, and researchers. HELIOS bridges the gap between raw study materials (textbooks, lecture videos, lab spreadsheets, curriculum notes) and active cognitive mastery through 5 local-first AI engines.
          </p>

          {/* 4 Architectural Guarantees */}
          <div
            className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-5 border-t"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div
              className="p-3.5 rounded-xl border flex flex-col gap-1"
              style={{ background: 'var(--bg-app)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--emerald)' }}>
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>100% Local &amp; Private</span>
              </div>
              <p className="text-[11px] leading-tight m-0" style={{ color: 'var(--text-muted)' }}>
                Zero cloud data leakage; documents and transcripts run on local SQLite &amp; ChromaDB.
              </p>
            </div>

            <div
              className="p-3.5 rounded-xl border flex flex-col gap-1"
              style={{ background: 'var(--bg-app)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--cyan)' }}>
                <Cpu className="w-4 h-4 shrink-0" />
                <span>Zero Required Paid APIs</span>
              </div>
              <p className="text-[11px] leading-tight m-0" style={{ color: 'var(--text-muted)' }}>
                Powered by faster-whisper, sentence-transformers, PyAV, and NetworkX on your CPU.
              </p>
            </div>

            <div
              className="p-3.5 rounded-xl border flex flex-col gap-1"
              style={{ background: 'var(--bg-app)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--gold)' }}>
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Verifiable Citations</span>
              </div>
              <p className="text-[11px] leading-tight m-0" style={{ color: 'var(--text-muted)' }}>
                Every retrieval cites exact textbook pages and exact video timestamps to prevent hallucinations.
              </p>
            </div>

            <div
              className="p-3.5 rounded-xl border flex flex-col gap-1"
              style={{ background: 'var(--bg-app)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: '#c084fc' }}>
                <Network className="w-4 h-4 shrink-0" />
                <span>Multimodal Fusion</span>
              </div>
              <p className="text-[11px] leading-tight m-0" style={{ color: 'var(--text-muted)' }}>
                Unifies PDF texts, spoken audio, extracted visual equations, lab numbers, and 3D graphs.
              </p>
            </div>
          </div>

          {/* Live Academic Corpus Metrics Ribbon */}
          <div
            className="mt-5 p-4 rounded-xl border grid grid-cols-2 sm:grid-cols-4 gap-3 text-center"
            style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(56, 189, 248, 0.05))',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div className="flex flex-col items-center">
              <span className="text-xl sm:text-2xl font-black text-indigo-400 font-mono-code">
                {stats.documentsCount || 7}
              </span>
              <span className="text-[11px] font-bold text-neutral-300 mt-0.5">Indexed Documents</span>
              <span className="text-[10px] text-neutral-500">{stats.pagesCount || 148} Parsed Pages</span>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-xl sm:text-2xl font-black text-cyan-400 font-mono-code">
                {stats.lecturesCount || 7}
              </span>
              <span className="text-[11px] font-bold text-neutral-300 mt-0.5">Sync Lectures</span>
              <span className="text-[10px] text-neutral-500">{stats.lectureHours || 18.2}h Video/Audio</span>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-xl sm:text-2xl font-black text-amber-400 font-mono-code">
                {stats.quizzes || 38}
              </span>
              <span className="text-[11px] font-bold text-neutral-300 mt-0.5">Fog of War Stages</span>
              <span className="text-[10px] text-neutral-500">20 CS50 Chapters</span>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono-code">
                {stats.datasetsCount || 3}
              </span>
              <span className="text-[11px] font-bold text-neutral-300 mt-0.5">Data Stories &amp; Groups</span>
              <span className="text-[10px] text-neutral-500">5 Clean Topic Cards</span>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 2. THE PIPELINE: HOW HELIOS TRANSFORMS RAW COURSEWORK INTO KNOWLEDGE */}
        {/* ========================================================================= */}
        <section
          className="helios-card p-5 sm:p-6 border"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3
              className="text-[11px] font-bold tracking-[0.16em] uppercase flex items-center gap-1.5 m-0"
              style={{ color: 'var(--accent)' }}
            >
              <Layers className="w-3.5 h-3.5" />
              THE HELIOS PIPELINE: HOW YOUR DATA IS PROCESSED
            </h3>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Deterministic &amp; Verifiable Workflow
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
            {/* Step 1 */}
            <div
              className="p-4 rounded-xl border flex flex-col gap-2 relative"
              style={{ background: 'var(--bg-card-elevated)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono-code text-xs font-bold px-2 py-0.5 rounded" style={{ background: 'var(--accent-soft)', color: 'var(--accent-bright)' }}>
                  STAGE 01
                </span>
                <FolderCheck className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              </div>
              <h4 className="text-sm font-bold m-0" style={{ color: 'var(--text-primary)' }}>
                Course Media Ingestion
              </h4>
              <p className="text-xs leading-relaxed m-0" style={{ color: 'var(--text-secondary)' }}>
                Upload textbooks &amp; syllabus PDFs, classroom audio (.mp3, .wav), recorded lecture videos (.mp4, .mkv), YouTube URLs, and experimental lab spreadsheets (.csv, .xlsx).
              </p>
            </div>

            {/* Step 2 */}
            <div
              className="p-4 rounded-xl border flex flex-col gap-2 relative"
              style={{ background: 'var(--bg-card-elevated)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono-code text-xs font-bold px-2 py-0.5 rounded" style={{ background: 'var(--cyan-soft)', color: 'var(--cyan)' }}>
                  STAGE 02
                </span>
                <Cpu className="w-4 h-4" style={{ color: 'var(--cyan)' }} />
              </div>
              <h4 className="text-sm font-bold m-0" style={{ color: 'var(--text-primary)' }}>
                Local Neural Extraction
              </h4>
              <p className="text-xs leading-relaxed m-0" style={{ color: 'var(--text-secondary)' }}>
                On-device models index text into ChromaDB vector embeddings, Faster-Whisper transcribes speech timestamps, and PyAV computer vision detects on-screen equations and slides.
              </p>
            </div>

            {/* Step 3 */}
            <div
              className="p-4 rounded-xl border flex flex-col gap-2 relative"
              style={{ background: 'var(--bg-card-elevated)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono-code text-xs font-bold px-2 py-0.5 rounded" style={{ background: 'var(--emerald-soft)', color: 'var(--emerald)' }}>
                  STAGE 03
                </span>
                <Sparkles className="w-4 h-4" style={{ color: 'var(--emerald)' }} />
              </div>
              <h4 className="text-sm font-bold m-0" style={{ color: 'var(--text-primary)' }}>
                Cognitive Active Mastery
              </h4>
              <p className="text-xs leading-relaxed m-0" style={{ color: 'var(--text-secondary)' }}>
                Ask AI with exact page citations, generate automated practice exams and flashcards, inspect synchronized video slides, clean lab datasets, and navigate 3D knowledge webs.
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3. THE 5 CORE INTELLIGENCE MODULES (DEEP DIVE & LAUNCHERS) */}
        {/* ========================================================================= */}
        <section>
          <div className="flex items-center justify-between mb-3.5 px-0.5">
            <div>
              <h3
                className="text-[11px] font-bold tracking-[0.16em] uppercase m-0"
                style={{ color: 'var(--accent)' }}
              >
                THE 5 CORE INTELLIGENCE ENGINES
              </h3>
              <p className="text-xs mt-0.5 m-0" style={{ color: 'var(--text-muted)' }}>
                Choose an engine below to start interacting with your course materials:
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full border" style={{ background: 'var(--bg-card-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--accent-bright)' }}>
              All 5 Engines Ready
            </span>
          </div>

          <div className="flex flex-col gap-4">
            {intelligenceModules.map((mod) => {
              const Icon = mod.icon
              return (
                <div
                  key={mod.id}
                  className="helios-card helios-card-hover p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5 border transition-all"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border mt-0.5 shadow-sm"
                      style={{
                        background: mod.accentSoft,
                        borderColor: mod.accentBorder,
                        color: mod.accent,
                      }}
                    >
                      <Icon className="w-6 h-6" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h4 className="text-base sm:text-lg font-bold m-0" style={{ color: 'var(--text-primary)' }}>
                          {mod.title}
                        </h4>
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
                          style={{ background: 'var(--bg-app)', color: 'var(--text-muted)' }}
                        >
                          {mod.subtitle}
                        </span>
                      </div>

                      <p className="mt-2 text-xs sm:text-sm leading-relaxed m-0" style={{ color: 'var(--text-secondary)' }}>
                        {mod.desc}
                      </p>

                      {/* Feature Highlights Pills */}
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        {mod.highlights.map((h, i) => (
                          <span
                            key={i}
                            className="text-[11px] px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 font-medium"
                            style={{
                              background: 'var(--bg-app)',
                              borderColor: 'var(--border-subtle)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            <CheckCircle2 className="w-3 h-3" style={{ color: mod.accent }} />
                            {h}
                          </span>
                        ))}
                      </div>

                      {/* Engine Tag */}
                      <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
                        <Terminal className="w-3 h-3 shrink-0" />
                        <span>Engine: {mod.engine}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onNavigate(mod.id)}
                    className="helios-btn-primary px-5 py-3 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer shrink-0 transition-transform hover:scale-[1.02]"
                  >
                    <span>{mod.quickAction}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 4. ACTIVE STUDY SESSION & CURRENT RESUME WIDGET */}
        {/* ========================================================================= */}
        <section className="helios-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 border" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex-1 min-w-0">
            <div
              className="text-[11px] font-bold tracking-[0.14em] uppercase flex items-center gap-1.5"
              style={{ color: 'var(--accent)' }}
            >
              <ChevronRight className="w-3.5 h-3.5" />
              ACTIVE COURSE CONTEXT
            </div>

            <h2 className="mt-2 text-lg sm:text-xl font-bold flex items-center gap-2.5 m-0">
              <BookOpen className="w-5 h-5 shrink-0" style={{ color: 'var(--cyan)' }} />
              <span>Operating Systems (CS-301)</span>
            </h2>

            <div className="mt-2 flex flex-wrap items-center gap-2.5 text-xs sm:text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>
                Chapter 6: Concurrency &amp; Locks · Active Textbook: os_three_easy_pieces.pdf
              </span>
              <span
                className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
                style={{
                  background: 'var(--accent-soft)',
                  borderColor: 'var(--accent-border)',
                  color: 'var(--accent-bright)',
                }}
              >
                82% Indexed
              </span>
            </div>

            <div
              className="mt-4 h-2 w-full max-w-md rounded-full overflow-hidden"
              style={{ background: 'var(--bg-card-elevated)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: '82%',
                  background: 'linear-gradient(90deg, var(--accent), var(--accent-bright))',
                }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('smart-search')}
            className="helios-btn-primary inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm cursor-pointer shrink-0"
          >
            <Rocket className="w-4 h-4" />
            Resume CS-301 Session
          </button>
        </section>

        {/* ========================================================================= */}
        {/* 5. SEMESTER KNOWLEDGE MASTERY */}
        {/* ========================================================================= */}
        <section className="helios-card p-5 sm:p-6 border" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3
                className="text-[11px] font-bold tracking-[0.16em] uppercase m-0"
                style={{ color: 'var(--accent)' }}
              >
                SEMESTER KNOWLEDGE MASTERY TRACKER
              </h3>
              <p className="text-xs mt-0.5 m-0" style={{ color: 'var(--text-muted)' }}>
                Cross-course document indexing and revision completion
              </p>
            </div>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              FET · BTech CSE (DS)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {COURSES_MASTERY.map((course) => (
              <div
                key={course.code}
                className="p-3.5 rounded-xl border flex flex-col justify-between"
                style={{
                  background: 'var(--bg-card-elevated)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono-code text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      {course.code}
                    </span>
                    <span
                      className="text-xl font-extrabold"
                      style={{
                        color:
                          course.progress >= 80
                            ? 'var(--emerald)'
                            : course.progress >= 60
                            ? 'var(--accent-bright)'
                            : 'var(--gold)',
                      }}
                    >
                      {course.progress}%
                    </span>
                  </div>
                  <div className="mt-1 text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {course.title}
                  </div>
                </div>

                <div
                  className="mt-3 h-1.5 w-full rounded-full overflow-hidden"
                  style={{ background: 'var(--bg-app)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${course.progress}%`,
                      background:
                        course.progress >= 80
                          ? 'var(--emerald)'
                          : course.progress >= 60
                          ? 'var(--accent)'
                          : 'var(--gold)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ========================================================================= */}
      {/* RIGHT SIDEBAR PANEL: ARCHITECTURE STATUS, QUICK TOOLS & STATS */}
      {/* ========================================================================= */}
      <aside className="flex flex-col gap-4">
        
        {/* PLATFORM ARCHITECTURE & LOCAL ENGINE HEALTH */}
        <div className="helios-card p-5 border" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center justify-between mb-3.5">
            <span
              className="text-[11px] font-bold tracking-[0.14em] uppercase flex items-center gap-1.5"
              style={{ color: 'var(--emerald)' }}
            >
              <Cpu className="w-3.5 h-3.5" />
              SYSTEM ARCHITECTURE
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: 'var(--bg-app)', color: 'var(--emerald)' }}>
              LOCAL-FIRST
            </span>
          </div>

          <div className="flex flex-col gap-2.5 text-xs">
            <div className="p-2.5 rounded-lg border flex items-center justify-between" style={{ background: 'var(--bg-app)', borderColor: 'var(--border-subtle)' }}>
              <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>FastAPI Gateway</span>
              <span className="font-mono text-[11px] font-bold" style={{ color: backendOnline ? 'var(--emerald)' : 'var(--danger)' }}>
                {backendOnline ? 'Active (Port 8000)' : 'Offline'}
              </span>
            </div>

            <div className="p-2.5 rounded-lg border flex items-center justify-between" style={{ background: 'var(--bg-app)', borderColor: 'var(--border-subtle)' }}>
              <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>Vector Store</span>
              <span className="font-mono text-[11px] font-bold" style={{ color: 'var(--accent-bright)' }}>
                ChromaDB (Local)
              </span>
            </div>

            <div className="p-2.5 rounded-lg border flex items-center justify-between" style={{ background: 'var(--bg-app)', borderColor: 'var(--border-subtle)' }}>
              <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>Speech-to-Text</span>
              <span className="font-mono text-[11px] font-bold" style={{ color: 'var(--cyan)' }}>
                Faster-Whisper CPU
              </span>
            </div>

            <div className="p-2.5 rounded-lg border flex items-center justify-between" style={{ background: 'var(--bg-app)', borderColor: 'var(--border-subtle)' }}>
              <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>Vision Keyframes</span>
              <span className="font-mono text-[11px] font-bold" style={{ color: 'var(--gold)' }}>
                PyAV Codec Engine
              </span>
            </div>

            <div className="p-2.5 rounded-lg border flex items-center justify-between" style={{ background: 'var(--bg-app)', borderColor: 'var(--border-subtle)' }}>
              <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>3D Topology</span>
              <span className="font-mono text-[11px] font-bold" style={{ color: '#c084fc' }}>
                Three.js WebGL
              </span>
            </div>
          </div>
        </div>

        {/* Active Document Card */}
        <div className="helios-card p-5 border" style={{ borderColor: 'var(--border-subtle)' }}>
          <div
            className="text-[11px] font-bold tracking-[0.14em] uppercase flex items-center gap-1.5 mb-3"
            style={{ color: 'var(--text-secondary)' }}
          >
            <FileText className="w-3.5 h-3.5" style={{ color: 'var(--gold)' }} />
            INDEXED CORPUS DOCUMENT
          </div>

          <div
            className="p-3.5 rounded-xl border"
            style={{
              background: 'var(--bg-card-elevated)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
              >
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                  {activeDocument.filename}
                </div>
                <div className="text-[11px] flex items-center gap-1 mt-0.5" style={{ color: 'var(--emerald)' }}>
                  <CheckCircle2 className="w-3 h-3" />
                  {activeDocument.pages}/{activeDocument.pages} Pages Ingested
                </div>
                <div className="text-[10px] mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }}>
                  Cosine Embeddings Ready
                </div>
              </div>
            </div>

            <div
              className="mt-3 h-1.5 w-full rounded-full overflow-hidden"
              style={{ background: 'var(--bg-app)' }}
            >
              <div
                className="h-full w-full rounded-full"
                style={{
                  background: 'linear-gradient(90deg, var(--accent), var(--accent-bright))',
                }}
              />
            </div>
          </div>
        </div>

        {/* Daily Memory Spark */}
        <div className="helios-card p-5 border" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center justify-between">
            <span
              className="text-[11px] font-bold tracking-[0.14em] uppercase flex items-center gap-1.5"
              style={{ color: 'var(--gold)' }}
            >
              <Lightbulb className="w-3.5 h-3.5" />
              DAILY MEMORY SPARK
            </span>
            <button
              type="button"
              onClick={handleNextSpark}
              title="Next spark"
              className="p-1 rounded-lg hover:opacity-80 cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
            {currentSpark.question.split(currentSpark.term).map((part, idx, arr) =>
              idx < arr.length - 1 ? (
                <span key={idx}>
                  {part}
                  <strong style={{ color: 'var(--accent-bright)' }}>{currentSpark.term}</strong>
                </span>
              ) : (
                <span key={idx}>{part}</span>
              )
            )}
          </p>

          {revealed && (
            <div
              className="mt-3 p-3 rounded-xl text-xs leading-relaxed border"
              style={{
                background: 'var(--accent-soft)',
                borderColor: 'var(--accent-border)',
                color: 'var(--text-primary)',
              }}
            >
              {currentSpark.answer}
            </div>
          )}

          <button
            type="button"
            onClick={handleReveal}
            className="mt-4 w-full py-2.5 px-4 rounded-xl text-sm font-semibold border transition-colors cursor-pointer"
            style={{
              background: revealed ? 'var(--accent-soft)' : 'var(--bg-card-elevated)',
              borderColor: 'var(--accent-border)',
              color: 'var(--accent-bright)',
            }}
          >
            {revealed ? 'Hide Answer' : 'Reveal Answer'}
          </button>
        </div>

        {/* Recent Activity */}
        <div className="helios-card p-5 border" style={{ borderColor: 'var(--border-subtle)' }}>
          <div
            className="text-[11px] font-bold tracking-[0.14em] uppercase flex items-center gap-1.5 mb-3.5"
            style={{ color: 'var(--gold)' }}
          >
            <Zap className="w-3.5 h-3.5" />
            RECENT ACTIVITY
          </div>

          <div className="flex flex-col gap-2.5">
            {recentActivity.slice(0, 4).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => item.target && onNavigate(item.target)}
                className="flex items-start gap-3 text-left p-2 -mx-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
                  style={{
                    background: 'var(--bg-card-elevated)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  {getActivityIcon(item.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {item.title}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {item.time}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Quick Stats Card */}
        <div className="helios-card p-5 grid grid-cols-3 text-center gap-2 border" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <div className="text-2xl font-extrabold font-mono-code" style={{ color: 'var(--accent-bright)' }}>
              {stats.documentsCount || 7}
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Indexed Docs
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold font-mono-code" style={{ color: 'var(--cyan)' }}>
              {stats.lecturesCount || 7}
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Sync Lectures
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold font-mono-code" style={{ color: 'var(--gold)' }}>
              {stats.lectureHours ? `${stats.lectureHours}h` : '18.2h'}
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Lecture Audio
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}

import { useState } from 'react'
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  FileText,
  Lightbulb,
  Mic,
  RefreshCw,
  Rocket,
  Search,
  Sparkles,
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

  const suiteModules = [
    {
      id: 'smart-search',
      title: 'Smart Search',
      desc: 'Ask AI across all notes & textbooks',
      icon: Search,
      accent: 'var(--accent)',
      accentSoft: 'var(--accent-soft)',
      linkColor: 'var(--text-primary)',
      liveBadge: backendOnline,
    },
    {
      id: 'quiz-master',
      title: 'Quiz Master',
      desc: 'Generate instant practice exams & flashcards',
      icon: FileText,
      accent: 'var(--accent)',
      accentSoft: 'var(--accent-soft)',
      linkColor: 'var(--text-primary)',
      liveBadge: backendOnline,
    },
    {
      id: 'lecture-sync',
      title: 'Lecture Sync',
      desc: 'Search & play audio lecture logs',
      icon: Mic,
      accent: 'var(--accent)',
      accentSoft: 'var(--accent-soft)',
      linkColor: 'var(--accent)',
      liveBadge: backendOnline,
    },
    {
      id: 'data-storyteller',
      title: 'Data Storyteller',
      desc: 'Clean spreadsheets & generate charts',
      icon: BarChart3,
      accent: 'var(--gold)',
      accentSoft: 'var(--gold-soft)',
      linkColor: 'var(--gold)',
      liveBadge: backendOnline,
    },
    {
      id: 'brain-map',
      title: 'Brain Map',
      desc: 'Visualize 3D concept networks',
      icon: Brain,
      accent: 'var(--emerald)',
      accentSoft: 'var(--emerald-soft)',
      linkColor: 'var(--emerald)',
      liveBadge: backendOnline,
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
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5 pb-6">
      {/* LEFT / MAIN COLUMN */}
      <div className="flex flex-col gap-5 min-w-0">
        {/* Welcome Banner */}
        <section
          className="helios-card p-6 sm:p-7 relative overflow-hidden"
          style={{
            background:
              'radial-gradient(circle at top right, var(--accent-soft), transparent 55%), var(--bg-card)',
          }}
        >
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2.5 m-0">
            <span role="img" aria-label="wave">
              👋
            </span>
            Welcome back, Student!
          </h1>
          <p className="mt-2 text-sm sm:text-[15px]" style={{ color: 'var(--text-secondary)' }}>
            You&apos;re on a{' '}
            <span className="font-semibold" style={{ color: 'var(--accent-bright)' }}>
              5-Day Study Streak
            </span>
            . Ready to continue mastering your courses?
          </p>

          <div className="mt-5 flex flex-wrap gap-2.5">
            <div
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium border"
              style={{
                background: 'var(--bg-card-elevated)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />
              {stats.minsStudied} mins studied today
            </div>

            <div
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium border"
              style={{
                background: 'var(--bg-card-elevated)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              <FileText className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
              {stats.flashcardsReviewed} Flashcards Reviewed
            </div>

            <div
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium border"
              style={{
                background: 'var(--bg-card-elevated)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--emerald)' }} />
              3 Subjects Active
            </div>
          </div>
        </section>

        {/* Continue Studying Card */}
        <section className="helios-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex-1 min-w-0">
            <div
              className="text-[11px] font-bold tracking-[0.14em] uppercase flex items-center gap-1.5"
              style={{ color: 'var(--accent)' }}
            >
              <ChevronRight className="w-3.5 h-3.5" />
              CONTINUE STUDYING
            </div>

            <h2 className="mt-2 text-lg sm:text-xl font-bold flex items-center gap-2.5 m-0">
              <BookOpen className="w-5 h-5 shrink-0" style={{ color: 'var(--cyan)' }} />
              <span>Operating Systems (CS-301)</span>
            </h2>

            <div className="mt-2 flex flex-wrap items-center gap-2.5 text-xs sm:text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>
                Last active 2 hours ago · Chapter 6: Concurrency &amp; Locks
              </span>
              <span
                className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
                style={{
                  background: 'var(--accent-soft)',
                  borderColor: 'var(--accent-border)',
                  color: 'var(--accent-bright)',
                }}
              >
                82% Complete
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
            Resume Study Session
          </button>
        </section>

        {/* THE HELIOS INTELLIGENCE SUITE */}
        <section>
          <div className="flex items-center justify-between mb-3 px-0.5">
            <h3
              className="text-[11px] font-bold tracking-[0.16em] uppercase m-0"
              style={{ color: 'var(--accent)' }}
            >
              THE HELIOS INTELLIGENCE SUITE
            </h3>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              5 unified AI modules
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {suiteModules.map((mod) => {
              const Icon = mod.icon
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => onNavigate(mod.id)}
                  className="helios-card helios-card-hover p-4 text-left flex flex-col justify-between min-h-[168px] cursor-pointer group"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center border"
                        style={{
                          background: mod.accentSoft,
                          borderColor: 'var(--border-subtle)',
                          color: mod.accent,
                        }}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      {mod.liveBadge && (
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
                          style={{
                            background: 'var(--emerald-soft)',
                            color: 'var(--emerald)',
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current animate-soft-pulse" />
                          LIVE
                        </span>
                      )}
                    </div>

                    <h4 className="mt-3.5 text-[15px] font-bold m-0" style={{ color: 'var(--text-primary)' }}>
                      {mod.title}
                    </h4>
                    <p className="mt-1.5 text-xs leading-relaxed m-0" style={{ color: 'var(--text-secondary)' }}>
                      {mod.desc}
                    </p>
                  </div>

                  <div
                    className="mt-4 inline-flex items-center gap-1 text-xs font-semibold group-hover:translate-x-0.5 transition-transform"
                    style={{ color: mod.linkColor }}
                  >
                    Open <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* SEMESTER KNOWLEDGE MASTERY */}
        <section className="helios-card p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3
              className="text-[11px] font-bold tracking-[0.16em] uppercase m-0"
              style={{ color: 'var(--accent)' }}
            >
              SEMESTER KNOWLEDGE MASTERY
            </h3>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              FET · BTech CSE (DS)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {COURSES_MASTERY.map((course) => (
              <div
                key={course.code}
                className="p-3.5 rounded-xl border"
                style={{
                  background: 'var(--bg-card-elevated)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
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
                <div
                  className="mt-2.5 h-1.5 w-full rounded-full overflow-hidden"
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

      {/* RIGHT SIDEBAR PANEL */}
      <aside className="flex flex-col gap-4">
        {/* Daily Memory Spark */}
        <div className="helios-card p-5">
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
        <div className="helios-card p-5">
          <div
            className="text-[11px] font-bold tracking-[0.14em] uppercase flex items-center gap-1.5 mb-3.5"
            style={{ color: 'var(--gold)' }}
          >
            <Zap className="w-3.5 h-3.5" />
            RECENT ACTIVITY
          </div>

          <div className="flex flex-col gap-3">
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

        {/* Active Document */}
        <div className="helios-card p-5">
          <div
            className="text-[11px] font-bold tracking-[0.14em] uppercase flex items-center gap-1.5 mb-3"
            style={{ color: 'var(--text-secondary)' }}
          >
            <FileText className="w-3.5 h-3.5" style={{ color: 'var(--gold)' }} />
            ACTIVE DOCUMENT
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
                <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  ChromaDB Ready
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

        {/* Quick Stats Card */}
        <div className="helios-card p-5 grid grid-cols-3 text-center gap-2">
          <div>
            <div className="text-2xl font-extrabold" style={{ color: 'var(--accent-bright)' }}>
              {stats.notes}
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Notes
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold" style={{ color: 'var(--cyan)' }}>
              {stats.quizzes}
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Quizzes
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold" style={{ color: 'var(--gold)' }}>
              {stats.hours}
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Hours
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}

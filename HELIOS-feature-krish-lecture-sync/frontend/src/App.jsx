import { useEffect, useRef, useState } from 'react'
import {
  BarChart3,
  Brain,
  ChevronDown,
  Circle,
  FileText,
  Flame,
  Flower2,
  Heart,
  LayoutGrid,
  Mic,
  Search,
  Snowflake,
} from 'lucide-react'
import { checkBackendHealth, listDatasets, listDocuments, listLectures } from './api/client'
import BrainMap from './components/BrainMap'
import Dashboard from './components/Dashboard'
import DataStoryteller from './components/DataStoryteller'
import LectureSync from './components/LectureSync'
import QuizMaster from './components/QuizMaster'
import SmartSearch from './components/SmartSearch'
import { INITIAL_DOCUMENTS, THEMES } from './data/mockCorpus'

function getGreeting() {
  const hr = new Date().getHours()
  if (hr < 12) return 'Good Morning, Student'
  if (hr < 17) return 'Good Afternoon, Student'
  return 'Good Evening, Student'
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { id: 'smart-search', label: 'Smart Search', icon: Search },
  { id: 'quiz-master', label: 'Quiz Master', icon: FileText },
  { id: 'lecture-sync', label: 'Lecture Sync', icon: Mic, isLive: true },
  { id: 'data-storyteller', label: 'Data Storyteller', icon: BarChart3 },
  { id: 'brain-map', label: 'Brain Map', icon: Brain },
]

const THEME_CONFIG = {
  obsidian: { icon: Circle, fill: true },
  sakura: { icon: Flower2, fill: false },
  nord: { icon: Snowflake, fill: false },
  lavender: { icon: Heart, fill: true },
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('helios_theme') || 'obsidian'
  })
  const [themeMenuOpen, setThemeMenuOpen] = useState(false)
  const [backendOnline, setBackendOnline] = useState(false)

  const [documents, setDocuments] = useState(INITIAL_DOCUMENTS)
  const [activeDocId, setActiveDocId] = useState(INITIAL_DOCUMENTS[0].document_id)

  const [recentActivity, setRecentActivity] = useState([
    { id: 1, title: 'Generated Quiz for CS-301', time: '2h ago', type: 'quiz', target: 'quiz-master' },
    { id: 2, title: "Searched 'Virtual Memory'", time: '3h ago', type: 'search', target: 'smart-search' },
    { id: 3, title: 'Transcribed Lecture 4', time: 'Yesterday', type: 'lecture', target: 'lecture-sync' },
  ])

  const [stats, setStats] = useState({
    minsStudied: 42,
    flashcardsReviewed: 14,
    notes: 247,
    quizzes: 38,
    hours: 124,
  })

  const themeMenuRef = useRef(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('helios_theme', theme)
    } catch {
      // Storage unavailable in sandbox; ignore
    }
  }, [theme])

  useEffect(() => {
    let mounted = true
    const poll = async () => {
      const res = await checkBackendHealth()
      if (mounted) {
        setBackendOnline(res.online)
        if (res.online) {
          Promise.allSettled([listDocuments(), listLectures(), listDatasets()])
            .then(([docsRes, lecsRes, datasetsRes]) => {
              if (!mounted) return
              const docs = docsRes.status === 'fulfilled' ? docsRes.value : []
              const lecs = lecsRes.status === 'fulfilled' ? lecsRes.value : []
              const datasets = datasetsRes.status === 'fulfilled' ? datasetsRes.value : []

              if (docs && docs.length > 0) {
                setDocuments(docs)
                setActiveDocId((prev) =>
                  docs.some((d) => d.document_id === prev) ? prev : docs[0].document_id
                )
              }

              const totalDurationSecs = lecs.reduce((acc, l) => acc + (parseFloat(l.duration) || 0), 0)
              const totalPages = (docs.length > 0 ? docs : INITIAL_DOCUMENTS).reduce(
                (acc, d) => acc + (d.pages || 1),
                0
              )

              setStats((prev) => ({
                ...prev,
                documentsCount: docs.length || INITIAL_DOCUMENTS.length,
                pagesCount: totalPages,
                lecturesCount: lecs.length || 7,
                lectureHours: Math.round((totalDurationSecs / 3600) * 10) / 10 || 18.2,
                datasetsCount: datasets.length || 3,
              }))
            })
            .catch(() => {})
        }
      }
    }
    poll()
    const id = setInterval(poll, 12000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target)) {
        setThemeMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const pushActivity = (title, type, target) => {
    setRecentActivity((prev) => [
      { id: Date.now(), title, time: 'Just now', type, target },
      ...prev.slice(0, 7),
    ])
  }

  const handleDocumentAdded = (doc) => {
    setDocuments((prev) => [
      doc,
      ...prev.filter((d) => d.document_id !== doc.document_id && d.filename !== doc.filename),
    ])
    setStats((prev) => ({ ...prev, notes: prev.notes + 1 }))
  }

  const activeDocument =
    documents.find((d) => d.document_id === activeDocId) || documents[0]
  const currentThemeObj = THEMES.find((t) => t.id === theme) || THEMES[0]

  return (
    <div
      className="h-screen w-screen flex flex-col overflow-hidden"
      style={{ background: 'var(--bg-app)', color: 'var(--text-primary)' }}
    >
      {/* TOP HEADER BAR */}
      <header
        className="h-16 px-4 sm:px-5 border-b flex items-center justify-between gap-3 shrink-0 z-30 backdrop-blur-md"
        style={{
          background: 'color-mix(in srgb, var(--bg-sidebar) 88%, transparent)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        {/* Brand + Greeting */}
        <div className="flex items-center gap-3.5 min-w-0">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-2.5 cursor-pointer shrink-0"
          >
            <span
              className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-base shadow-md"
              style={{
                background: 'linear-gradient(135deg, var(--accent-bright), var(--accent))',
                color: 'var(--accent-text)',
                boxShadow: '0 4px 18px -4px var(--accent-glow)',
              }}
            >
              H
            </span>
            <span className="font-extrabold tracking-wide text-base">HELIOS</span>
          </button>

          <span
            className="hidden sm:inline-block h-5 w-px"
            style={{ background: 'var(--border-strong)' }}
          />

          <div className="hidden sm:flex items-center gap-2 text-sm truncate">
            <span style={{ color: 'var(--accent-bright)' }}>{getGreeting()}</span>
            <span
              className="w-2 h-2 rounded-full shrink-0"
              title={backendOnline ? 'FastAPI Backend Connected' : 'FastAPI Backend Offline'}
              style={{ background: backendOnline ? 'var(--cyan)' : 'var(--danger)' }}
            />
          </div>
        </div>

        {/* Right Controls: Theme Switcher + Streak */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Theme Dropdown */}
          <div className="relative" ref={themeMenuRef}>
            {(() => {
              const currentCfg = THEME_CONFIG[currentThemeObj.id] || { icon: Circle, fill: true }
              const IconComp = currentCfg.icon
              return (
                <button
                  type="button"
                  onClick={() => setThemeMenuOpen((o) => !o)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm border cursor-pointer transition-colors"
                  style={{
                    background: 'var(--bg-card)',
                    borderColor: 'var(--border-strong)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <IconComp
                    className={`w-3.5 h-3.5 ${currentCfg.fill ? 'fill-current' : ''}`}
                    style={{ color: currentThemeObj.dot }}
                  />
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Theme:
                  </span>
                  <span className="font-semibold" style={{ color: 'var(--accent-bright)' }}>
                    {currentThemeObj.name}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                </button>
              )
            })()}

            {themeMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-52 rounded-xl border p-1.5 shadow-2xl z-50 backdrop-blur-md"
                style={{
                  background: 'var(--bg-card-elevated)',
                  borderColor: 'var(--border-strong)',
                }}
              >
                {THEMES.map((t) => {
                  const cfg = THEME_CONFIG[t.id] || { icon: Circle, fill: true }
                  const OptionIcon = cfg.icon
                  const isActive = theme === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setTheme(t.id)
                        setThemeMenuOpen(false)
                      }}
                      className="w-full px-3 py-2.5 rounded-lg text-xs font-medium flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                      style={{
                        color: isActive ? 'var(--accent-bright)' : 'var(--text-primary)',
                        background: isActive ? 'var(--accent-soft)' : 'transparent',
                      }}
                    >
                      <span className="flex items-center gap-2.5">
                        <OptionIcon
                          className={`w-3.5 h-3.5 ${cfg.fill ? 'fill-current' : ''}`}
                          style={{ color: t.dot }}
                        />
                        <span className="font-semibold">{t.name}</span>
                      </span>
                      {isActive && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded border"
                          style={{
                            borderColor: 'var(--accent-border)',
                            background: 'var(--accent-soft)',
                            color: 'var(--accent-bright)',
                          }}
                        >
                          Active
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* 5-Day Study Streak Badge */}
          <div
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border"
            style={{
              background: 'var(--gold-soft)',
              borderColor: 'rgba(245, 158, 11, 0.35)',
              color: 'var(--gold)',
            }}
          >
            <Flame className="w-4 h-4 fill-current" />
            <span className="hidden sm:inline">5-Day Study Streak</span>
            <span className="sm:hidden">5d</span>
          </div>
        </div>
      </header>

      {/* BODY: SIDEBAR RAIL + MAIN CONTENT */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Icon Rail (Desktop) */}
        <nav
          aria-label="HELIOS Modules"
          className="hidden sm:flex flex-col items-center gap-2.5 py-4 px-2.5 border-r w-[68px] shrink-0 h-full overflow-y-auto"
          style={{
            background: 'var(--bg-sidebar)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = activeTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                title={item.label}
                onClick={() => setActiveTab(item.id)}
                className="relative w-11 h-11 rounded-xl flex items-center justify-center border transition-all cursor-pointer group"
                style={{
                  background: active ? 'var(--accent-soft)' : 'transparent',
                  borderColor: active ? 'var(--accent-border)' : 'transparent',
                  color: active ? 'var(--accent-bright)' : 'var(--text-muted)',
                  boxShadow: active ? '0 0 18px -4px var(--accent-glow)' : 'none',
                }}
              >
                <Icon className="w-5 h-5" />
                {item.isLive && backendOnline && (
                  <span
                    className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                    style={{ background: 'var(--emerald)' }}
                  />
                )}
              </button>
            )
          })}
        </nav>

        {/* Main Workspace Viewport */}
        <main className="flex-1 min-w-0 h-full overflow-y-auto px-4 sm:px-6 lg:px-7 pt-5 pb-20 sm:pb-8 max-w-[1600px] mx-auto w-full">
          {activeTab === 'dashboard' && (
            <Dashboard
              onNavigate={setActiveTab}
              activeDocument={activeDocument}
              recentActivity={recentActivity}
              stats={stats}
              backendOnline={backendOnline}
              onFlashcardReveal={() =>
                setStats((prev) => ({
                  ...prev,
                  flashcardsReviewed: prev.flashcardsReviewed + 1,
                }))
              }
            />
          )}

          {activeTab === 'smart-search' && (
            <SmartSearch
              documents={documents}
              activeDocId={activeDocId}
              onSelectDoc={setActiveDocId}
              onDocumentAdded={handleDocumentAdded}
              onActivity={pushActivity}
              backendOnline={backendOnline}
            />
          )}

          {activeTab === 'quiz-master' && (
            <QuizMaster
              documents={documents}
              activeDocId={activeDocId}
              onActivity={pushActivity}
              backendOnline={backendOnline}
              onNavigate={setActiveTab}
              onQuizComplete={() =>
                setStats((prev) => ({ ...prev, quizzes: prev.quizzes + 1 }))
              }
            />
          )}

          {activeTab === 'lecture-sync' && (
            <LectureSync backendOnline={backendOnline} onActivity={pushActivity} />
          )}

          {activeTab === 'data-storyteller' && (
            <DataStoryteller
              documents={documents}
              activeDocId={activeDocId}
              backendOnline={backendOnline}
              onActivity={pushActivity}
            />
          )}

          {activeTab === 'brain-map' && (
            <BrainMap
              documents={documents}
              activeDocId={activeDocId}
              onActivity={pushActivity}
              backendOnline={backendOnline}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav
        className="sm:hidden fixed bottom-0 inset-x-0 border-t px-2 py-2 flex items-center justify-around z-30"
        style={{
          background: 'var(--bg-sidebar)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = activeTab === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className="p-2.5 rounded-xl cursor-pointer"
              style={{
                background: active ? 'var(--accent-soft)' : 'transparent',
                color: active ? 'var(--accent-bright)' : 'var(--text-muted)',
              }}
              aria-label={item.label}
            >
              <Icon className="w-5 h-5" />
            </button>
          )
        })}
      </nav>
    </div>
  )
}

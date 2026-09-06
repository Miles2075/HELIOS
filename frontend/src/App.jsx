import { useState } from 'react'
import './App.css'

const icons = {
  dashboard: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </svg>
  ),

  search: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m16 16 4 4" />
    </svg>
  ),

  quiz: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  ),

  lecture: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="8" y="3" width="8" height="12" rx="4" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" />
    </svg>
  ),

  data: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="12" width="3.5" height="7" rx="1" />
      <rect x="10.25" y="8" width="3.5" height="11" rx="1" />
      <rect x="15.5" y="5" width="3.5" height="14" rx="1" />
    </svg>
  ),

  brain: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 4.5A3.5 3.5 0 0 0 5.5 8v.5A3.5 3.5 0 0 0 4 11.5 3.5 3.5 0 0 0 7.5 15H8v1a3 3 0 0 0 3 3h1V5a3 3 0 0 0-3-3" />
      <path d="M15 4.5A3.5 3.5 0 0 1 18.5 8v.5a3.5 3.5 0 0 1 1.5 3 3.5 3.5 0 0 1-3.5 3H16v1a3 3 0 0 1-3 3h-1V5a3 3 0 0 1 3-3" />
      <path d="M8 9h2M14 9h2M8 13h2M14 13h2" />
    </svg>
  ),

  settings: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V20h-2.6v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H6.3v-2.6h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V5h2.6v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1v2.6h-.1a1.7 1.7 0 0 0-1.6 1Z" />
    </svg>
  ),
}

const themes = {
  sakura: {
    name: 'Sakura Pink',
    symbol: '✿',
    colors: {
      bg: '#181016',
      canvas: '#221720',
      card: '#2A1B24',
      border: '#4A283C',
      accent: '#F58BD5',
      accentStrong: '#F9BEDD',
      secondary: '#B8E3E9',
      text: '#FFF0F5',
      muted: '#C8A4B8',
      track: '#402332',
      green: '#9BD3B0',
      yellow: '#E5C06A',
      purple: '#B298E7',
      iconBlue: '#B8E3E9',
    },
  },

  frost: {
    name: 'Nord Frost',
    symbol: '❄',
    colors: {
      bg: '#08121D',
      canvas: '#0D1B28',
      card: '#132638',
      border: '#29485D',
      accent: '#A8D9EB',
      accentStrong: '#C5EDF7',
      secondary: '#82C7DF',
      text: '#EFF8FC',
      muted: '#8BA9BA',
      track: '#1D3447',
      green: '#9BCF9B',
      yellow: '#E8BC67',
      purple: '#B8A4DF',
      iconBlue: '#82C7DF',
    },
  },

  lavender: {
    name: 'Lavender Haze',
    symbol: '💜',
    colors: {
      bg: '#120F1B',
      canvas: '#1C1728',
      card: '#241D35',
      border: '#493A63',
      accent: '#B298E7',
      accentStrong: '#CBB8F4',
      secondary: '#B8E3E9',
      text: '#F6F1FF',
      muted: '#B3A5C9',
      track: '#332743',
      green: '#9BD3B0',
      yellow: '#E5C06A',
      purple: '#B298E7',
      iconBlue: '#B8E3E9',
    },
  },

  obsidian: {
    name: 'Obsidian Mono',
    symbol: '◐',
    colors: {
      bg: '#101010',
      canvas: '#181818',
      card: '#202020',
      border: '#383838',
      accent: '#F5F5F5',
      accentStrong: '#FFFFFF',
      secondary: '#D4D4D4',
      text: '#F7F7F7',
      muted: '#AFAFAF',
      track: '#303030',
      green: '#D4D4D4',
      yellow: '#E8E8E8',
      purple: '#BDBDBD',
      iconBlue: '#D4D4D4',
    },
  },
}

const tools = [
  {
    title: 'Smart Search',
    description: 'Ask AI across all notes & textbooks',
    icon: 'search',
    color: 'accent',
  },
  {
    title: 'Quiz Master',
    description: 'Generate instant practice exams & flashcards',
    icon: 'quiz',
    color: 'pink',
  },
  {
    title: 'Lecture Sync',
    description: 'Search & play audio lecture logs',
    icon: 'lecture',
    color: 'cyan',
  },
  {
    title: 'Data Storyteller',
    description: 'Clean spreadsheets & generate charts',
    icon: 'data',
    color: 'yellow',
  },
  {
    title: 'Brain Map',
    description: 'Visualize 3D concept networks',
    icon: 'brain',
    color: 'green',
  },
]

const subjects = [
  {
    code: 'CS-301',
    name: 'Operating Systems',
    progress: 82,
    status: 'High mastery',
    color: 'accent',
  },
  {
    code: 'CS-402',
    name: 'Machine Learning',
    progress: 45,
    status: 'Needs focus',
    color: 'pink',
  },
  {
    code: 'CS-510',
    name: 'Distributed Systems',
    progress: 90,
    status: 'High mastery',
    color: 'green',
  },
]

function App() {
  const [activeNav, setActiveNav] = useState('dashboard')
  const [activeTheme, setActiveTheme] = useState('sakura')
  const [themeOpen, setThemeOpen] = useState(false)
  const [memoryRevealed, setMemoryRevealed] = useState(false)

  const theme = themes[activeTheme]

  return (
    <div
      className={`helios-app theme-${activeTheme}`}
      style={{
        '--app-bg': theme.colors.bg,
        '--canvas': theme.colors.canvas,
        '--card': theme.colors.card,
        '--border': theme.colors.border,
        '--accent': theme.colors.accent,
        '--accent-strong': theme.colors.accentStrong,
        '--secondary': theme.colors.secondary,
        '--text': theme.colors.text,
        '--muted': theme.colors.muted,
        '--track': theme.colors.track,
        '--green': theme.colors.green,
        '--yellow': theme.colors.yellow,
        '--purple': theme.colors.purple,
        '--icon-blue': theme.colors.iconBlue,
      }}
    >
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">H</div>
          <span className="brand-name">HELIOS</span>
        </div>

        <div className="greeting">
          <span>Good Afternoon, Student</span>
          <span className="tiny-orb">●</span>
        </div>

        <div className="top-actions">
          <div className="theme-wrapper">
            <button
              className="theme-selector"
              onClick={() => setThemeOpen((prev) => !prev)}
              aria-expanded={themeOpen}
            >
              <span className="theme-symbol">{theme.symbol}</span>
              <span>
                Theme: <strong>{theme.name}</strong>
              </span>
              <span className="chevron">⌄</span>
            </button>

            {themeOpen && (
              <div className="theme-dropdown">
                {Object.entries(themes).map(([key, item]) => (
                  <button
                    key={key}
                    className={`theme-option ${
                      activeTheme === key ? 'selected' : ''
                    }`}
                    onClick={() => {
                      setActiveTheme(key)
                      setThemeOpen(false)
                    }}
                  >
                    <span
                      className="theme-dot"
                      style={{
                        background:
                          key === 'obsidian'
                            ? '#D4D4D4'
                            : item.colors.accent,
                      }}
                    />
                    <span>{item.name}</span>
                    {activeTheme === key && (
                      <span className="theme-check">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="streak">
            <span>🔥</span>
            <span>5-Day Study Streak</span>
          </div>
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <nav>
            {[
              ['dashboard', 'Dashboard'],
              ['search', 'Smart Search'],
              ['quiz', 'Quiz Master'],
              ['lecture', 'Lecture Sync'],
              ['data', 'Data Storyteller'],
              ['brain', 'Brain Map'],
            ].map(([key, label]) => (
              <button
                key={key}
                className={`nav-item ${
                  activeNav === key ? 'active' : ''
                }`}
                onClick={() => setActiveNav(key)}
                aria-label={label}
                title={label}
              >
                {icons[key]}
              </button>
            ))}
          </nav>

          <button className="nav-item settings" aria-label="Settings">
            {icons.settings}
          </button>
        </aside>

        <main className="main-content">
          <section className="welcome glass-panel">
            <div className="welcome-title">
              <span className="wave">👋</span>
              <h1>Welcome back, Student!</h1>
            </div>

            <p>
              You're on a <strong>5-Day Study Streak.</strong> Ready to
              continue mastering your courses?
            </p>

            <div className="stats">
              <span className="stat-pill">
                <span>●</span> 42 mins studied today
              </span>

              <span className="stat-pill pink">
                <span>▣</span> 14 Flashcards Reviewed
              </span>

              <span className="stat-pill green">
                <span>●</span> 3 Subjects Active
              </span>
            </div>
          </section>

          <section className="continue glass-panel">
            <div className="continue-content">
              <span className="eyebrow">
                <span>▶</span> CONTINUE STUDYING
              </span>

              <h2>📖 Operating Systems (CS-301)</h2>

              <p>
                Last active 2 hours ago · Chapter 6: Concurrency & Locks
                <span className="complete">82% Complete</span>
              </p>

              <div className="progress small">
                <div style={{ width: '82%' }} />
              </div>
            </div>

            <button className="resume-button">
              🚀 Resume Study Session
            </button>
          </section>

          <section className="suite">
            <div className="section-heading">
              <span>THE HELIOS INTELLIGENCE SUITE</span>
              <div />
            </div>

            <div className="tool-grid">
              {tools.map((tool) => (
                <button
                  className="tool-card glass-panel"
                  key={tool.title}
                  onClick={() => setActiveNav(tool.icon)}
                >
                  <div className={`tool-icon ${tool.color}`}>
                    {icons[tool.icon]}
                  </div>

                  <h3>{tool.title}</h3>
                  <p>{tool.description}</p>

                  <span className={`open-link ${tool.color}`}>
                    Open →
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="mastery glass-panel">
            <div className="section-heading">
              <span>SEMESTER KNOWLEDGE MASTERY</span>
              <div />
            </div>

            <div className="subjects">
              {subjects.map((subject) => (
                <div className="subject" key={subject.code}>
                  <div className="subject-top">
                    <div>
                      <span className={`subject-code ${subject.color}`}>
                        {subject.code}
                      </span>

                      <h3>{subject.name}</h3>
                    </div>

                    <strong className={subject.color}>
                      {subject.progress}%
                    </strong>
                  </div>

                  <div className="progress">
                    <div
                      className={subject.color}
                      style={{ width: `${subject.progress}%` }}
                    />
                  </div>

                  <span
                    className={`mastery-status ${subject.color}`}
                  >
                    ● {subject.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </main>

        <aside className="right-panel">
          <section className="side-card glass-panel memory">
            <h3>💡 DAILY MEMORY SPARK</h3>

            {!memoryRevealed ? (
              <>
                <p>
                  Do you remember what a <strong>Mutex</strong> is
                  from your OS notes?
                </p>

                <button
                  onClick={() => setMemoryRevealed(true)}
                >
                  Reveal Answer
                </button>
              </>
            ) : (
              <>
                <p>
                  A <strong>Mutex</strong> is a synchronization
                  mechanism that allows only one thread to access a
                  shared resource at a time.
                </p>

                <button
                  onClick={() => setMemoryRevealed(false)}
                >
                  Hide Answer
                </button>
              </>
            )}
          </section>

          <section className="side-card glass-panel">
            <h3>⚡ RECENT ACTIVITY</h3>

            <div className="activity">
              <div className="activity-icon">
                {icons.quiz}
              </div>

              <div>
                <strong>Generated Quiz for CS-301</strong>
                <small>2h ago</small>
              </div>
            </div>

            <div className="activity">
              <div className="activity-icon">
                {icons.search}
              </div>

              <div>
                <strong>Searched 'Virtual Memory'</strong>
                <small>3h ago</small>
              </div>
            </div>

            <div className="activity">
              <div className="activity-icon">
                {icons.lecture}
              </div>

              <div>
                <strong>Transcribed Lecture 4</strong>
                <small>Yesterday</small>
              </div>
            </div>
          </section>

          <section className="side-card glass-panel document">
            <h3>📄 ACTIVE DOCUMENT</h3>

            <div className="document-row">
              <div className="document-icon">
                {icons.quiz}
              </div>

              <div>
                <strong>Operating_Systems.pdf</strong>
                <span className="ingested">
                  ● 48/48 Pages Ingested
                </span>
                <small>ChromaDB Ready</small>
              </div>
            </div>

            <div className="document-progress" />
          </section>

          <section className="side-card glass-panel numbers">
            <div>
              <strong>247</strong>
              <span>Notes</span>
            </div>

            <div>
              <strong>38</strong>
              <span>Quizzes</span>
            </div>

            <div>
              <strong>124</strong>
              <span>Hours</span>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

export default App
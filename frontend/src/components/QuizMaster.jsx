import { useEffect, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  ExternalLink,
  Eye,
  FileText,
  Flame,
  Layers,
  Lightbulb,
  Loader2,
  Lock,
  Maximize2,
  Mic,
  Play,
  RotateCcw,
  RotateCw,
  Search,
  ShieldCheck,
  Sigma,
  Sparkles,
  Trophy,
  Unlock,
  Video,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import {
  generateQuiz,
  getLectureVisuals,
  getQuizCampaign,
  listLectures,
} from '../api/client'

const isGenuineMathLatex = (latex) => {
  if (!latex || typeof latex !== 'string') return false
  const lower = latex.toLowerCase()
  if (['def ', 'solve', 'alpha x', 'beta x', 'gamma', 'print', 'class', 'import', 'return'].some((kw) => lower.includes(kw))) {
    return false
  }
  return ['=', '\\frac', '\\int', '\\sum', '^', '\\vec', '\\cdot'].some((op) => latex.includes(op))
}

export default function QuizMaster({
  documents = [],
  activeDocId,
  onActivity,
  onQuizComplete,
  backendOnline,
  onNavigate,
}) {
  // Navigation mode: 'campaign' (Fog of War) vs 'classic' (Standard test)
  const [mode, setMode] = useState('campaign')

  // Available Lectures & Documents for Campaign
  const [lectures, setLectures] = useState([])
  const [selectedSourceType, setSelectedSourceType] = useState('lecture') // 'lecture' | 'document'
  const [selectedSourceId, setSelectedSourceId] = useState(null)
  const [stageCount, setStageCount] = useState(0) // 0 = auto-adaptive

  // Campaign State
  const [campaign, setCampaign] = useState(null)
  const [loadingCampaign, setLoadingCampaign] = useState(false)
  const [campaignError, setCampaignError] = useState('')
  const [currentStageIdx, setCurrentStageIdx] = useState(0)
  const [unlockedStageIdx, setUnlockedStageIdx] = useState(0) // Stages 0..unlockedStageIdx are accessible
  const [stageAnswers, setStageAnswers] = useState({}) // { [stageIdx]: { optionKey, isCorrect } }
  const [stageScore, setStageScore] = useState(0) // XP
  const [inspectedVisual, setInspectedVisual] = useState(null) // Lightbox slide preview
  const [campaignComplete, setCampaignComplete] = useState(false)

  // Classic Quiz Mode State
  const [selectedDocId, setSelectedDocId] = useState(activeDocId || documents[0]?.document_id || null)
  const [quizType, setQuizType] = useState('mcq')
  const [difficulty, setDifficulty] = useState('medium')
  const [count, setCount] = useState(5)
  const [classicLoading, setClassicLoading] = useState(false)
  const [classicError, setClassicError] = useState('')
  const [classicQuiz, setClassicQuiz] = useState(null)
  const [classicAnswers, setClassicAnswers] = useState({})
  const [cardIndex, setCardIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [knownCards, setKnownCards] = useState({})

  // Load lectures on mount
  useEffect(() => {
    let active = true
    listLectures()
      .then((rows) => {
        if (!active) return
        setLectures(rows || [])
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  // Auto-select valid source when lectures or documents update
  useEffect(() => {
    if (lectures.length > 0) {
      if (selectedSourceType === 'lecture' && !lectures.some((l) => l.lecture_id === selectedSourceId)) {
        setSelectedSourceId(lectures[0].lecture_id)
      }
    } else if (documents.length > 0) {
      if (selectedSourceType === 'lecture' || !documents.some((d) => d.document_id === selectedSourceId)) {
        setSelectedSourceType('document')
        setSelectedSourceId(documents[0].document_id)
      }
    } else {
      setSelectedSourceId(null)
      setCampaign(null)
      setCampaignError('')
    }
  }, [lectures, documents, selectedSourceType, selectedSourceId])

  // Auto-load campaign on lecture selection, source change or stageCount change
  useEffect(() => {
    if (!selectedSourceId) return
    handleLoadCampaign(selectedSourceType, selectedSourceId, stageCount)
  }, [selectedSourceId, selectedSourceType, stageCount])

  const handleLoadCampaign = async (sourceType, sourceId, count = stageCount) => {
    if (!sourceId) return
    setLoadingCampaign(true)
    setCampaignError('')
    setCurrentStageIdx(0)
    setUnlockedStageIdx(0)
    setStageAnswers({})
    setStageScore(0)
    setCampaignComplete(false)

    try {
      const data = await getQuizCampaign({
        source_type: sourceType,
        source_id: sourceId,
        difficulty: 'medium',
        stage_count: count > 0 ? count : undefined,
      })
      setCampaign(data)
      onActivity?.(
        `Initialized 'Fog of War' Campaign for '${data.source_title}' (${data.total_stages} chapters)`,
        'quiz',
        'quiz-master'
      )
    } catch (err) {
      setCampaignError(err.message || 'Failed to initialize campaign.')
    } finally {
      setLoadingCampaign(false)
    }
  }

  // Submit Answer for Current Stage
  const handleAnswerStage = (optionKey) => {
    if (!campaign) return
    const stage = campaign.stages[currentStageIdx]
    if (!stage) return
    if (stageAnswers[currentStageIdx]?.answered) return // already answered

    const isCorrect = optionKey === stage.question.correct_answer
    const nextAnswers = {
      ...stageAnswers,
      [currentStageIdx]: {
        answered: true,
        isCorrect,
        selectedOption: optionKey,
      },
    }
    setStageAnswers(nextAnswers)

    if (isCorrect) {
      setStageScore((s) => s + 100)
      // Unlock next stage if this was the frontier stage
      if (currentStageIdx === unlockedStageIdx) {
        const nextUnlock = unlockedStageIdx + 1
        setUnlockedStageIdx(nextUnlock)
        if (nextUnlock >= campaign.stages.length) {
          setCampaignComplete(true)
          onQuizComplete?.()
          onActivity?.(
            `100% Cleared Fog of War for '${campaign.source_title}'! All chapters unlocked!`,
            'quiz',
            'quiz-master'
          )
        }
      }
    }
  }

  // Retry Current Stage
  const handleRetryStage = () => {
    setStageAnswers((prev) => {
      const copy = { ...prev }
      delete copy[currentStageIdx]
      return copy
    })
  }

  // Advance to Next Chapter
  const handleAdvanceNextStage = () => {
    if (currentStageIdx < unlockedStageIdx && currentStageIdx < campaign.stages.length - 1) {
      setCurrentStageIdx((prev) => prev + 1)
    }
  }

  // Classic Quiz Generation Handler
  const handleGenerateClassic = async () => {
    setClassicLoading(true)
    setClassicError('')
    setClassicAnswers({})
    setCardIndex(0)
    setFlipped(false)
    setKnownCards({})
    try {
      const res = await generateQuiz({
        document_id: Number(selectedDocId),
        question_count: Number(count),
        difficulty,
        type: quizType,
      })
      setClassicQuiz(res)
      const docName = documents.find((d) => d.document_id === Number(selectedDocId))?.filename || `Doc #${selectedDocId}`
      onActivity?.(`Generated ${quizType.toUpperCase()} test for ${docName}`, 'quiz', 'quiz-master')
    } catch (err) {
      setClassicError(err.message || 'Failed to generate quiz.')
    } finally {
      setClassicLoading(false)
    }
  }

  const selectClassicAnswer = (qIdx, optionKey) => {
    if (classicAnswers[qIdx]) return
    const next = { ...classicAnswers, [qIdx]: optionKey }
    setClassicAnswers(next)
    if (classicQuiz && Object.keys(next).length === classicQuiz.questions.length) {
      onQuizComplete?.()
    }
  }

  const activeStage = campaign?.stages?.[currentStageIdx] || null
  const activeAnswer = stageAnswers[currentStageIdx] || null
  const fogPercentage = campaign?.total_stages
    ? Math.round((Math.min(unlockedStageIdx, campaign.total_stages) / campaign.total_stages) * 100)
    : 0

  return (
    <div className="flex flex-col gap-5 pb-8">
      {/* Top Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm"
            style={{
              background: 'var(--accent-soft)',
              borderColor: 'var(--accent)',
              color: 'var(--accent)',
            }}
          >
            <Compass className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold m-0 flex items-center gap-2">
              <span>Quiz Master</span>
              <span
                className="text-[11px] font-mono-code font-bold px-2 py-0.5 rounded-full border uppercase"
                style={{
                  background: 'var(--accent-soft)',
                  borderColor: 'var(--accent-border)',
                  color: 'var(--accent-bright)',
                }}
              >
                Fog of War Engine
              </span>
            </h1>
            <p className="text-xs sm:text-sm m-0" style={{ color: 'var(--text-secondary)' }}>
              Master lecture videos stage-by-stage. Clear checkpoints to lift the Fog of War and unlock professor slides.
            </p>
          </div>
        </div>

        {/* Mode Switcher Pill */}
        <div
          className="p-1 rounded-xl border flex items-center gap-1 w-fit"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          <button
            type="button"
            onClick={() => setMode('campaign')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              mode === 'campaign' ? 'shadow-sm' : 'opacity-70 hover:opacity-100'
            }`}
            style={{
              background: mode === 'campaign' ? 'var(--accent)' : 'transparent',
              color: mode === 'campaign' ? 'var(--accent-text)' : 'var(--text-secondary)',
            }}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Fog of War Campaign</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('classic')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              mode === 'classic' ? 'shadow-sm' : 'opacity-70 hover:opacity-100'
            }`}
            style={{
              background: mode === 'classic' ? 'var(--accent)' : 'transparent',
              color: mode === 'classic' ? 'var(--accent-text)' : 'var(--text-secondary)',
            }}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Standard Exam Mode</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODE 1: FOG OF WAR LECTURE CAMPAIGN */}
      {/* ===================================================================== */}
      {mode === 'campaign' && (
        <div className="flex flex-col gap-5">
          {/* Campaign Selector Bar */}
          <div className="helios-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 min-w-0 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-wider uppercase" style={{ color: 'var(--text-secondary)' }}>
                  Lecture Campaign:
                </span>
              </div>

              {lectures.length === 0 && documents.length === 0 ? (
                <div
                  className="px-3.5 py-2 rounded-xl text-xs font-medium border"
                  style={{
                    background: 'var(--bg-input)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  No materials uploaded yet (Upload in Smart Search or Lecture Sync)
                </div>
              ) : (
                <select
                  value={`${selectedSourceType}-${selectedSourceId}`}
                  onChange={(e) => {
                    const [st, id] = e.target.value.split('-')
                    setSelectedSourceType(st)
                    setSelectedSourceId(Number(id))
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border outline-none max-w-lg cursor-pointer"
                  style={{
                    background: 'var(--bg-input)',
                    borderColor: 'var(--border-strong)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {lectures.length > 0 && (
                    <optgroup label="🎥 Lecture Videos & Audio Logs">
                      {lectures.map((l) => (
                        <option key={`lecture-${l.lecture_id}`} value={`lecture-${l.lecture_id}`}>
                          {l.filename} ({Math.round((l.duration || 0) / 60)} mins)
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {documents.length > 0 && (
                    <optgroup label="📄 Course Documents & Syllabi">
                      {documents.map((d) => (
                        <option key={`document-${d.document_id}`} value={`document-${d.document_id}`}>
                          {d.filename} ({d.pages || d.page_count || 1} pages)
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              )}

              {/* Chapter Depth Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-wider uppercase" style={{ color: 'var(--text-secondary)' }}>
                  Chapters:
                </span>
                <select
                  value={stageCount}
                  onChange={(e) => setStageCount(Number(e.target.value))}
                  className="px-2.5 py-2 rounded-xl text-xs font-semibold border outline-none cursor-pointer"
                  style={{
                    background: 'var(--bg-input)',
                    borderColor: 'var(--border-strong)',
                    color: 'var(--text-primary)',
                  }}
                  title="Configure number of chapter checkpoints for this campaign"
                >
                  <option value={0}>Auto (Adaptive to Video)</option>
                  <option value={5}>5 Chapters (Quick Overview)</option>
                  <option value={10}>10 Chapters (Full Modules)</option>
                  <option value={15}>15 Chapters (Deep Mastery)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => handleLoadCampaign(selectedSourceType, selectedSourceId)}
                disabled={loadingCampaign || !selectedSourceId}
                className="helios-btn-primary px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {loadingCampaign ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                <span>Restart Campaign</span>
              </button>
            </div>
          </div>

          {campaignError && (
            <div
              className="p-4 rounded-xl border flex items-center gap-2 text-xs"
              style={{
                background: 'rgba(251, 113, 133, 0.12)',
                borderColor: 'rgba(251, 113, 133, 0.4)',
                color: 'var(--danger)',
              }}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{campaignError}</span>
            </div>
          )}

          {/* Loading Campaign State */}
          {loadingCampaign ? (
            <div className="helios-card p-12 text-center flex flex-col items-center justify-center min-h-[360px] gap-3">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent)' }} />
              <h3 className="text-base font-bold m-0" style={{ color: 'var(--text-primary)' }}>
                Constructing Lecture Chapter Roadmap...
              </h3>
              <p className="text-xs max-w-md m-0" style={{ color: 'var(--text-secondary)' }}>
                Aligning lecture video keyframes, slide equations, and speech timestamps into chronological checkpoints.
              </p>
            </div>
          ) : !campaign ? (
            <div className="helios-card p-10 text-center flex flex-col items-center justify-center min-h-[300px]">
              <Compass className="w-10 h-10 mb-3 opacity-40" style={{ color: 'var(--accent)' }} />
              <h3 className="text-base font-bold m-0" style={{ color: 'var(--text-primary)' }}>
                {lectures.length === 0 && documents.length === 0 ? 'No Study Materials Ingested Yet' : 'No Campaign Initialized'}
              </h3>
              <p className="text-xs mt-1 max-w-md" style={{ color: 'var(--text-secondary)' }}>
                {lectures.length === 0 && documents.length === 0
                  ? 'Upload lecture videos or audio in Lecture Sync, or PDF textbooks in Smart Search to generate your interactive "Fog of War" Mindmap campaign.'
                  : 'Select an uploaded lecture or document above and click Restart Campaign.'}
              </p>
            </div>
          ) : (
            <>
              {/* =================================================================== */}
              {/* CAMPAIGN METRICS & "FOG OF WAR" PROGRESS HEADER */}
              {/* =================================================================== */}
              <div
                className="helios-card p-5 border relative overflow-hidden"
                style={{
                  background:
                    'radial-gradient(ellipse at top right, var(--accent-soft), transparent 60%), var(--bg-card)',
                  borderColor: 'var(--border-strong)',
                }}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-code text-[11px] font-bold px-2 py-0.5 rounded uppercase" style={{ background: 'var(--bg-app)', color: 'var(--accent-bright)' }}>
                        Campaign Mission
                      </span>
                      <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                        {campaign.total_stages} Sequential Chapter Stages
                      </span>
                    </div>

                    <h2 className="text-lg sm:text-xl font-extrabold mt-1 truncate m-0" style={{ color: 'var(--text-primary)' }}>
                      {campaign.source_title}
                    </h2>
                  </div>

                  {/* Fog of War Gauge & XP */}
                  <div className="flex items-center gap-3 shrink-0 flex-wrap">
                    <div className="px-3 py-1.5 rounded-xl border flex items-center gap-2" style={{ background: 'var(--bg-app)', borderColor: 'var(--border-subtle)' }}>
                      <Flame className="w-4 h-4 fill-current text-amber-400" />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mastery Score</span>
                        <span className="text-xs font-bold text-amber-300">+{stageScore} XP</span>
                      </div>
                    </div>

                    <div className="px-3 py-1.5 rounded-xl border flex items-center gap-2" style={{ background: 'var(--bg-app)', borderColor: 'var(--border-subtle)' }}>
                      <Unlock className="w-4 h-4 text-emerald-400" />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fog Lifted</span>
                        <span className="text-xs font-bold text-emerald-400">{fogPercentage}% Cleared</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fog of War Progress Bar */}
                <div className="mt-4 h-2 w-full rounded-full overflow-hidden" style={{ background: 'var(--bg-app)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${fogPercentage}%`,
                      background: 'linear-gradient(90deg, var(--accent), var(--emerald))',
                    }}
                  />
                </div>
              </div>

              {/* =================================================================== */}
              {/* THE "FOG OF WAR" MINDMAP & CHAPTER ROADMAP */}
              {/* =================================================================== */}
              <div className="helios-card p-5 sm:p-6 border flex flex-col gap-4" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold tracking-[0.16em] uppercase flex items-center gap-1.5 m-0" style={{ color: 'var(--accent)' }}>
                      <Compass className="w-3.5 h-3.5" />
                      INTERACTIVE CHAPTER MINDMAP · ROADMAP OF THE LECTURE
                    </h3>
                    <p className="text-[11px] mt-0.5 m-0" style={{ color: 'var(--text-muted)' }}>
                      Click on any cleared chapter to review slides or jump playback. Locked chapters remain shrouded in fog until unlocked.
                    </p>
                  </div>

                  <span className="text-xs font-semibold px-2 py-0.5 rounded border" style={{ background: 'var(--bg-card-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                    Stage {currentStageIdx + 1} of {campaign.stages.length}
                  </span>
                </div>

                {/* The Stage Nodes Timeline */}
                <div className="relative pt-3 pb-2 overflow-x-auto">
                  <div className="flex items-center justify-between gap-4 min-w-[650px] relative">
                    {/* Connecting Baseline Beam */}
                    <div
                      className="absolute left-6 right-6 top-6 h-1 -translate-y-1/2 z-0 rounded-full"
                      style={{ background: 'var(--bg-app)' }}
                    />

                    {campaign.stages.map((st, idx) => {
                      const isCleared = idx < unlockedStageIdx
                      const isActive = idx === currentStageIdx
                      const isLocked = idx > unlockedStageIdx
                      const isFrontier = idx === unlockedStageIdx

                      return (
                        <div
                          key={st.stage_id}
                          className="flex flex-col items-center text-center relative z-10 flex-1 group"
                        >
                          {/* Node Button */}
                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() => setCurrentStageIdx(idx)}
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all cursor-pointer ${
                              isActive
                                ? 'scale-110 shadow-lg ring-4 ring-purple-500/30'
                                : isCleared
                                ? 'hover:scale-105'
                                : isLocked
                                ? 'opacity-50 cursor-not-allowed'
                                : 'hover:scale-105'
                            }`}
                            style={{
                              background: isCleared
                                ? 'var(--emerald-soft)'
                                : isActive
                                ? 'var(--accent)'
                                : isLocked
                                ? 'rgba(0, 0, 0, 0.45)'
                                : 'var(--bg-card-elevated)',
                              borderColor: isCleared
                                ? 'var(--emerald)'
                                : isActive
                                ? 'var(--accent-bright)'
                                : isLocked
                                ? 'var(--border-subtle)'
                                : 'var(--border-strong)',
                              color: isCleared
                                ? 'var(--emerald)'
                                : isActive
                                ? 'var(--accent-text)'
                                : isLocked
                                ? 'var(--text-muted)'
                                : 'var(--text-primary)',
                            }}
                            title={
                              isLocked
                                ? `Locked in Fog of War. Clear Stage ${unlockedStageIdx + 1} to unlock.`
                                : st.title
                            }
                          >
                            {isCleared ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            ) : isActive ? (
                              <Play className="w-5 h-5 fill-current ml-0.5 animate-pulse text-white" />
                            ) : isLocked ? (
                              <Lock className="w-4 h-4 text-gray-400" />
                            ) : (
                              <Sparkles className="w-4 h-4" />
                            )}
                          </button>

                          {/* Stage Number & Title */}
                          <div className="mt-2.5 flex flex-col items-center max-w-[120px]">
                            <span
                              className="text-[10px] font-bold uppercase tracking-wider"
                              style={{
                                color: isCleared
                                  ? 'var(--emerald)'
                                  : isActive
                                  ? 'var(--accent-bright)'
                                  : 'var(--text-muted)',
                              }}
                            >
                              {isCleared ? 'Cleared' : isActive ? 'Current Trial' : isLocked ? 'Fog of War' : 'Available'}
                            </span>
                            <span
                              className="text-xs font-bold truncate w-full mt-0.5"
                              style={{ color: isLocked ? 'var(--text-muted)' : 'var(--text-primary)' }}
                            >
                              {isLocked ? 'Classified' : st.title.split(':')[1]?.trim() || `Chapter ${st.stage_number}`}
                            </span>
                            <span className="font-mono-code text-[10px] opacity-75 mt-0.5" style={{ color: 'var(--text-muted)' }}>
                              {st.timestamp_label}
                            </span>
                          </div>

                          {/* Visual Milestone Pill */}
                          {st.visual && !isLocked && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setInspectedVisual(st.visual)
                              }}
                              className="mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-md border flex items-center gap-1 cursor-pointer hover:scale-105 transition-transform"
                              style={{
                                background: 'var(--bg-app)',
                                borderColor: 'var(--border-subtle)',
                                color: 'var(--accent-bright)',
                              }}
                              title="Click to inspect professor's slide"
                            >
                              <Eye className="w-2.5 h-2.5" />
                              <span>Slide #{st.stage_number}</span>
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* =================================================================== */}
              {/* ACTIVE STAGE TRIAL CARD (THE GATED QUESTION & SLIDE PROOF) */}
              {/* =================================================================== */}
              {activeStage && (
                <div
                  className="helios-card p-6 sm:p-7 border flex flex-col gap-5 relative overflow-hidden"
                  style={{
                    borderColor: activeAnswer?.isCorrect
                      ? 'rgba(52, 211, 153, 0.5)'
                      : activeAnswer && !activeAnswer.isCorrect
                      ? 'rgba(251, 113, 133, 0.5)'
                      : 'var(--border-strong)',
                  }}
                >
                  {/* Stage Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="font-mono-code text-[11px] font-bold px-2.5 py-0.5 rounded-lg uppercase"
                          style={{
                            background: 'var(--accent-soft)',
                            color: 'var(--accent-bright)',
                          }}
                        >
                          Stage {activeStage.stage_number} of {campaign.stages.length}
                        </span>

                        <span className="font-mono-code text-xs font-semibold px-2.5 py-0.5 rounded-lg border flex items-center gap-1" style={{ background: 'var(--bg-app)', borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                          <Clock className="w-3 h-3" />
                          {activeStage.timestamp_label}
                        </span>
                      </div>

                      <h2 className="text-lg sm:text-xl font-extrabold mt-2 m-0" style={{ color: 'var(--text-primary)' }}>
                        {activeStage.title}
                      </h2>
                    </div>

                    {/* Stage Status Badge */}
                    <div>
                      {activeAnswer?.isCorrect ? (
                        <span className="px-3 py-1 rounded-full text-xs font-bold border inline-flex items-center gap-1.5" style={{ background: 'var(--emerald-soft)', borderColor: 'var(--emerald)', color: 'var(--emerald)' }}>
                          <CheckCircle2 className="w-4 h-4" /> Stage Cleared (+100 XP)
                        </span>
                      ) : activeAnswer && !activeAnswer.isCorrect ? (
                        <span className="px-3 py-1 rounded-full text-xs font-bold border inline-flex items-center gap-1.5" style={{ background: 'rgba(251, 113, 133, 0.14)', borderColor: 'var(--danger)', color: 'var(--danger)' }}>
                          <XCircle className="w-4 h-4" /> Concept Gap Detected
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-bold border inline-flex items-center gap-1.5" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-border)', color: 'var(--accent-bright)' }}>
                          <Compass className="w-4 h-4" /> Active Challenge
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Professor's Slide & Context Teaser */}
                  {activeStage.visual && (
                    <div
                      className="p-4 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-4"
                      style={{
                        background: 'var(--bg-card-elevated)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          onClick={() => setInspectedVisual(activeStage.visual)}
                          className="w-16 h-12 rounded-lg overflow-hidden border bg-black shrink-0 relative cursor-pointer group"
                          style={{ borderColor: 'var(--border-subtle)' }}
                        >
                          <img
                            src={activeStage.visual.image_url}
                            alt={activeStage.visual.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Maximize2 className="w-3.5 h-3.5 text-white" />
                          </div>
                        </div>

                        <div className="min-w-0">
                          <span className="text-[10px] font-mono uppercase font-bold tracking-wider" style={{ color: 'var(--accent)' }}>
                            Professor&apos;s Lecture Slide Milestone
                          </span>
                          <h4 className="text-xs sm:text-sm font-bold truncate m-0" style={{ color: 'var(--text-primary)' }}>
                            {activeStage.visual.title}
                          </h4>
                          <p className="text-[11px] truncate m-0 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                            {activeStage.summary}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setInspectedVisual(activeStage.visual)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold border inline-flex items-center gap-1.5 cursor-pointer hover:opacity-90"
                          style={{
                            background: 'var(--bg-app)',
                            borderColor: 'var(--border-subtle)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <Maximize2 className="w-3 h-3" /> Inspect Slide
                        </button>

                        <button
                          type="button"
                          onClick={() => onNavigate?.('lecture-sync')}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold border inline-flex items-center gap-1.5 cursor-pointer hover:opacity-90"
                          style={{
                            background: 'var(--accent-soft)',
                            borderColor: 'var(--accent)',
                            color: 'var(--accent-bright)',
                          }}
                        >
                          <Play className="w-3 h-3" /> Jump to Video
                        </button>
                      </div>
                    </div>
                  )}

                  {/* LaTeX Equation Block if present and genuine math */}
                  {isGenuineMathLatex(activeStage.visual?.latex) && (
                    <div
                      className="p-3.5 rounded-xl border font-mono text-xs flex flex-col gap-1"
                      style={{
                        background: 'var(--bg-app)',
                        borderColor: 'rgba(168, 85, 247, 0.4)',
                      }}
                    >
                      <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: '#c084fc' }}>
                        Derived Mathematical Formula:
                      </span>
                      <div className="text-sm font-bold text-amber-300 overflow-x-auto py-0.5">
                        $${activeStage.visual.latex}$$
                      </div>
                    </div>
                  )}

                  {/* Slide Text / Code Snippet if present and not a math formula */}
                  {(!isGenuineMathLatex(activeStage.visual?.latex)) && activeStage.visual?.ocr_text && (
                    <div
                      className="p-3.5 rounded-xl border font-mono text-xs flex flex-col gap-1"
                      style={{
                        background: 'var(--bg-app)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      <span className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5" style={{ color: 'var(--accent-bright)' }}>
                        <FileText className="w-3.5 h-3.5" /> Slide Code & Key Concepts:
                      </span>
                      <pre className="text-xs font-mono-code text-cyan-300 overflow-x-auto py-0.5 m-0 whitespace-pre-wrap">
                        {activeStage.visual.ocr_text}
                      </pre>
                    </div>
                  )}

                  {/* The Stage Question */}
                  <div className="flex flex-col gap-3">
                    <div className="text-sm sm:text-base font-bold leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                      <span className="mr-2 font-mono-code" style={{ color: 'var(--accent)' }}>
                        Q{activeStage.stage_number}.
                      </span>
                      {activeStage.question.question}
                    </div>

                    {/* 4 Interactive Option Buttons */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                      {Object.entries(activeStage.question.options || {}).map(([key, label]) => {
                        const isPicked = activeAnswer?.selectedOption === key
                        const isAnswer = activeStage.question.correct_answer === key
                        let bg = 'var(--bg-card-elevated)'
                        let border = 'var(--border-subtle)'
                        let textCol = 'var(--text-primary)'

                        if (activeAnswer) {
                          if (isAnswer) {
                            bg = 'var(--emerald-soft)'
                            border = 'rgba(52, 211, 153, 0.55)'
                            textCol = 'var(--emerald)'
                          } else if (isPicked && !isAnswer) {
                            bg = 'rgba(251, 113, 133, 0.14)'
                            border = 'rgba(251, 113, 133, 0.5)'
                            textCol = 'var(--danger)'
                          }
                        }

                        return (
                          <button
                            key={key}
                            type="button"
                            disabled={Boolean(activeAnswer)}
                            onClick={() => handleAnswerStage(key)}
                            className="p-3.5 rounded-xl border text-left text-xs sm:text-sm flex items-center justify-between gap-2 transition-all cursor-pointer disabled:cursor-default"
                            style={{ background: bg, borderColor: border, color: textCol }}
                          >
                            <span>
                              <strong className="font-mono-code mr-2">{key}.</strong>
                              {label}
                            </span>
                            {activeAnswer && isAnswer && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />}
                            {activeAnswer && isPicked && !isAnswer && <XCircle className="w-4 h-4 shrink-0 text-rose-400" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Gating Evaluation Result & Action Buttons */}
                  {activeAnswer && (
                    <div
                      className="p-4 rounded-xl border flex flex-col gap-3"
                      style={{
                        background: activeAnswer.isCorrect ? 'var(--emerald-soft)' : 'rgba(251, 113, 133, 0.1)',
                        borderColor: activeAnswer.isCorrect ? 'rgba(52, 211, 153, 0.4)' : 'rgba(251, 113, 133, 0.4)',
                      }}
                    >
                      <div className="flex items-start gap-2.5">
                        {activeAnswer.isCorrect ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <h4 className="text-sm font-bold m-0" style={{ color: activeAnswer.isCorrect ? 'var(--emerald)' : 'var(--danger)' }}>
                            {activeAnswer.isCorrect
                              ? 'Stage Mastered! Fog of War Lifted!'
                              : `Incorrect Answer: Concept Gap in Chapter ${activeStage.stage_number}`}
                          </h4>
                          <p className="text-xs mt-1 leading-relaxed m-0" style={{ color: 'var(--text-secondary)' }}>
                            {activeStage.question.explanation}
                          </p>
                        </div>
                      </div>

                      {/* Action Triggers */}
                      <div className="flex items-center justify-between gap-3 pt-2 border-t flex-wrap" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                        {!activeAnswer.isCorrect ? (
                          <>
                            <span className="text-xs text-rose-300 font-medium">
                              Review the professor&apos;s slide above to clear this stage.
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setInspectedVisual(activeStage.visual)}
                                className="px-3.5 py-1.5 rounded-lg text-xs font-bold border inline-flex items-center gap-1.5 cursor-pointer"
                                style={{ background: 'var(--bg-app)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                              >
                                <Eye className="w-3.5 h-3.5" /> Review Slide
                              </button>
                              <button
                                type="button"
                                onClick={handleRetryStage}
                                className="px-3.5 py-1.5 rounded-lg text-xs font-bold border inline-flex items-center gap-1.5 cursor-pointer"
                                style={{ background: 'var(--danger)', color: 'white', borderColor: 'transparent' }}
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> Retry Question
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="text-xs text-emerald-300 font-medium">
                              {currentStageIdx + 1 < campaign.stages.length
                                ? 'Chapter unlocked! Ready to enter the next trial?'
                                : 'All stages cleared! Full lecture campaign completed!'}
                            </span>

                            {currentStageIdx + 1 < campaign.stages.length ? (
                              <button
                                type="button"
                                onClick={handleAdvanceNextStage}
                                className="helios-btn-primary px-5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <span>Advance to Chapter {currentStageIdx + 2}</span>
                                <ArrowRight className="w-4 h-4" />
                              </button>
                            ) : (
                              <span className="text-xs font-extrabold text-emerald-400 flex items-center gap-1">
                                <Trophy className="w-4 h-4" /> Campaign 100% Complete!
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Campaign Complete Victory Banner */}
              {campaignComplete && (
                <div
                  className="helios-card p-8 border text-center flex flex-col items-center gap-3 shadow-2xl"
                  style={{
                    background: 'radial-gradient(circle at center, var(--emerald-soft), var(--bg-card))',
                    borderColor: 'var(--emerald)',
                  }}
                >
                  <Trophy className="w-12 h-12 text-emerald-400 animate-bounce" />
                  <h2 className="text-2xl font-black m-0" style={{ color: 'var(--text-primary)' }}>
                    Lecture Campaign 100% Cleared!
                  </h2>
                  <p className="text-sm max-w-lg m-0 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    You have successfully lifted the Fog of War across every milestone of <strong>{campaign.source_title}</strong>. All slides, equations, and speech principles are now permanently unlocked in your Knowledge Mindmap.
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleLoadCampaign(selectedSourceType, selectedSourceId)}
                      className="px-4 py-2 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 cursor-pointer"
                      style={{ background: 'var(--bg-app)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Replay Campaign
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate?.('lecture-sync')}
                      className="helios-btn-primary px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Video className="w-3.5 h-3.5" /> Review in Lecture Sync
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* High-Resolution Slide Inspection Modal */}
          {inspectedVisual && (
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
                    <span className="text-xs uppercase font-bold tracking-wider px-2.5 py-1 rounded-lg border inline-flex items-center gap-1.5" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent)', color: 'var(--accent-bright)' }}>
                      Slide Milestone
                    </span>
                    <span className="font-mono-code text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: 'var(--bg-app)', color: 'var(--accent-bright)' }}>
                      Timestamp: {Math.floor(inspectedVisual.timestamp / 60)}:{(Math.floor(inspectedVisual.timestamp % 60)).toString().padStart(2, '0')}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setInspectedVisual(null)}
                    className="p-1.5 rounded-lg border cursor-pointer opacity-70 hover:opacity-100"
                    style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="rounded-xl overflow-hidden border bg-black aspect-video flex items-center justify-center" style={{ borderColor: 'var(--border-subtle)' }}>
                  <img
                    src={inspectedVisual.image_url}
                    alt={inspectedVisual.title}
                    className="w-full h-full object-contain"
                  />
                </div>

                <div>
                  <h3 className="text-base font-bold m-0" style={{ color: 'var(--text-primary)' }}>
                    {inspectedVisual.title}
                  </h3>
                  <p className="text-xs sm:text-sm mt-1 leading-relaxed m-0" style={{ color: 'var(--text-secondary)' }}>
                    {inspectedVisual.description}
                  </p>
                </div>

                {isGenuineMathLatex(inspectedVisual.latex) && (
                  <div
                    className="p-3.5 rounded-xl border font-mono text-xs flex flex-col gap-1.5"
                    style={{
                      background: 'var(--bg-app)',
                      borderColor: 'rgba(168, 85, 247, 0.4)',
                    }}
                  >
                    <span className="text-[11px] uppercase font-bold tracking-wider" style={{ color: '#c084fc' }}>
                      Extracted Mathematical Equation:
                    </span>
                    <div className="text-sm font-bold text-amber-300 py-1 overflow-x-auto">
                      $${inspectedVisual.latex}$$
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODE 2: CLASSIC QUICK EXAM & FLASHCARD MODE */}
      {/* ===================================================================== */}
      {mode === 'classic' && (
        <div className="flex flex-col gap-5">
          {classicError && (
            <div
              className="p-3.5 rounded-xl border flex items-center gap-2 text-sm"
              style={{
                background: 'rgba(251, 113, 133, 0.12)',
                borderColor: 'rgba(251, 113, 133, 0.4)',
                color: 'var(--danger)',
              }}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {classicError}
            </div>
          )}

          {/* Config Bar */}
          <div className="helios-card p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-end border" style={{ borderColor: 'var(--border-subtle)' }}>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Document
              </label>
              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl text-xs border outline-none"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border-strong)',
                  color: 'var(--text-primary)',
                }}
              >
                {documents.map((d) => (
                  <option key={d.document_id} value={d.document_id}>
                    {d.filename}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Format
              </label>
              <select
                value={quizType}
                onChange={(e) => setQuizType(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-xs border outline-none"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border-strong)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="mcq">Multiple Choice (MCQ)</option>
                <option value="true_false">True / False</option>
                <option value="flashcard">Flashcards</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Difficulty
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-xs border outline-none"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border-strong)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Questions: {count}
              </label>
              <input
                type="range"
                min="2"
                max="10"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full accent-pink-400"
              />
            </div>

            <button
              type="button"
              disabled={classicLoading}
              onClick={handleGenerateClassic}
              className="helios-btn-primary py-2.5 px-4 rounded-xl text-xs sm:text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              {classicLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate Quiz
            </button>
          </div>

          {/* Classic Quiz Content */}
          {!classicQuiz ? (
            <div className="helios-card p-10 text-center flex flex-col items-center justify-center min-h-[300px]">
              <Trophy className="w-10 h-10 mb-3" style={{ color: 'var(--accent)' }} />
              <h2 className="text-lg font-bold m-0">Ready to Test Your Knowledge?</h2>
              <p className="mt-1.5 text-sm max-w-md" style={{ color: 'var(--text-secondary)' }}>
                Select a document, format, and difficulty above, then click{' '}
                <strong style={{ color: 'var(--accent-bright)' }}>Generate Quiz</strong>.
              </p>
            </div>
          ) : classicQuiz.type === 'flashcard' ? (
            /* FLASHCARD MODE */
            <div className="helios-card p-6 flex flex-col items-center">
              <div className="w-full flex items-center justify-between text-xs mb-4">
                <span style={{ color: 'var(--text-secondary)' }}>
                  Card {cardIndex + 1} of {classicQuiz.questions.length}
                </span>
                <span style={{ color: 'var(--emerald)' }}>
                  Mastered: {Object.values(knownCards).filter(Boolean).length} / {classicQuiz.questions.length}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setFlipped((f) => !f)}
                className="w-full max-w-2xl min-h-[240px] p-8 rounded-2xl border flex flex-col items-center justify-center text-center cursor-pointer transition-all"
                style={{
                  background: flipped ? 'var(--accent-soft)' : 'var(--bg-card-elevated)',
                  borderColor: flipped ? 'var(--accent-border)' : 'var(--border-strong)',
                }}
              >
                <span
                  className="text-[11px] font-bold tracking-[0.16em] uppercase mb-3"
                  style={{ color: flipped ? 'var(--emerald)' : 'var(--accent)' }}
                >
                  {flipped ? 'ANSWER' : 'CONCEPT — CLICK TO FLIP'}
                </span>
                <div className="text-lg sm:text-xl font-bold leading-relaxed">
                  {flipped
                    ? classicQuiz.questions[cardIndex]?.correct_answer
                    : classicQuiz.questions[cardIndex]?.question}
                </div>
                {flipped && (
                  <p className="mt-3 text-xs max-w-lg" style={{ color: 'var(--text-secondary)' }}>
                    {classicQuiz.questions[cardIndex]?.explanation}
                  </p>
                )}
                <span className="mt-5 inline-flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  <RotateCw className="w-3 h-3" /> Tap card to flip
                </span>
              </button>

              <div className="mt-5 flex items-center gap-3 flex-wrap justify-center">
                <button
                  type="button"
                  disabled={cardIndex === 0}
                  onClick={() => {
                    setFlipped(false)
                    setCardIndex((i) => Math.max(0, i - 1))
                  }}
                  className="px-4 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  style={{ background: 'var(--bg-card-elevated)', borderColor: 'var(--border-subtle)' }}
                >
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>

                <button
                  type="button"
                  onClick={() => setKnownCards((prev) => ({ ...prev, [cardIndex]: !prev[cardIndex] }))}
                  className="px-4 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  style={{
                    background: knownCards[cardIndex] ? 'var(--emerald-soft)' : 'var(--bg-card-elevated)',
                    borderColor: knownCards[cardIndex] ? 'rgba(52, 211, 153, 0.5)' : 'var(--border-subtle)',
                    color: knownCards[cardIndex] ? 'var(--emerald)' : 'var(--text-primary)',
                  }}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {knownCards[cardIndex] ? 'Mastered' : 'Mark as Known'}
                </button>

                <button
                  type="button"
                  disabled={cardIndex >= classicQuiz.questions.length - 1}
                  onClick={() => {
                    setFlipped(false)
                    setCardIndex((i) => Math.min(classicQuiz.questions.length - 1, i + 1))
                  }}
                  className="px-4 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  style={{ background: 'var(--bg-card-elevated)', borderColor: 'var(--border-subtle)' }}
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* MCQ & TRUE/FALSE MODE */
            <div className="flex flex-col gap-4">
              <div className="helios-card p-4 flex flex-wrap items-center justify-between gap-3 border" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono-code px-2 py-0.5 rounded" style={{ background: 'var(--accent-soft)', color: 'var(--accent-bright)' }}>
                    Quiz #{classicQuiz.quiz_id}
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Answered {Object.keys(classicAnswers).length} / {classicQuiz.questions.length}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm font-bold" style={{ color: 'var(--emerald)' }}>
                    Score: {classicQuiz.questions.reduce((acc, q, idx) => acc + (classicAnswers[idx] === q.correct_answer ? 1 : 0), 0)} / {classicQuiz.questions.length}
                  </div>
                  {Object.keys(classicAnswers).length > 0 && (
                    <button
                      type="button"
                      onClick={() => setClassicAnswers({})}
                      className="px-3 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      style={{
                        background: 'var(--bg-card-elevated)',
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Retake
                    </button>
                  )}
                </div>
              </div>

              {classicQuiz.questions.map((q, qIdx) => {
                const picked = classicAnswers[qIdx]
                const isCorrect = picked === q.correct_answer
                return (
                  <div key={qIdx} className="helios-card p-5 border" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="text-sm font-bold leading-relaxed">
                      <span className="mr-2 font-mono-code" style={{ color: 'var(--accent)' }}>
                        Q{qIdx + 1}.
                      </span>
                      {q.question}
                    </div>

                    <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {Object.entries(q.options || {}).map(([key, label]) => {
                        const isPicked = picked === key
                        const isAnswer = q.correct_answer === key
                        let bg = 'var(--bg-card-elevated)'
                        let border = 'var(--border-subtle)'
                        let textCol = 'var(--text-primary)'

                        if (picked) {
                          if (isAnswer) {
                            bg = 'var(--emerald-soft)'
                            border = 'rgba(52, 211, 153, 0.55)'
                            textCol = 'var(--emerald)'
                          } else if (isPicked && !isAnswer) {
                            bg = 'rgba(251, 113, 133, 0.14)'
                            border = 'rgba(251, 113, 133, 0.5)'
                            textCol = 'var(--danger)'
                          }
                        }

                        return (
                          <button
                            key={key}
                            type="button"
                            disabled={Boolean(picked)}
                            onClick={() => selectClassicAnswer(qIdx, key)}
                            className="p-3 rounded-xl border text-left text-xs sm:text-sm flex items-center justify-between gap-2 transition-all cursor-pointer disabled:cursor-default"
                            style={{ background: bg, borderColor: border, color: textCol }}
                          >
                            <span>
                              <strong className="font-mono-code mr-2">{key}.</strong>
                              {label}
                            </span>
                            {picked && isAnswer && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                            {picked && isPicked && !isAnswer && <XCircle className="w-4 h-4 shrink-0" />}
                          </button>
                        )
                      })}
                    </div>

                    {picked && (
                      <div
                        className="mt-3.5 p-3 rounded-xl border text-xs leading-relaxed"
                        style={{
                          background: isCorrect ? 'var(--emerald-soft)' : 'var(--accent-soft)',
                          borderColor: isCorrect ? 'rgba(52, 211, 153, 0.35)' : 'var(--accent-border)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <strong className="mr-1.5" style={{ color: isCorrect ? 'var(--emerald)' : 'var(--accent-bright)' }}>
                          {isCorrect ? 'Correct!' : `Correct Answer: ${q.correct_answer}.`}
                        </strong>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

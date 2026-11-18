import { useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  RotateCcw,
  RotateCw,
  Sparkles,
  Trophy,
  XCircle,
} from 'lucide-react'
import { generateQuiz } from '../api/client'

export default function QuizMaster({ documents, activeDocId, onActivity, onQuizComplete, backendOnline }) {
  const [selectedDocId, setSelectedDocId] = useState(activeDocId || documents[0]?.document_id || 1)
  const [quizType, setQuizType] = useState('mcq')
  const [difficulty, setDifficulty] = useState('medium')
  const [count, setCount] = useState(5)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [quiz, setQuiz] = useState(null)
  const [answers, setAnswers] = useState({})
  const [cardIndex, setCardIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [knownCards, setKnownCards] = useState({})

  const docId = documents.some((d) => d.document_id === selectedDocId)
    ? selectedDocId
    : documents[0]?.document_id || 1

  const handleGenerate = async () => {
    setLoading(true)
    setError('')
    setAnswers({})
    setCardIndex(0)
    setFlipped(false)
    setKnownCards({})
    try {
      const res = await generateQuiz({
        document_id: Number(docId),
        question_count: Number(count),
        difficulty,
        type: quizType,
      })
      setQuiz(res)
      const docName = documents.find((d) => d.document_id === Number(docId))?.filename || `Doc #${docId}`
      onActivity?.(`Generated ${quizType.toUpperCase()} quiz for ${docName}`, 'quiz', 'quiz-master')
    } catch (err) {
      setError(err.message || 'Failed to generate quiz.')
    } finally {
      setLoading(false)
    }
  }

  const selectAnswer = (qIdx, optionKey) => {
    if (answers[qIdx]) return
    const next = { ...answers, [qIdx]: optionKey }
    setAnswers(next)
    if (quiz && Object.keys(next).length === quiz.questions.length) {
      onQuizComplete?.()
    }
  }

  const totalAnswered = Object.keys(answers).length
  const totalCorrect = quiz
    ? quiz.questions.reduce((acc, q, idx) => acc + (answers[idx] === q.correct_answer ? 1 : 0), 0)
    : 0

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="w-9 h-9 rounded-xl flex items-center justify-center border"
            style={{
              background: 'var(--accent-soft)',
              borderColor: 'var(--accent-border)',
              color: 'var(--accent)',
            }}
          >
            <FileText className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold m-0">Quiz Master</h1>
            <p className="text-xs sm:text-sm m-0" style={{ color: 'var(--text-secondary)' }}>
              Generate validated MCQs, True/False checks, and interactive flashcards from your study materials.
            </p>
          </div>
        </div>

        <span
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border w-fit"
          style={{
            background: (quiz?._mode === 'live' || backendOnline) ? 'var(--emerald-soft)' : 'var(--accent-soft)',
            borderColor: (quiz?._mode === 'live' || backendOnline) ? 'rgba(52, 211, 153, 0.4)' : 'var(--accent-border)',
            color: (quiz?._mode === 'live' || backendOnline) ? 'var(--emerald)' : 'var(--accent-bright)',
          }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          {(quiz?._mode === 'live' || backendOnline) ? 'Live /api/quiz/generate' : 'Preview /api/quiz/generate'}
        </span>
      </div>

      {error && (
        <div
          className="p-3.5 rounded-xl border flex items-center gap-2 text-sm"
          style={{
            background: 'rgba(251, 113, 133, 0.12)',
            borderColor: 'rgba(251, 113, 133, 0.4)',
            color: 'var(--danger)',
          }}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Config Bar */}
      <div className="helios-card p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-end">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Document
          </label>
          <select
            value={docId}
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
          disabled={loading}
          onClick={handleGenerate}
          className="helios-btn-primary py-2.5 px-4 rounded-xl text-xs sm:text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Generate Quiz
        </button>
      </div>

      {/* Quiz Content */}
      {!quiz ? (
        <div className="helios-card p-10 text-center flex flex-col items-center justify-center min-h-[300px]">
          <Trophy className="w-10 h-10 mb-3" style={{ color: 'var(--accent)' }} />
          <h2 className="text-lg font-bold m-0">Ready to Test Your Knowledge?</h2>
          <p className="mt-1.5 text-sm max-w-md" style={{ color: 'var(--text-secondary)' }}>
            Select a document, format, and difficulty above, then click{' '}
            <strong style={{ color: 'var(--accent-bright)' }}>Generate Quiz</strong>.
          </p>
        </div>
      ) : quiz.type === 'flashcard' ? (
        /* FLASHCARD MODE */
        <div className="helios-card p-6 flex flex-col items-center">
          <div className="w-full flex items-center justify-between text-xs mb-4">
            <span style={{ color: 'var(--text-secondary)' }}>
              Card {cardIndex + 1} of {quiz.questions.length}
            </span>
            <span style={{ color: 'var(--emerald)' }}>
              Mastered: {Object.values(knownCards).filter(Boolean).length} / {quiz.questions.length}
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
                ? quiz.questions[cardIndex]?.correct_answer
                : quiz.questions[cardIndex]?.question}
            </div>
            {flipped && (
              <p className="mt-3 text-xs max-w-lg" style={{ color: 'var(--text-secondary)' }}>
                {quiz.questions[cardIndex]?.explanation}
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
              disabled={cardIndex >= quiz.questions.length - 1}
              onClick={() => {
                setFlipped(false)
                setCardIndex((i) => Math.min(quiz.questions.length - 1, i + 1))
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
          {/* Score Bar */}
          <div className="helios-card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono-code px-2 py-0.5 rounded" style={{ background: 'var(--accent-soft)', color: 'var(--accent-bright)' }}>
                Quiz #{quiz.quiz_id}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                Answered {totalAnswered} / {quiz.questions.length}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm font-bold" style={{ color: 'var(--emerald)' }}>
                Score: {totalCorrect} / {quiz.questions.length}
              </div>
              {totalAnswered > 0 && (
                <button
                  type="button"
                  onClick={() => setAnswers({})}
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

          {quiz.questions.map((q, qIdx) => {
            const picked = answers[qIdx]
            const isCorrect = picked === q.correct_answer
            return (
              <div key={qIdx} className="helios-card p-5">
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
                        onClick={() => selectAnswer(qIdx, key)}
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
  )
}

import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart3,
  BookOpen,
  FileText,
  Layers,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
  X,
  Zap,
} from 'lucide-react'
import { getDocumentPages, runRetrievalBenchmark, uploadSearchDocument } from '../api/client'
import { SmartSearchView } from './SmartSearchView'

const NOTES_STORAGE_KEY = 'helios-saved-notes-v1'

function generateQuestionsForDocument(filename = '') {
  const lower = filename.toLowerCase()
  if (lower.includes('heat')) {
    return [
      'What is the hospital preparedness plan during extreme heat?',
      'What are the first aid instructions for heat exhaustion and heatstroke?',
      'What is the spectrum and classification of heat-related illnesses?',
      'What vulnerable populations require specialized clinical care in heatwaves?',
    ]
  }
  if (lower.includes('os') || lower.includes('operating')) {
    return [
      'Why can adding more memory frames cause more page faults (Belady\'s anomaly)?',
      'What is the difference between a mutex and a spinlock when waiting for a lock?',
      'What are the four Coffman conditions required for a deadlock to occur?',
      'How does the TLB accelerate virtual-to-physical address translation?',
    ]
  }
  return [
    `Summarize the key concepts and arguments introduced in ${filename || 'this document'}.`,
    'What are the primary definitions, formulas, or mechanisms explained?',
    'What critical edge cases or guidelines are highlighted in the text?',
    'Explain the main conclusions with exact page citations.',
  ]
}

export default function SmartSearch({
  documents = [],
  activeDocId,
  onSelectDoc,
  onDocumentAdded,
  onActivity,
  backendOnline = false,
}) {
  const [docPages, setDocPages] = useState({}) // { [docId]: [{ pageNumber, title, content }] }
  const [loadingDocId, setLoadingDocId] = useState(null)
  const [isAsking, setIsAsking] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)

  // Benchmark modal states
  const [showBenchmarkModal, setShowBenchmarkModal] = useState(false)
  const [benchmarkData, setBenchmarkData] = useState(null)
  const [runningBenchmark, setRunningBenchmark] = useState(false)
  const [benchmarkError, setBenchmarkError] = useState('')

  const fileInputRef = useRef(null)

  // Saved notes persistence
  const [savedNotes, setSavedNotes] = useState(() => {
    try {
      const raw = localStorage.getItem(NOTES_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return parsed
      }
    } catch {
      // ignore
    }
    return []
  })

  useEffect(() => {
    try {
      localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(savedNotes))
    } catch {
      // ignore
    }
  }, [savedNotes])

  const savedNoteSignatures = useMemo(() => {
    const set = new Set()
    for (const note of savedNotes) {
      set.add(`${note.documentId}::${note.id.replace(/^note-/, '')}`)
    }
    return set
  }, [savedNotes])

  // Map incoming documents to StudyDocument shape with real pages
  const studyDocuments = useMemo(() => {
    return (documents || []).map((doc, idx) => {
      const id = String(doc.document_id ?? doc.id ?? idx + 1)
      const fileName = doc.filename || doc.fileName || `document_${id}.pdf`
      const title = doc.title || fileName
      const courseCode = doc.subject || doc.courseCode || 'General'
      const courseName = doc.courseName || doc.subject || title
      const masteryPercent = doc.progress ?? doc.masteryPercent ?? 85
      const lastChapter = doc.lastChapter || 'Chapter 1: Foundations'

      const pages = docPages[id] || []

      return {
        id,
        title,
        fileName,
        courseCode,
        courseName,
        masteryPercent,
        lastChapter,
        pages,
        suggestedQuestions: generateQuestionsForDocument(fileName),
        source: 'uploaded',
        uploadedAt: doc.uploaded_at || new Date().toISOString(),
      }
    })
  }, [documents, docPages])

  // Resolve active document
  const activeDoc = useMemo(() => {
    if (studyDocuments.length === 0) return null
    if (activeDocId) {
      const found = studyDocuments.find((d) => d.id === String(activeDocId))
      if (found) return found
    }
    return studyDocuments[0]
  }, [studyDocuments, activeDocId])

  // Fetch pages for active document if not yet cached
  useEffect(() => {
    if (!activeDoc) return
    const id = activeDoc.id
    if (docPages[id] && docPages[id].length > 0) return

    let cancelled = false
    setLoadingDocId(id)

    getDocumentPages(id)
      .then((pages) => {
        if (cancelled) return
        if (Array.isArray(pages) && pages.length > 0) {
          const formatted = pages.map((p, idx) => ({
            pageNumber: p.page_number ?? p.page ?? idx + 1,
            title: p.title || `Page ${p.page_number ?? p.page ?? idx + 1}`,
            content: p.text || p.content || '',
          }))
          setDocPages((prev) => ({ ...prev, [id]: formatted }))
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingDocId(null)
      })

    return () => {
      cancelled = true
    }
  }, [activeDoc?.id])

  // Conversation messages state
  const [messages, setMessages] = useState([
    {
      id: 'init-1',
      role: 'assistant',
      content:
        'Welcome to HELIOS Smart Search. Ask questions across your documents or scope to a specific PDF. Every response is grounded with exact citations and verbatim highlight spans.',
      timestamp: 'Just now',
      citations: [],
      followUpQuestions: [
        'What are the core concepts and definitions explained in this material?',
        'What are the key protocols and steps highlighted in the text?',
        'Summarize the primary guidelines with exact page citations.',
      ],
      foundInDocument: true,
    },
  ])

  const formatTimeNow = () =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  // Ask Question handler
  const handleAskQuestion = async (questionText, scopeDocId) => {
    const trimmed = questionText.trim()
    if (!trimmed) return

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: formatTimeNow(),
    }
    setMessages((prev) => [...prev, userMsg])
    setIsAsking(true)

    try {
      const isSearchAll = !scopeDocId || scopeDocId === 'all'
      const targetDoc = !isSearchAll ? studyDocuments.find((d) => d.id === scopeDocId) || activeDoc : null

      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const endpoint = isSearchAll ? '/api/qa/search-all' : '/api/qa/ask'
      const payload = isSearchAll
        ? {
            documents: studyDocuments.map((d) => ({
              id: d.id,
              title: d.title,
              fileName: d.fileName,
              pages: d.pages,
            })),
            question: trimmed,
            history: historyPayload,
          }
        : {
            documentTitle: targetDoc?.title || targetDoc?.fileName || 'Study Document',
            pages: targetDoc?.pages || [],
            question: trimmed,
            history: historyPayload,
          }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || data.detail || 'Unable to retrieve answer right now.')
      }

      const cleanCitations = (data.citations || []).map((c) => ({
        ...c,
        documentId: c.documentId || targetDoc?.id || activeDoc?.id || '1',
        fileName: c.fileName || targetDoc?.fileName || activeDoc?.fileName || 'Document',
        documentTitle: c.documentTitle || targetDoc?.title || activeDoc?.title || 'Document',
      }))

      const asstMsg = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: data.answer || 'No answer could be generated from the document text.',
        citations: cleanCitations,
        followUpQuestions: data.followUpQuestions || [],
        foundInDocument: data.foundInDocument !== false,
        timestamp: formatTimeNow(),
      }

      setMessages((prev) => [...prev, asstMsg])

      if (cleanCitations.length > 0 && cleanCitations[0].documentId) {
        onSelectDoc?.(cleanCitations[0].documentId)
      }

      onActivity?.({
        title: trimmed.length > 34 ? `${trimmed.slice(0, 32)}...` : trimmed,
        time: 'Just now',
        type: 'search',
        detail: cleanCitations[0]
          ? `${cleanCitations[0].fileName} · p. ${cleanCitations[0].pageNumber}`
          : 'Smart Search Q&A',
      })
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `asst-err-${Date.now()}`,
          role: 'assistant',
          content: `Unable to complete search: ${err.message}`,
          citations: [],
          timestamp: formatTimeNow(),
          foundInDocument: false,
        },
      ])
    } finally {
      setIsAsking(false)
    }
  }

  // Save Note handler
  const handleSaveNote = (question, answerMsg) => {
    const docId = answerMsg.citations?.[0]?.documentId || activeDoc?.id || 'general'
    const docTitle = answerMsg.citations?.[0]?.documentTitle || activeDoc?.title || 'Study Document'

    const newNote = {
      id: `note-${Date.now()}`,
      documentId: docId,
      documentTitle: docTitle,
      question,
      answer: answerMsg.content,
      citations: answerMsg.citations || [],
      savedAt: new Date().toISOString(),
    }

    setSavedNotes((prev) => [newNote, ...prev])

    onActivity?.({
      title: 'Saved Research Note',
      time: 'Just now',
      type: 'note',
      detail: question.length > 30 ? `${question.slice(0, 28)}...` : question,
    })
  }

  // Upload trigger
  const handleTriggerUpload = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    setUploadError(null)

    try {
      const nextId = (documents.length ? Math.max(...documents.map((d) => d.document_id || d.id || 0)) : 0) + 1
      const uploaded = await uploadSearchDocument(file, nextId)

      onDocumentAdded?.(uploaded)
      if (uploaded.document_id || uploaded.id) {
        onSelectDoc?.(String(uploaded.document_id || uploaded.id))
      }

      onActivity?.({
        title: `Uploaded "${file.name}"`,
        time: 'Just now',
        type: 'upload',
        detail: `${uploaded.pages || 1} pages extracted & indexed`,
      })
    } catch (err) {
      setUploadError(err.message || 'Failed to upload document')
    } finally {
      setIsUploading(false)
      if (e.target) e.target.value = ''
    }
  }

  // Run Benchmark
  const handleRunBenchmark = async () => {
    setRunningBenchmark(true)
    setBenchmarkError('')
    try {
      const data = await runRetrievalBenchmark()
      setBenchmarkData(data)
    } catch (err) {
      setBenchmarkError(err.message || 'Benchmark execution failed')
    } finally {
      setRunningBenchmark(false)
    }
  }

  // Empty state if no documents are in system
  if (studyDocuments.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-[520px] rounded-2xl border p-8 text-center"
        style={{
          background: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt"
          onChange={handleFileChange}
          className="hidden"
        />
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border"
          style={{
            background: 'var(--accent-soft)',
            borderColor: 'var(--accent-border)',
            color: 'var(--accent-bright)',
          }}
        >
          <FileText className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          No Study Documents Ingested
        </h2>
        <p
          className="text-sm max-w-md mb-6 leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          Upload your syllabus, lecture slides, or textbook chapter PDF to activate HELIOS Smart Search
          with reciprocal rank fusion (RRF) and verbatim excerpt highlighting.
        </p>

        {uploadError && (
          <div
            className="mb-4 px-4 py-2 rounded-xl text-xs font-medium border"
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              borderColor: 'rgba(239, 68, 68, 0.35)',
              color: '#f87171',
            }}
          >
            {uploadError}
          </div>
        )}

        <button
          type="button"
          onClick={handleTriggerUpload}
          disabled={isUploading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer shadow-md transition-all hover:scale-[1.02]"
          style={{
            background: 'var(--accent-solid)',
            color: 'var(--accent-solid-text)',
          }}
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Indexing Document...</span>
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              <span>Upload PDF Document</span>
            </>
          )}
        </button>
      </div>
    )
  }

  return (
    <div className="relative w-full flex flex-col gap-3">
      {/* Hidden file input for upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Top Utility Bar with Benchmark Trigger */}
      <div className="flex items-center justify-between px-2 pt-1">
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            HELIOS Smart Search
          </span>
          <span>·</span>
          <span>
            {studyDocuments.length} Document{studyDocuments.length > 1 ? 's' : ''} Loaded
          </span>
          {loadingDocId && (
            <span className="flex items-center gap-1 text-[11px] text-amber-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading pages...
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setShowBenchmarkModal(true)
            if (!benchmarkData) handleRunBenchmark()
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all hover:opacity-90"
          style={{
            background: 'var(--bg-app)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
        >
          <BarChart3 className="w-3.5 h-3.5" style={{ color: 'var(--accent-bright)' }} />
          <span>V6 Retrieval Benchmark</span>
        </button>
      </div>

      {/* Upload Error Banner */}
      {uploadError && (
        <div
          className="px-4 py-2 rounded-xl text-xs font-medium border"
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            borderColor: 'rgba(239, 68, 68, 0.35)',
            color: '#f87171',
          }}
        >
          {uploadError}
        </div>
      )}

      {/* Working SmartSearchView from Zip */}
      <SmartSearchView
        documents={studyDocuments}
        activeDoc={activeDoc}
        onSelectDocument={(id) => onSelectDoc?.(id)}
        messages={messages}
        isAsking={isAsking}
        onAskQuestion={handleAskQuestion}
        onClearMessages={() => setMessages([])}
        onSaveNote={handleSaveNote}
        savedNoteSignatures={savedNoteSignatures}
        onTriggerUpload={handleTriggerUpload}
        isUploading={isUploading}
        onUpdateDocumentMeta={() => {}}
      />

      {/* V6 Retrieval Benchmark Modal */}
      {showBenchmarkModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border p-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto"
            style={{
              background: 'var(--bg-surface)',
              borderColor: 'var(--border-strong)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" style={{ color: 'var(--accent-bright)' }} />
                <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                  Empirical Retrieval Benchmark (MRR & Recall)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBenchmarkModal(false)}
                className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {runningBenchmark ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent-bright)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Running empirical benchmark queries across RRF, BM25, and dense embeddings...
                </p>
              </div>
            ) : benchmarkError ? (
              <div className="p-4 rounded-xl text-xs text-red-400 bg-red-950/30 border border-red-800/40">
                {benchmarkError}
              </div>
            ) : benchmarkData ? (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {(benchmarkData.leaderboard || []).map((row) => (
                    <div
                      key={row.strategy}
                      className="p-3 rounded-xl border flex flex-col gap-1"
                      style={{
                        background: row.champion ? 'var(--accent-soft)' : 'var(--bg-app)',
                        borderColor: row.champion ? 'var(--accent-border)' : 'var(--border-subtle)',
                      }}
                    >
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span style={{ color: 'var(--text-primary)' }}>{row.label}</span>
                        {row.champion && (
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                            style={{ background: 'var(--emerald)', color: '#000' }}
                          >
                            #1 Rank
                          </span>
                        )}
                      </div>
                      <div className="text-xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
                        MRR: {row.mrr_at_5}
                      </div>
                      <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                        Latency: {row.avg_latency_ms} ms · Recall: {row.recall_hit_rate}%
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleRunBenchmark}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer"
                    style={{
                      background: 'var(--bg-app)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Re-run Evaluation</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

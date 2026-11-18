import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  FileText,
  Loader2,
  Search,
  Send,
  Sparkles,
  Upload,
} from 'lucide-react'
import { askSmartSearch, uploadSearchDocument } from '../api/client'

export default function SmartSearch({
  documents,
  activeDocId,
  onSelectDoc,
  onDocumentAdded,
  onActivity,
  backendOnline,
}) {
  const [question, setQuestion] = useState('')
  const [searchAll, setSearchAll] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Upload a PDF or TXT study document, or ask a question about Operating_Systems.pdf or biology.pdf to receive grounded answers with page-level citations.',
      sources: [],
    },
  ])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState(null)

  const fileInputRef = useRef(null)
  const chatEndRef = useRef(null)
  const activeDoc = documents.find((d) => d.document_id === activeDocId) || documents[0]
  const isLive = mode === 'live' || (mode === null && backendOnline)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const getQuickPrompts = (doc) => {
    switch (doc?.document_id) {
      case 2:
        return ['What is photosynthesis?', 'Where does the Calvin Cycle occur?', 'What do chloroplasts contain?']
      case 3:
        return ['How does Backpropagation work?', 'Explain Gradient Descent & Adam', 'How does Dropout prevent overfitting?']
      case 4:
        return ['Why use B+ Trees for indexes?', 'How does Write-Ahead Logging (WAL) work?', 'What is Strict 2PL concurrency?']
      case 5:
        return ['Explain the TCP 3-Way Handshake', 'How does TCP BBR control congestion?', 'How does TLS 1.3 achieve 1-RTT?']
      default:
        return ['What is a Mutex?', 'Explain virtual memory and TLB', 'What are the four deadlock conditions?']
    }
  }

  const quickPrompts = getQuickPrompts(activeDoc)

  const handleUpload = async (file) => {
    if (!file) return
    setError('')
    setUploading(true)
    try {
      const nextId = Math.max(...documents.map((d) => d.document_id), 0) + 1
      const res = await uploadSearchDocument(file, nextId)
      setMode(res._mode || 'contract-preview')
      onDocumentAdded?.({
        document_id: res.document_id,
        filename: res.filename,
        pages: res.pages || 1,
        ingested: true,
        subject: 'Custom',
        sections: res.sections || [],
      })
      onSelectDoc?.(res.document_id)
      onActivity?.(`Uploaded '${res.filename}'`, 'search', 'smart-search')
    } catch (err) {
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleAsk = async (promptText) => {
    const q = (promptText ?? question).trim()
    if (!q || (!searchAll && !activeDoc)) return
    setError('')
    setQuestion('')
    setMessages((prev) => [...prev, { role: 'user', text: q }])
    setLoading(true)
    try {
      const targetDocId = searchAll ? null : activeDoc.document_id
      const res = await askSmartSearch(targetDocId, q, documents)
      setMode(res._mode || 'contract-preview')
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: res.answer,
          sources: res.sources || [],
        },
      ])
      onActivity?.(`Searched '${q.slice(0, 26)}${q.length > 26 ? '…' : ''}'`, 'search', 'smart-search')
    } catch (err) {
      setError(err.message || 'Failed to query document')
    } finally {
      setLoading(false)
    }
  }

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
            <Search className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold m-0">Smart Search</h1>
            <p className="text-xs sm:text-sm m-0" style={{ color: 'var(--text-secondary)' }}>
              Ask natural-language questions across uploaded PDF &amp; TXT documents with page-level citations.
            </p>
          </div>
        </div>

        <span
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border w-fit"
          style={{
            background: isLive ? 'var(--emerald-soft)' : 'var(--accent-soft)',
            borderColor: isLive ? 'rgba(52, 211, 153, 0.4)' : 'var(--accent-border)',
            color: isLive ? 'var(--emerald)' : 'var(--accent-bright)',
          }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          {isLive ? 'Live ChromaDB (/api/search/*)' : 'API Contract Mode (/api/search/*)'}
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

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
        {/* LEFT: Document Store */}
        <div className="flex flex-col gap-4">
          <div className="helios-card p-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt"
              className="hidden"
              onChange={(e) => {
                handleUpload(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="helios-btn-primary w-full py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload PDF / TXT Document
            </button>

            <div className="mt-4">
              <div
                className="text-[11px] font-bold tracking-[0.14em] uppercase mb-2.5"
                style={{ color: 'var(--text-secondary)' }}
              >
                DOCUMENT STORE ({documents.length})
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setSearchAll((v) => !v)}
                  className="p-2.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between cursor-pointer"
                  style={{
                    background: searchAll ? 'var(--emerald-soft)' : 'var(--bg-card-elevated)',
                    borderColor: searchAll ? 'rgba(52, 211, 153, 0.45)' : 'var(--border-subtle)',
                    color: searchAll ? 'var(--emerald)' : 'var(--text-secondary)',
                  }}
                >
                  <span>Search Across All Documents</span>
                  <span>{searchAll ? 'ON' : 'OFF'}</span>
                </button>
                {documents.map((doc) => {
                  const selected = !searchAll && doc.document_id === activeDoc?.document_id
                  return (
                    <button
                      key={doc.document_id}
                      type="button"
                      onClick={() => {
                        setSearchAll(false)
                        onSelectDoc?.(doc.document_id)
                      }}
                      className="p-3 rounded-xl border text-left transition-all cursor-pointer"
                      style={{
                        background: selected ? 'var(--accent-soft)' : 'var(--bg-card-elevated)',
                        borderColor: selected ? 'var(--accent-border)' : 'var(--border-subtle)',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 shrink-0" style={{ color: 'var(--accent)' }} />
                        <span className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                          {doc.filename}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[11px]">
                        <span className="inline-flex items-center gap-1" style={{ color: 'var(--emerald)' }}>
                          <CheckCircle2 className="w-3 h-3" /> {doc.pages} pages
                        </span>
                        <span className="font-mono-code" style={{ color: 'var(--text-muted)' }}>
                          ID #{doc.document_id}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Q&A Chat + Citations */}
        <div className="helios-card p-5 flex flex-col min-h-[500px] justify-between gap-4">
          <div className="flex flex-col gap-4 overflow-y-auto max-h-[460px] pr-1">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className="max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed border"
                  style={
                    msg.role === 'user'
                      ? {
                          background: 'var(--accent-soft)',
                          borderColor: 'var(--accent-border)',
                          color: 'var(--text-primary)',
                        }
                      : {
                          background: 'var(--bg-card-elevated)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--text-primary)',
                        }
                  }
                >
                  {msg.text}

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t flex flex-col gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
                      <div
                        className="text-[10px] font-bold tracking-[0.14em] uppercase"
                        style={{ color: 'var(--accent)' }}
                      >
                        PAGE-LEVEL CITATIONS ({msg.sources.length})
                      </div>
                      {msg.sources.map((src, sIdx) => (
                        <div
                          key={sIdx}
                          className="p-2.5 rounded-xl border text-xs"
                          style={{
                            background: 'var(--bg-app)',
                            borderColor: 'var(--border-subtle)',
                          }}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-semibold flex items-center gap-1.5" style={{ color: 'var(--accent-bright)' }}>
                              <BookOpen className="w-3.5 h-3.5" />
                              {src.document}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {typeof src.distance === 'number' && (
                                <span
                                  className="font-mono-code text-[10px] px-2 py-0.5 rounded-full"
                                  style={{ background: 'var(--emerald-soft)', color: 'var(--emerald)' }}
                                >
                                  dist {src.distance.toFixed(2)}
                                </span>
                              )}
                              <span
                                className="font-mono-code text-[10px] px-2 py-0.5 rounded-full"
                                style={{ background: 'var(--accent-soft)', color: 'var(--accent-bright)' }}
                              >
                                Page {src.page}
                              </span>
                            </div>
                          </div>
                          <p className="m-0 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            &ldquo;{src.text}&rdquo;
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-xs px-2" style={{ color: 'var(--accent)' }}>
                <Loader2 className="w-4 h-4 animate-spin" />
                Searching semantic index in {searchAll ? 'all uploaded documents' : activeDoc?.filename}...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="flex flex-col gap-2.5 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map((qp) => (
                <button
                  key={qp}
                  type="button"
                  onClick={() => handleAsk(qp)}
                  className="text-[11px] px-3 py-1 rounded-full border cursor-pointer hover:opacity-90"
                  style={{
                    background: 'var(--bg-card-elevated)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {qp}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleAsk()
              }}
              className="flex gap-2.5"
            >
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={`Ask anything about ${activeDoc?.filename || 'your document'}...`}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm border outline-none"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border-strong)',
                  color: 'var(--text-primary)',
                }}
              />
              <button
                type="submit"
                disabled={loading || !question.trim()}
                className="helios-btn-primary px-4 py-2.5 rounded-xl text-sm inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                Ask
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

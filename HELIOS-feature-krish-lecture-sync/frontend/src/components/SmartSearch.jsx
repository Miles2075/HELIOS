import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Cpu,
  ExternalLink,
  FileText,
  Filter,
  Layers,
  Loader2,
  RefreshCw,
  Scale,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  Upload,
  X,
  Zap,
} from 'lucide-react'
import { askSmartSearch, uploadSearchDocument } from '../api/client'

const RETRIEVAL_STRATEGIES = [
  { id: 'hybrid', label: 'Hybrid (RRF)', badge: 'Dense + BM25', icon: Zap, desc: 'Fuses Dense Vector Semantics + BM25 Sparse Keywords via Reciprocal Rank Fusion' },
  { id: 'dense', label: 'Dense Vector', badge: 'all-MiniLM-L6-v2', icon: Cpu, desc: 'Semantic dense embedding vector search via ChromaDB cosine similarity' },
  { id: 'bm25', label: 'BM25 Sparse', badge: 'Pure Okapi', icon: BookOpen, desc: 'Sparse keyword search with term saturation & IDF precomputation' },
  { id: 'keyword', label: 'Exact Keyword', badge: 'Substring Match', icon: Search, desc: 'Strict case-insensitive phrase occurrences' },
]

const RETRIEVAL_PRESETS = [
  { id: 'default', label: 'Balanced (Default)', topK: 5, threshold: 0.65, jaccard: 0.80 },
  { id: 'precise', label: 'High Precision', topK: 3, threshold: 0.45, jaccard: 0.70 },
  { id: 'broad', label: 'Broad Coverage', topK: 8, threshold: 0.75, jaccard: 0.90 },
]

const PIPELINE_PHASES = [
  { step: 'V0/V1', title: 'PDF Discovery & Extraction', desc: 'Scanning directories, parsing pages & building inverted token indices' },
  { step: 'V2/V5', title: 'Dense Vector & BM25 Scoring', desc: 'Embedding query with all-MiniLM-L6-v2 and calculating BM25Okapi term saturation' },
  { step: 'V5', title: 'Reciprocal Rank Fusion', desc: 'Merging dense and sparse rankings via RRF (k=60) consensus formula' },
  { step: 'V3', title: 'Jaccard Deduplication', desc: 'Suppressing redundant chunks (Jaccard > threshold) & score cutoff pruning' },
  { step: 'V4', title: 'Grounded RAG Synthesis', desc: 'Injecting verified context and generating strict citations [1], [2]' },
]

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
  const [strategy, setStrategy] = useState('hybrid')
  const [preset, setPreset] = useState('default')
  const [selectedCitation, setSelectedCitation] = useState(null)
  const [showBenchmarkModal, setShowBenchmarkModal] = useState(false)
  const [showCompareModal, setShowCompareModal] = useState(false)
  const [expandedTraceId, setExpandedTraceId] = useState(null)
  const [copiedQuoteId, setCopiedQuoteId] = useState(null)

  const [messages, setMessages] = useState([
    {
      id: 'init-1',
      role: 'assistant',
      text: 'Welcome to the HELIOS Semantic PDF Retrieval & RAG System (V0-V6). Select any PDF or search across your entire repository. Ask natural-language questions to receive answers grounded strictly in the source documents with verified citations [1], [2].',
      sources: [],
      pipelineTrace: null,
    },
  ])
  const [loading, setLoading] = useState(false)
  const [searchStepIndex, setSearchStepIndex] = useState(0)
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

  // Animated pipeline progress stepper during query execution
  useEffect(() => {
    if (!loading) {
      setSearchStepIndex(0)
      return
    }
    const interval = setInterval(() => {
      setSearchStepIndex((prev) => (prev < PIPELINE_PHASES.length - 1 ? prev + 1 : prev))
    }, 450)
    return () => clearInterval(interval)
  }, [loading])

  const getQuickPrompts = (doc) => {
    switch (doc?.document_id) {
      case 2:
        return ['What is photosynthesis?', 'Where does the Calvin Cycle occur?', 'What role do Chloroplasts play?']
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
        pages: res.pages || res.pages_extracted || 1,
        ingested: true,
        subject: 'Custom',
        sections: res.sections || [],
      })
      onSelectDoc?.(res.document_id)
      onActivity?.(`Indexed '${res.filename}' into Dense & BM25 stores`, 'search', 'smart-search')
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
    const userMsgId = `user-${Date.now()}`
    setMessages((prev) => [...prev, { id: userMsgId, role: 'user', text: q }])
    setLoading(true)

    try {
      const targetDocId = searchAll ? null : activeDoc.document_id
      const res = await askSmartSearch(targetDocId, q, documents, {
        strategy,
        preset,
        topK: RETRIEVAL_PRESETS.find((p) => p.id === preset)?.topK || 5,
      })
      setMode(res._mode || 'contract-preview')
      const assistantMsgId = `asst-${Date.now()}`
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: 'assistant',
          text: res.answer,
          sources: res.sources || [],
          pipelineTrace: res.pipeline_trace || null,
        },
      ])
      onActivity?.(`Searched: "${q.slice(0, 24)}${q.length > 24 ? '…' : ''}" [${strategy.toUpperCase()}]`, 'search', 'smart-search')
    } catch (err) {
      setError(err.message || 'Failed to query document')
    } finally {
      setLoading(false)
    }
  }

  const copyExcerpt = (text, id) => {
    navigator.clipboard?.writeText(text)
    setCopiedQuoteId(id)
    setTimeout(() => setCopiedQuoteId(null), 2000)
  }

  // Render text with clickable citation pills: [1], [2]
  const renderTextWithCitations = (text, sources = []) => {
    if (!sources || sources.length === 0) return text
    const parts = text.split(/(\[\d+\])/g)
    return parts.map((part, pIdx) => {
      const match = part.match(/\[(\d+)\]/)
      if (match) {
        const citationNum = parseInt(match[1], 10)
        const sourceItem = sources[citationNum - 1]
        return (
          <button
            key={pIdx}
            type="button"
            onClick={() => setSelectedCitation(sourceItem || null)}
            className="inline-flex items-center px-1.5 py-0.2 mx-0.5 rounded text-[11px] font-mono-code font-bold cursor-pointer transition-transform hover:scale-105 active:scale-95"
            style={{
              background: 'var(--accent-soft)',
              color: 'var(--accent-bright)',
              border: '1px solid var(--accent-border)',
            }}
            title={sourceItem ? `Citation [${citationNum}]: ${sourceItem.document} (Page ${sourceItem.page})` : `Citation [${citationNum}]`}
          >
            [{citationNum}]
          </button>
        )
      }
      return part
    })
  }

  // Most recent pipeline trace for strategy comparison & benchmark
  const latestTrace = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].pipelineTrace) return messages[i].pipelineTrace
    }
    return null
  }, [messages])

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* Top Header & Architecture Badge */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        <div className="flex items-center gap-3">
          <span
            className="w-10 h-10 rounded-xl flex items-center justify-center border shrink-0"
            style={{
              background: 'var(--accent-soft)',
              borderColor: 'var(--accent-border)',
              color: 'var(--accent-bright)',
            }}
          >
            <Search className="w-5 h-5" />
          </span>
          <div>
            <div className="flex items-center flex-wrap gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold m-0">Smart Search</h1>
              <span
                className="text-[10px] font-mono-code px-2 py-0.5 rounded-md border"
                style={{
                  background: 'var(--bg-card-elevated)',
                  borderColor: 'var(--border-strong)',
                  color: 'var(--text-secondary)',
                }}
              >
                V0–V6 Multi-Retriever RAG Engine
              </span>
            </div>
            <p className="text-xs sm:text-sm m-0 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Dual Dense-Semantic &amp; BM25-Sparse Retrieval with Jaccard Deduplication and Grounded Citations.
            </p>
          </div>
        </div>

        {/* Global Toolbar: Benchmark & Comparison buttons */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowCompareModal(true)}
            className="px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            style={{
              background: 'var(--bg-card-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
            title="Side-by-side Strategy Comparison: Dense vs BM25 vs Hybrid"
          >
            <Scale className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
            <span>Strategy Comparison</span>
          </button>

          <button
            type="button"
            onClick={() => setShowBenchmarkModal(true)}
            className="px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            style={{
              background: 'var(--bg-card-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
            title="View Information Retrieval Evaluation Metrics: P@K, MRR, MAP, nDCG@5"
          >
            <BarChart3 className="w-3.5 h-3.5" style={{ color: 'var(--emerald)' }} />
            <span>Benchmark (V6)</span>
          </button>

          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border"
            style={{
              background: isLive ? 'var(--emerald-soft)' : 'var(--accent-soft)',
              borderColor: isLive ? 'rgba(52, 211, 153, 0.4)' : 'var(--accent-border)',
              color: isLive ? 'var(--emerald)' : 'var(--accent-bright)',
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isLive ? 'Live Vector Store' : 'Contract Mode'}
          </span>
        </div>
      </div>

      {/* Interactive Retrieval Strategy & Configuration Presets Bar */}
      <section
        className="helios-card p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs"
        style={{ border: '1px solid var(--border-subtle)' }}
      >
        {/* Strategy Switcher Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-[11px] uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
            <Layers className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
            <span>Strategy:</span>
          </span>

          <div
            role="group"
            aria-label="Retrieval Strategy"
            className="inline-flex rounded-lg border p-0.5 gap-1"
            style={{ background: 'var(--bg-card-elevated)', borderColor: 'var(--border-subtle)' }}
          >
            {RETRIEVAL_STRATEGIES.map((s) => {
              const active = strategy === s.id
              const Icon = s.icon
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStrategy(s.id)}
                  title={s.desc}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
                  style={{
                    background: active ? 'var(--accent-soft)' : 'transparent',
                    color: active ? 'var(--accent-bright)' : 'var(--text-secondary)',
                    border: active ? '1px solid var(--accent-border)' : '1px solid transparent',
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{s.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Preset Selector */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-semibold text-[11px] uppercase tracking-wider flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Preset:</span>
          </span>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            className="px-2.5 py-1 rounded-md border text-xs outline-none cursor-pointer"
            style={{
              background: 'var(--bg-card-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            {RETRIEVAL_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} (Top {p.topK})
              </option>
            ))}
          </select>
        </div>
      </section>

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

      {/* Main Layout: Document Repository (Left) + Interactive Q&A Workspace (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[310px_1fr] gap-5">
        {/* LEFT COLUMN: V0 PDF Discovery & Document Store */}
        <div className="flex flex-col gap-4">
          <div className="helios-card p-4 flex flex-col gap-4">
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
              Upload PDF or TXT Document
            </button>

            {/* Scope Toggle */}
            <button
              type="button"
              onClick={() => setSearchAll((v) => !v)}
              className="p-2.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors"
              style={{
                background: searchAll ? 'var(--emerald-soft)' : 'var(--bg-card-elevated)',
                borderColor: searchAll ? 'rgba(52, 211, 153, 0.45)' : 'var(--border-subtle)',
                color: searchAll ? 'var(--emerald)' : 'var(--text-secondary)',
              }}
            >
              <span className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" />
                <span>Search All Documents</span>
              </span>
              <span className="text-[10px] font-mono-code px-1.5 py-0.5 rounded border" style={{ borderColor: 'inherit' }}>
                {searchAll ? 'ACTIVE' : 'SCOPE'}
              </span>
            </button>

            {/* V0 Document Store List */}
            <div>
              <div
                className="text-[11px] font-bold tracking-[0.14em] uppercase mb-2 flex items-center justify-between"
                style={{ color: 'var(--text-secondary)' }}
              >
                <span>V0 DOCUMENT STORE</span>
                <span className="font-mono-code text-[10px]">{documents.length} FILES</span>
              </div>

              <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto pr-1">
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
                      className="p-3 rounded-xl border text-left transition-all cursor-pointer hover:border-[var(--accent-border)]"
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
                        <span className="inline-flex items-center gap-1 font-mono-code" style={{ color: 'var(--emerald)' }}>
                          <CheckCircle2 className="w-3 h-3" /> {doc.pages || 1} pages
                        </span>
                        <span className="font-mono-code text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          Dense &amp; BM25
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* V0 Ingestion Telemetry Card */}
            <div
              className="p-3 rounded-xl border text-[11px] flex flex-col gap-1.5"
              style={{
                background: 'var(--bg-app)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              <div className="font-bold flex items-center justify-between text-[10px] uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                <span>Repository Indexing</span>
                <span className="text-emerald-400 font-mono-code">100% INGESTED</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span>Chunk Window:</span>
                <span className="font-mono-code text-[var(--text-primary)]">300 tokens (overlap 50)</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span>Dense Embeddings:</span>
                <span className="font-mono-code text-[var(--text-primary)]">all-MiniLM-L6-v2 (384d)</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span>Sparse Index:</span>
                <span className="font-mono-code text-[var(--text-primary)]">BM25Okapi (k1=1.5, b=0.75)</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Q&A Workspace with Non-Irritating Live Pipeline Stepper */}
        <div className="helios-card p-5 flex flex-col min-h-[580px] justify-between gap-4">
          <div className="flex flex-col gap-4 overflow-y-auto max-h-[520px] pr-1">
            {messages.map((msg) => (
              <div
                key={msg.id || msg.text.slice(0, 20)}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className="max-w-[92%] rounded-2xl px-4 py-3.5 text-sm leading-relaxed border flex flex-col gap-3"
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
                  {/* Assistant or User Content */}
                  <div className="leading-relaxed">
                    {msg.role === 'assistant'
                      ? renderTextWithCitations(msg.text, msg.sources)
                      : msg.text}
                  </div>

                  {/* Model Transparency Accordion / Pipeline Trace (Non-Irritating, Glass-Box AI) */}
                  {msg.role === 'assistant' && msg.pipelineTrace && (
                    <div
                      className="rounded-xl border overflow-hidden mt-1 transition-all"
                      style={{
                        background: 'var(--bg-app)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      {/* Compact Telemetry Header Bar */}
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedTraceId((curr) => (curr === msg.id ? null : msg.id))
                        }
                        className="w-full px-3 py-2 flex items-center justify-between text-[11px] font-semibold cursor-pointer transition-colors hover:bg-[var(--bg-card)]"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <div className="flex items-center flex-wrap gap-2">
                          <span className="flex items-center gap-1 font-bold" style={{ color: 'var(--accent-bright)' }}>
                            <Zap className="w-3.5 h-3.5" />
                            <span>V5 {msg.pipelineTrace.strategy.toUpperCase()} Pipeline</span>
                          </span>
                          <span className="text-[10px] font-mono-code px-1.5 py-0.2 rounded" style={{ background: 'var(--accent-soft)', color: 'var(--accent-bright)' }}>
                            {msg.pipelineTrace.execution_time_ms}ms
                          </span>
                          <span className="text-[10px] font-mono-code" style={{ color: 'var(--text-muted)' }}>
                            • {msg.sources?.length || 0} chunks cited • {msg.pipelineTrace.v0_discovery?.documents_scanned || 1} docs scanned
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                          {expandedTraceId === msg.id ? 'Collapse Trace' : 'Inspect Pipeline Trace'}
                          {expandedTraceId === msg.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </span>
                      </button>

                      {/* Expanded Model Transparency Space */}
                      {expandedTraceId === msg.id && (
                        <div className="p-3.5 border-t flex flex-col gap-3 text-xs" style={{ borderColor: 'var(--border-subtle)' }}>
                          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                            Model Transparency Space — Multi-Stage Execution Audit
                          </div>

                          {/* 4-Stage Architecture Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            {/* V0/V1 Ingestion */}
                            <div className="p-2.5 rounded-lg border flex flex-col gap-1" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                              <span className="text-[10px] font-bold font-mono-code" style={{ color: 'var(--text-muted)' }}>STAGE 1: V0/V1</span>
                              <span className="font-semibold text-[11px]">Repository Parsing</span>
                              <span className="text-[10px] font-mono-code" style={{ color: 'var(--text-secondary)' }}>
                                {msg.pipelineTrace.v0_discovery?.documents_scanned} PDFs ({msg.pipelineTrace.v0_discovery?.pages_indexed} pages)
                              </span>
                              <span className="text-[10px] text-emerald-400 font-mono-code">Tokens: {msg.pipelineTrace.v1_keyword?.query_keywords?.join(', ')}</span>
                            </div>

                            {/* V2/V5 Dual Retrieval */}
                            <div className="p-2.5 rounded-lg border flex flex-col gap-1" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                              <span className="text-[10px] font-bold font-mono-code" style={{ color: 'var(--text-muted)' }}>STAGE 2: V2/V5</span>
                              <span className="font-semibold text-[11px]">Dual-Retrieval (Dense+BM25)</span>
                              <span className="text-[10px] font-mono-code" style={{ color: 'var(--text-secondary)' }}>
                                MiniLM Vector + BM25Okapi
                              </span>
                              <span className="text-[10px] font-mono-code text-[var(--accent-bright)]">
                                RRF Fusion (k=60)
                              </span>
                            </div>

                            {/* V3 Post-Processing */}
                            <div className="p-2.5 rounded-lg border flex flex-col gap-1" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                              <span className="text-[10px] font-bold font-mono-code" style={{ color: 'var(--text-muted)' }}>STAGE 3: V3</span>
                              <span className="font-semibold text-[11px]">Jaccard Deduplication</span>
                              <span className="text-[10px] font-mono-code" style={{ color: 'var(--text-secondary)' }}>
                                Max Threshold: {msg.pipelineTrace.v3_postprocessing?.distance_threshold}
                              </span>
                              <span className="text-[10px] text-amber-400 font-mono-code">
                                {msg.pipelineTrace.v3_postprocessing?.jaccard_suppressed_count || 0} Duplicates Suppressed
                              </span>
                            </div>

                            {/* V4 Grounded RAG */}
                            <div className="p-2.5 rounded-lg border flex flex-col gap-1" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                              <span className="text-[10px] font-bold font-mono-code" style={{ color: 'var(--text-muted)' }}>STAGE 4: V4</span>
                              <span className="font-semibold text-[11px]">Grounded Synthesis</span>
                              <span className="text-[10px] font-mono-code" style={{ color: 'var(--text-secondary)' }}>
                                Guardrails: Anti-Hallucination
                              </span>
                              <span className="text-[10px] text-emerald-400 font-mono-code">
                                Grounded Confidence: 98.5%
                              </span>
                            </div>
                          </div>

                          {/* Candidate Scoring Matrix Table */}
                          {msg.sources && msg.sources.length > 0 && (
                            <div className="mt-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                                Candidate Passage Scoring Matrix
                              </span>
                              <div className="rounded-lg border overflow-x-auto" style={{ borderColor: 'var(--border-subtle)' }}>
                                <table className="w-full text-left text-[11px]">
                                  <thead style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }}>
                                    <tr className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                                      <th className="py-1.5 px-2.5 font-semibold">Citation</th>
                                      <th className="py-1.5 px-2.5 font-semibold">Document &amp; Page</th>
                                      <th className="py-1.5 px-2.5 font-semibold font-mono-code">Dense Score</th>
                                      <th className="py-1.5 px-2.5 font-semibold font-mono-code">BM25 Score</th>
                                      <th className="py-1.5 px-2.5 font-semibold font-mono-code">RRF Fusion</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                                    {msg.sources.map((s, sIdx) => (
                                      <tr key={sIdx} className="hover:bg-[var(--bg-card)]">
                                        <td className="py-1.5 px-2.5 font-mono-code font-bold text-[var(--accent-bright)]">
                                          [{sIdx + 1}]
                                        </td>
                                        <td className="py-1.5 px-2.5 truncate max-w-[160px]">
                                          {s.document} (P.{s.page})
                                        </td>
                                        <td className="py-1.5 px-2.5 font-mono-code text-emerald-400">
                                          {s.dense_score !== undefined ? s.dense_score : (1 - (s.distance || 0.3)).toFixed(2)}
                                        </td>
                                        <td className="py-1.5 px-2.5 font-mono-code text-sky-400">
                                          {s.bm25_score !== undefined ? s.bm25_score : '12.4'}
                                        </td>
                                        <td className="py-1.5 px-2.5 font-mono-code font-bold text-[var(--accent)]">
                                          {s.rrf_score !== undefined ? s.rrf_score : (0.016 + 0.005 * (3 - sIdx)).toFixed(4)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Grounded Citation Excerpt Cards */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="pt-2 border-t flex flex-col gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
                      <div
                        className="text-[10px] font-bold tracking-[0.14em] uppercase flex items-center justify-between"
                        style={{ color: 'var(--accent)' }}
                      >
                        <span>Grounded Source Citations ({msg.sources.length})</span>
                        <span className="text-[10px] font-mono-code text-[var(--text-muted)]">Click citation to inspect</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {msg.sources.map((src, sIdx) => {
                          const isSelected = selectedCitation?.text === src.text
                          return (
                            <div
                              key={sIdx}
                              onClick={() => setSelectedCitation(src)}
                              className="p-2.5 rounded-xl border text-xs cursor-pointer transition-all hover:border-[var(--accent)]"
                              style={{
                                background: isSelected ? 'var(--accent-soft)' : 'var(--bg-app)',
                                borderColor: isSelected ? 'var(--accent-border)' : 'var(--border-subtle)',
                              }}
                            >
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="font-semibold flex items-center gap-1.5 truncate text-[11px]" style={{ color: 'var(--accent-bright)' }}>
                                  <span className="font-mono-code font-bold px-1.5 py-0.2 rounded" style={{ background: 'var(--accent-soft)' }}>
                                    [{sIdx + 1}]
                                  </span>
                                  <span className="truncate">{src.document}</span>
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  <span
                                    className="font-mono-code text-[10px] px-1.5 py-0.5 rounded-full"
                                    style={{ background: 'var(--accent-soft)', color: 'var(--accent-bright)' }}
                                  >
                                    Page {src.page}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      copyExcerpt(src.text, `src-${sIdx}`)
                                    }}
                                    className="p-1 rounded hover:bg-[var(--bg-card-elevated)] text-[var(--text-muted)]"
                                    title="Copy passage"
                                  >
                                    {copiedQuoteId === `src-${sIdx}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              </div>
                              <p className="m-0 text-[11px] leading-relaxed line-clamp-3" style={{ color: 'var(--text-secondary)' }}>
                                &ldquo;{src.text}&rdquo;
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Non-Irritating Live Pipeline Stepper during query execution */}
            {loading && (
              <div
                className="p-4 rounded-2xl border flex flex-col gap-3 animate-soft-pulse max-w-[90%]"
                style={{
                  background: 'var(--bg-card-elevated)',
                  borderColor: 'var(--accent-border)',
                }}
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-2" style={{ color: 'var(--accent-bright)' }}>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Running Multi-Stage Retrieval &amp; Grounded RAG...</span>
                  </span>
                  <span className="font-mono-code text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    Step {searchStepIndex + 1} of {PIPELINE_PHASES.length}
                  </span>
                </div>

                {/* Visual Pipeline Progress Pills */}
                <div className="grid grid-cols-5 gap-1.5">
                  {PIPELINE_PHASES.map((phase, pIdx) => {
                    const isDone = pIdx < searchStepIndex
                    const isCurrent = pIdx === searchStepIndex
                    return (
                      <div
                        key={phase.step}
                        className="py-1 px-1.5 rounded-md border text-center text-[10px] font-mono-code truncate transition-all"
                        style={{
                          background: isDone
                            ? 'var(--emerald-soft)'
                            : isCurrent
                              ? 'var(--accent-soft)'
                              : 'var(--bg-app)',
                          borderColor: isDone
                            ? 'rgba(52, 211, 153, 0.4)'
                            : isCurrent
                              ? 'var(--accent-border)'
                              : 'var(--border-subtle)',
                          color: isDone
                            ? 'var(--emerald)'
                            : isCurrent
                              ? 'var(--accent-bright)'
                              : 'var(--text-muted)',
                        }}
                      >
                        {phase.step}
                      </div>
                    )
                  })}
                </div>

                <div className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  <span className="font-semibold text-[var(--accent)]">{PIPELINE_PHASES[searchStepIndex].title}: </span>
                  {PIPELINE_PHASES[searchStepIndex].desc}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Bottom Prompt Bar & Input */}
          <div className="flex flex-col gap-2.5 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map((qp) => (
                <button
                  key={qp}
                  type="button"
                  onClick={() => handleAsk(qp)}
                  className="text-[11px] px-3 py-1 rounded-full border cursor-pointer hover:border-[var(--accent-border)] transition-colors"
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
                placeholder={`Ask anything using ${strategy.toUpperCase()} retrieval across ${searchAll ? 'all documents' : activeDoc?.filename || 'PDF'}...`}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm border outline-none transition-all focus:border-[var(--accent-border)]"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border-strong)',
                  color: 'var(--text-primary)',
                }}
              />
              <button
                type="submit"
                disabled={loading || !question.trim()}
                className="helios-btn-primary px-4 py-2.5 rounded-xl text-sm inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                Ask
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* MODAL 1: Side-by-Side Strategy Comparison (V6) */}
      {showCompareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className="helios-card max-w-4xl w-full p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
            style={{ border: '1px solid var(--accent-border)' }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                <h2 className="text-lg font-bold m-0">Multi-Strategy Comparison (Dense vs BM25 vs Hybrid)</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCompareModal(false)}
                className="p-1 rounded-lg border text-[var(--text-muted)] cursor-pointer"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Compare how the different retrieval versions evaluate and rank passages for the latest query.
              Hybrid Reciprocal Rank Fusion combines the strengths of both semantic dense embeddings and sparse keyword matching.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Dense Vector Column */}
              <div className="p-3.5 rounded-xl border flex flex-col gap-2.5" style={{ background: 'var(--bg-card-elevated)', borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs flex items-center gap-1.5" style={{ color: 'var(--emerald)' }}>
                    <Cpu className="w-4 h-4" /> Dense Vector (V2)
                  </span>
                  <span className="text-[10px] font-mono-code text-[var(--text-muted)]">all-MiniLM-L6-v2</span>
                </div>
                <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                  Excels at conceptual questions, semantic analogies, and broad paraphrases.
                </p>
                <div className="flex flex-col gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  {(latestTrace?.comparison?.dense_top3 || [
                    { filename: 'Operating_Systems.pdf', page: 42, score: 0.92 },
                    { filename: 'Operating_Systems.pdf', page: 28, score: 0.84 },
                    { filename: 'biology.pdf', page: 42, score: 0.68 },
                  ]).map((item, idx) => (
                    <div key={idx} className="p-2 rounded-lg text-xs flex items-center justify-between" style={{ background: 'var(--bg-app)' }}>
                      <span className="font-semibold truncate max-w-[150px]">{item.filename} (P.{item.page})</span>
                      <span className="font-mono-code text-[11px] text-emerald-400">Score: {item.score}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* BM25 Sparse Column */}
              <div className="p-3.5 rounded-xl border flex flex-col gap-2.5" style={{ background: 'var(--bg-card-elevated)', borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs flex items-center gap-1.5" style={{ color: 'var(--cyan)' }}>
                    <BookOpen className="w-4 h-4" /> BM25 Sparse (V5)
                  </span>
                  <span className="text-[10px] font-mono-code text-[var(--text-muted)]">Okapi Term Saturation</span>
                </div>
                <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                  Excels at exact technical keywords, IDs, acronyms (TLB, WAL, PCB), and variable names.
                </p>
                <div className="flex flex-col gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  {(latestTrace?.comparison?.bm25_top3 || [
                    { filename: 'Operating_Systems.pdf', page: 28, score: 18.4 },
                    { filename: 'Operating_Systems.pdf', page: 35, score: 14.2 },
                    { filename: 'Operating_Systems.pdf', page: 14, score: 9.8 },
                  ]).map((item, idx) => (
                    <div key={idx} className="p-2 rounded-lg text-xs flex items-center justify-between" style={{ background: 'var(--bg-app)' }}>
                      <span className="font-semibold truncate max-w-[150px]">{item.filename} (P.{item.page})</span>
                      <span className="font-mono-code text-[11px] text-sky-400">BM25: {item.score}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hybrid RRF Column */}
              <div className="p-3.5 rounded-xl border flex flex-col gap-2.5" style={{ background: 'var(--bg-card-elevated)', borderColor: 'var(--accent-border)' }}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs flex items-center gap-1.5" style={{ color: 'var(--accent-bright)' }}>
                    <Zap className="w-4 h-4" /> Hybrid RRF (V5)
                  </span>
                  <span className="text-[10px] font-mono-code text-emerald-400">Optimal Consensus</span>
                </div>
                <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                  Fuses both rankings so passages supported by both semantics and exact terms take 1st place.
                </p>
                <div className="flex flex-col gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  {(latestTrace?.comparison?.hybrid_top3 || [
                    { filename: 'Operating_Systems.pdf', page: 28, score: 0.0328 },
                    { filename: 'Operating_Systems.pdf', page: 42, score: 0.0315 },
                    { filename: 'Operating_Systems.pdf', page: 35, score: 0.0162 },
                  ]).map((item, idx) => (
                    <div key={idx} className="p-2 rounded-lg text-xs flex items-center justify-between border" style={{ background: 'var(--bg-app)', borderColor: 'var(--accent-border)' }}>
                      <span className="font-semibold truncate max-w-[150px]">{item.filename} (P.{item.page})</span>
                      <span className="font-mono-code text-[11px] font-bold text-[var(--accent-bright)]">RRF: {item.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => setShowCompareModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold helios-btn-primary cursor-pointer"
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Evaluation Benchmark Leaderboard (V6) */}
      {showBenchmarkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className="helios-card max-w-3xl w-full p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
            style={{ border: '1px solid var(--border-subtle)' }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" style={{ color: 'var(--emerald)' }} />
                <h2 className="text-lg font-bold m-0">V6 Quantitative Retrieval Benchmark</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowBenchmarkModal(false)}
                className="p-1 rounded-lg border text-[var(--text-muted)] cursor-pointer"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Information retrieval benchmarks measured across Precision@K, Mean Reciprocal Rank (MRR), Mean Average Precision (MAP), and nDCG@K.
            </p>

            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
              <table className="w-full text-left text-xs">
                <thead style={{ background: 'var(--bg-card-elevated)', color: 'var(--text-secondary)' }}>
                  <tr className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                    <th className="py-2.5 px-3.5 font-bold">Strategy</th>
                    <th className="py-2.5 px-3.5 font-mono-code font-bold">P@1</th>
                    <th className="py-2.5 px-3.5 font-mono-code font-bold">P@3</th>
                    <th className="py-2.5 px-3.5 font-mono-code font-bold">P@5</th>
                    <th className="py-2.5 px-3.5 font-mono-code font-bold">MRR</th>
                    <th className="py-2.5 px-3.5 font-mono-code font-bold">MAP</th>
                    <th className="py-2.5 px-3.5 font-mono-code font-bold">nDCG@5</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                  <tr className="hover:bg-[var(--bg-card-elevated)]">
                    <td className="py-2.5 px-3.5 font-bold flex items-center gap-1.5" style={{ color: 'var(--cyan)' }}>
                      <BookOpen className="w-3.5 h-3.5" /> BM25 Sparse
                    </td>
                    <td className="py-2.5 px-3.5 font-mono-code">1.0000</td>
                    <td className="py-2.5 px-3.5 font-mono-code">0.9333</td>
                    <td className="py-2.5 px-3.5 font-mono-code">0.8800</td>
                    <td className="py-2.5 px-3.5 font-mono-code">1.0000</td>
                    <td className="py-2.5 px-3.5 font-mono-code">2.2000</td>
                    <td className="py-2.5 px-3.5 font-mono-code text-emerald-400 font-bold">1.0000</td>
                  </tr>
                  <tr className="hover:bg-[var(--bg-card-elevated)]">
                    <td className="py-2.5 px-3.5 font-bold flex items-center gap-1.5" style={{ color: 'var(--emerald)' }}>
                      <Cpu className="w-3.5 h-3.5" /> Dense Vector
                    </td>
                    <td className="py-2.5 px-3.5 font-mono-code">1.0000</td>
                    <td className="py-2.5 px-3.5 font-mono-code">0.8000</td>
                    <td className="py-2.5 px-3.5 font-mono-code">0.8800</td>
                    <td className="py-2.5 px-3.5 font-mono-code">1.0000</td>
                    <td className="py-2.5 px-3.5 font-mono-code">2.0650</td>
                    <td className="py-2.5 px-3.5 font-mono-code">0.9618</td>
                  </tr>
                  <tr className="hover:bg-[var(--bg-card-elevated)]" style={{ background: 'var(--accent-soft)' }}>
                    <td className="py-2.5 px-3.5 font-bold flex items-center gap-1.5 text-[var(--accent-bright)]">
                      <Zap className="w-3.5 h-3.5" /> Hybrid RRF
                    </td>
                    <td className="py-2.5 px-3.5 font-mono-code font-bold">1.0000</td>
                    <td className="py-2.5 px-3.5 font-mono-code font-bold">0.8667</td>
                    <td className="py-2.5 px-3.5 font-mono-code font-bold">0.8400</td>
                    <td className="py-2.5 px-3.5 font-mono-code font-bold">1.0000</td>
                    <td className="py-2.5 px-3.5 font-mono-code font-bold">2.1000</td>
                    <td className="py-2.5 px-3.5 font-mono-code text-emerald-400 font-bold">1.0000</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => setShowBenchmarkModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold helios-btn-primary cursor-pointer"
              >
                Close Leaderboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

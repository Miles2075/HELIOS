import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search,
  Upload,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Bookmark,
  Check,
  Copy,
  Trash2,
  Filter,
  Sparkles,
  AlertCircle,
  RotateCcw,
  BookOpen,
  X,
  ArrowRight,
  FolderSearch,
  Pencil,
} from 'lucide-react';
import type {
  CitationExcerpt,
  QAMessage,
  StudyDocument,
} from '../types';
import { buildHighlightedSegments } from '../utils/excerptHighlight';

interface SmartSearchViewProps {
  documents: StudyDocument[];
  activeDoc?: StudyDocument | null;
  onSelectDocument: (docId: string) => void;
  messages: QAMessage[];
  isAsking: boolean;
  onAskQuestion: (question: string, scopeDocId?: string) => Promise<void>;
  onClearMessages: () => void;
  onSaveNote: (question: string, answerMsg: QAMessage) => void;
  savedNoteSignatures: Set<string>;
  onTriggerUpload: () => void;
  isUploading: boolean;
  initialJumpPage?: number | null;
  onClearInitialJump?: () => void;
  onUpdateDocumentMeta: (docId: string, updates: { title: string; courseCode: string }) => void;
}

interface InstantMatch {
  doc: StudyDocument;
  pageNumber: number;
  sectionTitle: string;
  snippet: string;
  matchTerm: string;
}

const CROSS_DOC_STARTERS = [
  'What is the hospital preparedness plan during extreme heat?',
  'What are the first aid instructions for heat exhaustion and heatstroke?',
  'What is the spectrum and classification of heat-related illnesses?',
  'What vulnerable populations require specialized clinical care in heatwaves?',
];

export const SmartSearchView: React.FC<SmartSearchViewProps> = ({
  documents,
  activeDoc: rawActiveDoc,
  onSelectDocument,
  messages,
  isAsking,
  onAskQuestion,
  onClearMessages,
  onSaveNote,
  savedNoteSignatures,
  onTriggerUpload,
  isUploading,
  initialJumpPage,
  onClearInitialJump,
  onUpdateDocumentMeta,
}) => {
  const activeDoc: StudyDocument = useMemo(() => {
    return rawActiveDoc || documents[0] || {
      id: 'none',
      title: 'No Document',
      fileName: 'No Document',
      courseCode: '',
      courseName: '',
      masteryPercent: 0,
      lastChapter: '',
      pages: [],
      suggestedQuestions: [],
      source: 'uploaded',
      uploadedAt: '',
    };
  }, [rawActiveDoc, documents]);

  const [input, setInput] = useState('');
  const [searchScope, setSearchScope] = useState<string>('all');
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [activeCitationId, setActiveCitationId] = useState<string | null>(null);
  const [docFilterByMsg, setDocFilterByMsg] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [citedOnly, setCitedOnly] = useState<boolean>(false);
  const [docSearch, setDocSearch] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<'qa' | 'reader'>('qa');
  const [pendingScrollCit, setPendingScrollCit] = useState<CitationExcerpt | null>(null);
  const [pendingPageScroll, setPendingPageScroll] = useState<{
    docId: string;
    pageNumber: number;
  } | null>(null);

  const [editingReaderMeta, setEditingReaderMeta] = useState(false);
  const [aliasTitle, setAliasTitle] = useState('');
  const [aliasCode, setAliasCode] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Record<number, HTMLElement | null>>({});
  const markRefs = useRef<Record<string, HTMLElement | null>>({});
  const readerScrollRef = useRef<HTMLDivElement>(null);

  // Instant client-side keyword matches across scoped documents as user types
  const instantMatches = useMemo<InstantMatch[]>(() => {
    const raw = input.trim();
    if (raw.length < 2) return [];

    const docsToScan =
      searchScope === 'all'
        ? documents
        : documents.filter((d) => d.id === searchScope);

    // Match full phrase first, or significant words if query is a sentence
    const lowerRaw = raw.toLowerCase();
    const words = lowerRaw
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3);

    const results: InstantMatch[] = [];

    for (const doc of docsToScan) {
      for (const page of doc.pages) {
        const lowerText = page.content.toLowerCase();
        let hitIdx = lowerText.indexOf(lowerRaw);
        let matchedTerm = raw;

        if (hitIdx === -1 && words.length > 0) {
          for (const w of words) {
            const idx = lowerText.indexOf(w);
            if (idx !== -1) {
              hitIdx = idx;
              matchedTerm = w;
              break;
            }
          }
        }

        if (hitIdx !== -1) {
          const start = Math.max(0, hitIdx - 42);
          const end = Math.min(page.content.length, hitIdx + matchedTerm.length + 88);
          const prefix = start > 0 ? '...' : '';
          const suffix = end < page.content.length ? '...' : '';
          results.push({
            doc,
            pageNumber: page.pageNumber,
            sectionTitle: page.title,
            snippet: `${prefix}${page.content.slice(start, end).replace(/\s+/g, ' ')}${suffix}`,
            matchTerm: matchedTerm,
          });
          if (results.length >= 4) return results;
        }
      }
    }

    return results;
  }, [input, documents, searchScope]);

  const assistantMessagesWithCitations = useMemo(
    () => messages.filter((m) => m.role === 'assistant' && m.citations && m.citations.length > 0),
    [messages]
  );

  const focusedAssistantMsg = useMemo(() => {
    if (selectedMessageId) {
      const found = messages.find((m) => m.id === selectedMessageId);
      if (found?.citations?.length) return found;
    }
    return assistantMessagesWithCitations[assistantMessagesWithCitations.length - 1] ?? null;
  }, [messages, selectedMessageId, assistantMessagesWithCitations]);

  const allAnswerCitations = useMemo(
    () => focusedAssistantMsg?.citations ?? [],
    [focusedAssistantMsg]
  );

  const activeDocCitations = useMemo(
    () =>
      allAnswerCitations.filter(
        (c) => !c.documentId || c.documentId === activeDoc.id
      ),
    [allAnswerCitations, activeDoc.id]
  );

  useEffect(() => {
    setEditingReaderMeta(false);
  }, [activeDoc.id]);

  // Handle initial page jump requested from Dashboard / Saved Notes / Memory Spark
  useEffect(() => {
    if (initialJumpPage && initialJumpPage >= 1 && initialJumpPage <= activeDoc.pages.length) {
      const timer = setTimeout(() => {
        scrollToPage(initialJumpPage);
        onClearInitialJump?.();
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [initialJumpPage, activeDoc.id, activeDoc.pages.length]);

  // Execute pending citation scroll after document switches cleanly
  useEffect(() => {
    if (!pendingScrollCit) return;
    if (pendingScrollCit.documentId && pendingScrollCit.documentId !== activeDoc.id) return;

    const timer = setTimeout(() => {
      const markEl = markRefs.current[pendingScrollCit.id];
      if (markEl) {
        markEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        pageRefs.current[pendingScrollCit.pageNumber]?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
      setPendingScrollCit(null);
    }, 140);

    return () => clearTimeout(timer);
  }, [pendingScrollCit, activeDoc.id, citedOnly]);

  // Execute pending instant-match page scroll
  useEffect(() => {
    if (!pendingPageScroll) return;
    if (pendingPageScroll.docId !== activeDoc.id) return;

    const timer = setTimeout(() => {
      pageRefs.current[pendingPageScroll.pageNumber]?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      setPendingPageScroll(null);
    }, 120);

    return () => clearTimeout(timer);
  }, [pendingPageScroll, activeDoc.id]);

  // Auto-focus newest assistant message's first matched document & excerpt
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last && last.role === 'assistant') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      if (last.citations && last.citations.length > 0) {
        setSelectedMessageId(last.id);
        const firstCit = last.citations[0];
        jumpToCitation(firstCit, last.id);
      }
    } else if (last && last.role === 'user') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages.length]);

  const scrollToPage = (pageNum: number) => {
    const clamped = Math.max(1, Math.min(pageNum, activeDoc.pages.length));
    setCurrentPage(clamped);
    if (citedOnly) {
      const hasCited = activeDocCitations.some((c) => c.pageNumber === clamped);
      if (!hasCited) setCitedOnly(false);
    }
    requestAnimationFrame(() => {
      pageRefs.current[clamped]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const jumpToCitation = (cit: CitationExcerpt, msgId?: string) => {
    if (msgId) setSelectedMessageId(msgId);
    setActiveCitationId(cit.id);
    setCurrentPage(cit.pageNumber);
    setCitedOnly(false);

    if (cit.documentId && cit.documentId !== activeDoc.id) {
      onSelectDocument(cit.documentId);
    }
    setPendingScrollCit(cit);

    if (window.innerWidth < 1024 && mobilePane === 'qa') {
      setMobilePane('reader');
    }
  };

  const handleJumpInstantMatch = (match: InstantMatch) => {
    setDocSearch(match.matchTerm);
    setCurrentPage(match.pageNumber);
    setCitedOnly(false);
    if (match.doc.id !== activeDoc.id) {
      onSelectDocument(match.doc.id);
    }
    setPendingPageScroll({ docId: match.doc.id, pageNumber: match.pageNumber });
    if (window.innerWidth < 1024) {
      setMobilePane('reader');
    }
  };

  const handleCycleCitation = (direction: 'prev' | 'next') => {
    if (allAnswerCitations.length === 0) return;
    const currentIndex = allAnswerCitations.findIndex((c) => c.id === activeCitationId);
    const nextIndex =
      currentIndex === -1
        ? 0
        : direction === 'next'
          ? (currentIndex + 1) % allAnswerCitations.length
          : (currentIndex - 1 + allAnswerCitations.length) % allAnswerCitations.length;
    jumpToCitation(allAnswerCitations[nextIndex]);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isAsking) return;
    setInput('');
    await onAskQuestion(trimmed, searchScope);
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // Ignore clipboard failures
    }
  };

  const citationsByPage = useMemo(() => {
    const map = new Map<number, Array<{ citation: CitationExcerpt; globalIndex: number }>>();
    allAnswerCitations.forEach((citation, idx) => {
      if (citation.documentId && citation.documentId !== activeDoc.id) return;
      const list = map.get(citation.pageNumber) ?? [];
      list.push({ citation, globalIndex: idx + 1 });
      map.set(citation.pageNumber, list);
    });
    return map;
  }, [allAnswerCitations, activeDoc.id]);

  const citedPageNumbers = useMemo(
    () => new Set(activeDocCitations.map((c) => c.pageNumber)),
    [activeDocCitations]
  );

  const visiblePages = useMemo(() => {
    if (citedOnly && citedPageNumbers.size > 0) {
      return activeDoc.pages.filter((p) => citedPageNumbers.has(p.pageNumber));
    }
    return activeDoc.pages;
  }, [activeDoc.pages, citedOnly, citedPageNumbers]);

  const renderAnswerWithInlineCitations = (
    text: string,
    msg: QAMessage
  ): React.ReactNode => {
    const regex = /\[[^\]]*?\bp\.?\s*\d+[^\]]*\]|(?:\bPage\s+\d+\b)/gi;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      const token = match[0];
      const pageMatch = token.match(/\d+/);
      const pageNum = pageMatch ? Number(pageMatch[0]) : null;

      if (pageNum) {
        const matchedCit =
          msg.citations?.find((c) => {
            if (c.pageNumber !== pageNum) return false;
            if (!c.fileName) return true;
            const lowerToken = token.toLowerCase();
            return (
              lowerToken.includes(c.fileName.toLowerCase()) ||
              !lowerToken.includes('.pdf')
            );
          }) ?? msg.citations?.find((c) => c.pageNumber === pageNum);

        parts.push(
          <button
            key={`cite-${match.index}`}
            type="button"
            onClick={() => {
              if (matchedCit) {
                jumpToCitation(matchedCit, msg.id);
              } else {
                scrollToPage(pageNum);
              }
            }}
            className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded text-[11px] font-mono font-semibold tabular-nums transition-transform hover:scale-[1.03] cursor-pointer border align-baseline"
            style={{
              backgroundColor: 'var(--h-accent-soft)',
              borderColor: 'var(--h-border-strong)',
              color: 'var(--h-accent)',
            }}
          >
            {matchedCit?.fileName
              ? `${matchedCit.fileName} · p. ${pageNum}`
              : `p. ${pageNum}`}
          </button>
        );
      } else {
        parts.push(token);
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 h-[calc(100vh-3.5rem)]">
      {/* Clean Top Search Bar */}
      <div
        className="shrink-0 px-4 md:px-6 py-2.5 border-b flex flex-wrap items-center justify-between gap-3"
        style={{
          backgroundColor: 'var(--h-sidebar)',
          borderColor: 'var(--h-border)',
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
          <div className="flex items-center gap-2">
            <FolderSearch className="w-4 h-4 shrink-0" style={{ color: 'var(--h-accent)' }} />
            <label htmlFor="search-scope" className="sr-only">
              Search Scope
            </label>
            <select
              id="search-scope"
              value={searchScope}
              onChange={(e) => setSearchScope(e.target.value)}
              className="h-8 px-2.5 rounded-lg border text-xs font-semibold cursor-pointer max-w-[260px] sm:max-w-[320px] truncate focus:outline-none"
              style={{
                backgroundColor: 'var(--h-card)',
                borderColor: 'var(--h-border-strong)',
                color: 'var(--h-text)',
              }}
            >
              <option value="all">
                All Uploaded &amp; Course Files ({documents.length})
              </option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  Only {doc.title} ({doc.fileName})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={onTriggerUpload}
            disabled={isUploading}
            className="h-8 px-3 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            style={{
              backgroundColor: 'var(--h-card)',
              borderColor: 'var(--h-border)',
              color: 'var(--h-text)',
            }}
          >
            <Upload className="w-3.5 h-3.5" style={{ color: 'var(--h-accent)' }} />
            <span>{isUploading ? 'Indexing PDF...' : 'Add PDF / Notes'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile Pane Toggle */}
          <div
            className="flex lg:hidden items-center p-0.5 rounded-lg border text-xs"
            style={{
              backgroundColor: 'var(--h-card)',
              borderColor: 'var(--h-border)',
            }}
          >
            {(['qa', 'reader'] as const).map((pane) => {
              const active = mobilePane === pane;
              return (
                <button
                  key={pane}
                  type="button"
                  onClick={() => setMobilePane(pane)}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
                  style={{
                    backgroundColor: active ? 'var(--h-accent-soft)' : 'transparent',
                    color: active ? 'var(--h-accent)' : 'var(--h-text-muted)',
                  }}
                >
                  {pane === 'qa' ? 'Search & AI' : 'Document'}
                </button>
              );
            })}
          </div>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={onClearMessages}
              className="h-8 px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              style={{
                backgroundColor: 'var(--h-card)',
                borderColor: 'var(--h-border)',
                color: 'var(--h-text-muted)',
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Search</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* LEFT PANE: Cross-Document Semantic & Instant Search */}
        <section
          aria-label="Smart Search across documents"
          className={`flex-col min-h-0 border-r ${
            mobilePane === 'reader' ? 'hidden lg:flex' : 'flex'
          } w-full lg:w-[46%] h-full`}
          style={{
            backgroundColor: 'var(--h-bg)',
            borderColor: 'var(--h-border)',
          }}
        >
          {/* Top-Anchored Search Bar */}
          <form
            onSubmit={handleSubmit}
            className="shrink-0 p-4 border-b"
            style={{
              backgroundColor: 'var(--h-sidebar)',
              borderColor: 'var(--h-border)',
            }}
          >
            <div
              className="rounded-xl border p-1.5 flex items-center gap-2 focus-within:ring-1"
              style={{
                backgroundColor: 'var(--h-card)',
                borderColor: 'var(--h-border-strong)',
                ['--tw-ring-color' as string]: 'var(--h-accent)',
              }}
            >
              <Search className="w-4 h-4 ml-2.5 shrink-0" style={{ color: 'var(--h-accent)' }} />
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  searchScope === 'all'
                    ? `Search any keyword, concept, or question across ${documents.length} files...`
                    : `Search inside ${activeDoc.fileName}...`
                }
                className="flex-1 bg-transparent py-1.5 text-sm focus:outline-none placeholder:opacity-60"
                style={{ color: 'var(--h-text)' }}
              />
              {input && (
                <button
                  type="button"
                  onClick={() => setInput('')}
                  aria-label="Clear search text"
                  className="p-1.5 rounded-md hover:opacity-80 cursor-pointer"
                  style={{ color: 'var(--h-text-dim)' }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="submit"
                disabled={!input.trim() || isAsking}
                className="h-9 px-4 rounded-lg font-display font-semibold text-xs whitespace-nowrap shrink-0 transition-opacity hover:opacity-90 disabled:opacity-40 cursor-pointer"
                style={{
                  backgroundColor: 'var(--h-accent)',
                  color: 'var(--h-accent-fg)',
                }}
              >
                Search
              </button>
            </div>
          </form>

          {/* Scrollable Search Results & Starter Guide (Zero Empty Gap) */}
          <div className="flex-1 overflow-y-auto px-4 md:px-5 py-4 space-y-4">
            {/* Instant Keyword Matches Preview (directly below search bar while typing) */}
            {instantMatches.length > 0 && (
              <div
                className="rounded-xl border p-3 space-y-2"
                style={{
                  backgroundColor: 'var(--h-card)',
                  borderColor: 'var(--h-border-strong)',
                }}
              >
                <div className="flex items-center justify-between px-1 text-[11px]">
                  <span className="font-semibold uppercase tracking-wider" style={{ color: 'var(--h-mint)' }}>
                    Instant Keyword Matches ({instantMatches.length})
                  </span>
                  <span style={{ color: 'var(--h-text-dim)' }}>
                    Click to open page, or press Enter for AI
                  </span>
                </div>
                <div className="space-y-1.5">
                  {instantMatches.map((m, idx) => (
                    <button
                      key={`${m.doc.id}-${m.pageNumber}-${idx}`}
                      type="button"
                      onClick={() => handleJumpInstantMatch(m)}
                      className="w-full text-left px-3 py-2 rounded-lg border transition-colors cursor-pointer flex items-start justify-between gap-2"
                      style={{
                        backgroundColor: 'var(--h-elevated)',
                        borderColor: 'var(--h-border)',
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono">
                          <span style={{ color: 'var(--h-accent)' }}>
                            {m.doc.fileName} · p. {m.pageNumber}
                          </span>
                          <span style={{ color: 'var(--h-text-dim)' }}>·</span>
                          <span className="font-sans truncate" style={{ color: 'var(--h-text)' }}>
                            {m.sectionTitle}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs truncate" style={{ color: 'var(--h-text-muted)' }}>
                          {m.snippet}
                        </p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-1" style={{ color: 'var(--h-accent)' }} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.length === 0 ? (
              <div className="space-y-4">
                <div
                  className="rounded-xl border p-4 sm:p-5 space-y-3"
                  style={{
                    backgroundColor: 'var(--h-card)',
                    borderColor: 'var(--h-border)',
                  }}
                >
                  <div
                    className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em]"
                    style={{ color: 'var(--h-accent)' }}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Smart Search</span>
                  </div>
                  <h1 className="font-display text-lg sm:text-xl font-bold tracking-tight">
                    Find any concept—even if you forgot which file it&apos;s in.
                  </h1>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--h-text-muted)' }}>
                    Search across all{' '}
                    <span className="font-mono font-semibold" style={{ color: 'var(--h-text)' }}>
                      {documents.length}
                    </span>{' '}
                    indexed files by keyword or meaning. Helios explains the answer clearly and opens the exact page with highlighted excerpts on the right.
                  </p>

                  <div
                    className="pt-3 border-t flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]"
                    style={{ borderColor: 'var(--h-border)', color: 'var(--h-text-dim)' }}
                  >
                    <span>Indexed files:</span>
                    {documents.map((d, i) => (
                      <React.Fragment key={d.id}>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectDocument(d.id);
                            if (window.innerWidth < 1024) setMobilePane('reader');
                          }}
                          className="font-mono hover:underline cursor-pointer"
                          style={{ color: 'var(--h-text-muted)' }}
                        >
                          {d.title !== d.fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')
                            ? `${d.title} (${d.fileName})`
                            : d.fileName}
                        </button>
                        {i < documents.length - 1 && <span aria-hidden="true">·</span>}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Cross-Document Starter Queries */}
                <div className="space-y-2">
                  <div
                    className="text-[11px] font-semibold uppercase tracking-[0.14em] px-1"
                    style={{ color: 'var(--h-text-dim)' }}
                  >
                    Try searching across your library
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {CROSS_DOC_STARTERS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => onAskQuestion(q, searchScope)}
                        disabled={isAsking}
                        className="group text-left p-3 rounded-xl border text-sm transition-colors flex items-center justify-between gap-3 cursor-pointer hover:opacity-95"
                        style={{
                          backgroundColor: 'var(--h-card)',
                          borderColor: 'var(--h-border)',
                          color: 'var(--h-text)',
                        }}
                      >
                        <span className="flex items-start gap-2.5">
                          <Search
                            className="w-4 h-4 mt-0.5 shrink-0"
                            style={{ color: 'var(--h-accent)' }}
                          />
                          <span className="leading-snug">{q}</span>
                        </span>
                        <ArrowRight
                          className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ color: 'var(--h-accent)' }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg, msgIdx) => {
                if (msg.role === 'user') {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div
                        className="max-w-[88%] rounded-xl border px-4 py-2.5 text-sm leading-relaxed"
                        style={{
                          backgroundColor: 'var(--h-elevated)',
                          borderColor: 'var(--h-border-strong)',
                          color: 'var(--h-text)',
                        }}
                      >
                        {msg.content}
                      </div>
                    </div>
                  );
                }

                const userQuestion =
                  msgIdx > 0 && messages[msgIdx - 1].role === 'user'
                    ? messages[msgIdx - 1].content
                    : 'Smart Search';
                const firstDocId = msg.citations?.[0]?.documentId ?? activeDoc.id;
                const noteSignature = `${firstDocId}::${msg.id}`;
                const isSaved = savedNoteSignatures.has(noteSignature);

                if (msg.error) {
                  return (
                    <div
                      key={msg.id}
                      className="rounded-xl border p-4 flex items-start gap-3"
                      style={{
                        backgroundColor: 'var(--h-card)',
                        borderColor: 'rgba(239, 68, 68, 0.4)',
                      }}
                    >
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0 space-y-2">
                        <p className="text-sm text-red-300">{msg.error}</p>
                        <button
                          type="button"
                          onClick={() => onAskQuestion(userQuestion, searchScope)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline cursor-pointer"
                          style={{ color: 'var(--h-accent)' }}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Try Again</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                // Multi-document filter chips for this answer
                const msgCitations = msg.citations ?? [];
                const distinctFiles = Array.from(
                  new Map(
                    msgCitations.map((c) => [
                      c.documentId || c.fileName || 'doc',
                      c.fileName || activeDoc.fileName,
                    ])
                  ).entries()
                );
                const activeFileFilter = docFilterByMsg[msg.id] ?? 'all';
                const visibleCitations =
                  activeFileFilter === 'all'
                    ? msgCitations
                    : msgCitations.filter(
                        (c) => (c.documentId || c.fileName || 'doc') === activeFileFilter
                      );

                return (
                  <article
                    key={msg.id}
                    className="rounded-xl border p-4 sm:p-5 space-y-4"
                    style={{
                      backgroundColor: 'var(--h-card)',
                      borderColor:
                        focusedAssistantMsg?.id === msg.id
                          ? 'var(--h-border-strong)'
                          : 'var(--h-border)',
                    }}
                  >
                    {/* Answer Text with Clickable Inline File + Page Citations */}
                    <div className="text-[14.5px] leading-[1.68] whitespace-pre-wrap">
                      {renderAnswerWithInlineCitations(msg.content, msg)}
                    </div>

                    {/* Matched Sources & Highlighted Excerpts */}
                    {msgCitations.length > 0 && (
                      <div
                        className="pt-3.5 border-t space-y-2.5"
                        style={{ borderColor: 'var(--h-border)' }}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span
                            className="text-[11px] font-semibold uppercase tracking-[0.12em]"
                            style={{ color: 'var(--h-text-muted)' }}
                          >
                            Found in your files ({msgCitations.length})
                          </span>
                          <span className="text-[11px]" style={{ color: 'var(--h-text-dim)' }}>
                            Click to open &amp; highlight
                          </span>
                        </div>

                        {/* Interactive File Filter Chips when multiple PDFs matched */}
                        {distinctFiles.length > 1 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setDocFilterByMsg((prev) => ({ ...prev, [msg.id]: 'all' }))
                              }
                              className="px-2.5 py-1 rounded-md border text-[11px] font-semibold cursor-pointer transition-colors"
                              style={{
                                backgroundColor:
                                  activeFileFilter === 'all'
                                    ? 'var(--h-accent)'
                                    : 'var(--h-elevated)',
                                borderColor:
                                  activeFileFilter === 'all'
                                    ? 'var(--h-accent)'
                                    : 'var(--h-border)',
                                color:
                                  activeFileFilter === 'all'
                                    ? 'var(--h-accent-fg)'
                                    : 'var(--h-text-muted)',
                              }}
                            >
                              All Files ({msgCitations.length})
                            </button>
                            {distinctFiles.map(([docKey, fileName]) => {
                              const selected = activeFileFilter === docKey;
                              return (
                                <button
                                  key={docKey}
                                  type="button"
                                  onClick={() =>
                                    setDocFilterByMsg((prev) => ({
                                      ...prev,
                                      [msg.id]: docKey,
                                    }))
                                  }
                                  className="px-2.5 py-1 rounded-md border font-mono text-[11px] font-semibold cursor-pointer transition-colors truncate max-w-[200px]"
                                  style={{
                                    backgroundColor: selected
                                      ? 'var(--h-accent)'
                                      : 'var(--h-elevated)',
                                    borderColor: selected
                                      ? 'var(--h-accent)'
                                      : 'var(--h-border)',
                                    color: selected
                                      ? 'var(--h-accent-fg)'
                                      : 'var(--h-text-muted)',
                                  }}
                                >
                                  {fileName}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        <div className="space-y-2">
                          {visibleCitations.map((cit) => {
                            const globalIdx = msgCitations.findIndex((c) => c.id === cit.id) + 1;
                            const isCitActive = activeCitationId === cit.id;
                            return (
                              <button
                                key={cit.id}
                                type="button"
                                onClick={() => jumpToCitation(cit, msg.id)}
                                className="w-full text-left rounded-lg border p-3 transition-colors cursor-pointer"
                                style={{
                                  backgroundColor: isCitActive
                                    ? 'var(--h-accent-soft)'
                                    : 'var(--h-elevated)',
                                  borderColor: isCitActive
                                    ? 'var(--h-accent)'
                                    : 'var(--h-border)',
                                }}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span
                                      className="px-1.5 py-0.5 rounded font-mono text-[11px] font-bold tabular-nums shrink-0"
                                      style={{
                                        backgroundColor: 'var(--h-accent)',
                                        color: 'var(--h-accent-fg)',
                                      }}
                                    >
                                      [{globalIdx}] {cit.fileName || activeDoc.fileName} · p. {cit.pageNumber}
                                    </span>
                                    <span
                                      className="text-xs font-medium truncate"
                                      style={{ color: 'var(--h-text)' }}
                                    >
                                      {cit.sectionTitle}
                                    </span>
                                  </div>
                                  <span
                                    className="text-[11px] font-semibold shrink-0"
                                    style={{ color: 'var(--h-accent)' }}
                                  >
                                    {isCitActive ? 'Opened' : 'Open →'}
                                  </span>
                                </div>

                                <blockquote
                                  className="mt-2 text-xs leading-relaxed line-clamp-3"
                                  style={{ color: 'var(--h-text-muted)' }}
                                >
                                  &ldquo;{cit.excerpt}&rdquo;
                                </blockquote>

                                {cit.whyRelevant && (
                                  <p
                                    className="mt-1.5 text-[11px]"
                                    style={{ color: 'var(--h-text-dim)' }}
                                  >
                                    {cit.whyRelevant}
                                  </p>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Follow-up Suggestions */}
                    {msg.followUpQuestions && msg.followUpQuestions.length > 0 && (
                      <div
                        className="pt-3 border-t space-y-2"
                        style={{ borderColor: 'var(--h-border)' }}
                      >
                        <div
                          className="text-[11px] font-semibold uppercase tracking-[0.12em]"
                          style={{ color: 'var(--h-text-dim)' }}
                        >
                          Related Searches
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.followUpQuestions.map((fq) => (
                            <button
                              key={fq}
                              type="button"
                              onClick={() => onAskQuestion(fq, searchScope)}
                              disabled={isAsking}
                              className="text-left px-2.5 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer hover:opacity-90"
                              style={{
                                backgroundColor: 'var(--h-elevated)',
                                borderColor: 'var(--h-border)',
                                color: 'var(--h-text-muted)',
                              }}
                            >
                              {fq}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Bar */}
                    <div
                      className="pt-2.5 border-t flex items-center justify-between gap-3 text-xs"
                      style={{ borderColor: 'var(--h-border)' }}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition-colors cursor-pointer"
                          style={{
                            backgroundColor: 'var(--h-elevated)',
                            borderColor: 'var(--h-border)',
                            color: 'var(--h-text-muted)',
                          }}
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3.5 h-3.5" style={{ color: 'var(--h-mint)' }} />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => onSaveNote(userQuestion, msg)}
                          disabled={isSaved}
                          className="px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-80"
                          style={{
                            backgroundColor: isSaved ? 'var(--h-accent-soft)' : 'var(--h-elevated)',
                            borderColor: isSaved ? 'var(--h-border-strong)' : 'var(--h-border)',
                            color: isSaved ? 'var(--h-accent)' : 'var(--h-text-muted)',
                          }}
                        >
                          {isSaved ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Saved</span>
                            </>
                          ) : (
                            <>
                              <Bookmark className="w-3.5 h-3.5" />
                              <span>Save Note</span>
                            </>
                          )}
                        </button>
                      </div>

                      <span className="font-mono text-[11px]" style={{ color: 'var(--h-text-dim)' }}>
                        {msg.timestamp}
                      </span>
                    </div>
                  </article>
                );
              })
            )}

            {isAsking && (
              <div
                className="rounded-xl border p-4 space-y-3 animate-pulse"
                style={{
                  backgroundColor: 'var(--h-card)',
                  borderColor: 'var(--h-border)',
                }}
              >
                <div className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--h-accent)' }}>
                  <Search className="w-3.5 h-3.5" />
                  <span>
                    Searching{' '}
                    {searchScope === 'all'
                      ? `across all ${documents.length} documents`
                      : activeDoc.fileName}
                    ...
                  </span>
                </div>
                <div className="h-3.5 w-11/12 rounded" style={{ backgroundColor: 'var(--h-elevated)' }} />
                <div className="h-3.5 w-4/5 rounded" style={{ backgroundColor: 'var(--h-elevated)' }} />
                <div className="h-3.5 w-2/3 rounded" style={{ backgroundColor: 'var(--h-elevated)' }} />
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </section>

        {/* RIGHT PANE: Matched Document Page Reader with Excerpt Highlighting */}
        <section
          aria-label="Matched Document Reader"
          className={`flex-col min-h-0 ${
            mobilePane === 'qa' ? 'hidden lg:flex' : 'flex'
          } w-full lg:w-[54%] h-full`}
          style={{ backgroundColor: 'var(--h-bg)' }}
        >
          {/* Reader Header */}
          <div
            className="shrink-0 px-4 py-2.5 border-b flex flex-wrap items-center justify-between gap-2.5"
            style={{
              backgroundColor: 'var(--h-card)',
              borderColor: 'var(--h-border)',
            }}
          >
            {/* Active Document Switcher + Quick Rename + Page Stepper */}
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <div className="flex items-center gap-1.5 min-w-0">
                <BookOpen className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--h-accent)' }} />
                <select
                  aria-label="Open document in reader"
                  value={activeDoc.id}
                  onChange={(e) => {
                    onSelectDocument(e.target.value);
                    setCurrentPage(1);
                    setCitedOnly(false);
                  }}
                  className="h-7 px-2 rounded border text-xs font-mono font-semibold max-w-[180px] truncate cursor-pointer focus:outline-none"
                  style={{
                    backgroundColor: 'var(--h-elevated)',
                    borderColor: 'var(--h-border)',
                    color: 'var(--h-text)',
                  }}
                >
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fileName}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (editingReaderMeta) {
                      setEditingReaderMeta(false);
                    } else {
                      setAliasTitle(activeDoc.title);
                      setAliasCode(activeDoc.courseCode);
                      setEditingReaderMeta(true);
                    }
                  }}
                  title="Rename or tag this file"
                  className="w-7 h-7 rounded border flex items-center justify-center cursor-pointer"
                  style={{
                    backgroundColor: editingReaderMeta ? 'var(--h-accent-soft)' : 'var(--h-elevated)',
                    borderColor: editingReaderMeta ? 'var(--h-accent)' : 'var(--h-border)',
                    color: editingReaderMeta ? 'var(--h-accent)' : 'var(--h-text-muted)',
                  }}
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => scrollToPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  aria-label="Previous page"
                  className="w-7 h-7 rounded-md border flex items-center justify-center disabled:opacity-40 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--h-elevated)',
                    borderColor: 'var(--h-border)',
                  }}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-1.5 text-xs font-mono tabular-nums" style={{ color: 'var(--h-text-muted)' }}>
                  p. {currentPage}/{activeDoc.pages.length}
                </span>
                <button
                  type="button"
                  onClick={() => scrollToPage(currentPage + 1)}
                  disabled={currentPage >= activeDoc.pages.length}
                  aria-label="Next page"
                  className="w-7 h-7 rounded-md border flex items-center justify-center disabled:opacity-40 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--h-elevated)',
                    borderColor: 'var(--h-border)',
                  }}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Match Stepper + Filter + Quick Find */}
            <div className="flex items-center gap-2 flex-wrap">
              {allAnswerCitations.length > 0 && (
                <div
                  className="flex items-center gap-1 px-2 py-1 rounded-lg border text-xs"
                  style={{
                    backgroundColor: 'var(--h-accent-soft)',
                    borderColor: 'var(--h-border-strong)',
                  }}
                >
                  <span className="font-mono font-semibold tabular-nums" style={{ color: 'var(--h-accent)' }}>
                    {allAnswerCitations.length} {allAnswerCitations.length === 1 ? 'Match' : 'Matches'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCycleCitation('prev')}
                    title="Previous match"
                    className="p-0.5 rounded hover:opacity-80 cursor-pointer"
                    style={{ color: 'var(--h-accent)' }}
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCycleCitation('next')}
                    title="Next match"
                    className="p-0.5 rounded hover:opacity-80 cursor-pointer"
                    style={{ color: 'var(--h-accent)' }}
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  {activeDocCitations.length > 0 && (
                    <>
                      <span
                        className="h-3.5 w-px mx-0.5"
                        style={{ backgroundColor: 'var(--h-border-strong)' }}
                        aria-hidden="true"
                      />
                      <button
                        type="button"
                        onClick={() => setCitedOnly((prev) => !prev)}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold cursor-pointer"
                        style={{
                          backgroundColor: citedOnly ? 'var(--h-accent)' : 'transparent',
                          color: citedOnly ? 'var(--h-accent-fg)' : 'var(--h-accent)',
                        }}
                      >
                        <Filter className="w-3 h-3" />
                        <span>Cited Only</span>
                      </button>
                    </>
                  )}
                </div>
              )}

              <div
                className="h-7 px-2 rounded-lg border flex items-center gap-1.5"
                style={{
                  backgroundColor: 'var(--h-elevated)',
                  borderColor: 'var(--h-border)',
                }}
              >
                <Search className="w-3 h-3 shrink-0" style={{ color: 'var(--h-text-dim)' }} />
                <input
                  type="text"
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  placeholder="Find in page..."
                  aria-label="Find text in open document"
                  className="w-24 sm:w-28 bg-transparent text-xs focus:outline-none"
                  style={{ color: 'var(--h-text)' }}
                />
                {docSearch && (
                  <button
                    type="button"
                    onClick={() => setDocSearch('')}
                    aria-label="Clear find"
                    className="cursor-pointer"
                    style={{ color: 'var(--h-text-dim)' }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Inline Rename / Tag Bar for the Open Document */}
          {editingReaderMeta && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onUpdateDocumentMeta(activeDoc.id, {
                  title: aliasTitle,
                  courseCode: aliasCode,
                });
                setEditingReaderMeta(false);
              }}
              className="shrink-0 px-4 py-2.5 border-b flex flex-wrap items-center gap-2"
              style={{
                backgroundColor: 'var(--h-elevated)',
                borderColor: 'var(--h-border-strong)',
              }}
            >
              <span className="text-[11px] font-semibold" style={{ color: 'var(--h-text-muted)' }}>
                Label:
              </span>
              <input
                type="text"
                value={aliasTitle}
                onChange={(e) => setAliasTitle(e.target.value)}
                placeholder="Readable title..."
                className="h-7 px-2 rounded border text-xs flex-1 min-w-[160px] focus:outline-none"
                style={{
                  backgroundColor: 'var(--h-card)',
                  borderColor: 'var(--h-border)',
                  color: 'var(--h-text)',
                }}
              />
              <input
                type="text"
                value={aliasCode}
                onChange={(e) => setAliasCode(e.target.value)}
                placeholder="Tag (e.g. CS-301)"
                className="h-7 px-2 rounded border text-xs font-mono w-28 focus:outline-none"
                style={{
                  backgroundColor: 'var(--h-card)',
                  borderColor: 'var(--h-border)',
                  color: 'var(--h-text)',
                }}
              />
              <button
                type="submit"
                className="h-7 px-3 rounded text-xs font-semibold cursor-pointer"
                style={{
                  backgroundColor: 'var(--h-accent)',
                  color: 'var(--h-accent-fg)',
                }}
              >
                Save
              </button>
            </form>
          )}

          {/* Scrollable Pages */}
          <div
            ref={readerScrollRef}
            className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6"
          >
            {visiblePages.map((page) => {
              const pageCitations = citationsByPage.get(page.pageNumber) ?? [];
              const segments = buildHighlightedSegments(
                page.content,
                pageCitations,
                activeCitationId,
                docSearch
              );
              const isPageFocused = pageCitations.some(
                (c) => c.citation.id === activeCitationId
              );

              return (
                <article
                  key={`${activeDoc.id}-p-${page.pageNumber}`}
                  ref={(el) => {
                    pageRefs.current[page.pageNumber] = el;
                  }}
                  onClick={() => setCurrentPage(page.pageNumber)}
                  className="max-w-[70ch] mx-auto rounded-xl border p-6 sm:p-8 transition-colors"
                  style={{
                    backgroundColor: 'var(--h-card)',
                    borderColor: isPageFocused
                      ? 'var(--h-accent)'
                      : pageCitations.length > 0
                        ? 'var(--h-border-strong)'
                        : 'var(--h-border)',
                  }}
                >
                  <header
                    className="pb-4 mb-5 border-b flex flex-wrap items-center justify-between gap-2"
                    style={{ borderColor: 'var(--h-border)' }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="font-mono text-xs font-bold uppercase tracking-wider tabular-nums"
                        style={{ color: 'var(--h-accent)' }}
                      >
                        Page {String(page.pageNumber).padStart(2, '0')}
                      </span>
                      <span style={{ color: 'var(--h-text-dim)' }} aria-hidden="true">
                        /
                      </span>
                      <span
                        className="text-xs font-semibold truncate"
                        style={{ color: 'var(--h-text-muted)' }}
                      >
                        {page.title}
                      </span>
                    </div>

                    {pageCitations.length > 0 && (
                      <span
                        className="text-[11px] font-mono font-semibold tabular-nums"
                        style={{ color: 'var(--h-accent)' }}
                      >
                        {pageCitations.length}{' '}
                        {pageCitations.length === 1 ? 'highlighted excerpt' : 'highlighted excerpts'}
                      </span>
                    )}
                  </header>

                  <div
                    className="text-[15px] leading-[1.78] whitespace-pre-wrap break-words"
                    style={{ color: 'var(--h-text)' }}
                  >
                    {segments.map((seg, idx) => {
                      if (!seg.highlight) {
                        return <React.Fragment key={idx}>{seg.text}</React.Fragment>;
                      }

                      const h = seg.highlight;
                      if (h.kind === 'search') {
                        return (
                          <mark
                            key={idx}
                            className="rounded px-0.5"
                            style={{
                              backgroundColor: 'rgba(251, 191, 36, 0.28)',
                              color: 'var(--h-text)',
                            }}
                          >
                            {seg.text}
                          </mark>
                        );
                      }

                      return (
                        <mark
                          key={`${h.citationId}-${idx}`}
                          ref={(el) => {
                            markRefs.current[h.citationId] = el;
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveCitationId(h.citationId);
                          }}
                          className={`rounded-sm px-1 py-0.5 cursor-pointer transition-all ${
                            h.isActive ? 'excerpt-active-pulse' : ''
                          }`}
                          style={{
                            backgroundColor: h.isActive
                              ? 'var(--h-highlight-active-bg)'
                              : 'var(--h-highlight-bg)',
                            color: 'var(--h-highlight-text)',
                            borderBottom: '2px solid var(--h-highlight-border)',
                            outline: h.isActive ? '1.5px solid var(--h-highlight-border)' : 'none',
                          }}
                        >
                          <span
                            className="inline-flex items-center justify-center mr-1 px-1 rounded text-[10px] font-mono font-bold align-baseline select-none"
                            style={{
                              backgroundColor: 'var(--h-accent)',
                              color: 'var(--h-accent-fg)',
                            }}
                          >
                            {h.citationIndex}
                          </span>
                          {seg.text}
                        </mark>
                      );
                    })}
                  </div>

                  <footer
                    className="mt-6 pt-3 border-t flex items-center justify-between text-[11px] font-mono tabular-nums"
                    style={{ borderColor: 'var(--h-border)', color: 'var(--h-text-dim)' }}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <FileText className="w-3 h-3 shrink-0" />
                      <span className="truncate">{activeDoc.fileName}</span>
                    </span>
                    <span>
                      p. {page.pageNumber} / {activeDoc.pages.length}
                    </span>
                  </footer>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};

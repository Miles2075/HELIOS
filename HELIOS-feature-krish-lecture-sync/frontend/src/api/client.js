import { BRAIN_MAPS, QUIZ_BANK, SAMPLE_DATASET_CSV } from '../data/mockCorpus'

// --- Health check against FastAPI root ---
export async function checkBackendHealth() {
  try {
    const res = await fetch('/health')
    if (!res.ok) return { online: false }
    const data = await res.json()
    return { online: true, message: data.message || 'HELIOS API is running!' }
  } catch {
    return { online: false }
  }
}

// ============================================================================
// 1. LECTURE SYNC (LIVE FastAPI Backend: /api/lecture/* backed by SQLite)
// ============================================================================

export async function listLectures() {
  const res = await fetch('/api/lecture/list')
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.detail || `Failed to load lectures (${res.status})`)
  }
  return data.lectures || []
}

export function getLectureAudioUrl(lectureId) {
  return `/api/lecture/${lectureId}/audio`
}

export async function uploadLecture(file) {
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch('/api/lecture/upload', {
    method: 'POST',
    body: formData,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.detail || `Upload failed (${res.status})`)
  }
  return { ...data, _mode: 'live' }
}

export async function importYouTubeLecture(url) {
  const res = await fetch('/api/lecture/youtube', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.detail || `YouTube import failed (${res.status})`)
  }
  return { ...data, _mode: 'live' }
}

export async function transcribeLecture(lectureId, force = false) {
  const res = await fetch('/api/lecture/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lecture_id: lectureId, force }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.detail || `Transcription failed (${res.status})`)
  }
  return { ...data, _mode: 'live' }
}

export async function searchLecture(lectureId, query) {
  const res = await fetch('/api/lecture/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lecture_id: lectureId, query }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.detail || `Search failed (${res.status})`)
  }
  return { ...data, _mode: 'live' }
}

/**
 * Generates a real playable 18-second PCM WAV file in the browser so users
 * can test the live FastAPI upload -> transcribe -> search + audio seek flow
 * with one click even without a local MP3/WAV file.
 */
export function createSampleWavFile(filename = 'physics_lecture_newton.wav') {
  const sampleRate = 8000
  const durationSec = 18
  const numSamples = sampleRate * durationSec
  const buffer = new ArrayBuffer(44 + numSamples * 2)
  const view = new DataView(buffer)

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + numSamples * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, numSamples * 2, true)

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate
    const freq = t < 8.5 ? 261.63 : 329.63
    const envelope = Math.min(1, Math.sin((Math.PI * (t % 8.5)) / 8.5) * 2.5) * 0.16
    const sample = Math.sin(2 * Math.PI * freq * t) * envelope
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 32767, true)
  }

  return new File([buffer], filename, { type: 'audio/wav' })
}

// ============================================================================
// 2. SMART SEARCH (README: POST /api/search/upload, GET /api/search/search)
// ============================================================================

export async function listDocuments() {
  const res = await fetch('/api/search/documents')
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return []
  return data.documents || []
}

export async function uploadSearchDocument(file, nextId) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!['pdf', 'txt'].includes(ext)) {
    throw new Error('Unsupported document format. Only PDF and TXT files are accepted.')
  }

  try {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/search/upload', { method: 'POST', body: formData })
    if (res.ok) {
      const data = await res.json()
      return {
        ...data,
        pages: data.pages_extracted ?? data.pages ?? 1,
        _mode: 'live',
      }
    }
    if (res.status !== 404) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Upload failed')
    }
  } catch (e) {
    if (e.message && !e.message.includes('fetch')) throw e
  }

  // Contract-compliant local preview when Smart Search router isn't merged yet
  let sections
  if (ext === 'txt') {
    const text = await file.text()
    const chunks = text
      .split(/\n\s*\n/)
      .map((c) => c.trim())
      .filter(Boolean)
    sections = (chunks.length ? chunks : [text.trim() || 'Empty document']).map((chunk, i) => ({
      page: i + 1,
      heading: `Section ${i + 1}`,
      text: chunk,
    }))
  } else {
    sections = [
      {
        page: 1,
        heading: 'Document Abstract',
        text: `Indexed content from ${file.name}. Semantic chunks and page references are prepared for Q&A retrieval.`,
      },
    ]
  }

  return {
    success: true,
    document_id: nextId,
    filename: file.name,
    pages_extracted: sections.length,
    pages_embedded: sections.length,
    pages: sections.length,
    message: 'Document uploaded successfully',
    sections,
    _mode: 'contract-preview',
  }
}

export async function askSmartSearch(documentId, question, documents, topK = 5) {
  // 1. Live README endpoint: GET /api/search/search?query=...&top_k=5
  try {
    const params = new URLSearchParams({
      query: question,
      top_k: String(topK),
      ...(documentId ? { document_id: String(documentId) } : {}),
    })
    const res = await fetch(`/api/search/search?${params.toString()}`)
    if (res.ok) {
      const data = await res.json()
      return {
        success: Boolean(data.success),
        answer: data.answer,
        sources: (data.results || []).map((r) => ({
          document: r.filename || `Document #${r.document_id}`,
          page: r.page_number,
          text: r.text,
          distance: r.distance,
        })),
        _mode: 'live',
      }
    }
  } catch {
    // fallback below
  }

  // 2. API_CONTRACT.md endpoint: POST /api/search/ask
  try {
    const res = await fetch('/api/search/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_id: documentId, question }),
    })
    if (res.ok) {
      const data = await res.json()
      return { ...data, _mode: 'live' }
    }
  } catch {
    // fallback below
  }

  // 3. Local contract preview respecting README distance <= 0.6 rule
  const doc = documents.find((d) => d.document_id === documentId) || documents[0]
  const tokens = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)

  const scored = (doc?.sections || [])
    .map((sec) => {
      const hay = `${sec.heading} ${sec.text}`.toLowerCase()
      const hits = tokens.reduce((acc, tok) => acc + (hay.includes(tok) ? 1 : 0), 0)
      const distance = hits > 0 ? Number(Math.max(0.14, 0.55 - hits * 0.12).toFixed(2)) : 0.85
      return { sec, hits, distance }
    })
    .filter((item) => item.distance <= 0.6)
    .sort((a, b) => a.distance - b.distance)

  if (scored.length === 0) {
    return {
      success: true,
      answer:
        'No sufficiently relevant information was found in the uploaded documents (vector distance > 0.6 threshold).',
      sources: [],
      _mode: 'contract-preview',
    }
  }

  const chosen = scored.slice(0, 2)
  const answer = `Based on ${doc.filename}, ${chosen.map((c) => `${c.sec.text} [Page ${c.sec.page}]`).join(' ')}`

  return {
    success: true,
    answer,
    sources: chosen.map((c) => ({
      document: doc.filename,
      page: c.sec.page,
      text: c.sec.text,
      distance: c.distance,
    })),
    _mode: 'contract-preview',
  }
}

// ============================================================================
// 3. QUIZ MASTER (/api/quiz/generate)
// ============================================================================

export async function generateQuiz({ document_id, question_count, difficulty, type }) {
  try {
    const res = await fetch('/api/quiz/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_id, question_count, difficulty, type }),
    })
    if (res.ok) {
      const data = await res.json()
      return { ...data, _mode: 'live' }
    }
  } catch {
    // fallback below
  }

  const bank = QUIZ_BANK[document_id] || QUIZ_BANK[1]
  const pool = bank[type] || bank.mcq
  const questions = pool.slice(0, Math.min(question_count, pool.length))

  return {
    success: true,
    quiz_id: 100 + Math.floor(Math.random() * 900),
    difficulty,
    type,
    questions,
    _mode: 'contract-preview',
  }
}

// ============================================================================
// 4. BRAIN MAP (/api/brainmap/generate)
// ============================================================================

export async function generateBrainMap(documentId, documents) {
  try {
    const res = await fetch('/api/brainmap/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_id: documentId }),
    })
    if (res.ok) {
      const data = await res.json()
      return { ...data, _mode: 'live' }
    }
    if (res.status !== 404) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || `Brain Map generation failed (${res.status})`)
    }
  } catch (e) {
    if (e.message && !e.message.includes('fetch')) throw e
  }

  if (BRAIN_MAPS[documentId]) {
    return { ...BRAIN_MAPS[documentId], _mode: 'contract-preview' }
  }

  const doc = documents.find((d) => d.document_id === documentId)
  if (!doc) {
    throw new Error(`Document ID ${documentId} not found in local store.`)
  }
  const label = doc.filename.replace(/\.[^.]+$/, '')
  const nodes = [
    { id: 'root', label, type: 'core', summary: `Root knowledge hub extracted from ${doc.filename}.` },
    ...(doc.sections || []).slice(0, 5).map((s, idx) => ({
      id: `sec_${idx + 1}`,
      label: s.heading || `Topic ${idx + 1}`,
      type: idx % 2 === 0 ? 'concept' : 'mechanism',
      summary: s.text,
    })),
  ]
  const edges = nodes.slice(1).map((n, idx) => ({
    source: idx === 0 ? 'root' : nodes[idx].id,
    target: n.id,
    relationship: idx === 0 ? 'introduces' : 'connects_to',
  }))

  return {
    success: true,
    map_id: String(300 + documentId),
    nodes,
    edges,
    _mode: 'contract-preview',
  }
}

// ============================================================================
// 5. DATA STORYTELLER (/api/data/list, /api/data/upload, /api/data/analyze)
// ============================================================================

export async function listDatasets() {
  try {
    const res = await fetch('/api/data/list')
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return []
    return data.datasets || []
  } catch {
    return []
  }
}

export function parseCsvText(csvText) {
  const lines = csvText
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = lines[0].split(',').map((h) => h.trim())
  const rows = lines.slice(1).map((line) => {
    const vals = line.split(',').map((v) => v.trim())
    const obj = {}
    headers.forEach((h, i) => {
      const num = Number(vals[i])
      obj[h] = vals[i] !== '' && !Number.isNaN(num) ? num : vals[i]
    })
    return obj
  })
  return { headers, rows }
}

export async function uploadDataset(file, nextId) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!['csv', 'xlsx'].includes(ext)) {
    throw new Error('Unsupported dataset format. Only CSV and XLSX files are accepted.')
  }

  try {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/data/upload', { method: 'POST', body: formData })
    if (res.ok) {
      const data = await res.json()
      return { ...data, _mode: 'live' }
    }
  } catch {
    // fallback below
  }

  const parsed = ext === 'csv' ? parseCsvText(await file.text()) : parseCsvText(SAMPLE_DATASET_CSV)

  return {
    success: true,
    dataset_id: nextId,
    filename: file.name,
    message: 'Dataset uploaded successfully',
    parsed,
    _mode: 'contract-preview',
  }
}

export async function analyzeDataset(dataset) {
  try {
    const res = await fetch('/api/data/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataset_id: dataset.dataset_id }),
    })
    if (res.ok) {
      const data = await res.json()
      return { ...data, _mode: 'live' }
    }
  } catch {
    // fallback below
  }

  const parsed = dataset.parsed || parseCsvText(SAMPLE_DATASET_CSV)
  const { headers, rows } = parsed
  const numericCols = headers.filter((h) => rows.some((r) => typeof r[h] === 'number'))
  const targetCol = numericCols[numericCols.length - 1] || numericCols[0]

  const computeStats = (col) => {
    const vals = rows.map((r) => r[col]).filter((v) => typeof v === 'number' && !Number.isNaN(v))
    if (!vals.length) return { mean: 0, median: 0, min: 0, max: 0, std: 0 }
    const sorted = [...vals].sort((a, b) => a - b)
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length
    const mid = Math.floor(sorted.length / 2)
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
    const variance = vals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / vals.length
    return {
      mean: Number(mean.toFixed(2)),
      median: Number(median.toFixed(2)),
      min: Number(sorted[0].toFixed(2)),
      max: Number(sorted[sorted.length - 1].toFixed(2)),
      std: Number(Math.sqrt(variance).toFixed(2)),
    }
  }

  const columnInfo = {}
  headers.forEach((col) => {
    const vals = rows.map((r) => r[col])
    const missing = vals.filter((v) => v === '' || v === null || v === undefined).length
    const nonEmpty = vals.filter((v) => v !== '' && v !== null && v !== undefined)
    const isNum = nonEmpty.length > 0 && nonEmpty.every((v) => typeof v === 'number')
    columnInfo[col] = {
      data_type: isNum ? 'float64' : 'object',
      missing_values: missing,
      unique_values: new Set(nonEmpty).size,
    }
  })

  const columnStats = {}
  numericCols.forEach((c) => {
    columnStats[c] = computeStats(c)
  })

  const primaryStats = columnStats[targetCol] || { mean: 0, median: 0, min: 0, max: 0, std: 0 }
  const xCol = numericCols[0] || headers[0]
  const yCol = numericCols.length > 1 ? numericCols[numericCols.length - 2] : targetCol
  const maxRow = rows.reduce((best, r) => (r[yCol] > (best?.[yCol] ?? -Infinity) ? r : best), rows[0])

  return {
    success: true,
    dataset_id: dataset.dataset_id,
    summary: {
      rows: rows.length,
      columns: headers.length,
    },
    columns: columnInfo,
    statistics: {
      mean: primaryStats.mean,
      median: primaryStats.median,
      min: primaryStats.min,
      max: primaryStats.max,
      std: primaryStats.std,
      primary_column: targetCol,
      by_column: columnStats,
    },
    charts: [
      { type: 'scatter', x: xCol, y: yCol, title: `${xCol} vs ${yCol}` },
      { type: 'bar', x: xCol, y: targetCol, title: `${targetCol} across ${xCol}` },
    ],
    ai_summary: `Analyzed ${rows.length} rows across ${headers.length} columns in ${dataset.filename}. "${yCol}" peaks at ${maxRow?.[yCol]} when ${xCol} = ${maxRow?.[xCol]}. Across "${targetCol}", mean is ${primaryStats.mean}, median is ${primaryStats.median}, and std dev is ${primaryStats.std}.`,
    parsed,
    _mode: 'contract-preview',
  }
}

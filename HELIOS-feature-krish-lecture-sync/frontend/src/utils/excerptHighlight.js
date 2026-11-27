/**
 * Normalizes whitespace while maintaining a map from normalized string indices
 * back to original string indices so any fuzzy/whitespace-insensitive match
 * highlights the exact original characters in the document page.
 */
function buildNormalizedMap(raw) {
  let norm = ''
  const indexMap = []
  let inSpace = false

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    const isWs = /\s/.test(ch)
    if (isWs) {
      if (!inSpace && norm.length > 0) {
        norm += ' '
        indexMap.push(i)
        inSpace = true
      }
    } else {
      norm += ch.toLowerCase()
      indexMap.push(i)
      inSpace = false
    }
  }

  return { norm, indexMap }
}

function normalizeQuery(text) {
  return text
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * Finds the best [start, end) character span in `pageContent` for a cited excerpt.
 * Tries:
 * 1. Exact case-sensitive match
 * 2. Case-insensitive / whitespace-normalized match
 * 3. Punctuation-stripped / anchor-window match (first 4 words ... last 4 words)
 * 4. Best-scoring sentence match via word overlap
 */
export function findExcerptSpan(pageContent, rawExcerpt) {
  const trimmed = (rawExcerpt || '').replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, '')
  if (!trimmed || !pageContent) return null

  // 1. Exact match
  const exactIdx = pageContent.indexOf(trimmed)
  if (exactIdx !== -1) {
    return { start: exactIdx, end: exactIdx + trimmed.length }
  }

  // 2. Whitespace-normalized + lowercase match mapped back to original indices
  const { norm: pageNorm, indexMap } = buildNormalizedMap(pageContent)
  const queryNorm = normalizeQuery(trimmed)

  if (queryNorm.length >= 6) {
    const normIdx = pageNorm.indexOf(queryNorm)
    if (normIdx !== -1) {
      const origStart = indexMap[normIdx]
      const normEndIdx = Math.min(normIdx + queryNorm.length - 1, indexMap.length - 1)
      const origEnd = indexMap[normEndIdx] + 1
      return { start: origStart, end: origEnd }
    }
  }

  // 3. Anchor match using prefix + suffix words (handles minor ellipsis or middle edits)
  const words = queryNorm.split(' ').filter((w) => w.length > 1)
  if (words.length >= 8) {
    const prefix = words.slice(0, 4).join(' ')
    const suffix = words.slice(-4).join(' ')
    const pIdx = pageNorm.indexOf(prefix)
    if (pIdx !== -1) {
      const sIdx = pageNorm.indexOf(suffix, pIdx + prefix.length)
      if (sIdx !== -1 && sIdx - pIdx < queryNorm.length * 1.8 + 120) {
        const origStart = indexMap[pIdx]
        const normEndIdx = Math.min(sIdx + suffix.length - 1, indexMap.length - 1)
        const origEnd = indexMap[normEndIdx] + 1
        return { start: origStart, end: origEnd }
      }
    }
  }

  // 4. Fallback: find sentence in pageContent with highest token overlap
  const queryTokens = new Set(
    queryNorm
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 3)
  )
  if (queryTokens.size < 2) return null

  const sentenceRegex = /[^.!?\n]+[.!?]?/g
  let match
  let bestScore = 0
  let bestSpan = null

  while ((match = sentenceRegex.exec(pageContent)) !== null) {
    const sentence = match[0].trim()
    if (sentence.length < 15) continue
    const sentTokens = sentence
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 3)
    if (sentTokens.length === 0) continue

    let hits = 0
    for (const tok of sentTokens) {
      if (queryTokens.has(tok)) hits++
    }
    const score = hits / Math.max(queryTokens.size, 1)
    if (score > bestScore && hits >= 2) {
      bestScore = score
      const leadingWs = match[0].length - match[0].trimStart().length
      const start = match.index + leadingWs
      const end = start + sentence.length
      bestSpan = { start, end }
    }
  }

  return bestScore >= 0.35 ? bestSpan : null
}

/**
 * Splits `pageContent` into ordered plain and highlighted segments for rendering.
 */
export function buildHighlightedSegments(
  pageContent,
  citations = [],
  activeCitationId = null,
  searchQuery = ''
) {
  if (!pageContent) return []
  const ranges = []

  for (const item of citations) {
    const span = findExcerptSpan(pageContent, item.citation?.excerpt || item.citation?.text || '')
    if (span) {
      ranges.push({
        start: span.start,
        end: span.end,
        citationId: item.citation?.id,
        citationIndex: item.globalIndex,
        isActive: item.citation?.id === activeCitationId,
        kind: 'citation',
      })
    }
  }

  if (searchQuery && searchQuery.trim().length >= 2) {
    const q = searchQuery.trim().toLowerCase()
    const lower = pageContent.toLowerCase()
    let idx = 0
    while ((idx = lower.indexOf(q, idx)) !== -1) {
      ranges.push({
        start: idx,
        end: idx + q.length,
        citationId: `search-${idx}`,
        citationIndex: 0,
        isActive: false,
        kind: 'search',
      })
      idx += q.length
    }
  }

  if (ranges.length === 0) {
    return [{ text: pageContent }]
  }

  // Sort by start ascending; prefer citations & active highlights on overlap
  ranges.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start
    if (a.kind !== b.kind) return a.kind === 'citation' ? -1 : 1
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
    return b.end - a.end
  })

  // Resolve overlaps cleanly so every character appears once
  const cleanRanges = []
  for (const r of ranges) {
    const prev = cleanRanges[cleanRanges.length - 1]
    if (!prev) {
      cleanRanges.push(r)
      continue
    }
    if (r.start >= prev.end) {
      cleanRanges.push(r)
    } else if (r.kind === 'citation' && prev.kind === 'search') {
      cleanRanges[cleanRanges.length - 1] = r
    } else if (r.end > prev.end) {
      cleanRanges.push({ ...r, start: prev.end })
    }
  }

  const segments = []
  let cursor = 0

  for (const r of cleanRanges) {
    if (r.start > cursor) {
      segments.push({ text: pageContent.slice(cursor, r.start) })
    }
    if (r.end > r.start) {
      segments.push({
        text: pageContent.slice(r.start, r.end),
        highlight: r,
      })
      cursor = r.end
    }
  }

  if (cursor < pageContent.length) {
    segments.push({ text: pageContent.slice(cursor) })
  }

  return segments
}

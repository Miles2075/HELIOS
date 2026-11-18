import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  Table2,
  Upload,
} from 'lucide-react'
import { analyzeDataset, listDatasets, parseCsvText, uploadDataset } from '../api/client'
import { SAMPLE_DATASET_CSV } from '../data/mockCorpus'

const PIE_COLORS = [
  '#f472b6',
  '#38bdf8',
  '#34d399',
  '#fbbf24',
  '#a78bfa',
  '#fb7185',
  '#2dd4bf',
  '#f97316',
  '#818cf8',
  '#4ade80',
]

function InteractiveChart({ rows, xCol, yCol, chartType }) {
  const [hoveredIdx, setHoveredIdx] = useState(null)

  if (!rows.length || !xCol || !yCol) return null

  const cleanRows = rows.filter((r) => r && typeof r === 'object')

  if (chartType === 'pie') {
    // Aggregate yCol by distinct xCol categories
    const catMap = {}
    cleanRows.forEach((r) => {
      const label = String(r[xCol] ?? 'Other')
      const val = Math.max(0, Number(r[yCol]) || 0)
      catMap[label] = (catMap[label] || 0) + val
    })
    const slicesRaw = Object.entries(catMap)
      .slice(0, 10)
      .map(([label, value]) => ({ label, value: Number(value.toFixed(2)) }))
    const total = slicesRaw.reduce((acc, s) => acc + s.value, 0) || 1
    const cx = 185
    const cy = 135
    const radius = 102

    const slices = []
    let startAngle = -Math.PI / 2
    slicesRaw.forEach((s, i) => {
      const fraction = s.value / total
      const angle = fraction * Math.PI * 2
      const endAngle = startAngle + angle
      const x1 = cx + radius * Math.cos(startAngle)
      const y1 = cy + radius * Math.sin(startAngle)
      const x2 = cx + radius * Math.cos(endAngle)
      const y2 = cy + radius * Math.sin(endAngle)
      const largeArc = angle > Math.PI ? 1 : 0
      const path =
        slicesRaw.length === 1
          ? `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx - 0.01} ${cy - radius} Z`
          : `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`
      slices.push({
        ...s,
        pct: (fraction * 100).toFixed(1),
        color: PIE_COLORS[i % PIE_COLORS.length],
        path,
      })
      startAngle = endAngle
    })

    return (
      <div className="relative">
        <svg viewBox="0 0 560 270" className="w-full h-auto">
          {slices.map((s, i) => {
            const hovered = hoveredIdx === i
            return (
              <path
                key={i}
                d={s.path}
                fill={s.color}
                fillOpacity={hoveredIdx === null || hovered ? 0.9 : 0.45}
                stroke="var(--bg-app)"
                strokeWidth={hovered ? 2.5 : 1.5}
                style={{ cursor: 'pointer', transition: 'fill-opacity 0.15s' }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            )
          })}
          <circle cx={cx} cy={cy} r={42} fill="var(--bg-card)" />
          <text x={cx} y={cy - 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text-primary)">
            {hoveredIdx !== null && slices[hoveredIdx] ? `${slices[hoveredIdx].pct}%` : yCol}
          </text>
          <text x={cx} y={cy + 13} textAnchor="middle" fontSize="9.5" fill="var(--text-secondary)">
            {hoveredIdx !== null && slices[hoveredIdx]
              ? `${xCol}: ${slices[hoveredIdx].label}`
              : `${slices.length} categories`}
          </text>

          {/* Legend */}
          {slices.map((s, i) => {
            const ly = 28 + i * 22
            const hovered = hoveredIdx === i
            return (
              <g
                key={i}
                transform={`translate(325, ${ly})`}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer' }}
              >
                <rect width="10" height="10" rx="3" fill={s.color} />
                <text
                  x="18"
                  y="9"
                  fontSize="10.5"
                  fontFamily="JetBrains Mono, monospace"
                  fill={hovered ? 'var(--text-primary)' : 'var(--text-secondary)'}
                  fontWeight={hovered ? '700' : '400'}
                >
                  {s.label.slice(0, 14)} · {s.value} ({s.pct}%)
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    )
  }

  const width = 560
  const height = 270
  const pad = { top: 24, right: 24, bottom: 42, left: 52 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom

  // Prepare chart items: if bar chart and many rows with recurring categories, aggregate mean Y
  let chartItems = cleanRows
  if (chartType === 'bar' && cleanRows.length > 20) {
    const catTotals = {}
    const catCounts = {}
    cleanRows.forEach((r) => {
      const label = String(r[xCol] ?? 'Other')
      const val = Number(r[yCol])
      if (!Number.isNaN(val)) {
        catTotals[label] = (catTotals[label] || 0) + val
        catCounts[label] = (catCounts[label] || 0) + 1
      }
    })
    const uniqueCats = Object.keys(catTotals)
    if (uniqueCats.length <= 15 && uniqueCats.length < cleanRows.length * 0.7) {
      chartItems = uniqueCats.map((cat) => ({
        [xCol]: cat,
        [yCol]: Number((catTotals[cat] / catCounts[cat]).toFixed(2)),
      }))
    } else {
      chartItems = cleanRows.slice(0, 20)
    }
  }

  const xVals = chartItems.map((r, i) => (typeof r[xCol] === 'number' && !Number.isNaN(r[xCol]) ? r[xCol] : i))
  const yVals = chartItems.map((r) => (typeof r[yCol] === 'number' && !Number.isNaN(r[yCol]) ? r[yCol] : 0))

  const minX = Math.min(...xVals)
  const maxX = Math.max(...xVals)
  const minY = Math.min(0, ...yVals)
  const maxY = Math.max(...yVals) * 1.1 || 1

  const scaleX = (v) =>
    maxX === minX ? pad.left + innerW / 2 : pad.left + ((v - minX) / (maxX - minX)) * innerW
  const scaleY = (v) => pad.top + innerH - ((v - minY) / (maxY - minY)) * innerH

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => Number((minY + t * (maxY - minY)).toFixed(1)))

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        {/* Grid lines */}
        {yTicks.map((tick, idx) => {
          const y = scaleY(tick)
          return (
            <g key={idx}>
              <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="var(--border-subtle)" strokeDasharray="3 3" />
              <text x={pad.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="var(--text-muted)" fontFamily="JetBrains Mono">
                {tick}
              </text>
            </g>
          )
        })}

        {/* Axes */}
        <line x1={pad.left} y1={pad.top + innerH} x2={width - pad.right} y2={pad.top + innerH} stroke="var(--border-strong)" />
        <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + innerH} stroke="var(--border-strong)" />

        {/* Axis labels */}
        <text x={pad.left + innerW / 2} y={height - 8} textAnchor="middle" fontSize="11" fill="var(--text-secondary)" fontWeight="600">
          {xCol}
        </text>
        <text
          x={14}
          y={pad.top + innerH / 2}
          textAnchor="middle"
          fontSize="11"
          fill="#b99aa9"
          fontWeight="600"
          transform={`rotate(-90 14 ${pad.top + innerH / 2})`}
        >
          {yCol}
        </text>

        {/* Chart geometry */}
        {chartType === 'bar' ? (
          chartItems.map((r, i) => {
            const barW = Math.max(10, Math.min(36, innerW / chartItems.length - 8))
            const x = pad.left + (i / chartItems.length) * innerW + 4
            const y = scaleY(yVals[i])
            const barH = Math.max(2, pad.top + innerH - y)
            const hovered = hoveredIdx === i
            return (
              <g
                key={i}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={barH}
                  rx={4}
                  fill={hovered ? '#fcd34d' : '#f59e0b'}
                  fillOpacity={hovered ? 1 : 0.82}
                />
                <text
                  x={x + barW / 2}
                  y={pad.top + innerH + 14}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#7f6271"
                  fontFamily="JetBrains Mono"
                >
                  {String(r[xCol] ?? '').slice(0, 10)}
                </text>
              </g>
            )
          })
        ) : (
          <>
            {/* Connecting trend path */}
            <path
              d={chartItems
                .map((_, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(xVals[i])} ${scaleY(yVals[i])}`)
                .join(' ')}
              fill="none"
              stroke="#f472b6"
              strokeWidth="2.2"
              strokeOpacity="0.65"
            />
            {chartItems.map((_, i) => {
              const cx = scaleX(xVals[i])
              const cy = scaleY(yVals[i])
              const hovered = hoveredIdx === i
              return (
                <g
                  key={i}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {hovered && <circle cx={cx} cy={cy} r="11" fill="#f472b6" fillOpacity="0.22" />}
                  <circle cx={cx} cy={cy} r={hovered ? 6 : 4.5} fill="#ff85c8" stroke="#12090e" strokeWidth="1.5" />
                </g>
              )
            })}
          </>
        )}
      </svg>

      {hoveredIdx !== null && chartItems[hoveredIdx] && (
        <div
          className="absolute top-2 right-3 px-3 py-1.5 rounded-lg text-xs border font-mono-code"
          style={{
            background: 'rgba(18, 9, 14, 0.92)',
            borderColor: 'var(--accent-border)',
            color: 'var(--text-primary)',
          }}
        >
          {xCol}: <strong>{String(chartItems[hoveredIdx][xCol] ?? '—')}</strong> · {yCol}:{' '}
          <strong style={{ color: 'var(--gold)' }}>{chartItems[hoveredIdx][yCol] ?? '—'}</strong>
        </div>
      )}
    </div>
  )
}

export default function DataStoryteller({ backendOnline, onActivity }) {
  const [datasets, setDatasets] = useState([])
  const [dataset, setDataset] = useState({
    dataset_id: 1,
    filename: 'experiment_results.csv',
    parsed: parseCsvText(SAMPLE_DATASET_CSV),
  })
  const [analysis, setAnalysis] = useState(null)
  const [chartType, setChartType] = useState('scatter')
  const [xCol, setXCol] = useState('temperature')
  const [yCol, setYCol] = useState('growth')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tablePage, setTablePage] = useState(0)
  const [pageSize, setPageSize] = useState(15)

  const fileInputRef = useRef(null)

  const applyChartCols = (res) => {
    const hdrs = res.parsed?.headers || []
    const rws = res.parsed?.rows || []
    const numericCols = hdrs.filter((h) => rws.some((r) => typeof r[h] === 'number'))
    if (numericCols.length >= 2) {
      setXCol(res.charts?.[0]?.x || numericCols[0])
      setYCol(res.charts?.[0]?.y || numericCols[1])
    } else if (numericCols.length === 1 && hdrs.length >= 1) {
      setXCol(hdrs[0])
      setYCol(numericCols[0])
    }
  }

  const runAnalysis = async (ds) => {
    setLoading(true)
    setError('')
    try {
      const res = await analyzeDataset(ds)
      setAnalysis(res)
      applyChartCols(res)
      setTablePage(0)
      onActivity?.(`Analyzed dataset '${ds.filename}'`, 'data', 'data-storyteller')
    } catch (err) {
      setError(err.message || 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      const serverDatasets = await listDatasets()
      if (!active) return
      let targetDs = dataset
      if (serverDatasets.length > 0) {
        setDatasets(serverDatasets)
        targetDs = serverDatasets[0]
        setDataset(targetDs)
      } else {
        setDatasets([dataset])
      }
      const res = await analyzeDataset(targetDs)
      if (!active) return
      setAnalysis(res)
      applyChartCols(res)
    })()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleUpload = async (file) => {
    if (!file) return
    setError('')
    setLoading(true)
    try {
      const nextId = Math.max(0, ...datasets.map((d) => d.dataset_id || 0), dataset.dataset_id || 0) + 1
      const res = await uploadDataset(file, nextId)
      const nextDs = {
        dataset_id: res.dataset_id,
        filename: res.filename,
        parsed: res.parsed,
      }
      setDataset(nextDs)
      setDatasets((prev) => [nextDs, ...prev.filter((d) => d.dataset_id !== nextDs.dataset_id)])
      setTablePage(0)
      if (res.summary && res.statistics && res.columns) {
        setAnalysis(res)
        applyChartCols(res)
        onActivity?.(`Uploaded & analyzed '${res.filename}'`, 'data', 'data-storyteller')
      } else {
        await runAnalysis(nextDs)
      }
    } catch (err) {
      setError(err.message || 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const headers = analysis?.parsed?.headers || []
  const rows = analysis?.parsed?.rows || []
  const numericCols = headers.filter((h) => rows.some((r) => typeof r[h] === 'number'))
  const xOptions = headers.length > 0 ? headers : numericCols
  const isLive = analysis?._mode === 'live' || backendOnline

  const activeMetric =
    (yCol && analysis?.statistics?.by_column?.[yCol])
      ? yCol
      : (analysis?.statistics?.primary_column || numericCols[0] || '')
  const activeStats = (activeMetric && analysis?.statistics?.by_column?.[activeMetric]) || analysis?.statistics || {}

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="w-9 h-9 rounded-xl flex items-center justify-center border"
            style={{
              background: 'var(--gold-soft)',
              borderColor: 'rgba(245, 158, 11, 0.4)',
              color: 'var(--gold)',
            }}
          >
            <BarChart3 className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold m-0">Data Storyteller</h1>
            <p className="text-xs sm:text-sm m-0" style={{ color: 'var(--text-secondary)' }}>
              Upload CSV or XLSX spreadsheets for automated statistics, interactive charts, and AI summaries.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {datasets.length > 0 && (
            <select
              value={dataset.dataset_id}
              onChange={(e) => {
                const found = datasets.find((d) => d.dataset_id === Number(e.target.value))
                if (found) {
                  setDataset(found)
                  runAnalysis(found)
                }
              }}
              className="px-3 py-2 rounded-xl text-xs border outline-none"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
              }}
            >
              {datasets.map((d) => (
                <option key={d.dataset_id} value={d.dataset_id}>
                  {d.filename} (#{d.dataset_id})
                </option>
              ))}
            </select>
          )}
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border"
            style={{
              background: isLive ? 'var(--emerald-soft)' : 'var(--gold-soft)',
              borderColor: isLive ? 'rgba(52, 211, 153, 0.4)' : 'rgba(245, 158, 11, 0.4)',
              color: isLive ? 'var(--emerald)' : 'var(--gold)',
            }}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {isLive ? 'Live Pandas & Plotly' : 'Preview Mode'}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            className="hidden"
            onChange={(e) => {
              handleUpload(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => fileInputRef.current?.click()}
            className="helios-btn-primary px-4 py-2.5 rounded-xl text-xs inline-flex items-center gap-2 cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload CSV / XLSX
          </button>
        </div>
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

      {analysis && (
        <>
          {/* Summary KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
            <div className="helios-card p-4">
              <div className="text-[11px] uppercase font-bold tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Dataset
              </div>
              <div className="mt-1.5 text-sm font-bold truncate flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 shrink-0" style={{ color: 'var(--gold)' }} />
                {dataset.filename}
              </div>
            </div>

            <div className="helios-card p-4">
              <div className="text-[11px] uppercase font-bold tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Rows × Cols
              </div>
              <div className="mt-1 text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                {analysis.summary.rows} × {analysis.summary.columns}
              </div>
            </div>

            <div className="helios-card p-4">
              <div className="text-[11px] uppercase font-bold tracking-wider truncate" style={{ color: 'var(--text-muted)' }}>
                Mean ({activeMetric || 'Metric'})
              </div>
              <div className="mt-1 text-xl font-extrabold" style={{ color: 'var(--accent-bright)' }}>
                {activeStats.mean ?? '—'}
              </div>
            </div>

            <div className="helios-card p-4">
              <div className="text-[11px] uppercase font-bold tracking-wider truncate" style={{ color: 'var(--text-muted)' }}>
                Median ({activeMetric || 'Metric'})
              </div>
              <div className="mt-1 text-xl font-extrabold" style={{ color: 'var(--gold)' }}>
                {activeStats.median ?? '—'}
              </div>
            </div>

            <div className="helios-card p-4">
              <div className="text-[11px] uppercase font-bold tracking-wider truncate" style={{ color: 'var(--text-muted)' }}>
                Range ({activeMetric || 'Metric'})
              </div>
              <div className="mt-1 text-xl font-extrabold" style={{ color: 'var(--emerald)' }}>
                {activeStats.min != null && activeStats.max != null ? `${activeStats.min} – ${activeStats.max}` : '—'}
              </div>
            </div>
          </div>

          {/* Chart + AI Summary */}
          <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-5">
            <div className="helios-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2.5 mb-4">
                <div>
                  <h2 className="text-sm font-bold m-0">
                    {xCol} vs {yCol}
                  </h2>
                  <p className="text-[11px] m-0" style={{ color: 'var(--text-muted)' }}>
                    Hover over data points to inspect exact values
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={xCol}
                    onChange={(e) => setXCol(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg text-xs border outline-none"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}
                  >
                    {xOptions.map((c) => (
                      <option key={c} value={c}>
                        X: {c}
                      </option>
                    ))}
                  </select>

                  <select
                    value={yCol}
                    onChange={(e) => setYCol(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg text-xs border outline-none"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}
                  >
                    {numericCols.map((c) => (
                      <option key={c} value={c}>
                        Y: {c}
                      </option>
                    ))}
                  </select>

                  <div
                    className="inline-flex rounded-lg border p-0.5"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-subtle)' }}
                  >
                    {['scatter', 'bar', 'pie'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setChartType(t)}
                        className="px-2.5 py-1 rounded-md text-xs font-semibold capitalize cursor-pointer"
                        style={{
                          background: chartType === t ? 'var(--accent-soft)' : 'transparent',
                          color: chartType === t ? 'var(--accent-bright)' : 'var(--text-muted)',
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <InteractiveChart rows={rows} xCol={xCol} yCol={yCol} chartType={chartType} />
            </div>

            {/* AI Summary & Column Statistics */}
            <div className="flex flex-col gap-4">
              <div
                className="helios-card p-5"
                style={{
                  background:
                    'radial-gradient(circle at top right, var(--gold-soft), transparent 60%), var(--bg-card)',
                }}
              >
                <div
                  className="text-[11px] font-bold tracking-[0.14em] uppercase flex items-center gap-1.5 mb-2.5"
                  style={{ color: 'var(--gold)' }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  AI ANALYTICAL SUMMARY
                </div>
                <p className="text-sm leading-relaxed m-0" style={{ color: 'var(--text-primary)' }}>
                  {analysis.ai_summary}
                </p>
                {analysis.cleaning_report && (
                  <div className="mt-3 pt-3 border-t flex flex-wrap gap-2 text-[11px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                    <span className="px-2 py-0.5 rounded-md" style={{ background: 'var(--emerald-soft)', color: 'var(--emerald)' }}>
                      Auto-Cleaned
                    </span>
                    <span>Duplicates removed: {analysis.cleaning_report.duplicates_removed}</span>
                    <span>·</span>
                    <span>Empty rows dropped: {analysis.cleaning_report.empty_rows_dropped}</span>
                    <span>·</span>
                    <span>Nulls flagged: {analysis.cleaning_report.missing_values_detected}</span>
                  </div>
                )}
              </div>

              <div className="helios-card p-5 flex-1">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div
                    className="text-[11px] font-bold tracking-[0.14em] uppercase flex items-center gap-1.5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <Table2 className="w-3.5 h-3.5" />
                    COLUMN PROFILING &amp; PREVIEW ({rows.length} ROWS)
                  </div>
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>
                      {rows.length === 0 ? 0 : tablePage * pageSize + 1}–{Math.min((tablePage + 1) * pageSize, rows.length)} of {rows.length}
                    </span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value))
                        setTablePage(0)
                      }}
                      className="px-2 py-0.5 rounded border text-[11px] outline-none"
                      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                    >
                      <option value={10}>10</option>
                      <option value={15}>15</option>
                      <option value={30}>30</option>
                      <option value={60}>60</option>
                    </select>
                    <button
                      type="button"
                      disabled={tablePage === 0}
                      onClick={() => setTablePage((p) => Math.max(0, p - 1))}
                      className="px-2 py-0.5 rounded border disabled:opacity-30 cursor-pointer"
                      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                    >
                      ‹
                    </button>
                    <span>
                      {tablePage + 1}/{Math.max(1, Math.ceil(rows.length / pageSize))}
                    </span>
                    <button
                      type="button"
                      disabled={(tablePage + 1) * pageSize >= rows.length}
                      onClick={() => setTablePage((p) => p + 1)}
                      className="px-2 py-0.5 rounded border disabled:opacity-30 cursor-pointer"
                      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                    >
                      ›
                    </button>
                  </div>
                </div>

                {analysis.columns && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {Object.entries(analysis.columns).map(([col, info]) => {
                      const isNumeric = numericCols.includes(col)
                      const isY = col === yCol
                      const isX = col === xCol
                      return (
                        <button
                          key={col}
                          type="button"
                          onClick={() => {
                            if (isNumeric) setYCol(col)
                            else setXCol(col)
                          }}
                          className="font-mono-code text-[10px] px-2 py-1 rounded-lg border text-left cursor-pointer transition-colors"
                          style={{
                            background: isY ? 'var(--accent-soft)' : isX ? 'var(--gold-soft)' : 'var(--bg-card-elevated)',
                            borderColor: isY ? 'var(--accent-bright)' : isX ? 'var(--gold)' : 'var(--border-subtle)',
                            color: isY ? 'var(--accent-bright)' : isX ? 'var(--gold)' : 'var(--text-secondary)',
                          }}
                          title={`Click to set as ${isNumeric ? 'Y axis metric' : 'X axis'}`}
                        >
                          <strong>{col}</strong> {isY ? '(Y)' : isX ? '(X)' : ''} ·{' '}
                          {info.data_type} · {info.unique_values} uniq
                          {info.missing_values > 0 ? ` · ${info.missing_values} null` : ''}
                        </button>
                      )
                    })}
                  </div>
                )}

                <div className="overflow-x-auto max-h-[220px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        {headers.map((h) => (
                          <th
                            key={h}
                            onClick={() => {
                              if (numericCols.includes(h)) setYCol(h)
                              else setXCol(h)
                            }}
                            className="py-2 pr-3 font-mono-code font-semibold cursor-pointer select-none hover:underline"
                            style={{ color: h === yCol ? 'var(--accent-bright)' : h === xCol ? 'var(--gold)' : 'var(--text-primary)' }}
                            title="Click to select for charts"
                          >
                            {h} {h === yCol ? '▲ (Y)' : h === xCol ? '▲ (X)' : ''}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(tablePage * pageSize, (tablePage + 1) * pageSize).map((r, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(51, 30, 42, 0.45)' }}>
                          {headers.map((h) => (
                            <td key={h} className="py-1.5 pr-3 font-mono-code" style={{ color: 'var(--text-secondary)' }}>
                              {r[h] === null || r[h] === undefined ? (
                                <span className="opacity-35 italic font-sans text-[10px]">null</span>
                              ) : (
                                String(r[h])
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

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

  if (chartType === 'pie') {
    const slicesRaw = rows.slice(0, 10).map((r, i) => ({
      label: String(r[xCol] ?? `Item ${i + 1}`),
      value: Math.max(0, Number(r[yCol]) || 0),
    }))
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
              : `${slices.length} slices`}
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

  const xVals = rows.map((r, i) => (typeof r[xCol] === 'number' ? r[xCol] : i))
  const yVals = rows.map((r) => (typeof r[yCol] === 'number' ? r[yCol] : 0))

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
          rows.map((r, i) => {
            const barW = Math.max(12, innerW / rows.length - 10)
            const x = pad.left + (i / rows.length) * innerW + 5
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
                  rx={5}
                  fill={hovered ? '#fcd34d' : '#f59e0b'}
                  fillOpacity={hovered ? 1 : 0.82}
                />
                <text
                  x={x + barW / 2}
                  y={pad.top + innerH + 14}
                  textAnchor="middle"
                  fontSize="9.5"
                  fill="#7f6271"
                  fontFamily="JetBrains Mono"
                >
                  {r[xCol]}
                </text>
              </g>
            )
          })
        ) : (
          <>
            {/* Connecting trend path */}
            <path
              d={rows
                .map((_, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(xVals[i])} ${scaleY(yVals[i])}`)
                .join(' ')}
              fill="none"
              stroke="#f472b6"
              strokeWidth="2.2"
              strokeOpacity="0.65"
            />
            {rows.map((_, i) => {
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

      {hoveredIdx !== null && rows[hoveredIdx] && (
        <div
          className="absolute top-2 right-3 px-3 py-1.5 rounded-lg text-xs border font-mono-code"
          style={{
            background: 'rgba(18, 9, 14, 0.92)',
            borderColor: 'var(--accent-border)',
            color: 'var(--text-primary)',
          }}
        >
          {xCol}: <strong>{rows[hoveredIdx][xCol]}</strong> · {yCol}:{' '}
          <strong style={{ color: 'var(--gold)' }}>{rows[hoveredIdx][yCol]}</strong>
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
      const nextId = Math.max(...datasets.map((d) => d.dataset_id || 0), dataset.dataset_id || 0) + 1
      const res = await uploadDataset(file, nextId)
      const nextDs = {
        dataset_id: res.dataset_id,
        filename: res.filename,
        parsed: res.parsed,
      }
      setDataset(nextDs)
      setDatasets((prev) => [nextDs, ...prev.filter((d) => d.dataset_id !== nextDs.dataset_id)])
      await runAnalysis(nextDs)
    } catch (err) {
      setError(err.message || 'Upload failed')
      setLoading(false)
    }
  }

  const headers = analysis?.parsed?.headers || []
  const rows = analysis?.parsed?.rows || []
  const numericCols = headers.filter((h) => rows.some((r) => typeof r[h] === 'number'))
  const xOptions = headers.length > 0 ? headers : numericCols
  const isLive = analysis?._mode === 'live' || backendOnline

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
              <div className="text-[11px] uppercase font-bold tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Mean ({analysis.statistics.primary_column})
              </div>
              <div className="mt-1 text-xl font-extrabold" style={{ color: 'var(--accent-bright)' }}>
                {analysis.statistics.mean}
              </div>
            </div>

            <div className="helios-card p-4">
              <div className="text-[11px] uppercase font-bold tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Median
              </div>
              <div className="mt-1 text-xl font-extrabold" style={{ color: 'var(--gold)' }}>
                {analysis.statistics.median}
              </div>
            </div>

            <div className="helios-card p-4">
              <div className="text-[11px] uppercase font-bold tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Range
              </div>
              <div className="mt-1 text-xl font-extrabold" style={{ color: 'var(--emerald)' }}>
                {analysis.statistics.min} – {analysis.statistics.max}
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
                <div
                  className="text-[11px] font-bold tracking-[0.14em] uppercase flex items-center gap-1.5 mb-3"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <Table2 className="w-3.5 h-3.5" />
                  COLUMN PROFILING &amp; PREVIEW ({rows.length} ROWS)
                </div>

                {analysis.columns && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {Object.entries(analysis.columns).map(([col, info]) => (
                      <span
                        key={col}
                        className="font-mono-code text-[10px] px-2 py-1 rounded-lg border"
                        style={{
                          background: 'var(--bg-card-elevated)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <strong style={{ color: 'var(--accent-bright)' }}>{col}</strong> ·{' '}
                        {info.data_type} · {info.unique_values} uniq
                        {info.missing_values > 0 ? ` · ${info.missing_values} null` : ''}
                      </span>
                    ))}
                  </div>
                )}

                <div className="overflow-x-auto max-h-[210px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        {headers.map((h) => (
                          <th key={h} className="py-2 pr-3 font-mono-code font-semibold" style={{ color: 'var(--accent-bright)' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 8).map((r, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(51, 30, 42, 0.45)' }}>
                          {headers.map((h) => (
                            <td key={h} className="py-1.5 pr-3 font-mono-code" style={{ color: 'var(--text-secondary)' }}>
                              {r[h]}
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

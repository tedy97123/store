import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'

interface ParsedRow {
  cardId: string
  quantity: number
  priceCents: number
  condition: string
  isFoil: boolean
}

interface RowResult {
  row: ParsedRow
  status: 'pending' | 'ok' | 'error'
  error?: string
}

const REQUIRED_HEADERS = ['cardId', 'quantity', 'priceCents', 'condition', 'isFoil']

// Minimal CSV parser: handles quoted fields and commas inside quotes.
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1
      row.push(field)
      rows.push(row)
      field = ''
      row = []
    } else {
      field += char
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

export default function CsvTab({ slug }: { slug: string }) {
  const queryClient = useQueryClient()
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [results, setResults] = useState<RowResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  function handleFile(file: File) {
    setError(null)
    setResults([])
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const grid = parseCsv(String(reader.result ?? ''))
        if (grid.length < 2) {
          setError('CSV must have a header row and at least one data row.')
          setRows([])
          return
        }
        const headers = grid[0].map((h) => h.trim())
        const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h))
        if (missing.length) {
          setError(`Missing required column(s): ${missing.join(', ')}`)
          setRows([])
          return
        }
        const idx = Object.fromEntries(headers.map((h, i) => [h, i]))
        const parsed: ParsedRow[] = grid.slice(1).map((cols) => ({
          cardId: (cols[idx.cardId] ?? '').trim(),
          quantity: Number((cols[idx.quantity] ?? '0').trim()),
          priceCents: Number((cols[idx.priceCents] ?? '0').trim()),
          condition: (cols[idx.condition] ?? 'NM').trim().toUpperCase(),
          isFoil: ['1', 'true', 'yes', 'foil'].includes(
            (cols[idx.isFoil] ?? '').trim().toLowerCase(),
          ),
        }))
        setRows(parsed)
      } catch {
        setError('Could not parse the file. Make sure it is a valid CSV.')
        setRows([])
      }
    }
    reader.readAsText(file)
  }

  async function runImport() {
    setImporting(true)
    const next: RowResult[] = rows.map((row) => ({ row, status: 'pending' }))
    setResults(next)
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i]
      try {
        await api.post(`/stores/${slug}/inventory`, {
          cardId: row.cardId,
          quantity: row.quantity,
          priceCents: row.priceCents,
          condition: row.condition,
          isFoil: row.isFoil,
        })
        next[i] = { row, status: 'ok' }
      } catch (e) {
        const message =
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          'Import failed'
        next[i] = { row, status: 'error', error: message }
      }
      setResults([...next])
    }
    setImporting(false)
    await queryClient.invalidateQueries({ queryKey: ['inventory', slug] })
  }

  const okCount = results.filter((r) => r.status === 'ok').length
  const errorCount = results.filter((r) => r.status === 'error').length

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-semibold">Import inventory from CSV</h2>
        <p className="mt-1 text-sm text-slate-400">
          Upload a CSV with the columns:{' '}
          <code className="rounded bg-slate-950 px-1.5 py-0.5 text-amber-300">
            {REQUIRED_HEADERS.join(', ')}
          </code>
          . Each row is added to this store&apos;s inventory.
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
          className="mt-4 block w-full text-sm text-slate-300 file:mr-4 file:rounded-md file:border-0 file:bg-slate-800 file:px-4 file:py-2 file:text-white hover:file:bg-slate-700"
        />
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </section>

      {rows.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-md font-semibold">
              Preview ({rows.length} row{rows.length === 1 ? '' : 's'})
            </h3>
            <button
              type="button"
              onClick={() => void runImport()}
              disabled={importing}
              className="rounded-md bg-amber-500 px-4 py-2 font-medium text-slate-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {importing ? 'Importing…' : `Import ${rows.length} row(s)`}
            </button>
          </div>
          {results.length > 0 && (
            <p className="text-sm text-slate-400">
              <span className="text-emerald-400">{okCount} imported</span>
              {errorCount > 0 && <span className="text-red-400"> · {errorCount} failed</span>}
            </p>
          )}
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Card ID</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Price (cents)</th>
                  <th className="px-4 py-3">Condition</th>
                  <th className="px-4 py-3">Foil</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const result = results[i]
                  return (
                    <tr key={i} className="border-t border-slate-800">
                      <td className="px-4 py-3 font-mono text-xs">{row.cardId}</td>
                      <td className="px-4 py-3">{row.quantity}</td>
                      <td className="px-4 py-3">{row.priceCents}</td>
                      <td className="px-4 py-3">{row.condition}</td>
                      <td className="px-4 py-3">{row.isFoil ? 'Yes' : 'No'}</td>
                      <td className="px-4 py-3">
                        {!result && <span className="text-slate-500">—</span>}
                        {result?.status === 'pending' && (
                          <span className="text-slate-400">…</span>
                        )}
                        {result?.status === 'ok' && (
                          <span className="text-emerald-400">✓ Added</span>
                        )}
                        {result?.status === 'error' && (
                          <span className="text-red-400" title={result.error}>
                            ✕ {result.error}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

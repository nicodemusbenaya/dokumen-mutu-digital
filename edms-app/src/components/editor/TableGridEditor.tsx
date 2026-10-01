'use client';

import React, { useState, useMemo, useCallback } from 'react';
import TipTapEditor from './TipTapEditor';
import { IconTrash, IconPlus, IconTable, IconEditor } from '@/components/icons/Icons';
import {
  type GridCell,
  type GridRow,
  type GridState,
  parseTableFromHtml,
  buildHtmlFromTable,
  toState,
  gridColumnCount,
  attrsToStyle,
  flattenRows,
  cellToText,
  textToCell,
} from './tableGridHtml';

interface Props {
  content: string;
  onChange: (html: string) => void;
}

export default function TableGridEditor({ content, onChange }: Props) {
  const parsed = useMemo(() => parseTableFromHtml(content), [content]);
  const [viewMode, setViewMode] = useState<'grid' | 'tiptap'>(
    parsed.hasTable ? 'grid' : 'tiptap'
  );
  const [grid, setGrid] = useState<GridState>(() => toState(parsed));
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [hasHeaderRow, setHasHeaderRow] = useState(true);

  // Grid ter-sinkron (derive saat render): bila isi grid sudah tidak sama lagi
  // dengan konten terkini — diubah dari luar lewat impor, template, atau simpan —
  // bangun ulang dari konten tanpa perlu setState di dalam effect.
  const syncedGrid = useMemo(
    () => (buildHtmlFromTable(grid) === content ? grid : toState(parsed)),
    [grid, content, parsed]
  );
  // Tanpa tabel, selalu paksa mode teks bebas (TipTap).
  const mode: 'grid' | 'tiptap' = parsed.hasTable ? viewMode : 'tiptap';

  const commit = useCallback(
    (next: GridState) => {
      setGrid(next);
      onChange(buildHtmlFromTable(next));
    },
    [onChange]
  );

  const { headers, rows, prefix, suffix, tableAttrs, headRowAttrs } = syncedGrid;

  const handleCellChange = (rowIndex: number, colIndex: number, val: string) => {
    const updated = rows.map((r, rIdx) => {
      if (rIdx !== rowIndex) return r;
      const copy = [...r];
      const cell = copy[colIndex];
      if (cell) copy[colIndex] = { ...cell, html: textToCell(val) };
      return copy;
    });
    commit({ ...syncedGrid, rows: updated });
  };

  const handleHeaderChange = (colIndex: number, val: string) => {
    if (!headers) return;
    const copy = [...headers];
    const cell = copy[colIndex];
    if (cell) copy[colIndex] = { ...cell, html: textToCell(val) };
    commit({ ...syncedGrid, headers: copy });
  };

  const handleAddRow = () => {
    const colCount = gridColumnCount(syncedGrid);
    const flat = flattenRows(rows);
    const newRow: GridCell[] = Array.from({ length: colCount }, () => ({
      html: '', colSpan: 1, rowSpan: 1, attrs: '', tag: 'td',
    }));
    newRow[0] = { html: String(flat.length + 1), colSpan: 1, rowSpan: 1, attrs: '', tag: 'td' };
    commit({ ...syncedGrid, rows: [...flat.map((r) => r as GridRow), newRow as GridRow] });
  };

  const renumberFirstCol = (list: GridCell[][]): GridCell[][] =>
    list.map((r, idx) => {
      const copy = [...r];
      const text = cellToText(copy[0]?.html ?? '');
      if (text === '' || /^\d+$/.test(text)) {
        copy[0] = { ...(copy[0] || { html: '', colSpan: 1, rowSpan: 1, attrs: '', tag: 'td' }), html: String(idx + 1) };
      }
      return copy;
    });

  const handleDeleteRow = (rowIndex: number) => {
    if (rows.length <= 1) {
      if (!confirm('Hapus baris ini? Tabel akan menjadi kosong.')) return;
    }
    const flat = flattenRows(rows).filter((_, idx) => idx !== rowIndex);
    commit({ ...syncedGrid, rows: renumberFirstCol(flat).map((r) => r as GridRow) });
  };

  const swapRows = (a: number, b: number) => {
    if (a < 0 || b < 0 || a >= rows.length || b >= rows.length) return;
    const flat = flattenRows(rows);
    const copy = [...flat];
    const tmp = copy[a];
    copy[a] = copy[b];
    copy[b] = tmp;
    const renumbered = copy.map((r, idx) => {
      const text = cellToText(r[0]?.html ?? '');
      if (!/^\d+$/.test(text)) return r;
      const c = [...r];
      c[0] = { ...c[0], html: String(idx + 1) };
      return c;
    });
    commit({ ...syncedGrid, rows: renumbered.map((r) => r as GridRow) });
  };

  const handleAutoRenumber = () => {
    const flat = flattenRows(rows);
    const renumbered = flat.map((r, idx) => {
      const c = [...r];
      c[0] = { ...(c[0] || { html: '', colSpan: 1, rowSpan: 1, attrs: '', tag: 'td' }), html: String(idx + 1) };
      return c;
    });
    commit({ ...syncedGrid, rows: renumbered.map((r) => r as GridRow) });
  };

  const handleImportExcel = () => {
    if (!pasteText.trim()) return;
    const lines = pasteText.trim().split(/\r?\n/).map((l) => l.split('\t'));
    if (!lines.length) return;

    let newHeaders: GridCell[] | null = headers;
    let dataLines: string[][] = lines;

    if (hasHeaderRow && lines.length > 1) {
      newHeaders = lines[0].map((h) => ({
        html: textToCell(h.trim()), colSpan: 1, rowSpan: 1, attrs: '', tag: 'th' as const,
      }));
      dataLines = lines.slice(1);
    }

    const width = Math.max(
      newHeaders?.length ?? 0,
      ...dataLines.map((l) => l.length)
    );
    if (newHeaders) {
      while (newHeaders.length < width) {
        newHeaders.push({ html: '', colSpan: 1, rowSpan: 1, attrs: '', tag: 'th' });
      }
    }
    const normalized: GridCell[][] = dataLines.map((l) => {
      const row: GridCell[] = l.map((v) => ({
        html: textToCell(v), colSpan: 1, rowSpan: 1, attrs: '', tag: 'td' as const,
      }));
      while (row.length < width) row.push({ html: '', colSpan: 1, rowSpan: 1, attrs: '', tag: 'td' });
      return row.slice(0, width);
    });

    commit({
      ...syncedGrid,
      headers: newHeaders,
      rows: normalized.map((r) => r as GridRow),
      tableAttrs,
      headRowAttrs: newHeaders ? headRowAttrs : '',
    });
    setPasteModalOpen(false);
    setPasteText('');
  };

  // ── Mode teks bebas (TipTap) ────────────────────────────────────
  if (!parsed.hasTable) {
    return (
      <div>
        <div style={{ padding: '8px 16px', background: '#f8fafc', borderBottom: '1px solid var(--paper-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
            {parsed.blocked
              ? 'Mode Editor Teks Bebas — tabel/gambar kompleks di bagian ini biarkan ditangani editor kaya teks agar format asli tidak hilang.'
              : 'Mode Editor Teks Bebas (Rich Text)'}
          </div>
          <button
            type="button"
            className="btn btn-xs btn-outline"
            onClick={() => {
              const colCount = gridColumnCount(syncedGrid);
              const defaultHeaders = ['No.', 'Uraian / Item Rekaman', 'Keterangan'];
              const pad: GridCell[] = defaultHeaders.map((h) => ({
                html: textToCell(h), colSpan: 1, rowSpan: 1, attrs: '', tag: 'th',
              }));
              while (pad.length < colCount && colCount > 3) pad.push({ html: '', colSpan: 1, rowSpan: 1, attrs: '', tag: 'th' });
              const row: GridCell[] = Array.from({ length: colCount || 3 }, (_, i) => ({
                html: i === 0 ? '1' : '', colSpan: 1, rowSpan: 1, attrs: '', tag: 'td',
              }));
              commit({ headers: pad, rows: [row as GridRow], prefix, suffix, tableAttrs: '', headRowAttrs: '' });
              setViewMode('grid');
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <IconTable size={13} />
            <span>Ubah ke Mode Grid Tabel</span>
          </button>
        </div>
        <TipTapEditor content={content} onChange={onChange} />
      </div>
    );
  }

  const colCount = gridColumnCount(syncedGrid);
  const headerCells = headers ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Switcher Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 16px',
          background: '#f8fafc',
          borderBottom: '1px solid var(--paper-line)',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 4,
              background: mode === 'grid' ? '#0284c7' : 'var(--navy)',
              color: '#fff',
            }}
          >
            {mode === 'grid' ? <IconTable size={13} /> : <IconEditor size={13} />}
            {mode === 'grid' ? 'Grid Tabel Interaktif' : 'Editor Teks TipTap'}
          </span>
          <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
            {mode === 'grid'
              ? `${colCount} Kolom · ${rows.length} Baris Data`
              : 'Edit leluasa dengan WYSIWYG TipTap'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            onClick={() => {
              setGrid(toState(parsed));
              setViewMode('grid');
            }}
            style={{
              padding: '4px 10px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: mode === 'grid' ? 700 : 500,
              border: '1px solid',
              borderColor: mode === 'grid' ? 'var(--navy)' : 'var(--paper-line)',
              background: mode === 'grid' ? '#fff' : 'transparent',
              color: mode === 'grid' ? 'var(--navy)' : 'var(--ink-soft)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <IconTable size={13} />
            <span>Form Grid Tabel</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('tiptap')}
            style={{
              padding: '4px 10px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: mode === 'tiptap' ? 700 : 500,
              border: '1px solid',
              borderColor: mode === 'tiptap' ? 'var(--navy)' : 'var(--paper-line)',
              background: mode === 'tiptap' ? '#fff' : 'transparent',
              color: mode === 'tiptap' ? 'var(--navy)' : 'var(--ink-soft)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <IconEditor size={13} />
            <span>Teks Bebas (TipTap)</span>
          </button>
        </div>
      </div>

      {mode === 'tiptap' ? (
        <TipTapEditor content={content} onChange={onChange} />
      ) : (
        <div style={{ padding: '16px 20px', background: '#fff' }}>
          {/* Teks pengantar sebelum tabel jika ada */}
          {prefix ? (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Teks Pengantar Sebelum Tabel
              </label>
              <div
                dangerouslySetInnerHTML={{ __html: prefix }}
                style={{
                  padding: '10px 14px',
                  background: '#f8fafc',
                  border: '1px solid var(--paper-line)',
                  borderRadius: 6,
                  fontSize: 13,
                  marginTop: 4,
                  lineHeight: 1.6,
                }}
              />
            </div>
          ) : null}

          {/* Interactive Grid Table */}
          <div style={{ overflowX: 'auto', border: '1.5px solid #cbd5e1', borderRadius: 6, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              {headers ? (
                <thead>
                  <tr style={{ borderBottom: '1.5px solid #cbd5e1' }}>
                    {headers.map((h, hIdx) => (
                      <th
                        key={hIdx}
                        colSpan={h.colSpan > 1 ? h.colSpan : undefined}
                        rowSpan={h.rowSpan > 1 ? h.rowSpan : undefined}
                        style={{
                          padding: '10px 12px',
                          borderRight: '1px solid #cbd5e1',
                          textAlign: hIdx === 0 ? 'center' : 'left',
                          width: hIdx === 0 ? '70px' : undefined,
                          fontWeight: 600,
                          letterSpacing: '0.02em',
                          ...attrsToStyle(h.attrs),
                        }}
                      >
                        <input
                          type="text"
                          value={cellToText(h.html)}
                          onChange={e => handleHeaderChange(hIdx, e.target.value)}
                          style={{
                            width: '100%',
                            background: 'transparent',
                            border: 'none',
                            color: 'inherit',
                            font: 'inherit',
                            textAlign: 'inherit',
                            padding: 0,
                            outlineOffset: 2,
                          }}
                        />
                      </th>
                    ))}
                    <th style={{ width: '50px', textAlign: 'center', padding: '10px 6px' }}>Aksi</th>
                  </tr>
                </thead>
              ) : null}
              <tbody>
                {rows.length === 0 && headerCells.length === 0 ? (
                  <tr>
                    <td
                      colSpan={colCount + 1}
                      style={{ textAlign: 'center', padding: '24px', color: 'var(--ink-muted)', fontStyle: 'italic' }}
                    >
                      Belum ada baris data. Klik tombol &quot;+ Tambah Baris Baru&quot; di bawah untuk mengisi tabel.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                      }}
                    >
                      {row.map((cell, cIdx) =>
                        cell === null ? (
                          <React.Fragment key={`s${cIdx}`} />
                        ) : (
                          <td
                            key={cIdx}
                            colSpan={cell.colSpan > 1 ? cell.colSpan : undefined}
                            rowSpan={cell.rowSpan > 1 ? cell.rowSpan : undefined}
                            style={{
                              padding: '6px 8px',
                              borderRight: '1px solid #e2e8f0',
                              verticalAlign: 'top',
                              textAlign: cIdx === 0 ? 'center' : 'left',
                              ...attrsToStyle(cell.attrs),
                            }}
                          >
                            {cIdx === 0 ? (
                              <input
                                type="text"
                                value={cellToText(cell.html)}
                                onChange={e => handleCellChange(rIdx, cIdx, e.target.value)}
                                style={{
                                  width: '100%',
                                  textAlign: 'center',
                                  padding: '6px 4px',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: 4,
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                  background: '#fff',
                                }}
                              />
                            ) : (
                              <textarea
                                rows={2}
                                value={cellToText(cell.html)}
                                placeholder={`Isi ${headerCells[cIdx] ? cellToText(headerCells[cIdx].html) : `kolom ${cIdx + 1}`}...`}
                                onChange={e => handleCellChange(rIdx, cIdx, e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '6px 8px',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: 4,
                                  fontSize: 12.5,
                                  lineHeight: 1.4,
                                  fontFamily: 'inherit',
                                  resize: 'vertical',
                                  background: '#fff',
                                }}
                              />
                            )}
                          </td>
                        )
                      )}
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '6px 4px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <button
                            type="button"
                            onClick={() => swapRows(rIdx, rIdx - 1)}
                            disabled={rIdx === 0}
                            title="Pindah ke atas"
                            style={{
                              background: rIdx === 0 ? '#f1f5f9' : '#e0f2fe',
                              color: rIdx === 0 ? '#94a3b8' : '#0284c7',
                              border: 'none',
                              borderRadius: 4,
                              padding: '5px 7px',
                              cursor: rIdx === 0 ? 'not-allowed' : 'pointer',
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => swapRows(rIdx, rIdx + 1)}
                            disabled={rIdx === rows.length - 1}
                            title="Pindah ke bawah"
                            style={{
                              background: rIdx === rows.length - 1 ? '#f1f5f9' : '#e0f2fe',
                              color: rIdx === rows.length - 1 ? '#94a3b8' : '#0284c7',
                              border: 'none',
                              borderRadius: 4,
                              padding: '5px 7px',
                              cursor: rIdx === rows.length - 1 ? 'not-allowed' : 'pointer',
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(rIdx)}
                            title="Hapus baris ini"
                            style={{
                              background: '#fee2e2',
                              color: '#dc2626',
                              border: 'none',
                              borderRadius: 4,
                              padding: '5px 7px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <IconTrash size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Action Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 14,
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleAddRow}
                className="btn btn-sm btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <IconPlus size={15} />
                <span>Tambah Baris Baru</span>
              </button>

              <button
                type="button"
                onClick={handleAutoRenumber}
                className="btn btn-sm btn-outline"
                title="Menyusun ulang nomor urut kolom 1 secara otomatis dari 1 sampai akhir"
                style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <span>Urutkan No. 1, 2, 3</span>
              </button>

              <button
                type="button"
                onClick={() => setPasteModalOpen(true)}
                className="btn btn-sm btn-outline"
                title="Impor atau tempel data tabel langsung dari Microsoft Excel atau Google Sheets"
                style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5, borderColor: '#10b981', color: '#047857' }}
              >
                <span>Paste dari Excel</span>
              </button>
            </div>

            <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
              <em>Teks dalam tabel otomatis tersimpan dan terformat rapi pada dokumen resmi / PDF.</em>
            </div>
          </div>

          {/* Paste from Excel Modal */}
          {pasteModalOpen && (
            <div className="overlay" style={{ zIndex: 10000 }} onClick={() => setPasteModalOpen(false)}>
              <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>Impor / Paste Tabel dari Excel</span>
                  </div>
                  <button className="modal-close" onClick={() => setPasteModalOpen(false)}>×</button>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 12 }}>
                  Salin (Copy) sel tabel dari Microsoft Excel atau Google Sheets, lalu tempelkan (Ctrl+V) di area bawah ini:
                </div>
                <textarea
                  rows={8}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1.5px solid var(--paper-line)',
                    borderRadius: 6,
                    fontFamily: 'monospace',
                    fontSize: 12,
                    lineHeight: 1.4,
                    marginBottom: 12,
                    background: '#f8fafc',
                  }}
                  placeholder="Paste tabel Excel di sini..."
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  autoFocus
                />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={hasHeaderRow}
                      onChange={e => setHasHeaderRow(e.target.checked)}
                    />
                    <span>Baris pertama adalah judul kolom (Header)</span>
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => setPasteModalOpen(false)}
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={handleImportExcel}
                      disabled={!pasteText.trim()}
                    >
                      Impor ke Tabel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Teks penutup setelah tabel jika ada */}
          {suffix ? (
            <div style={{ marginTop: 18 }}>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Teks Penutup Setelah Tabel
              </label>
              <div
                dangerouslySetInnerHTML={{ __html: suffix }}
                style={{
                  padding: '10px 14px',
                  background: '#f8fafc',
                  border: '1px solid var(--paper-line)',
                  borderRadius: 6,
                  fontSize: 13,
                  marginTop: 4,
                  lineHeight: 1.6,
                }}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

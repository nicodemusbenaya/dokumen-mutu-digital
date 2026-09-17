'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import TipTapEditor from './TipTapEditor';
import { IconTrash, IconPlus, IconTable, IconEditor } from '@/components/icons/Icons';

interface Props {
  content: string;
  onChange: (html: string) => void;
  sectionKey?: string;
  sectionLabel?: string;
}

interface ParsedTable {
  hasTable: boolean;
  prefixHtml: string;
  suffixHtml: string;
  headers: string[];
  rows: string[][];
}

function parseTableFromHtml(html: string): ParsedTable {
  if (!html || !html.includes('<table')) {
    return {
      hasTable: false,
      prefixHtml: html || '',
      suffixHtml: '',
      headers: [],
      rows: [],
    };
  }

  const tableMatch = html.match(/<table[\s\S]*?<\/table>/i);
  if (!tableMatch) {
    return {
      hasTable: false,
      prefixHtml: html,
      suffixHtml: '',
      headers: [],
      rows: [],
    };
  }

  const tableHtml = tableMatch[0];
  // Ignore layout/signature tables (border:none or no <th> tags)
  const isBorderless = /border:\s*none/i.test(tableHtml);
  const hasTh = /<th[\s\S]*?<\/th>/i.test(tableHtml);
  if (isBorderless || !hasTh) {
    return {
      hasTable: false,
      prefixHtml: html || '',
      suffixHtml: '',
      headers: [],
      rows: [],
    };
  }

  const tableIndex = html.indexOf(tableHtml);
  const prefixHtml = html.slice(0, tableIndex).trim();
  const suffixHtml = html.slice(tableIndex + tableHtml.length).trim();

  // Parse table rows
  const trMatches = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  let headers: string[] = [];
  const rows: string[][] = [];

  for (let i = 0; i < trMatches.length; i++) {
    const tr = trMatches[i];

    // Check for <th>
    const thMatches = tr.match(/<th[\s\S]*?<\/th>/gi);
    if (thMatches && thMatches.length > 0) {
      headers = thMatches.map(th => th.replace(/<[^>]+>/g, '').trim());
      continue;
    }

    // Check for <td>
    const tdMatches = tr.match(/<td[\s\S]*?<\/td>/gi);
    if (tdMatches && tdMatches.length > 0) {
      const rowCells = tdMatches.map(td => td.replace(/<[^>]+>/g, '').trim());
      // Skip helper numbering row if it's purely numbers like [2, 3, 4...] or [7, '', 8, 9]
      const isHelperRow = rowCells.every(c => !c || /^[0-9]+$/.test(c));
      if (isHelperRow && rows.length === 0 && headers.length > 0) {
        continue; // Skip legacy helper row
      }

      if (headers.length === 0 && i === 0) {
        headers = rowCells;
      } else {
        rows.push(rowCells);
      }
    }
  }

  // Ensure every row has the same number of cells as headers
  const colCount = headers.length || (rows[0] ? rows[0].length : 4);
  const normalizedRows = rows.map(r => {
    const cells = [...r];
    while (cells.length < colCount) cells.push('');
    return cells.slice(0, colCount);
  });

  return {
    hasTable: true,
    prefixHtml,
    suffixHtml,
    headers,
    rows: normalizedRows,
  };
}

function buildHtmlFromTable(
  prefixHtml: string,
  headers: string[],
  rows: string[][],
  suffixHtml: string
): string {
  let tableHtml = '<table border="1" cellpadding="8" style="width:100%; border-collapse:collapse; margin:14px 0;">\n';
  tableHtml += '  <thead>\n    <tr style="background:#f1f5f9;">\n';
  headers.forEach((h, idx) => {
    const widthStyle = idx === 0 ? 'width:8%; ' : '';
    tableHtml += `      <th style="${widthStyle}padding:8px 12px; border:1px solid #000; font-weight:bold; text-align:center; background:#f1f5f9;">${h || 'Kolom ' + (idx + 1)}</th>\n`;
  });
  tableHtml += '    </tr>\n  </thead>\n  <tbody>\n';

  rows.forEach(r => {
    tableHtml += '    <tr>\n';
    r.forEach((cell, colIdx) => {
      const align = colIdx === 0 ? 'center' : 'left';
      tableHtml += `      <td style="padding:8px 12px; border:1px solid #000; vertical-align:top; text-align:${align};">${cell || ''}</td>\n`;
    });
    tableHtml += '    </tr>\n';
  });
  tableHtml += '  </tbody>\n</table>';

  const parts = [];
  if (prefixHtml) parts.push(prefixHtml);
  parts.push(tableHtml);
  if (suffixHtml) parts.push(suffixHtml);

  return parts.join('\n');
}

export default function TableGridEditor({
  content,
  onChange,
  sectionKey,
  sectionLabel,
}: Props) {
  const parsed = useMemo(() => parseTableFromHtml(content), [content]);
  const [viewMode, setViewMode] = useState<'grid' | 'tiptap'>(
    parsed.hasTable ? 'grid' : 'tiptap'
  );

  const [headers, setHeaders] = useState<string[]>(parsed.headers);
  const [rows, setRows] = useState<string[][]>(parsed.rows);
  const [prefixText, setPrefixText] = useState<string>(parsed.prefixHtml);
  const [suffixText, setSuffixText] = useState<string>(parsed.suffixHtml);

  // Sync internal state when external content changes (e.g. template loaded)
  useEffect(() => {
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setPrefixText(parsed.prefixHtml);
    setSuffixText(parsed.suffixHtml);
    if (parsed.hasTable && viewMode !== 'tiptap') {
      setViewMode('grid');
    }
  }, [parsed]);

  const commitChanges = useCallback(
    (newHeaders: string[], newRows: string[][], newPrefix = prefixText, newSuffix = suffixText) => {
      setHeaders(newHeaders);
      setRows(newRows);
      const newHtml = buildHtmlFromTable(newPrefix, newHeaders, newRows, newSuffix);
      onChange(newHtml);
    },
    [prefixText, suffixText, onChange]
  );

  const handleCellChange = (rowIndex: number, colIndex: number, val: string) => {
    const updated = rows.map((r, rIdx) => {
      if (rIdx === rowIndex) {
        const rowCopy = [...r];
        rowCopy[colIndex] = val;
        return rowCopy;
      }
      return r;
    });
    commitChanges(headers, updated);
  };

  const handleAddRow = () => {
    const colCount = headers.length || 4;
    const newRow = Array(colCount).fill('');
    // Auto-number first column if it's No
    newRow[0] = String(rows.length + 1);
    const updated = [...rows, newRow];
    commitChanges(headers, updated);
  };

  const handleDeleteRow = (rowIndex: number) => {
    if (rows.length <= 1) {
      if (!confirm('Hapus baris ini? Tabel akan menjadi kosong.')) return;
    }
    const updated = rows.filter((_, idx) => idx !== rowIndex);
    // Renumber first column if sequential
    const renumbered = updated.map((r, idx) => {
      const copy = [...r];
      if (/^[0-9]+$/.test(copy[0]) || copy[0] === '') {
        copy[0] = String(idx + 1);
      }
      return copy;
    });
    commitChanges(headers, renumbered);
  };

  // If this section has NO table at all, render standard TipTap editor directly
  if (!parsed.hasTable && viewMode === 'tiptap') {
    return (
      <div>
        <div style={{ padding: '8px 16px', background: '#f8fafc', borderBottom: '1px solid var(--paper-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
            Mode Editor Teks Bebas (Rich Text)
          </div>
          <button
            type="button"
            className="btn btn-xs btn-outline"
            onClick={() => {
              // Convert to table template
              const defaultHeaders = ['No.', 'Uraian / Item Rekaman', 'Keterangan'];
              const defaultRows = [['1', '', '']];
              commitChanges(defaultHeaders, defaultRows, content);
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
              background: viewMode === 'grid' ? '#0284c7' : 'var(--navy)',
              color: '#fff',
            }}
          >
            {viewMode === 'grid' ? <IconTable size={13} /> : <IconEditor size={13} />}
            {viewMode === 'grid' ? 'Grid Tabel Interaktif' : 'Editor Teks TipTap'}
          </span>
          <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
            {viewMode === 'grid'
              ? `${headers.length} Kolom · ${rows.length} Baris Data`
              : 'Edit leluasa dengan WYSIWYG TipTap'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            style={{
              padding: '4px 10px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: viewMode === 'grid' ? 700 : 500,
              border: '1px solid',
              borderColor: viewMode === 'grid' ? 'var(--navy)' : 'var(--paper-line)',
              background: viewMode === 'grid' ? '#fff' : 'transparent',
              color: viewMode === 'grid' ? 'var(--navy)' : 'var(--ink-soft)',
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
              fontWeight: viewMode === 'tiptap' ? 700 : 500,
              border: '1px solid',
              borderColor: viewMode === 'tiptap' ? 'var(--navy)' : 'var(--paper-line)',
              background: viewMode === 'tiptap' ? '#fff' : 'transparent',
              color: viewMode === 'tiptap' ? 'var(--navy)' : 'var(--ink-soft)',
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

      {viewMode === 'tiptap' ? (
        <TipTapEditor content={content} onChange={onChange} />
      ) : (
        <div style={{ padding: '16px 20px', background: '#fff' }}>
          {/* Teks pengantar sebelum tabel jika ada */}
          {prefixText ? (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Teks Pengantar Sebelum Tabel
              </label>
              <div
                dangerouslySetInnerHTML={{ __html: prefixText }}
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
              <thead>
                <tr style={{ background: '#0b2545', color: '#fff' }}>
                  {headers.map((h, hIdx) => (
                    <th
                      key={hIdx}
                      style={{
                        padding: '10px 12px',
                        borderRight: '1px solid rgba(255,255,255,0.15)',
                        textAlign: hIdx === 0 ? 'center' : 'left',
                        width: hIdx === 0 ? '70px' : undefined,
                        fontWeight: 600,
                        letterSpacing: '0.02em',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                  <th style={{ width: '50px', textAlign: 'center', padding: '10px 6px' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={headers.length + 1}
                      style={{ textAlign: 'center', padding: '24px', color: 'var(--ink-muted)', fontStyle: 'italic' }}
                    >
                      Belum ada baris data. Klik tombol "+ Tambah Baris Baru" di bawah untuk mengisi tabel.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      style={{
                        background: rIdx % 2 === 0 ? '#fff' : '#f8fafc',
                        borderBottom: '1px solid #e2e8f0',
                      }}
                    >
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          style={{
                            padding: '6px 8px',
                            borderRight: '1px solid #e2e8f0',
                            verticalAlign: 'top',
                            textAlign: cIdx === 0 ? 'center' : 'left',
                          }}
                        >
                          {cIdx === 0 ? (
                            <input
                              type="text"
                              value={cell}
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
                              value={cell}
                              placeholder={`Isi ${headers[cIdx] || 'kolom'}...`}
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
                      ))}
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '6px 4px' }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(rIdx)}
                          title="Hapus baris ini"
                          style={{
                            background: '#fee2e2',
                            color: '#dc2626',
                            border: 'none',
                            borderRadius: 4,
                            padding: '6px 8px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s',
                          }}
                        >
                          <IconTrash size={14} />
                        </button>
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
            <button
              type="button"
              onClick={handleAddRow}
              className="btn btn-sm btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <IconPlus size={15} />
              <span>Tambah Baris Baru</span>
            </button>

            <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
              💡 <em>Teks dalam tabel otomatis tersimpan dan terformat rapi pada dokumen resmi / PDF.</em>
            </div>
          </div>

          {/* Teks penutup setelah tabel jika ada */}
          {suffixText ? (
            <div style={{ marginTop: 18 }}>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Teks Penutup Setelah Tabel
              </label>
              <div
                dangerouslySetInnerHTML={{ __html: suffixText }}
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

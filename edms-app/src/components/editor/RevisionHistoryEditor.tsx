'use client';

import React, { useState, useEffect } from 'react';
import {
  RevisionRow,
  formatIndoDate,
  computeSectionDiff
} from '@/lib/revisionUtils';
import { IconPlus, IconTrash, IconCheck } from '@/components/icons/Icons';

interface RevisionHistoryEditorProps {
  rows: RevisionRow[];
  onChange: (rows: RevisionRow[]) => void;
  oldSections?: Record<string, string>;
  newSections?: Record<string, string>;
  sectionLabels?: Record<string, string>;
  currentVersion?: string;
  docStatus?: string;
}

export default function RevisionHistoryEditor({
  rows,
  onChange,
  oldSections = {},
  newSections = {},
  sectionLabels = {},
  currentVersion = '1.0',
  docStatus = 'Draft'
}: RevisionHistoryEditorProps) {
  const [localRows, setLocalRows] = useState<RevisionRow[]>(rows);
  const [detectedDiffs, setDetectedDiffs] = useState<RevisionRow[]>([]);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Sync internal state when parent rows change
  useEffect(() => {
    setLocalRows(rows);
  }, [rows]);

  // Check for auto-diff between baseline (oldSections) and current (newSections)
  useEffect(() => {
    const diffs = computeSectionDiff(
      oldSections,
      newSections,
      sectionLabels,
      currentVersion.replace(/^v/, '')
    );
    setDetectedDiffs(diffs);
  }, [oldSections, newSections, sectionLabels, currentVersion]);

  // Update a single cell in the table
  const handleCellChange = (index: number, field: keyof RevisionRow, value: any) => {
    const updated = [...localRows];
    updated[index] = {
      ...updated[index],
      [field]: field === 'no' ? Number(value) || index + 1 : value,
      isAuto: false, // User modified manually
    };
    setLocalRows(updated);
    onChange(updated);
  };

  // Add a new manual row
  const handleAddManualRow = () => {
    const nextNo = localRows.length > 0 ? Math.max(...localRows.map(r => r.no)) + 1 : 1;
    const newRow: RevisionRow = {
      no: nextNo,
      tanggal: formatIndoDate(new Date()),
      halaman: 'Klausul',
      uraianSebelumDiubah: '',
      uraianSetelahDiubah: '',
      revisi: currentVersion.startsWith('Rev.') ? currentVersion : `Rev. ${currentVersion.replace(/^v/, '')}`,
      isAuto: false,
    };
    const updated = [...localRows, newRow];
    setLocalRows(updated);
    onChange(updated);
    setSyncFeedback('Baris manual berhasil ditambahkan');
    setTimeout(() => setSyncFeedback(null), 3000);
  };

  // Remove a row
  const handleDeleteRow = (index: number) => {
    const updated = localRows.filter((_, i) => i !== index).map((r, i) => ({
      ...r,
      no: i + 1,
    }));
    setLocalRows(updated);
    onChange(updated);
  };

  // Auto-diff merge / sync
  const handleSyncAutoDiff = () => {
    if (detectedDiffs.length === 0) {
      setSyncFeedback('Tidak ditemukan perubahan teks antar klausul baru vs awal.');
      setTimeout(() => setSyncFeedback(null), 3500);
      return;
    }

    // 1. Selalu pertahankan SELURUH baris riwayat yang sudah ada di tabel (tidak boleh hilang/terhapus)
    const combined: RevisionRow[] = localRows.length > 0 ? [...localRows] : [
      {
        no: 1,
        tanggal: formatIndoDate(new Date()),
        halaman: 'Semua',
        uraianSebelumDiubah: 'Dokumen Baru',
        uraianSetelahDiubah: 'Penerbitan Dokumen Mutu Terkendali Baru di Sistem EDMS',
        revisi: '00',
      }
    ];

    // 2. Gabungkan perubahan klausul yang terdeteksi
    let addedCount = 0;
    let updatedCount = 0;

    detectedDiffs.forEach(diff => {
      // Cari apakah klausul pada revisi ini sudah ada di tabel
      const existingIdx = combined.findIndex(
        r => r.halaman.trim().toLowerCase() === diff.halaman.trim().toLowerCase() &&
             r.revisi.trim().toLowerCase() === diff.revisi.trim().toLowerCase()
      );

      if (existingIdx >= 0) {
        // Jika klausul ini sudah ada di revisi saat ini, update uraian perubahannya ke yang paling baru
        combined[existingIdx] = {
          ...combined[existingIdx],
          uraianSebelumDiubah: diff.uraianSebelumDiubah || combined[existingIdx].uraianSebelumDiubah,
          uraianSetelahDiubah: diff.uraianSetelahDiubah,
          tanggal: diff.tanggal,
        };
        updatedCount++;
      } else {
        // Jika klausul ini baru pertama kali diubah, tambahkan sebagai baris baru (akumulatif)
        combined.push({
          ...diff,
          isAuto: false, // Disimpan permanen
        });
        addedCount++;
      }
    });

    // 3. Urutkan ulang nomor baris 1..N
    const finalized = combined.map((r, i) => ({ ...r, no: i + 1 }));
    setLocalRows(finalized);
    onChange(finalized);

    const msg = addedCount > 0 && updatedCount > 0
      ? `${addedCount} klausul baru ditambahkan & ${updatedCount} klausul diperbarui!`
      : addedCount > 0
      ? `${addedCount} klausul baru berhasil ditambahkan ke riwayat!`
      : `${updatedCount} uraian klausul berhasil diperbarui!`;

    setSyncFeedback(`Berhasil: ${msg}`);
    setTimeout(() => setSyncFeedback(null), 4000);
  };

  // Reset to default
  const handleResetToDefault = () => {
    if (confirm('Kembalikan tabel Riwayat Perubahan ke data awal sistem? Perubahan manual akan direset.')) {
      const defaultRows: RevisionRow[] = [
        {
          no: 1,
          tanggal: formatIndoDate(new Date()),
          halaman: 'Semua',
          uraianSebelumDiubah: 'Dokumen Baru',
          uraianSetelahDiubah: 'Penerbitan Dokumen Mutu Terkendali Baru di Sistem EDMS',
          revisi: '00',
        },
      ];
      setLocalRows(defaultRows);
      onChange(defaultRows);
      setSyncFeedback('Tabel riwayat berhasil dikembalikan ke standar awal.');
      setTimeout(() => setSyncFeedback(null), 3000);
    }
  };

  return (
    <div className="revision-editor-container" style={{ padding: '16px 20px' }}>
      {/* Header Info */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📋 Riwayat Perubahan Terkendali</span>
              <span className="badge badge-teal" style={{ fontSize: 10, padding: '2px 8px' }}>
                Format Baku 6-Kolom
              </span>
            </h2>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4, lineHeight: 1.4 }}>
              Sesuai format <strong>FR.UPS.SER3.BMK.01.01</strong> dan <strong>PR.UPS.SER3.BMK.01-02</strong>. Tampil otomatis tepat di bawah <strong>Lembar Pengesahan</strong> pada pratinjau kertas & cetak PDF resmi.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleSyncAutoDiff}
              className="btn btn-sm btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
              title="Analisis teks klausul dan masukkan perubahan secara otomatis ke tabel"
            >
              <span>⚡ Deteksi & Sinkronkan Auto Diff</span>
              {detectedDiffs.length > 0 && (
                <span style={{
                  background: '#f59e0b',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 800,
                  borderRadius: 10,
                  padding: '1px 6px',
                }}>
                  {detectedDiffs.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleAddManualRow}
              className="btn btn-sm btn-outline"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
            >
              <IconPlus />
              <span>+ Tambah Baris Manual</span>
            </button>

            <button
              type="button"
              onClick={handleResetToDefault}
              className="btn btn-sm btn-ghost"
              style={{ fontSize: 11, color: 'var(--ink-muted)' }}
              title="Reset ke baris standar awal"
            >
              <span>🔄 Reset</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {syncFeedback && (
          <div style={{
            marginTop: 12,
            padding: '8px 12px',
            background: '#ecfdf5',
            border: '1px solid #10b981',
            borderRadius: 'var(--r-sm)',
            color: '#065f46',
            fontSize: 12,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <IconCheck />
            <span>{syncFeedback}</span>
          </div>
        )}

        {/* Detected Diffs Hint Banner */}
        {detectedDiffs.length > 0 && (
          <div style={{
            marginTop: 12,
            padding: '10px 14px',
            background: '#fffbeb',
            border: '1px solid #f59e0b',
            borderRadius: 'var(--r-md)',
            color: '#92400e',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10
          }}>
            <div>
              <strong>⚡ Auto Diff Mendeteksi {detectedDiffs.length} Perubahan Klausul:</strong>
              <div style={{ fontSize: 11, marginTop: 2, color: '#b45309' }}>
                Perubahan terdeteksi pada klausul:{' '}
                <strong>{detectedDiffs.map(d => d.halaman).join(', ')}</strong>.
              </div>
            </div>
            <button
              type="button"
              onClick={handleSyncAutoDiff}
              className="btn btn-xs"
              style={{ background: '#f59e0b', color: '#fff', border: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              Sinkronkan Sekarang
            </button>
          </div>
        )}
      </div>

      {/* Main 6-Column Table Editor */}
      <div style={{
        overflowX: 'auto',
        border: '1.5px solid #000',
        borderRadius: 4,
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '1.5px solid #000' }}>
              <th style={{ width: '5%', padding: '8px 6px', borderRight: '1px solid #000', textAlign: 'center', fontWeight: 800 }}>No</th>
              <th style={{ width: '14%', padding: '8px 8px', borderRight: '1px solid #000', textAlign: 'center', fontWeight: 800 }}>Tanggal</th>
              <th style={{ width: '11%', padding: '8px 8px', borderRight: '1px solid #000', textAlign: 'center', fontWeight: 800 }}>Halaman</th>
              <th style={{ width: '31%', padding: '8px 10px', borderRight: '1px solid #000', textAlign: 'left', fontWeight: 800 }}>Uraian yang Dirubah</th>
              <th style={{ width: '31%', padding: '8px 10px', borderRight: '1px solid #000', textAlign: 'left', fontWeight: 800 }}>Uraian Perubahan</th>
              <th style={{ width: '8%', padding: '8px 6px', borderRight: '1px solid #000', textAlign: 'center', fontWeight: 800 }}>Revisi</th>
              <th style={{ width: '40px', padding: '8px 4px', textAlign: 'center', fontWeight: 700, color: '#64748b' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {localRows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--ink-muted)' }}>
                  Belum ada baris riwayat perubahan. Klik <strong>+ Tambah Baris Manual</strong> atau <strong>⚡ Deteksi & Sinkronkan Auto Diff</strong>.
                </td>
              </tr>
            ) : (
              localRows.map((row, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: '1px solid #000',
                    background: row.isAuto ? '#f8fafc' : '#fff',
                    transition: 'background 0.15s ease'
                  }}
                >
                  {/* 1. No */}
                  <td style={{ padding: '6px 4px', borderRight: '1px solid #000', textAlign: 'center', verticalAlign: 'top' }}>
                    <input
                      type="number"
                      value={row.no}
                      onChange={e => handleCellChange(idx, 'no', e.target.value)}
                      style={{
                        width: '100%',
                        textAlign: 'center',
                        border: 'none',
                        background: 'transparent',
                        fontWeight: 700,
                        fontSize: 12,
                      }}
                    />
                  </td>

                  {/* 2. Tanggal */}
                  <td style={{ padding: '6px 6px', borderRight: '1px solid #000', verticalAlign: 'top' }}>
                    <input
                      type="text"
                      value={row.tanggal}
                      onChange={e => handleCellChange(idx, 'tanggal', e.target.value)}
                      placeholder="Contoh: 18 September 2026"
                      style={{
                        width: '100%',
                        border: '1px solid transparent',
                        borderRadius: 3,
                        padding: '3px 5px',
                        fontSize: 11.5,
                        textAlign: 'center',
                      }}
                      onFocus={e => (e.target.style.borderColor = '#94a3b8')}
                      onBlur={e => (e.target.style.borderColor = 'transparent')}
                    />
                  </td>

                  {/* 3. Halaman */}
                  <td style={{ padding: '6px 6px', borderRight: '1px solid #000', verticalAlign: 'top' }}>
                    <input
                      type="text"
                      value={row.halaman}
                      onChange={e => handleCellChange(idx, 'halaman', e.target.value)}
                      placeholder="Contoh: Cover, 5, Tujuan"
                      style={{
                        width: '100%',
                        border: '1px solid transparent',
                        borderRadius: 3,
                        padding: '3px 5px',
                        fontSize: 11.5,
                        textAlign: 'center',
                      }}
                      onFocus={e => (e.target.style.borderColor = '#94a3b8')}
                      onBlur={e => (e.target.style.borderColor = 'transparent')}
                    />
                  </td>

                  {/* 4. Uraian yang Dirubah */}
                  <td style={{ padding: '6px 8px', borderRight: '1px solid #000', verticalAlign: 'top' }}>
                    <textarea
                      rows={2}
                      value={row.uraianSebelumDiubah}
                      onChange={e => handleCellChange(idx, 'uraianSebelumDiubah', e.target.value)}
                      placeholder="Uraian sebelum dirubah..."
                      style={{
                        width: '100%',
                        border: '1px solid transparent',
                        borderRadius: 3,
                        padding: '4px 6px',
                        fontSize: 11.5,
                        lineHeight: 1.4,
                        resize: 'vertical',
                        fontFamily: 'inherit',
                      }}
                      onFocus={e => (e.target.style.borderColor = '#94a3b8')}
                      onBlur={e => (e.target.style.borderColor = 'transparent')}
                    />
                  </td>

                  {/* 5. Uraian Perubahan */}
                  <td style={{ padding: '6px 8px', borderRight: '1px solid #000', verticalAlign: 'top' }}>
                    <textarea
                      rows={2}
                      value={row.uraianSetelahDiubah}
                      onChange={e => handleCellChange(idx, 'uraianSetelahDiubah', e.target.value)}
                      placeholder="Uraian setelah dirubah..."
                      style={{
                        width: '100%',
                        border: '1px solid transparent',
                        borderRadius: 3,
                        padding: '4px 6px',
                        fontSize: 11.5,
                        lineHeight: 1.4,
                        resize: 'vertical',
                        fontFamily: 'inherit',
                      }}
                      onFocus={e => (e.target.style.borderColor = '#94a3b8')}
                      onBlur={e => (e.target.style.borderColor = 'transparent')}
                    />
                  </td>

                  {/* 6. Revisi */}
                  <td style={{ padding: '6px 6px', borderRight: '1px solid #000', verticalAlign: 'top' }}>
                    <input
                      type="text"
                      value={row.revisi}
                      onChange={e => handleCellChange(idx, 'revisi', e.target.value)}
                      placeholder="01"
                      style={{
                        width: '100%',
                        border: '1px solid transparent',
                        borderRadius: 3,
                        padding: '3px 5px',
                        fontSize: 11.5,
                        textAlign: 'center',
                        fontWeight: 700,
                      }}
                      onFocus={e => (e.target.style.borderColor = '#94a3b8')}
                      onBlur={e => (e.target.style.borderColor = 'transparent')}
                    />
                  </td>

                  {/* 7. Action delete */}
                  <td style={{ padding: '6px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(idx)}
                      title="Hapus baris ini"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--red)',
                        padding: 4,
                        borderRadius: 4,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <IconTrash />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div style={{
        marginTop: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: 11.5,
        color: 'var(--ink-muted)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ height: 8, width: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
          <span>Tersinkronisasi otomatis dengan Pratinjau Kertas & Generator PDF</span>
        </div>
        <div>
          Total <strong>{localRows.length}</strong> entri riwayat
        </div>
      </div>
    </div>
  );
}

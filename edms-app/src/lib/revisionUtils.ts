// Helper Utilitas Riwayat Perubahan Otomatis (Auto-Populated & Manual Revision History)
// Sesuai Format Baku 6-Kolom PLN UP Sertifikasi (FR.UPS.SER3.BMK.01.01 & PR.UPS.SER3.BMK.01-02):
// No | Tanggal | Halaman | Uraian yang Dirubah | Uraian Perubahan | Revisi

export interface RevisionRow {
  no: number;
  tanggal: string;
  halaman: string;
  uraianSebelumDiubah: string; // Header resmi: "Uraian yang Dirubah"
  uraianSetelahDiubah: string; // Header resmi: "Uraian Perubahan"
  revisi: string;
  isAuto?: boolean;
}

export function formatIndoDate(dateInput?: string | Date | null): string {
  if (!dateInput) return new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Membersihkan tag HTML dan entity untuk komparasi teks murni
 */
export function cleanHtmlText(html?: string | null): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Membuat ringkasan singkat (excerpt) untuk uraian perubahan
 */
function makeExcerpt(text: string, maxLength: number = 130): string {
  const cleaned = text.trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.substring(0, maxLength).trim() + '...';
}

/**
 * Menghitung Auto Diff per seksi antara seksi lama vs seksi baru
 */
export function computeSectionDiff(
  oldSections: Record<string, string> = {},
  newSections: Record<string, string> = {},
  sectionLabels: Record<string, string> = {},
  currentRev: string = '01',
  currentDate?: string
): RevisionRow[] {
  const diffRows: RevisionRow[] = [];
  const dateStr = currentDate || formatIndoDate(new Date());
  const allKeys = Array.from(new Set([...Object.keys(oldSections), ...Object.keys(newSections)]));

  // Kunci seksi sistem yang dikecualikan dari diff
  const EXCLUDED_KEYS = new Set(['riwayat_perubahan', 'pengesahan', 'judul_formulir']);

  let count = 0;
  for (const key of allKeys) {
    if (EXCLUDED_KEYS.has(key)) continue;

    const oldText = cleanHtmlText(oldSections[key] || '');
    const newText = cleanHtmlText(newSections[key] || '');

    if (oldText !== newText) {
      count++;
      const label = sectionLabels[key] || key.replace(/_/g, ' ').toUpperCase();
      let uraianSebelum = '';
      let uraianSesudah = '';

      if (!oldText && newText) {
        uraianSebelum = '(Klausul Baru Belum Ada)';
        uraianSesudah = `${label}: Ditambahkan uraian klausul baru ("${makeExcerpt(newText)}")`;
      } else if (oldText && !newText) {
        uraianSebelum = `${label}: "${makeExcerpt(oldText)}"`;
        uraianSesudah = '(Klausul Dikosongkan / Dihapus)';
      } else {
        uraianSebelum = `${label}: "${makeExcerpt(oldText)}"`;
        uraianSesudah = `${label}: "${makeExcerpt(newText)}"`;
      }

      diffRows.push({
        no: count,
        tanggal: dateStr,
        halaman: label.replace(/^\d+\.\s*/, ''), // Nama klausul atau nomor halaman
        uraianSebelumDiubah: uraianSebelum,
        uraianSetelahDiubah: uraianSesudah,
        revisi: currentRev.startsWith('Rev.') ? currentRev : `Rev. ${currentRev}`,
        isAuto: true,
      });
    }
  }

  return diffRows;
}

/**
 * Meng-generate baris Riwayat Perubahan:
 * 1. Mengutamakan data yang tersimpan / disinkronkan di doc.sections.riwayat_perubahan
 * 2. Fallback otomatis jika belum ada data manual/tersimpan
 */
export function getRevisionHistory(
  doc: any,
  versions: any[] = [],
  approvals: any[] = []
): RevisionRow[] {
  // 1. Cek apakah ada data tersimpan di doc.sections.riwayat_perubahan
  const storedRiwayat = doc?.sections?.riwayat_perubahan;
  if (storedRiwayat) {
    try {
      const parsed = typeof storedRiwayat === 'string' ? JSON.parse(storedRiwayat) : storedRiwayat;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((r, idx) => ({
          no: r.no ?? idx + 1,
          tanggal: r.tanggal || formatIndoDate(doc?.updatedAt || doc?.created_at),
          halaman: r.halaman || '-',
          uraianSebelumDiubah: r.uraianSebelumDiubah || r.uraian_sebelum_diubah || r.uraianYangDirubah || '-',
          uraianSetelahDiubah: r.uraianSetelahDiubah || r.uraian_setelah_diubah || r.uraianPerubahan || '-',
          revisi: r.revisi || '01',
          isAuto: !!r.isAuto,
        }));
      }
    } catch {
      // Jika bukan JSON valid, lanjutkan ke fallback
    }
  }

  // 2. Fallback otomatis bawaan sistem
  const rows: RevisionRow[] = [];
  const initialDate = formatIndoDate(doc?.createdAt || doc?.created_at);
  const currentVer = doc?.currentVersion || doc?.current_version || '1.0';

  // Baris 1: Penerbitan Dokumen Baru Perdana
  rows.push({
    no: 1,
    tanggal: initialDate,
    halaman: 'Semua',
    uraianSebelumDiubah: 'Dokumen Baru',
    uraianSetelahDiubah: 'Penerbitan Dokumen Mutu Terkendali Baru di Sistem EDMS',
    revisi: '00'
  });

  // Jika ada riwayat versi sebelumnya di tabel document_versions
  if (Array.isArray(versions) && versions.length > 0) {
    const sorted = [...versions].sort((a, b) => {
      const tA = new Date(a.archived_at || a.created_at || 0).getTime();
      const tB = new Date(b.archived_at || b.created_at || 0).getTime();
      return tA - tB;
    });

    sorted.forEach((v, idx) => {
      const vDate = formatIndoDate(v.archived_at || v.created_at);
      const revNum = (idx + 1).toString().padStart(2, '0');
      rows.push({
        no: rows.length + 1,
        tanggal: vDate,
        halaman: 'Semua',
        uraianSebelumDiubah: `Dokumen Terkendali Versi ${v.version || idx + 1}`,
        uraianSetelahDiubah: v.deskripsi || 'Pemutakhiran berkala dan penyesuaian klausul mutu terkendali',
        revisi: revNum
      });
    });
  } else if (currentVer && currentVer !== '1.0' && currentVer !== '00') {
    const updateDate = formatIndoDate(doc?.updatedAt || doc?.updated_at);
    rows.push({
      no: 2,
      tanggal: updateDate,
      halaman: 'Semua',
      uraianSebelumDiubah: 'Dokumen Mutu Versi Sebelumnya',
      uraianSetelahDiubah: `Pemutakhiran dan pengesahan dokumen terkendali aktif versi v${currentVer}`,
      revisi: '01'
    });
  }

  return rows;
}

/**
 * Menghasilkan markup HTML tabel Riwayat Perubahan untuk Puppeteer PDF & Pratinjau
 * Sesuai contoh pada Formulir FR.UPS.SER3.BMK.01.01-00 & Prosedur PR.UPS.SER3.BMK.01-02:
 * Header: No | Tanggal | Halaman | Uraian yang Dirubah | Uraian Perubahan | Revisi
 */
export function renderRevisionTableHtml(rows: RevisionRow[]): string {
  const rowHtml = rows
    .map(
      r => `<tr>
        <td style="text-align:center; padding:5px 7px; border:1px solid #000; font-size:8.5pt;">${r.no}</td>
        <td style="text-align:center; padding:5px 7px; border:1px solid #000; font-size:8.5pt; white-space:nowrap;">${r.tanggal}</td>
        <td style="text-align:center; padding:5px 7px; border:1px solid #000; font-size:8.5pt;">${r.halaman}</td>
        <td style="padding:5px 8px; border:1px solid #000; font-size:8.5pt; line-height:1.4;">${r.uraianSebelumDiubah}</td>
        <td style="padding:5px 8px; border:1px solid #000; font-size:8.5pt; line-height:1.4;">${r.uraianSetelahDiubah}</td>
        <td style="text-align:center; padding:5px 7px; border:1px solid #000; font-size:8.5pt; font-weight:700;">${r.revisi}</td>
      </tr>`
    )
    .join('');

  return `
    <div class="riwayat-perubahan-section" style="margin: 14px 0 18px; page-break-inside: avoid;">
      <div style="font-weight: 800; font-size: 9.5pt; color: #000; letter-spacing: 0.04em; margin-bottom: 6px; text-transform: uppercase; text-align: center;">
        RIWAYAT PERUBAHAN
      </div>
      <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 8.5pt;">
        <thead>
          <tr style="background: #f1f5f9; font-weight: 800; text-align: center;">
            <th style="width: 5%; padding: 6px 5px; border: 1px solid #000;">No</th>
            <th style="width: 14%; padding: 6px 6px; border: 1px solid #000;">Tanggal</th>
            <th style="width: 11%; padding: 6px 6px; border: 1px solid #000;">Halaman</th>
            <th style="width: 31%; padding: 6px 8px; border: 1px solid #000;">Uraian yang Dirubah</th>
            <th style="width: 31%; padding: 6px 8px; border: 1px solid #000;">Uraian Perubahan</th>
            <th style="width: 8%; padding: 6px 5px; border: 1px solid #000;">Revisi</th>
          </tr>
        </thead>
        <tbody>
          ${rowHtml}
        </tbody>
      </table>
    </div>
  `;
}

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, unauthorized } from '@/lib/auth';
import { parseDocxBuffer, parsePdfBuffer } from '@/lib/docParser';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Berkas tidak ditemukan. Harap sertakan file Word (.docx) atau PDF.' },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (fileName.endsWith('.docx')) {
      const parsed = await parseDocxBuffer(buffer);
      return NextResponse.json({
        success: true,
        data: {
          ...parsed,
          fileName: file.name,
          sectionCount: Object.keys(parsed.sections).length
        }
      });
    } else if (fileName.endsWith('.pdf')) {
      const parsed = await parsePdfBuffer(buffer);
      return NextResponse.json({
        success: true,
        data: {
          ...parsed,
          fileName: file.name,
          sectionCount: Object.keys(parsed.sections).length
        }
      });
    } else {
      return NextResponse.json(
        { error: 'Format berkas tidak didukung. Harap unggah berkas Microsoft Word (.docx) atau dokumen PDF (.pdf).' },
        { status: 400 }
      );
    }
  } catch (err: any) {
    console.error('Error importing document:', err);
    return NextResponse.json(
      { error: `Gagal membaca isi dokumen: ${err.message || 'Terjadi kesalahan sistem'}` },
      { status: 500 }
    );
  }
}

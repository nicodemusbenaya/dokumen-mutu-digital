import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  
  // Periksa di public/uploads
  const publicPath = path.normalize(path.join(process.cwd(), 'public', 'uploads', ...pathSegments));
  const storagePath = path.normalize(path.join(process.cwd(), 'storage', ...pathSegments));

  let targetFile: string | null = null;
  if (fs.existsSync(publicPath) && fs.statSync(publicPath).isFile()) {
    targetFile = publicPath;
  } else if (fs.existsSync(storagePath) && fs.statSync(storagePath).isFile()) {
    targetFile = storagePath;
  }

  if (!targetFile) {
    return new NextResponse('Not found', { status: 404 });
  }

  const fileBuffer = fs.readFileSync(targetFile);
  const ext = path.extname(targetFile).toLowerCase();
  const contentType =
    ext === '.png' ? 'image/png' :
    ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
    ext === '.svg' ? 'image/svg+xml' :
    ext === '.pdf' ? 'application/pdf' :
    'application/octet-stream';

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

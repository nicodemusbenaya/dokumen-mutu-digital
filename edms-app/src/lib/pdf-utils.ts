// Pure string-manipulation utilities for PDF rendering (no Node.js deps — safe for client bundle)

export function injectSignaturesIntoFormHtml(
  html: string,
  data: {
    mgrSignature?: string | null;
    mgrApprover?: string | null;
    pimpinanSignature?: string | null;
    pimpinanApprover?: string | null;
    penyusun?: string | null;
  }
): string {
  if (!html) return html;
  let res = html;

  if (data.mgrSignature) {
    const sigImgTag = `<div style="height:55px; display:flex; align-items:center; justify-content:center; margin:4px auto;"><img src="${data.mgrSignature}" style="max-height:50px; max-width:140px; display:block; margin:0 auto; object-fit:contain;" alt="Tanda Tangan Digital Manager" /></div>`;

    if (res.includes('<div style="height:60px;"></div>')) {
      res = res.replace('<div style="height:60px;"></div>', sigImgTag);
    } else if (!res.includes('alt="Tanda Tangan Digital Manager"') && !res.includes('<table')) {
      res = res.replace(
        /(<p[^>]*>(?:[\s\S](?!<\/p>))*Manager(?:[\s\S](?!<\/p>))*<\/p>)(\s*)(<p[^>]*>\s*<strong[^>]*>\s*\((?:[\s\S])*?\)\s*<\/strong>\s*<\/p>|<p[^>]*>\s*\((?:[\s\S])*?\)\s*<\/p>)/i,
        `$1${sigImgTag}$3`
      );
    } else if (!res.includes('alt="Tanda Tangan Digital Manager"')) {
      res = res.replace(
        /(<strong>Manager[\s\S]*?<\/strong><\/p>)(\s*)(<p>\s*<strong>\s*\()/i,
        `$1${sigImgTag}$3`
      );
    }

    if (data.mgrApprover) {
      res = res.replace(/\(\s*\.{3,}\s*\)/g, `(${data.mgrApprover})`);
    }
  }

  if (data.pimpinanSignature) {
    const pimpinanSigImg = `<div style="height:55px; display:flex; align-items:center; justify-content:center; margin:4px auto;"><img src="${data.pimpinanSignature}" style="max-height:50px; max-width:140px; display:block; margin:0 auto; object-fit:contain;" alt="Tanda Tangan Digital Pimpinan" /></div>`;
    if (!res.includes('alt="Tanda Tangan Digital Pimpinan"')) {
      res = res.replace(
        /(<p[^>]*>(?:[\s\S](?!<\/p>))*(?:Senior Manager|Pimpinan|General Manager)(?:[\s\S](?!<\/p>))*<\/p>)(\s*)(<p[^>]*>\s*<strong[^>]*>\s*\((?:[\s\S])*?\)\s*<\/strong>\s*<\/p>|<p[^>]*>\s*\((?:[\s\S])*?\)\s*<\/p>)/i,
        `$1${pimpinanSigImg}$3`
      );
    }
    if (data.pimpinanApprover) {
      res = res.replace(/\(\s*\.{3,}\s*\)/g, `(${data.pimpinanApprover})`);
    }
  }

  return res;
}

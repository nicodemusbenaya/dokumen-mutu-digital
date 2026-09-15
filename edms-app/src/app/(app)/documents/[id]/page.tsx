'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import SignaturePad from 'signature_pad';
import type { DocumentDetail, Approval } from '@/types';

const SECTIONS = [
  { key: 'tujuan',        label: '1. Tujuan' },
  { key: 'ruang_lingkup', label: '2. Ruang Lingkup' },
  { key: 'definisi',      label: '3. Definisi & Istilah' },
  { key: 'prosedur',      label: '4. Prosedur' },
  { key: 'lampiran',      label: '5. Lampiran' },
];

const STATUS_CLASS: Record<string, string> = {
  'Draft':'draft','Review':'review','Menunggu Approval':'approval','Aktif':'aktif','Obsolete':'obsolete',
};

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const docId  = params.id as string;

  const [doc,     setDoc]     = useState<DocumentDetail | null>(null);
  const [tab,     setTab]     = useState('isi');
  const [loading, setLoading] = useState(true);
  const [msg,     setMsg]     = useState('');
  const [msgType, setMsgType] = useState<'ok'|'err'>('ok');

  // Approval modal
  const [approvalOpen,  setApprovalOpen]  = useState(false);
  const [approvalAction,setApprovalAction]= useState<'Approve'|'Reject'>('Approve');
  const [approvalStage, setApprovalStage] = useState<1|2|3>(1);
  const [approvalNote,  setApprovalNote]  = useState('');
  const [approving,     setApproving]     = useState(false);

  // Signature pad
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const sigPadRef    = useRef<SignaturePad | null>(null);

  useEffect(() => {
    if (sigCanvasRef.current && approvalOpen) {
      sigPadRef.current = new SignaturePad(sigCanvasRef.current, {
        backgroundColor: 'rgba(245, 243, 237, 0)',
        penColor: '#1B2A4A',
      });
    }
  }, [approvalOpen]);

  const fetchDoc = useCallback(async () => {
    const res = await fetch(`/api/documents/${docId}`);
    if (res.ok) {
      const json = await res.json();
      setDoc(json.data);
    }
    setLoading(false);
  }, [docId]);

  useEffect(() => { fetchDoc(); }, [fetchDoc]);

  function notify(text: string, type: 'ok'|'err' = 'ok') {
    setMsg(text); setMsgType(type);
    setTimeout(() => setMsg(''), 4000);
  }

  async function handleSubmit() {
    if (!confirm('Ajukan dokumen ini untuk review Tim Mutu?')) return;
    const res = await fetch(`/api/documents/${docId}/submit`, { method: 'POST' });
    const json = await res.json();
    if (res.ok) {
      notify(json.message);
      fetchDoc();
    } else {
      notify(json.error, 'err');
    }
  }

  async function handleApprove() {
    setApproving(true);
    const signatureData = sigPadRef.current && !sigPadRef.current.isEmpty()
      ? sigPadRef.current.toDataURL('image/png')
      : undefined;

    const res = await fetch(`/api/documents/${docId}/approve`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: approvalAction,
        stage:  approvalStage,
        note:   approvalNote,
        signatureData,
      }),
    });
    const json = await res.json();
    setApproving(false);
    setApprovalOpen(false);
    if (res.ok) {
      notify(json.message);
      fetchDoc();
    } else {
      notify(json.error, 'err');
    }
  }

  async function handleGeneratePdf() {
    const res = await fetch(`/api/documents/${docId}/pdf`, { method: 'POST' });
    const json = await res.json();
    if (res.ok) {
      notify('PDF berhasil dibuat! 🖨️');
      window.open(json.data.url, '_blank');
    } else {
      notify(json.error, 'err');
    }
  }

  if (loading) {
    return (
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        {Array.from({length:4}).map((_,i) => (
          <div key={i} className="skeleton" style={{height:i===0?60:28,borderRadius:'var(--r-md)'}}></div>
        ))}
      </div>
    );
  }

  if (!doc) return <div className="card card-body" style={{textAlign:'center',padding:60}}>Dokumen tidak ditemukan.</div>;

  const reviewApproval     = doc.approvals.find((a: Approval) => a.stage === 1 && a.action === 'Approve');
  const mgrApproval        = doc.approvals.find((a: Approval) => a.stage === 2 && a.action === 'Approve');
  const pimpinanApproval   = doc.approvals.find((a: Approval) => a.stage === 3 && a.action === 'Approve');

  return (
    <>
      {/* Notif */}
      {msg && (
        <div className="notif-bar no-print">
          <div className={`notif ${msgType === 'ok' ? 'success' : 'error'}`}>{msg}</div>
        </div>
      )}

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:22}}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
            <Link href="/documents" style={{fontSize:13,color:'var(--ink-soft)'}}>← Kembali</Link>
          </div>
          <div style={{fontFamily:'var(--serif)',fontSize:22,fontWeight:700}}>{doc.judul}</div>
          <div style={{display:'flex',gap:10,marginTop:6,flexWrap:'wrap'}}>
            <code style={{fontSize:13,background:'var(--paper)',padding:'2px 10px',borderRadius:20,color:'var(--navy)',fontWeight:700,border:'1px solid var(--paper-line)'}}>{doc.kode}</code>
            <span className={`badge badge-${STATUS_CLASS[doc.status] ?? 'draft'}`}>{doc.status}</span>
            <span style={{fontSize:12,color:'var(--ink-soft)'}}>v{doc.currentVersion || (doc as any).current_version} · {doc.jenis} · {doc.bidang}</span>
          </div>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'flex-end'}}>
          {doc.status === 'Draft' && (
            <>
              <Link href={`/editor/${doc.id}`} className="btn btn-outline btn-sm">✏️ Edit</Link>
              <button className="btn btn-amber btn-sm" onClick={handleSubmit}>📤 Ajukan Review</button>
            </>
          )}
          {(doc.status === 'Review' || doc.status === 'Menunggu Approval' || doc.status === 'Aktif') && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                const stage = doc.status === 'Review' ? 1 : (mgrApproval ? 3 : 2);
                setApprovalStage(stage as 1|2|3);
                setApprovalOpen(true);
              }}
            >
              ✍️ Berikan Approval
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={handleGeneratePdf}>🖨️ Generate PDF</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        {['isi','refs','workflow','versi'].map(t => (
          <button key={t} className={`tab-btn ${tab===t?'active':''}`} onClick={() => setTab(t)}>
            {t === 'isi' ? '📄 Isi Dokumen' : t === 'refs' ? '📚 Referensi' : t === 'workflow' ? '✅ Workflow' : '🗂 Riwayat Versi'}
          </button>
        ))}
      </div>

      {/* Tab: Isi */}
      {tab === 'isi' && (
        <div className="card card-body">
          {SECTIONS.map(sec => (
            <div key={sec.key} style={{marginBottom:22}}>
              <div style={{fontFamily:'var(--serif)',fontWeight:700,fontSize:15,color:'var(--navy)',marginBottom:8,paddingBottom:6,borderBottom:'2px solid var(--paper-line)'}}>{sec.label}</div>
              {doc.sections[sec.key] ? (
                <div dangerouslySetInnerHTML={{__html: doc.sections[sec.key]}} style={{fontSize:13.5,lineHeight:1.8,color:'var(--ink)'}} />
              ) : (
                <div style={{color:'var(--ink-muted)',fontStyle:'italic',fontSize:13}}>Belum diisi</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tab: Refs */}
      {tab === 'refs' && (
        <div className="card card-body">
          {doc.refs.length === 0
            ? <div style={{textAlign:'center',color:'var(--ink-muted)',padding:40}}>Belum ada referensi terkait</div>
            : <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {doc.refs.map((r: any) => (
                  <div key={r.id} style={{display:'flex',gap:12,padding:'12px 14px',background:'var(--paper)',borderRadius:'var(--r-md)',border:'1px solid var(--paper-line)'}}>
                    <span className={`badge badge-${r.kategori==='Regulasi'?'review':r.kategori==='Standar'?'aktif':'draft'}`} style={{flexShrink:0,alignSelf:'flex-start'}}>
                      {r.kategori}
                    </span>
                    <div>
                      <div style={{fontWeight:700,fontSize:13}}>{r.nomor}</div>
                      <div style={{fontSize:12.5,color:'var(--ink-soft)'}}>{r.judul}</div>
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
      )}

      {/* Tab: Workflow */}
      {tab === 'workflow' && (
        <div className="card card-body">
          <ul className="timeline">
            {[
              { label:'Penyusunan', sub: `Oleh ${doc.penyusunName || '—'}`, done: true, date: doc.createdAt },
              { label:'Review Tim Mutu', sub: reviewApproval ? `✅ ${reviewApproval.actorName}${reviewApproval.note ? ': ' + reviewApproval.note : ''}` : doc.status === 'Draft' ? 'Menunggu pengajuan' : 'Menunggu Tim Mutu', done: !!reviewApproval, current: doc.status === 'Review' },
              { label:'Approval Manager Bidang', sub: mgrApproval ? `✅ ${mgrApproval.actorName}${mgrApproval.note ? ': ' + mgrApproval.note : ''}` : 'Menunggu', done: !!mgrApproval, current: !mgrApproval && doc.status === 'Menunggu Approval' && !!reviewApproval },
              { label:'Pengesahan Pimpinan Unit', sub: pimpinanApproval ? `✅ ${pimpinanApproval.actorName}` : 'Menunggu', done: !!pimpinanApproval, current: !pimpinanApproval && doc.status === 'Menunggu Approval' && !!mgrApproval },
              { label:'Terbit & Aktif', sub: doc.status === 'Aktif' ? '🎉 Dokumen resmi terbit' : 'Menunggu pengesahan', done: doc.status === 'Aktif' || doc.status === 'Obsolete' },
            ].map((step, i) => (
              <li key={i} className={step.done ? 'tl-done' : step.current ? 'tl-current' : ''}>
                <div className="tl-title">{step.label}</div>
                <div className="tl-sub">{step.sub}</div>
                {step.date && <div style={{fontSize:11,color:'var(--ink-muted)',marginTop:3}}>{new Date(step.date).toLocaleString('id-ID')}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tab: Versi */}
      {tab === 'versi' && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Versi</th><th>Status</th><th>Keterangan</th><th>Diarsipkan</th></tr></thead>
            <tbody>
              <tr>
                <td style={{fontWeight:700}}>v{doc.currentVersion} (ini)</td>
                <td><span className={`badge badge-${STATUS_CLASS[doc.status] ?? 'draft'}`}>{doc.status}</span></td>
                <td>—</td>
                <td>—</td>
              </tr>
              {doc.versions.map((v: any) => (
                <tr key={v.id}>
                  <td>v{v.version}</td>
                  <td><span className="badge badge-obsolete">{v.status}</span></td>
                  <td style={{fontSize:12,color:'var(--ink-soft)'}}>{v.deskripsi || '—'}</td>
                  <td style={{fontSize:12,color:'var(--ink-soft)'}}>{new Date(v.archived_at).toLocaleDateString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Approval Modal */}
      {approvalOpen && (
        <div className="overlay" onClick={() => setApprovalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">✍️ Berikan Approval / Review</div>
              <button className="modal-close" onClick={() => setApprovalOpen(false)}>×</button>
            </div>
            <div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
                <div className="field">
                  <label>Tindakan</label>
                  <select value={approvalAction} onChange={e => setApprovalAction(e.target.value as any)}>
                    <option value="Approve">✅ Setujui</option>
                    <option value="Reject">↩ Kembalikan ke Penyusun</option>
                  </select>
                </div>
                <div className="field">
                  <label>Stage</label>
                  <select value={approvalStage} onChange={e => setApprovalStage(Number(e.target.value) as 1|2|3)}>
                    <option value={1}>Stage 1 — Tim Mutu</option>
                    <option value={2}>Stage 2 — Manager Bidang</option>
                    <option value={3}>Stage 3 — Pimpinan Unit</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Catatan (opsional)</label>
                <textarea
                  value={approvalNote}
                  onChange={e => setApprovalNote(e.target.value)}
                  placeholder="Tambahkan catatan review atau pertimbangan..."
                  rows={3}
                />
              </div>
              {approvalAction === 'Approve' && (
                <div className="field">
                  <label>Tanda Tangan Digital</label>
                  <div className="sig-wrap">
                    <canvas ref={sigCanvasRef} width={480} height={130} />
                  </div>
                  <div className="field-hint" style={{display:'flex',justifyContent:'space-between'}}>
                    <span>Tanda tangani di area di atas menggunakan mouse atau stylus</span>
                    <button style={{border:'none',background:'none',color:'var(--red)',cursor:'pointer',fontSize:12}} onClick={() => sigPadRef.current?.clear()}>Hapus</button>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setApprovalOpen(false)}>Batal</button>
              <button
                className={`btn ${approvalAction === 'Approve' ? 'btn-green' : 'btn-danger'}`}
                onClick={handleApprove}
                disabled={approving}
              >
                {approving ? 'Memproses...' : approvalAction === 'Approve' ? '✅ Konfirmasi Setujui' : '↩ Kembalikan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

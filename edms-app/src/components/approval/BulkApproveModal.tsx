'use client';

import { useEffect, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';
import { canApprove } from '@/lib/rbac';

export type BulkApprovePayload = {
  stage: 1 | 2 | 3;
  decision: 'Approve' | 'Reject';
  note?: string;
  signatureData?: string;
};

// Modal persetujuan massal: satu tanda tangan dipakai untuk seluruh dokumen terpilih.
export default function BulkApproveModal({
  count,
  role,
  busy,
  onClose,
  onSubmit,
}: {
  count: number;
  role: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: BulkApprovePayload) => void;
}) {
  const allowed = ([1, 2, 3] as const).filter(s => canApprove(role, s));
  const firstAllowed = (allowed[0] ?? 1) as 1 | 2 | 3;

  const [stage, setStage] = useState<1 | 2 | 3>(firstAllowed);
  const [decision, setDecision] = useState<'Approve' | 'Reject'>('Approve');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const sigPadRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    if (sigCanvasRef.current) {
      sigPadRef.current = new SignaturePad(sigCanvasRef.current, {
        backgroundColor: 'rgba(245, 243, 237, 0)',
        penColor: '#1B2A4A',
      });
    }
    return () => { sigPadRef.current = null; };
  }, []);

  function submit() {
    if (decision === 'Approve') {
      if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
        setError('Tanda tangan wajib diisi untuk persetujuan.');
        return;
      }
    }
    setError('');
    onSubmit({
      stage,
      decision,
      note: note.trim() || undefined,
      signatureData:
        decision === 'Approve' && sigPadRef.current && !sigPadRef.current.isEmpty()
          ? sigPadRef.current.toDataURL()
          : undefined,
    });
  }

  return (
    <div className="overlay" onClick={() => !busy && onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Persetujuan Massal — {count} dokumen</div>
          <button className="modal-close" onClick={() => !busy && onClose()}>×</button>
        </div>

        <div style={{ fontSize: 13, color: 'var(--ink-mid)', lineHeight: 1.6, marginBottom: 14 }}>
          Satu tanda tangan akan dipakai untuk seluruh dokumen terpilih. Dokumen yang tidak
          berada pada tahap yang tepat akan dilewati dan dicatat dalam hasil.
        </div>

        <div className="field">
          <label>Tahap Persetujuan</label>
          <select
            value={stage}
            onChange={e => setStage(Number(e.target.value) as 1 | 2 | 3)}
            disabled={busy}
          >
            <option value={1} disabled={!canApprove(role, 1)}>
              Stage 1 — Review Tim Mutu {!canApprove(role, 1) ? '(Terkunci)' : ''}
            </option>
            <option value={2} disabled={!canApprove(role, 2)}>
              Stage 2 — Approval Manager Bidang {!canApprove(role, 2) ? '(Terkunci)' : ''}
            </option>
            <option value={3} disabled={!canApprove(role, 3)}>
              Stage 3 — Pimpinan Unit {!canApprove(role, 3) ? '(Terkunci)' : ''}
            </option>
          </select>
        </div>

        <div className="field">
          <label>Keputusan</label>
          <select
            value={decision}
            onChange={e => setDecision(e.target.value as 'Approve' | 'Reject')}
            disabled={busy}
          >
            <option value="Approve">Setujui</option>
            <option value="Reject">Kembalikan ke Penyusun</option>
          </select>
        </div>

        <div className="field">
          <label>Catatan (opsional)</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Catatan yang sama untuk seluruh dokumen terpilih..."
            rows={3}
            disabled={busy}
          />
        </div>

        {decision === 'Approve' && (
          <div className="field">
            <label>Tanda Tangan Digital</label>
            <div className="sig-wrap">
              <canvas ref={sigCanvasRef} width={480} height={130} />
            </div>
            <div className="field-hint" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Tanda tangani di area di atas menggunakan mouse atau stylus</span>
              <button
                style={{ border: 'none', background: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 12 }}
                onClick={() => sigPadRef.current?.clear()}
                type="button"
              >
                Hapus
              </button>
            </div>
          </div>
        )}

        {error && (
          <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 8 }}>{error}</div>
        )}

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Batal</button>
          <button
            className={`btn ${decision === 'Approve' ? 'btn-green' : 'btn-danger'}`}
            onClick={submit}
            disabled={busy}
          >
            {busy ? 'Memproses...' : decision === 'Approve' ? `Setujui ${count} Dokumen` : `Kembalikan ${count} Dokumen`}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { api } from '../../../api/client';

interface AssetRow {
  assetId: number;
  assetTag: string;
}

/** 1D Barcode (Code128) for barcode printers */
function barcodeUrl(tag: string): string {
  return `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(tag)}&code=Code128&dpi=96`;
}
/** QR code for mobile scan-to-open asset */
function qrUrl(_tag: string, assetId: number): string {
  const url = typeof window !== 'undefined' ? `${window.location.origin}/assets/${assetId}` : '';
  return `https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent(url)}`;
}

export default function PrintLabels() {
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [printMode, setPrintMode] = useState(false);

  const loadRecent = () => {
    setLoading(true);
    api.get<{ success: boolean; data: AssetRow[]; total: number }>('/api/assets?pageSize=100&page=1')
      .then((res) => {
        setAssets(res.data);
        setSelected(new Set(res.data.map((a) => a.assetId)));
      })
      .catch(() => setAssets([]))
      .finally(() => setLoading(false));
  };

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(assets.map((a) => a.assetId)));
  const selectNone = () => setSelected(new Set());

  const printSelected = () => {
    setPrintMode(true);
    setTimeout(() => {
      window.print();
      setPrintMode(false);
    }, 300);
  };

  const toPrint = assets.filter((a) => selected.has(a.assetId));

  return (
    <div className="container-fluid">
      <h4 className="mb-4">Assets Print Labels</h4>
      {!printMode && (
        <>
          <div className="card mb-3">
            <div className="card-body">
              <p className="text-muted small mb-2">Load assets to select which labels to print. Then use &quot;Print selected&quot; to open the print dialog (e.g. for a barcode printer or label sheet).</p>
              <button type="button" className="btn btn-primary" onClick={loadRecent} disabled={loading}>
                {loading ? 'Loading...' : 'Load assets (first 100)'}
              </button>
            </div>
          </div>
          {assets.length > 0 && (
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <span>Select assets to print</span>
                <div>
                  <button type="button" className="btn btn-sm btn-outline-secondary me-1" onClick={selectAll}>Select all</button>
                  <button type="button" className="btn btn-sm btn-outline-secondary me-2" onClick={selectNone}>Clear</button>
                  <button type="button" className="btn btn-sm btn-success" onClick={printSelected} disabled={selected.size === 0}>
                    Print selected ({selected.size})
                  </button>
                </div>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-sm table-hover mb-0">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}></th>
                        <th>Tag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assets.map((a) => (
                        <tr key={a.assetId}>
                          <td>
                            <input type="checkbox" className="form-check-input" checked={selected.has(a.assetId)} onChange={() => toggle(a.assetId)} />
                          </td>
                          <td>{a.assetTag}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      <div className={printMode ? 'print-sheet' : 'd-none'}>
        <div className="d-flex flex-wrap" style={{ gap: '2px' }}>
          {toPrint.map((a) => (
            <div key={a.assetId} className="border p-2 text-center" style={{ width: '2in', minHeight: '1.2in', fontSize: '10px' }}>
              <img src={barcodeUrl(a.assetTag)} alt="" style={{ height: 36, width: 'auto', maxWidth: '100%' }} />
              <div className="d-flex align-items-center justify-content-center gap-1 mt-1">
                <span className="fw-bold">{a.assetTag}</span>
                <img src={qrUrl(a.assetTag, a.assetId)} alt="" style={{ width: 40, height: 40 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-sheet, .print-sheet * { visibility: visible; }
          .print-sheet { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}

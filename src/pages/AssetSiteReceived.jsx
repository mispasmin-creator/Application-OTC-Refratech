import React, { useState, useEffect } from 'react';
import { serialFetch } from '../lib/serialFetch';
import { Search, Loader2, Upload, X, CheckCircle2, FileCheck, Eye } from 'lucide-react';
import TableCellValue from '../components/TableCell';
import AssetDetailsModal from '../components/AssetDetailsModal';

const SCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;
const SHEET_NAME = 'Asset Transfer';

const PENDING_HEADERS = [
  'Transfer ID',
  'Asset Name',
  'Qty',
  'To Location',
  'Site Incharge',
  'Planned',
  'Transfer Status'
];

const HISTORY_HEADERS = [
  'Transfer ID',
  'Asset Name',
  'Qty',
  'To Location',
  'Site Incharge',
  'Planned',
  'Actual',
  'Delay',
  'Received Asset Image',
  'Transfer Status'
];

const AssetSiteReceived = () => {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [pendingRows, setPendingRows] = useState([]);
  const [historyRows, setHistoryRows] = useState([]);
  const [rawHeaders, setRawHeaders] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  // Modal State for Action
  const [showModal, setShowModal] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [receivedAssetImageFile, setReceivedAssetImageFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // View Details Modal State
  const [selectedDetailsRow, setSelectedDetailsRow] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const cleanH = (s) => (s ? s.toString().trim().toLowerCase().replace(/[\s\u00a0\r\n\t_-]+/g, '') : '');

  const fetchData = async () => {
    setFetching(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await serialFetch(`${SCRIPT_URL}?sheet=${encodeURIComponent(SHEET_NAME)}`);
      const result = await response.json();

      if (result.success && result.data && result.data.length > 0) {
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(result.data.length, 7); i++) {
          if (result.data[i] && result.data[i].some(h => cleanH(h) === 'transferid' || cleanH(h) === 'assetname')) {
            headerRowIndex = i;
            break;
          }
        }

        const sheetHeaders = result.data[headerRowIndex] || [];
        setRawHeaders(sheetHeaders);

        // Find relevant column indices
        const plannedColIdx = sheetHeaders.findIndex(h => cleanH(h) === 'planned');
        const actualColIdx = sheetHeaders.findIndex(h => cleanH(h) === 'actual');
        const tidColIdx = sheetHeaders.findIndex(h => cleanH(h) === 'transferid');
        const appNoColIdx = sheetHeaders.findIndex(h => cleanH(h) === 'applicationno' || cleanH(h) === 'applicationnumber');
        const assetColIdx = sheetHeaders.findIndex(h => cleanH(h) === 'assetname');
        const qtyColIdx = sheetHeaders.findIndex(h => cleanH(h) === 'qty');

        const getColIdx = (target) => {
          const tClean = cleanH(target);
          let idx = sheetHeaders.findIndex(h => cleanH(h) === tClean);
          if (idx === -1 && tClean.includes('transporterstatus')) {
            idx = sheetHeaders.findIndex(h => cleanH(h) === 'transferstatus');
          } else if (idx === -1 && tClean.includes('transferstatus')) {
            idx = sheetHeaders.findIndex(h => cleanH(h) === 'transporterstatus');
          }
          return idx;
        };

        const pendingColMap = PENDING_HEADERS.map(target => ({
          label: target,
          colIdx: getColIdx(target)
        }));

        const historyColMap = HISTORY_HEADERS.map(target => ({
          label: target,
          colIdx: getColIdx(target)
        }));

        const pendingList = [];
        const historyList = [];

        result.data.slice(headerRowIndex + 1).forEach((row, idx) => {
          const hasData = row && row.some(cell => cell && cell.toString().trim() !== '');
          if (!hasData) return;

          const plannedVal = plannedColIdx !== -1 ? row[plannedColIdx] : '';
          const actualVal = actualColIdx !== -1 ? row[actualColIdx] : '';

          const isPlannedNotNull = plannedVal !== undefined && plannedVal !== null && plannedVal.toString().trim() !== '';
          const isActualNull = actualVal === undefined || actualVal === null || actualVal.toString().trim() === '';
          const isActualNotNull = !isActualNull;

          const baseItem = {
            rawRow: row,
            originalIndex: idx + headerRowIndex + 2,
            transferId: tidColIdx !== -1 ? row[tidColIdx] : '',
            applicationNo: appNoColIdx !== -1 ? row[appNoColIdx] : '',
            assetName: assetColIdx !== -1 ? row[assetColIdx] : '',
            qty: qtyColIdx !== -1 ? row[qtyColIdx] : ''
          };

          // Condition for Pending: Planned Not Null AND Actual Null
          if (isPlannedNotNull && isActualNull) {
            const mappedRow = pendingColMap.map(col => col.colIdx !== -1 ? row[col.colIdx] : '');
            pendingList.push({
              ...baseItem,
              rowData: mappedRow
            });
          }

          // Condition for History: Planned Not Null AND Actual Not Null
          if (isPlannedNotNull && isActualNotNull) {
            const mappedRow = historyColMap.map(col => col.colIdx !== -1 ? row[col.colIdx] : '');
            historyList.push({
              ...baseItem,
              rowData: mappedRow
            });
          }
        });

        setPendingRows(pendingList);
        setHistoryRows(historyList);
      } else {
        setPendingRows([]);
        setHistoryRows([]);
      }
    } catch (err) {
      console.error('Error fetching Site Received data:', err);
      setPendingRows([]);
      setHistoryRows([]);
    } finally {
      setFetching(false);
    }
  };

  const uploadFile = (file) => {
    return new Promise((resolve) => {
      const folderId = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID;
      if (!folderId) { resolve(''); return; }
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64Data = e.target.result;
          const params = new URLSearchParams();
          params.append('action', 'uploadFile');
          params.append('base64Data', base64Data);
          params.append('fileName', file.name);
          params.append('mimeType', file.type || 'application/octet-stream');
          params.append('folderId', folderId);

          const response = await serialFetch(SCRIPT_URL, { method: 'POST', body: params });
          const result = await response.json();
          resolve(result.success && result.fileUrl ? result.fileUrl : '');
        } catch (err) {
          console.error('Upload error:', err);
          resolve('');
        }
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  const handleOpenActionModal = (rowItem) => {
    setSelectedRow(rowItem);
    setReceivedAssetImageFile(null);
    setShowModal(true);
  };

  const handleActionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRow) return;

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      // 1. Upload Received Asset Image if chosen
      let uploadedImageUrl = '';
      if (receivedAssetImageFile) {
        uploadedImageUrl = await uploadFile(receivedAssetImageFile);
      }

      // 2. Generate Actual timestamp in dd/mm/yyyy hh:mm:ss
      const pad = (n) => n.toString().padStart(2, '0');
      const now = new Date();
      const formattedTimestamp = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

      // 3. Find column indices for Actual and Received Asset Image
      const actualColIdx = rawHeaders.findIndex(h => cleanH(h) === 'actual');
      const receivedAssetImageColIdx = rawHeaders.findIndex(h => cleanH(h) === 'receivedassetimage');

      const updates = [];
      if (actualColIdx !== -1) {
        updates.push({ col: actualColIdx + 1, val: formattedTimestamp });
      }
      if (receivedAssetImageColIdx !== -1 && uploadedImageUrl) {
        updates.push({ col: receivedAssetImageColIdx + 1, val: uploadedImageUrl });
      }

      if (updates.length === 0) {
        throw new Error('Could not find target Actual column in sheet.');
      }

      // 4. Update cells in Google Sheet
      const updatePromises = updates.map(u => {
        const params = new URLSearchParams();
        params.append('sheetName', SHEET_NAME);
        params.append('action', 'updateCell');
        params.append('rowIndex', selectedRow.originalIndex);
        params.append('columnIndex', u.col);
        params.append('value', u.val);
        return serialFetch(SCRIPT_URL, { method: 'POST', body: params }).then(r => r.json());
      });

      const results = await Promise.all(updatePromises);
      const allSuccess = results.every(r => r.success);

      if (allSuccess) {
        setMessage({
          type: 'success',
          text: `Asset (${selectedRow.transferId}) received successfully! Moved to History.`
        });
        setShowModal(false);
        fetchData();
      } else {
        throw new Error('Failed to update sheet cell.');
      }
    } catch (err) {
      console.error('Submit Error:', err);
      alert(err.message || 'Error updating record.');
    } finally {
      setSubmitting(false);
    }
  };

  const currentRows = activeTab === 'pending' ? pendingRows : historyRows;
  const currentHeaders = activeTab === 'pending' ? PENDING_HEADERS : HISTORY_HEADERS;

  const filteredRows = currentRows.filter(item => {
    if (!searchQuery) return true;
    return item.rowData.some(cell =>
      cell && cell.toString().toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Site Received</h1>
          <p style={{ color: 'var(--text-muted)' }}>Asset site arrival verification, planned vs actual timing, and receiving photos.</p>
        </div>
      </div>

      {message.text && (
        <div style={{
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          background: message.type === 'error' ? 'var(--error-bg)' : 'var(--success-bg)',
          color: message.type === 'error' ? 'var(--error-color)' : 'var(--success-color)',
          border: `1px solid ${message.type === 'error' ? 'var(--error-border)' : 'var(--success-border)'}`
        }}>
          {message.text}
        </div>
      )}

      {/* Tabs: Pending & History */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('pending')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'pending' ? '2px solid var(--primary-color)' : '2px solid transparent',
            color: activeTab === 'pending' ? 'var(--primary-color)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          Pending
          <span style={{
            fontSize: '0.78rem',
            padding: '0.15rem 0.5rem',
            borderRadius: '12px',
            backgroundColor: activeTab === 'pending' ? 'var(--primary-color)' : 'rgba(255,255,255,0.08)',
            color: '#fff'
          }}>
            {pendingRows.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'history' ? '2px solid var(--primary-color)' : '2px solid transparent',
            color: activeTab === 'history' ? 'var(--primary-color)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          History
          <span style={{
            fontSize: '0.78rem',
            padding: '0.15rem 0.5rem',
            borderRadius: '12px',
            backgroundColor: activeTab === 'history' ? 'var(--primary-color)' : 'rgba(255,255,255,0.08)',
            color: '#fff'
          }}>
            {historyRows.length}
          </span>
        </button>
      </div>

      <div className="table-container">
        <div style={{ position: 'relative', width: '100%', maxWidth: '100%', marginBottom: '1.5rem', display: 'flex' }}>
          <Search size={18} style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder={`Search ${activeTab} records by Transfer ID, Asset, Location, Incharge...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input"
            style={{ width: '100%', paddingLeft: '3rem', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '1rem' }}
          />
        </div>

        {fetching ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={32} className="animate-spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
            <p>Loading Site Received records...</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ width: activeTab === 'pending' ? '145px' : '65px' }}>Action</th>
                  {currentHeaders.map((h, idx) => (
                    <th key={idx}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={currentHeaders.length + 1} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No {activeTab} site received records found.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((item, index) => (
                    <tr key={index}>
                      {/* Action column */}
                      <td data-label="Action" style={{ width: activeTab === 'pending' ? '145px' : '65px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          {activeTab === 'pending' && (
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() => handleOpenActionModal(item)}
                              style={{
                                padding: '0.45rem 0.85rem',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                borderRadius: '6px'
                              }}
                            >
                              <FileCheck size={14} /> Receive
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDetailsRow(item);
                              setShowDetailsModal(true);
                            }}
                            title="View Complete Details"
                            style={{
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '6px',
                              padding: '0.45rem 0.55rem',
                              cursor: 'pointer',
                              color: 'var(--text-main)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--primary-color)';
                              e.currentTarget.style.color = '#fff';
                              e.currentTarget.style.borderColor = 'var(--primary-color)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                              e.currentTarget.style.color = 'var(--text-main)';
                              e.currentTarget.style.borderColor = 'var(--border-color)';
                            }}
                          >
                            <Eye size={16} />
                          </button>
                        </div>
                      </td>

                      {item.rowData.map((cell, idx) => (
                        <td key={idx} data-label={currentHeaders[idx]}>
                          <TableCellValue value={cell} label={currentHeaders[idx]} />
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* VIEW ALL DETAILS MODAL */}
      <AssetDetailsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        headers={rawHeaders.length > 0 ? rawHeaders : currentHeaders}
        rawRow={selectedDetailsRow?.rawRow}
        title={`Asset Transfer Details - ${selectedDetailsRow?.transferId || ''}`}
      />

      {/* ACTION POPUP MODAL */}
      {showModal && selectedRow && (
        <div className="modal-overlay" onClick={() => !submitting && setShowModal(false)}>
          <div
            className="modal-card animate-fade-in"
            style={{ maxWidth: '540px', width: '100%', padding: '2rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Receive Asset</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                  Upload received asset image and mark actual receipt timestamp.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !submitting && setShowModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Selected Row Info Summary */}
            <div style={{
              backgroundColor: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.75rem',
              fontSize: '0.88rem'
            }}>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Transfer ID</span>
                <strong style={{ color: 'var(--text-main)' }}>{selectedRow.transferId || '-'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Application No.</span>
                <strong style={{ color: 'var(--text-main)' }}>{selectedRow.applicationNo || '-'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Asset Name</span>
                <strong style={{ color: 'var(--text-main)' }}>{selectedRow.assetName || '-'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Qty</span>
                <strong style={{ color: 'var(--text-main)' }}>{selectedRow.qty || '-'}</strong>
              </div>
            </div>

            <form onSubmit={handleActionSubmit}>
              {/* Received Asset Image Field */}
              <div className="form-group" style={{ marginBottom: '1.75rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Received Asset Image <span style={{ color: 'red' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="file"
                    accept="image/*"
                    className="form-input"
                    required
                    style={{ opacity: 0, position: 'absolute', inset: 0, cursor: 'pointer', zIndex: 2 }}
                    onChange={(e) => setReceivedAssetImageFile(e.target.files[0] || null)}
                  />
                  <div
                    className="form-input"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      backgroundColor: 'rgba(255,255,255,0.04)',
                      padding: '0.75rem 1rem'
                    }}
                  >
                    <Upload size={18} />
                    <span style={{ fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {receivedAssetImageFile ? receivedAssetImageFile.name : 'Click to select Received Asset Image'}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                  style={{ background: 'transparent', border: '1px solid var(--border-color)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  Submit & Complete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetSiteReceived;

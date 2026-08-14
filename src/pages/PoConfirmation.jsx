import React, { useState, useEffect } from 'react';
import { serialFetch } from '../lib/serialFetch';
import { Search, Loader2, RefreshCcw, Edit2, X } from 'lucide-react';
import ActionButtons from '../components/ActionButtons';
import ApplicationTracker from '../components/ApplicationTracker';
import { findFileLink } from '../lib/fileLink';

const SCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;
const SHEET_NAME = 'FMS';

const POConfirmation = () => {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [indents, setIndents] = useState([]);
  const [historyIndents, setHistoryIndents] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // View (timeline) modal state
  const [viewItem, setViewItem] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setFetching(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await serialFetch(`${SCRIPT_URL}?sheet=${SHEET_NAME}`);
      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (err) {
        setIndents([]);
        setHistoryIndents([]);
        setMessage({ type: 'error', text: 'Google AppScript server link is unavailable or returning HTML (404).' });
        return;
      }
      if (result.success && result.data && result.data.length > 0) {
        
        // Headers are on row 6 (index 5)
        const headers = result.data.length > 5 ? result.data[5] : result.data[0];
        
        const findIdx = (name) => headers.findIndex(h => h && h.toString().trim().toLowerCase() === name.toLowerCase());
        
        let planned1Idx = findIdx('Planned 1');
        let actual1Idx = findIdx('Actual 1');
        
        if (planned1Idx === -1) planned1Idx = 17;
        if (actual1Idx === -1) actual1Idx = 18;
        
        // Data starts from row 7 (index 6)
        const allMapped = result.data.slice(6).map((row, idx) => ({ rowData: row, originalIndex: idx + 7 }));
        
        const pendingRows = allMapped.filter(item => {
          const row = item.rowData;
          const hasPlanned1 = row[planned1Idx] !== undefined && row[planned1Idx] !== null && row[planned1Idx].toString().trim() !== '';
          const noActual1 = row[actual1Idx] === undefined || row[actual1Idx] === null || row[actual1Idx].toString().trim() === '';
          return hasPlanned1 && noActual1;
        });

        const historyRows = allMapped.filter(item => {
          const row = item.rowData;
          const hasActual1 = row[actual1Idx] !== undefined && row[actual1Idx] !== null && row[actual1Idx].toString().trim() !== '';
          return hasActual1;
        });
        
        setIndents([{ rowData: headers, originalIndex: -1 }, ...pendingRows]);
        setHistoryIndents([{ rowData: headers, originalIndex: -1 }, ...historyRows]);
      } else {
        setIndents([]);
        setHistoryIndents([]);
        if (!result.success) {
          setMessage({ type: 'error', text: result.error || 'Failed to fetch data' });
        }
      }
    } catch (error) {
      console.warn("Fetch error:", error);
      setMessage({ type: 'error', text: 'Error fetching data from Google AppScript.' });
    } finally {
      setFetching(false);
    }
  };

  const openModal = (item) => {
    // Application Number is at index 1
    const appNumber = item.rowData[1] || 'N/A';
    setSelectedItem({ originalIndex: item.originalIndex, appNumber, rowData: item.rowData });
    setStatus('');
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!status) return alert('Please select a status');
    setSubmitting(true);
    
    // Format timestamp: dd/mm/yyyy hh:mm:ss
    const pad = (n) => n.toString().padStart(2, '0');
    const d = new Date();
    const formattedDate = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    
    const headers = indents[0].rowData;
    
    // Match names exactly (allowing for trailing spaces in sheet)
    const findIdx = (name) => headers.findIndex(h => h && h.toString().trim().toLowerCase() === name.toLowerCase());
    
    let actual1Idx = findIdx('Actual 1');
    let status1Idx = findIdx('Status 1');
    let planned1Idx = findIdx('Planned 1');
    let delay1Idx = findIdx('Time Delay 1');
    let planned2Idx = findIdx('Planned 2');
    
    // Fallback to absolute indices if headers are blank/missing
    if (actual1Idx === -1) actual1Idx = 18; 
    if (status1Idx === -1) status1Idx = 20;

    // Calculate Delay
    let timeDelay = '';
    if (planned1Idx !== -1 && indents[0].rowData) {
      const plannedDateStr = selectedItem?.rowData?.[planned1Idx];
      if (plannedDateStr) {
        // Simple delay calculation: Actual Date - Planned Date
        const parseDate = (dStr) => {
          const parts = dStr.toString().trim().split(' ');
          const dp = parts[0].split('/');
          if (dp.length !== 3) return new Date(dStr);
          return new Date(dp[2], dp[1]-1, dp[0]);
        };
        const pDate = parseDate(plannedDateStr);
        if (!isNaN(pDate.getTime())) {
          const diffTime = d.getTime() - pDate.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          timeDelay = diffDays.toString();
        }
      }
    }

    // Calculate Planned 2 (T + 2 days)
    const p2Date = new Date();
    p2Date.setDate(p2Date.getDate() + 2);
    const formattedP2 = `${pad(p2Date.getDate())}/${pad(p2Date.getMonth() + 1)}/${p2Date.getFullYear()} ${pad(p2Date.getHours())}:${pad(p2Date.getMinutes())}:${pad(p2Date.getSeconds())}`;

    // Update Actual, Status, Time Delay, and next step's Planned Date
    const updates = [];
    updates.push({ col: actual1Idx + 1, val: formattedDate });
    updates.push({ col: status1Idx + 1, val: status });
    if (delay1Idx !== -1) updates.push({ col: delay1Idx + 1, val: timeDelay });
    if (planned2Idx !== -1) updates.push({ col: planned2Idx + 1, val: formattedP2 });
    
    try {
      // Calculate Delay 1
      const plannedIdx = findIdx('Planned 1');
      let timeDelay = '';
      if (plannedIdx !== -1 && selectedItem?.rowData?.[plannedIdx]) {
        const pStr = selectedItem.rowData[plannedIdx].toString().trim();
        const pParts = pStr.split(' ')[0].split('/');
        if (pParts.length === 3) {
          const pDate = new Date(pParts[2], pParts[1] - 1, pParts[0]);
          if (!isNaN(pDate.getTime())) {
            const diffDays = Math.ceil((d.getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24));
            timeDelay = diffDays.toString();
          }
        }
      }
      
      const delayIdx = findIdx('Time Delay 1');
      if (delayIdx !== -1) updates.push({ col: delayIdx + 1, val: timeDelay });
      
      // Calculate Planned 2 (T + 2 days) if not final step
      
      const nextPlannedIdx = findIdx('Planned 2');
      if (nextPlannedIdx !== -1) {
        const pNextDate = new Date();
        pNextDate.setDate(pNextDate.getDate() + 2);
        const formattedNextP = `${pad(pNextDate.getDate())}/${pad(pNextDate.getMonth() + 1)}/${pNextDate.getFullYear()} ${pad(pNextDate.getHours())}:${pad(pNextDate.getMinutes())}:${pad(pNextDate.getSeconds())}`;
        updates.push({ col: nextPlannedIdx + 1, val: formattedNextP });
      }
      

      const results = [];
      for (const u of updates) {
        const params = new URLSearchParams();
        params.append('sheetName', SHEET_NAME);
        params.append('action', 'updateCell');
        params.append('rowIndex', selectedItem.originalIndex);
        params.append('columnIndex', u.col);
        params.append('value', u.val);
        
        const r = await serialFetch(SCRIPT_URL, { method: 'POST', body: params }).then(res => res.json());
        results.push(r);
      }
      
      const allSuccess = results.every(r => r.success);
      
      if (allSuccess) {
        setMessage({ type: 'success', text: 'Details updated successfully!' });
        window.dispatchEvent(new Event('fms-updated'));
        setShowModal(false);
        fetchData(); // Refresh table
      } else {
        alert('One or more cell updates failed. Please check the network.');
      }
    } catch (e) {
      console.error(e);
      alert('Network error occurred.');
    } finally {
      setSubmitting(false);
    }
};

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>PO Confirmation</h1>
          <p style={{ color: 'var(--text-muted)' }}>Showing records pending actual confirmation.</p>
        </div>
        <button className="btn btn-primary" onClick={fetchData} disabled={fetching || submitting}>
          <RefreshCcw size={18} className={fetching ? "animate-spin" : ""} style={fetching ? { animation: 'spin 1s linear infinite' } : {}} />
          Refresh Data
        </button>
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

      {/* Tabs */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
        <div className="tab-group">
          <button
            className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            Pending ({Math.max(0, indents.length - 1)})
          </button>
          <button
            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            History ({Math.max(0, historyIndents.length - 1)})
          </button>
        </div>
      </div>
      
      {fetching ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Loader2 size={32} className="animate-spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
          <p>Loading records...</p>
        </div>
      ) : (() => {
        const currentData = activeTab === 'pending' ? indents : historyIndents;
        const rawHeaders = currentData[0] ? currentData[0].rowData : [];
        const rows = currentData.slice(1).filter(item => {
            const isRowEmpty = item.rowData.every(cell => !cell || cell.toString().trim() === '');
            if (isRowEmpty) return false;
            if (!searchQuery) return true;
            return item.rowData.some(cell => 
              cell && cell.toString().toLowerCase().includes(searchQuery.toLowerCase())
            );
          });
        
        const createIndentFieldNames = [
          'Timestamp', 'Application Number', 'Serial Number', 'Po Number', 'Work Order Copy',
          'Firm Name', 'Party Name', 'Type Of Work', 'Lead Time To Start', 'Shift Type',
          'Type Of Industry', 'Size Of Industry', 'Area Of Application', 'Qty', 'Rate',
          'Company', 'Incharge'
        ];

        const columnsToRender = createIndentFieldNames.map((fieldName, fallbackIdx) => {
          let colIdx = -1;
          if (Array.isArray(rawHeaders)) {
            colIdx = rawHeaders.findIndex(h => h && h.toString().trim().toLowerCase() === fieldName.toLowerCase());
          }
          if (colIdx === -1) {
            colIdx = fallbackIdx;
          }
          return { label: fieldName, colIdx };
        });

        return (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th className="sticky-action">Action</th>
                  {columnsToRender.map((col, idx) => (
                    <th key={idx}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={columnsToRender.length + 1} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No {activeTab} records found.
                    </td>
                  </tr>
                ) : (
                  rows.map((item, index) => {
                    const row = item.rowData;
                    const fileLink = findFileLink(rawHeaders, row, ['Work Order Copy']);
                    const rowActions = [
                      { key: 'view', label: 'View Details', onClick: () => setViewItem({ headers: rawHeaders, rowData: row }) },
                      ...(activeTab === 'pending' ? [{ key: 'edit', label: 'Update PO', onClick: () => openModal(item) }] : []),
                      ...(fileLink ? [{ key: 'download', label: 'Download Work Order', href: fileLink }] : []),
                    ];
                    return (
                      <tr key={index}>
                        <td className="sticky-action">
                          <ActionButtons actions={rowActions} />
                        </td>
                        {columnsToRender.map((col, idx) => {
                          const val = row[col.colIdx];
                          return (
                            <td key={idx}>
                              {val !== undefined && val !== null ? val.toString() : ''}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* Update PO Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem'
        }}>
          <div className="glass-panel animate-fade-in" style={{ padding: '2rem', borderRadius: '12px', minWidth: '400px', maxWidth: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem' }}>Update PO Confirmation</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            
            <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Application: <strong style={{ color: 'var(--text-main)' }}>{selectedItem?.appNumber}</strong></p>
            
            <div className="form-group">
              <label className="form-label">Status 1 *</label>
              <select 
                className="form-input" 
                value={status} 
                onChange={(e) => setStatus(e.target.value)}
                style={{ backgroundColor: '#fff', width: '100%' }}
                disabled={submitting}
              >
                <option value="">Select Status</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Hold">Hold</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowModal(false)} disabled={submitting}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Edit2 size={16} />}
                Confirm PO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {viewItem && (
        <div className="modal-overlay" onClick={() => setViewItem(null)}>
          <div className="modal-card animate-fade-in" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setViewItem(null)}>
              <X size={18} />
            </button>
            <h2 style={{ fontSize: '1.35rem', marginBottom: '0.25rem' }}>Application Progress</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Application: <strong style={{ color: 'var(--text-main)' }}>{viewItem.rowData[1] || 'N/A'}</strong>
            </p>
            <ApplicationTracker headers={viewItem.headers} rowData={viewItem.rowData} />
          </div>
        </div>
      )}
    </div>
  );
};

export default POConfirmation;

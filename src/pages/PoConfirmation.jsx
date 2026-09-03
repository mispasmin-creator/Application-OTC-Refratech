import React, { useState, useEffect } from 'react';
import { serialFetch } from '../lib/serialFetch';
import { Search, Loader2, Edit2, X, ChevronDown } from 'lucide-react';
import ActionButtons from '../components/ActionButtons';
import { findFileLink } from '../lib/fileLink';
import TableCellValue from '../components/TableCell';

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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setFetching(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await serialFetch(`${SCRIPT_URL}?sheet=${SHEET_NAME}&action=stageSplit&presenceCol=${encodeURIComponent('Planned 1')}&completeCol=${encodeURIComponent('Actual 1')}`);
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
      if (result.success) {
        const headers = result.headers || [];
        setIndents([{ rowData: headers, originalIndex: -1 }, ...(result.pending || [])]);
        setHistoryIndents([{ rowData: headers, originalIndex: -1 }, ...(result.history || [])]);
      } else {
        setIndents([]);
        setHistoryIndents([]);
        setMessage({ type: 'error', text: result.error || 'Failed to fetch data' });
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
    const cleanH = (s) => (s ? s.toString().trim().toLowerCase().replace(/[\s\u00a0\r\n\t_-]+/g, '').replace(/[^a-z0-9]/g, '') : '');
    const findIdx = (name, fallbackIdx = -1) => {
      if (!headers || !Array.isArray(headers)) return fallbackIdx;
      const targetClean = cleanH(name);
      let idx = headers.findIndex(h => cleanH(h) === targetClean);
      if (idx !== -1) return idx;
      idx = headers.findIndex(h => cleanH(h).includes(targetClean));
      if (idx !== -1) return idx;
      return fallbackIdx;
    };
    
    let actual1Idx = findIdx('Actual 1', 18);
    let status1Idx = findIdx('Status 1', 20);
    let planned1Idx = findIdx('Planned 1', 17);
    let delay1Idx = findIdx('Time Delay 1', 19);
    let planned2Idx = findIdx('Planned 2', 21);

    // Calculate Delay
    let timeDelay = '';
    if (planned1Idx !== -1 && selectedItem?.rowData?.[planned1Idx]) {
      const plannedDateStr = selectedItem.rowData[planned1Idx].toString().trim();
      if (plannedDateStr) {
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
    if (actual1Idx !== -1) updates.push({ col: actual1Idx + 1, val: formattedDate });
    if (status1Idx !== -1) updates.push({ col: status1Idx + 1, val: status });
    if (delay1Idx !== -1) updates.push({ col: delay1Idx + 1, val: timeDelay });
    if (planned2Idx !== -1 && status !== 'Rejected') updates.push({ col: planned2Idx + 1, val: formattedP2 });
    
    try {
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>PO Confirmation</h1>
          <p style={{ color: 'var(--text-muted)' }}>Showing records pending actual confirmation.</p>
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
          'Company', 'Incharge', 'Status 1'
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
                      ...(activeTab === 'pending' ? [{ key: 'edit', label: 'Update PO', onClick: () => openModal(item) }] : []),
                      ...(fileLink ? [{ key: 'download', label: 'Download Work Order', href: fileLink }] : []),
                    ];
                    return (
                      <tr key={index}>
                        <td className="sticky-action" data-label="Action">
                          <ActionButtons actions={rowActions} />
                        </td>
                        {columnsToRender.map((col, idx) => {
                          const val = row[col.colIdx];
                          return (
                            <td key={idx} data-label={col.label}>
                              <TableCellValue value={val} label={col.label} />
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
              <label className="form-label">Status *</label>
              <div className="select-wrapper">
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
                <ChevronDown size={16} className="select-chevron" />
              </div>
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
    </div>
  );
};

export default POConfirmation;

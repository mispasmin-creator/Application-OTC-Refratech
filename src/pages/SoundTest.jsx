import React, { useState, useEffect } from 'react';
import { serialFetch } from '../lib/serialFetch';
import { Loader2, RefreshCcw, Edit2 } from 'lucide-react';

const SCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;
const SHEET_NAME = 'FMS';

const SoundTest = () => {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [indents, setIndents] = useState([]);
  const [historyIndents, setHistoryIndents] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  
  const [status6, setStatus6] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setFetching(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await serialFetch(`${SCRIPT_URL}?sheet=${SHEET_NAME}`);
      const result = await response.json();
      if (result.success && result.data && result.data.length > 0) {
        
        // Use row 5 (index 4) as headers to match sheet exactly
        const headers = result.data.length > 4 ? result.data[4] : result.data[0];
        
        const findIdx = (name) => headers.findIndex(h => h && h.toString().trim() === name);
        
        // Find indices for filtering
        const planned6Idx = findIdx('Planned 6');
        const actual6Idx = findIdx('Actual 6');
        
        // Data starts from row 6, which is index 5
        const allMapped = result.data.slice(5).map((row, idx) => ({ rowData: row, originalIndex: idx + 6 }));

        const filteredRows = allMapped.filter(item => {
          const row = item.rowData;
          const hasPlanned6 = planned6Idx !== -1 && row[planned6Idx] !== undefined && row[planned6Idx] !== null && row[planned6Idx].toString().trim() !== '';
          const noActual6 = actual6Idx === -1 || row[actual6Idx] === undefined || row[actual6Idx] === null || row[actual6Idx].toString().trim() !== '';
          return hasPlanned6 && noActual6;
        });

        const historyRows = allMapped.filter(item => {
          const row = item.rowData;
          const hasActual6 = actual6Idx !== -1 && row[actual6Idx] !== undefined && row[actual6Idx] !== null && row[actual6Idx].toString().trim() !== '';
          return hasActual6;
        });
        
        setIndents([{ rowData: headers, originalIndex: -1 }, ...filteredRows]);
        setHistoryIndents([{ rowData: headers, originalIndex: -1 }, ...historyRows]);
      } else {
        setIndents([]);
        setHistoryIndents([]);
        if (!result.success) {
          setMessage({ type: 'error', text: result.error || 'Failed to fetch data' });
        }
      }
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Error fetching data.' });
    } finally {
      setFetching(false);
    }
  };

  const openModal = (item) => {
    // Application Number is at index 1
    const appNumber = item.rowData[1] || 'N/A';
    setSelectedItem({ originalIndex: item.originalIndex, appNumber });
    
    // Reset modal fields
    setStatus6('');
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!status6) {
      return alert('Please select a status');
    }
    
    setSubmitting(true);
    const headers = indents[0].rowData;
    const findIdx = (name) => headers.findIndex(h => h && h.toString().trim() === name);
    
    const status6Idx = findIdx('Status 6');
    const actual6Idx = findIdx('Actual 6');
    
    // Format timestamp: dd/mm/yyyy hh:mm:ss
    const pad = (n) => n.toString().padStart(2, '0');
    const d = new Date();
    const formattedDate = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    
    // We use the updateCell action to update ONLY the specific columns.
    const updates = [];
    if (status6Idx !== -1) updates.push({ col: status6Idx + 1, val: status6 });
    if (actual6Idx !== -1) updates.push({ col: actual6Idx + 1, val: formattedDate });
    
    if (updates.length === 0) {
      alert("Could not find the target columns in the sheet headers. Please ensure they exist.");
      setSubmitting(false);
      return;
    }

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
        setMessage({ type: 'success', text: 'Sound Test details updated successfully!' });
        setShowModal(false);
        fetchData(); // Refresh table
      } else {
        alert('One or more cell updates failed.');
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
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Sound Test</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage records pending Sound Test.</p>
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
          background: message.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
          color: message.type === 'error' ? 'var(--error-color)' : 'var(--secondary-color)',
          border: `1px solid ${message.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`
        }}>
          {message.text}
        </div>
      )}

      {/* Table Section */}
      <div className="glass-panel" style={{ padding: '2rem', borderRadius: '12px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem' }}>
            {activeTab === 'pending' ? 'Pending Sound Test' : 'History Records'}
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <button 
              onClick={() => setActiveTab('pending')}
              className={`btn ${activeTab === 'pending' ? 'btn-primary' : ''}`}
              style={{ 
                padding: '0.4rem 1rem', 
                fontSize: '0.85rem', 
                borderRadius: '6px',
                background: activeTab === 'pending' ? undefined : 'transparent',
                border: 'none',
                color: activeTab === 'pending' ? '#fff' : 'var(--text-muted)'
              }}
            >
              Pending ({Math.max(0, indents.length - 1)})
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`btn ${activeTab === 'history' ? 'btn-primary' : ''}`}
              style={{ 
                padding: '0.4rem 1rem', 
                fontSize: '0.85rem', 
                borderRadius: '6px',
                background: activeTab === 'history' ? undefined : 'transparent',
                border: 'none',
                color: activeTab === 'history' ? '#fff' : 'var(--text-muted)'
              }}
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
          const rows = currentData.slice(1);
          
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
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1500px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    {activeTab === 'pending' && (
                      <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap', position: 'sticky', top: 0, left: 0, background: 'var(--bg-darker)', zIndex: 20 }}>
                        Action
                      </th>
                    )}
                    {columnsToRender.map((col, idx) => (
                      <th key={idx} style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--bg-darker)', zIndex: 15 }}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={columnsToRender.length + (activeTab === 'pending' ? 1 : 0)} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {activeTab === 'pending' ? 'No records pending Sound Test.' : 'No history records found.'}
                      </td>
                    </tr>
                  ) : (
                    rows.map((item, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
                        {activeTab === 'pending' && (
                          <td style={{ padding: '1rem', whiteSpace: 'nowrap', position: 'sticky', left: 0, background: 'var(--bg-darker)', zIndex: 10 }}>
                            <button 
                              className="btn btn-primary" 
                              onClick={() => openModal(item)} 
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                            >
                              <Edit2 size={14} /> Update
                            </button>
                          </td>
                        )}
                        {columnsToRender.map((col, idx) => {
                          const val = item.rowData ? item.rowData[col.colIdx] : '';
                          return (
                            <td key={idx} style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                              {val !== undefined && val !== null ? val.toString() : ''}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>

      {/* Modal Popup */}
      {showModal && selectedItem && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="glass-panel animate-fade-in" style={{ padding: '2rem', borderRadius: '12px', minWidth: '400px', maxWidth: '90%', border: '1px solid var(--border-color)' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Update Status</h2>
            
            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">Application Number</label>
              <input type="text" className="form-input" value={selectedItem.appNumber} disabled style={{ opacity: 0.7 }} />
            </div>
            
            <div style={{ marginBottom: '2rem' }}>
              <label className="form-label">Status 6</label>
              <select className="form-input" value={status6} onChange={(e) => setStatus6(e.target.value)} style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)' }}>
                <option value="">Select Status 6</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Pending Info">Pending Info</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowModal(false)} disabled={submitting} style={{ background: 'rgba(255,255,255,0.05)' }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> : 'Submit Sound Test'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        tbody tr:hover td {
          background: rgba(255, 255, 255, 0.05);
        }
      `}</style>
    </div>
  );
};

export default SoundTest;

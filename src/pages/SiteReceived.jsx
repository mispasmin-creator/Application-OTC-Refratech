import React, { useState, useEffect } from 'react';
import { serialFetch } from '../lib/serialFetch';
import { Loader2, RefreshCcw, Edit2 } from 'lucide-react';

const SCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;
const SHEET_NAME = 'FMS';

const SiteReceived = () => {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [indents, setIndents] = useState([]);
  const [historyIndents, setHistoryIndents] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  
  const [status2, setStatus2] = useState('');
  const [dateOfSiteReceived, setDateOfSiteReceived] = useState('');
  const [expectedDateOfHandover, setExpectedDateOfHandover] = useState('');
  const [supervisorName, setSupervisorName] = useState('');
  const [supervisorOptions, setSupervisorOptions] = useState([]);
  
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
    fetchMasterData();
  }, []);

  const fetchMasterData = async () => {
    try {
      const response = await serialFetch(`${SCRIPT_URL}?sheet=Master`);
      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (err) {
        console.warn("Master sheet response was not valid JSON:", text.substring(0, 100));
        return;
      }
      if (result.success && result.data && result.data.length > 0) {
        const headers = result.data[0];
        const dataRows = result.data.slice(1);
        
        const idx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'supervisor name');
        if (idx !== -1) {
          const options = new Set();
          dataRows.forEach(row => {
            if (row[idx]) options.add(row[idx].toString().trim());
          });
          setSupervisorOptions(Array.from(options).sort());
        }
      }
    } catch (e) {
      console.error("Error fetching master data", e);
    }
  };

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
        
        // Use row 5 (index 4) as headers to match sheet exactly
        const headers = result.data.length > 4 ? result.data[4] : result.data[0];
        
        const findIdx = (name) => headers.findIndex(h => h && h.toString().trim() === name);
        
        // Find indices for filtering
        const status1Idx = findIdx('Status 1');
        const dateOfSiteReceivedIdx = findIdx('Date Of Site Received');
        
        // Data starts from row 6, which is index 5
        const allMapped = result.data.slice(5).map((row, idx) => ({ rowData: row, originalIndex: idx + 6 }));

        const filteredRows = allMapped.filter(item => {
          const row = item.rowData;
          const hasStatus1 = status1Idx !== -1 && row[status1Idx] !== undefined && row[status1Idx] !== null && row[status1Idx].toString().trim() !== '';
          const noSiteReceived = dateOfSiteReceivedIdx === -1 || row[dateOfSiteReceivedIdx] === undefined || row[dateOfSiteReceivedIdx] === null || row[dateOfSiteReceivedIdx].toString().trim() === '';
          return hasStatus1 && noSiteReceived;
        });

        const historyRows = allMapped.filter(item => {
          const row = item.rowData;
          const hasSiteReceived = dateOfSiteReceivedIdx !== -1 && row[dateOfSiteReceivedIdx] !== undefined && row[dateOfSiteReceivedIdx] !== null && row[dateOfSiteReceivedIdx].toString().trim() !== '';
          return hasSiteReceived;
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
    const headers = indents[0].rowData;
    const findIdx = (name) => headers.findIndex(h => h && h.toString().trim() === name);
    const supervisorNameIdx = findIdx('Supervisor Name');
    const existingSupervisorName = supervisorNameIdx !== -1 ? item.rowData[supervisorNameIdx] : '';

    // Application Number is at index 1
    const appNumber = item.rowData[1] || 'N/A';
    setSelectedItem({ originalIndex: item.originalIndex, appNumber });
    
    // Reset modal fields
    setStatus2('');
    setDateOfSiteReceived('');
    setExpectedDateOfHandover('');
    setSupervisorName(existingSupervisorName || ''); // Pre-fill from existing data if any
    
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!status2 || !dateOfSiteReceived || !expectedDateOfHandover || !supervisorName) {
      return alert('Please fill all the fields');
    }
    
    setSubmitting(true);
    const headers = indents[0].rowData;
    const findIdx = (name) => headers.findIndex(h => h && h.toString().trim() === name);
    
    const status2Idx = findIdx('Status 2');
    const dateOfSiteReceivedIdx = findIdx('Date Of Site Received');
    const expectedDateOfHandoverIdx = findIdx('Expected Date Of Handover');
    const supervisorNameIdx = findIdx('Supervisor Name');
    const actual2Idx = findIdx('Actual 2');
    
    // Format timestamp: dd/mm/yyyy hh:mm:ss
    const pad = (n) => n.toString().padStart(2, '0');
    const d = new Date();
    const formattedDate = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    
    // We use the updateCell action to update ONLY the specific columns.
    const updates = [];
    if (status2Idx !== -1) updates.push({ col: status2Idx + 1, val: status2 });
    if (dateOfSiteReceivedIdx !== -1) updates.push({ col: dateOfSiteReceivedIdx + 1, val: dateOfSiteReceived });
    if (expectedDateOfHandoverIdx !== -1) updates.push({ col: expectedDateOfHandoverIdx + 1, val: expectedDateOfHandover });
    if (supervisorNameIdx !== -1) updates.push({ col: supervisorNameIdx + 1, val: supervisorName });
    if (actual2Idx !== -1) updates.push({ col: actual2Idx + 1, val: formattedDate });
    
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
        setMessage({ type: 'success', text: 'Site Received details updated successfully!' });
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
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Site Received</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage site received and handover details.</p>
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
            {activeTab === 'pending' ? 'Pending Site Receipts' : 'History Records'}
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
                        {activeTab === 'pending' ? 'No records pending site receipt.' : 'No history records found.'}
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
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Update Site Details</h2>
            
            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">Application Number</label>
              <input type="text" className="form-input" value={selectedItem.appNumber} disabled style={{ opacity: 0.7 }} />
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">Status 2</label>
              <select className="form-input" value={status2} onChange={(e) => setStatus2(e.target.value)} style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)' }}>
                <option value="">Select Status 2</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Pending Info">Pending Info</option>
              </select>
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">Date Of Site Received</label>
              <input type="date" className="form-input" value={dateOfSiteReceived} onChange={(e) => setDateOfSiteReceived(e.target.value)} />
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">Expected Date Of Handover</label>
              <input type="date" className="form-input" value={expectedDateOfHandover} onChange={(e) => setExpectedDateOfHandover(e.target.value)} />
            </div>
            
            <div style={{ marginBottom: '2rem' }}>
              <label className="form-label">Supervisor Name</label>
              {supervisorOptions.length > 0 ? (
                <select className="form-input" value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)' }}>
                  <option value="">Select Supervisor Name</option>
                  {supervisorOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input type="text" className="form-input" placeholder="Enter Supervisor Name" value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} />
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowModal(false)} disabled={submitting} style={{ background: 'rgba(255,255,255,0.05)' }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> : 'Submit Site Details'}
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

export default SiteReceived;

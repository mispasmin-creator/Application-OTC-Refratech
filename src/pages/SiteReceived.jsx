// Force reload
import React, { useState, useEffect } from 'react';
import { serialFetch } from '../lib/serialFetch';
import { Search, Loader2, Edit2, X, ChevronDown } from 'lucide-react';
import ActionButtons from '../components/ActionButtons';
import { findFileLink } from '../lib/fileLink';
import TableCellValue from '../components/TableCell';

const SCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;
const SHEET_NAME = 'FMS';

const SiteReceived = () => {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [indents, setIndents] = useState([]);
  const [historyIndents, setHistoryIndents] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
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
        
        const cleanH = (s) => (s ? s.toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '') : '');
        let idx = headers.findIndex(h => cleanH(h) === 'siteincharge');
        if (idx === -1) {
          idx = headers.findIndex(h => cleanH(h).includes('siteincharge'));
        }
        if (idx === -1) {
          idx = headers.findIndex(h => cleanH(h).includes('site') && cleanH(h).includes('incharge'));
        }
        if (idx === -1) {
          idx = headers.findIndex(h => cleanH(h) === 'supervisorname' || cleanH(h) === 'supervisor');
        }
        if (idx !== -1) {
          const options = new Set();
          dataRows.forEach(row => {
            if (row && row[idx] && row[idx].toString().trim() !== '') {
              options.add(row[idx].toString().trim());
            }
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
      const response = await serialFetch(`${SCRIPT_URL}?sheet=${SHEET_NAME}&action=stageSplit&presenceCol=${encodeURIComponent('Status 1')}&completeCol=${encodeURIComponent('Date Of Site Received')}`);
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
      console.error(error);
      setMessage({ type: 'error', text: 'Error fetching data.' });
    } finally {
      setFetching(false);
    }
  };

  const openModal = (item) => {
    const headers = indents[0].rowData;
    const findIdx = (name) => headers.findIndex(h => h && h.toString().trim().toLowerCase() === name.toLowerCase());
    const supervisorNameIdx = findIdx('Supervisor Name');
    const existingSupervisorName = supervisorNameIdx !== -1 ? item.rowData[supervisorNameIdx] : '';

    // Application Number is at index 1
    const appNumber = item.rowData[1] || 'N/A';
    setSelectedItem({ originalIndex: item.originalIndex, appNumber, rowData: item.rowData });
    
    // Reset modal fields
    setStatus2('');
    setDateOfSiteReceived('');
    setExpectedDateOfHandover('');
    setSupervisorName(existingSupervisorName || ''); // Pre-fill from existing data if any
    
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!status2) {
      return alert('Please select a status');
    }
    if (status2 === 'Approved' && (!dateOfSiteReceived || !expectedDateOfHandover || !supervisorName)) {
      return alert('Please fill all the fields');
    }
    
    setSubmitting(true);
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
    
    const status2Idx = findIdx('Status 2', 24);
    const dateOfSiteReceivedIdx = findIdx('Date Of Site Received', 25);
    const expectedDateOfHandoverIdx = findIdx('Expected Date Of Handover', 26);
    const supervisorNameIdx = findIdx('Supervisor Name', 27);
    const actual2Idx = findIdx('Actual 2', 22);
    const planned2Idx = findIdx('Planned 2', 21);
    const delay2Idx = findIdx('Time Delay 2', 23);
    const planned3Idx = findIdx('Planned 3', 28);
    
    // Format timestamp: dd/mm/yyyy hh:mm:ss
    const pad = (n) => n.toString().padStart(2, '0');
    const d = new Date();
    const formattedDate = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    
    // Calculate Delay
    let timeDelay = '';
    if (planned2Idx !== -1 && indents[0].rowData) {
      const plannedDateStr = selectedItem?.rowData?.[planned2Idx];
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

    // Calculate Planned 3 (T + 2 days)
    const p3Date = new Date();
    p3Date.setDate(p3Date.getDate() + 2);
    const formattedP3 = `${pad(p3Date.getDate())}/${pad(p3Date.getMonth() + 1)}/${p3Date.getFullYear()} ${pad(p3Date.getHours())}:${pad(p3Date.getMinutes())}:${pad(p3Date.getSeconds())}`;

    // We use the updateCell action to update ONLY the specific columns.
    const updates = [];
    if (status2Idx !== -1) updates.push({ col: status2Idx + 1, val: status2 });
    if (status2 === 'Approved') {
      if (dateOfSiteReceivedIdx !== -1) updates.push({ col: dateOfSiteReceivedIdx + 1, val: dateOfSiteReceived });
      if (expectedDateOfHandoverIdx !== -1) updates.push({ col: expectedDateOfHandoverIdx + 1, val: expectedDateOfHandover });
      if (supervisorNameIdx !== -1) updates.push({ col: supervisorNameIdx + 1, val: supervisorName });
    }
    if (actual2Idx !== -1) updates.push({ col: actual2Idx + 1, val: formattedDate });
    if (delay2Idx !== -1) updates.push({ col: delay2Idx + 1, val: timeDelay });
    if (planned3Idx !== -1 && status2 !== 'Rejected') updates.push({ col: planned3Idx + 1, val: formattedP3 });
    
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
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Site Received</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage site received and handover details.</p>
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

      {/* Table Section */}
      <div className="glass-panel" style={{ padding: '2rem', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem' }}>
            {activeTab === 'pending' ? 'Pending Site Receipts' : 'History Records'}
          </h2>
          <div className="tab-group">
            <button
              onClick={() => setActiveTab('pending')}
              className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
            >
              Pending ({Math.max(0, indents.length - 1)})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
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
            'Company', 'Incharge', 'Status 2'
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
            <div className="table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
              <table className="custom-table" style={{ minWidth: '1500px' }}>
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
                        {activeTab === 'pending' ? 'No records pending site receipt.' : 'No history records found.'}
                      </td>
                    </tr>
                  ) : (
                    rows.map((item, index) => {
                      const row = item.rowData;
                      const fileLink = findFileLink(rawHeaders, row, ['Work Order Copy']);
                      const rowActions = [
                        ...(activeTab === 'pending' ? [{ key: 'edit', label: 'Update', onClick: () => openModal(item) }] : []),
                        ...(fileLink ? [{ key: 'download', label: 'Download Work Order', href: fileLink }] : []),
                      ];
                      return (
                        <tr key={index}>
                          <td className="sticky-action" data-label="Action">
                            <ActionButtons actions={rowActions} />
                          </td>
                          {columnsToRender.map((col, idx) => {
                            const val = row ? row[col.colIdx] : '';
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
      </div>

      {/* Modal Popup */}
      {showModal && selectedItem && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="glass-panel animate-fade-in" style={{ padding: '2rem', borderRadius: '12px', minWidth: '400px', maxWidth: '90%', border: '1px solid var(--border-color)' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Update Site Details</h2>
            
            <div className="form-group">
              <label className="form-label">Application Number</label>
              <input type="text" className="form-input" value={selectedItem.appNumber} disabled style={{ opacity: 0.7 }} />
            </div>
            
            <div className="form-group">
              <label className="form-label">Status</label>
              <div className="select-wrapper">
                <select className="form-input" value={status2} onChange={(e) => setStatus2(e.target.value)} >
                  <option value="">Select Status</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
                <ChevronDown size={16} className="select-chevron" />
              </div>
            </div>
            
            {status2 === 'Approved' && (
              <>
                <div className="form-group">
                  <label className="form-label">Date Of Site Received</label>
                  <input type="date" className="form-input" value={dateOfSiteReceived} onChange={(e) => setDateOfSiteReceived(e.target.value)} />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Expected Date Of Handover</label>
                  <input type="date" className="form-input" value={expectedDateOfHandover} onChange={(e) => setExpectedDateOfHandover(e.target.value)} />
                </div>
                
                <div style={{ marginBottom: '2rem' }}>
                  <label className="form-label">Supervisor Name</label>
                  <div className="select-wrapper">
                    <select className="form-input" value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} >
                      <option value="">Select Supervisor Name</option>
                      {supervisorName && !supervisorOptions.includes(supervisorName) && (
                        <option value={supervisorName}>{supervisorName}</option>
                      )}
                      {supervisorOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="select-chevron" />
                  </div>
                </div>
              </>
            )}
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowModal(false)} disabled={submitting}>
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
      `}</style>
    </div>
  );
};

export default SiteReceived;

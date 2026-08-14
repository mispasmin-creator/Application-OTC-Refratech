import React, { useState, useEffect } from 'react';
import { serialFetch } from '../lib/serialFetch';
import { Search, Loader2, RefreshCcw, Edit2, X } from 'lucide-react';
import ActionButtons from '../components/ActionButtons';
import ApplicationTracker from '../components/ApplicationTracker';
import { findFileLink } from '../lib/fileLink';

const SCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;
const SHEET_NAME = 'FMS';

const KilnTesting = () => {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [indents, setIndents] = useState([]);
  const [historyIndents, setHistoryIndents] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  
  const [status3, setStatus3] = useState('');
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
      const result = await response.json();
      if (result.success && result.data && result.data.length > 0) {
        
        // Use row 6 (index 5) as headers to match sheet exactly
        const headers = result.data.length > 5 ? result.data[5] : result.data[0];
        
        const findIdx = (name) => headers.findIndex(h => h && h.toString().trim().toLowerCase() === name.toLowerCase());
        
        // Find indices for filtering
        const planned3Idx = findIdx('Planned 3');
        const actual3Idx = findIdx('Actual 3');
        
        // Data starts from row 7, which is index 6
        const allMapped = result.data.slice(6).map((row, idx) => ({ rowData: row, originalIndex: idx + 7 }));

        const filteredRows = allMapped.filter(item => {
          const row = item.rowData;
          const hasPlanned3 = planned3Idx !== -1 && row[planned3Idx] !== undefined && row[planned3Idx] !== null && row[planned3Idx].toString().trim() !== '';
          const noActual3 = actual3Idx === -1 || row[actual3Idx] === undefined || row[actual3Idx] === null || row[actual3Idx].toString().trim() === '';
          return hasPlanned3 && noActual3;
        });

        const historyRows = allMapped.filter(item => {
          const row = item.rowData;
          const hasActual3 = actual3Idx !== -1 && row[actual3Idx] !== undefined && row[actual3Idx] !== null && row[actual3Idx].toString().trim() !== '';
          return hasActual3;
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
    setSelectedItem({ originalIndex: item.originalIndex, appNumber, rowData: item.rowData });
    
    // Reset modal fields
    setStatus3('');
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!status3) {
      return alert('Please select a status');
    }
    
    setSubmitting(true);
    const headers = indents[0].rowData;
    const findIdx = (name) => headers.findIndex(h => h && h.toString().trim().toLowerCase() === name.toLowerCase());
    
    const status3Idx = findIdx('Status 3');
    const actual3Idx = findIdx('Actual 3');
    
    // Format timestamp: dd/mm/yyyy hh:mm:ss
    const pad = (n) => n.toString().padStart(2, '0');
    const d = new Date();
    const formattedDate = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    
    // We use the updateCell action to update ONLY the specific columns.
    const updates = [];
    if (status3Idx !== -1) updates.push({ col: status3Idx + 1, val: status3 });
    if (actual3Idx !== -1) updates.push({ col: actual3Idx + 1, val: formattedDate });
    
    if (updates.length === 0) {
      alert("Could not find the target columns in the sheet headers. Please ensure they exist.");
      setSubmitting(false);
      return;
    }

    try {
      // Calculate Delay 3
      const plannedIdx = findIdx('Planned 3');
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
      
      const delayIdx = findIdx('Time Delay 3');
      if (delayIdx !== -1) updates.push({ col: delayIdx + 1, val: timeDelay });
      
      // Calculate Planned 4 (T + 2 days) if not final step
      
      const nextPlannedIdx = findIdx('Planned 4');
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
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>KILN Testing</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage records pending KILN Testing.</p>
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

            {/* Table Section */}
      <div className="table-container">
        <div style={{ position: 'relative', width: '100%', maxWidth: '100%', marginBottom: '1.5rem', display: 'flex' }}>
          <Search size={18} style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search by PO Number, Application Number, Firm Name, or any keyword..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input"
            style={{ width: '100%', paddingLeft: '3rem', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '1rem', transition: 'all 0.2s ease', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)' }}
            onFocus={(e) => e.target.style.borderColor = 'var(--primary-color)'}
            onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
          />
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
            <div>
              <table className="custom-table">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th className="sticky-action">
                      Action
                    </th>
                    {columnsToRender.map((col, idx) => (
                      <th key={idx}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={columnsToRender.length + 1} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {activeTab === 'pending' ? 'No records pending KILN Testing.' : 'No history records found.'}
                      </td>
                    </tr>
                  ) : (
                    rows.map((item, index) => {
                      const row = item.rowData;
                      const fileLink = findFileLink(rawHeaders, row, ['Work Order Copy']);
                      const rowActions = [
                        { key: 'view', label: 'View Details', onClick: () => setViewItem({ headers: rawHeaders, rowData: row }) },
                        ...(activeTab === 'pending' ? [{ key: 'edit', label: 'Update', onClick: () => openModal(item) }] : []),
                        ...(fileLink ? [{ key: 'download', label: 'Download Work Order', href: fileLink }] : []),
                      ];
                      return (
                      <tr key={index}>
                        <td className="sticky-action">
                          <ActionButtons actions={rowActions} />
                        </td>
                        {columnsToRender.map((col, idx) => {
                          const val = item.rowData ? item.rowData[col.colIdx] : '';
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
      </div>

      {/* Modal Popup */}
      {showModal && selectedItem && (
        <div className="modal-overlay">
          <div className="modal-card animate-fade-in" style={{ minWidth: "400px", padding: "2rem" }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Update Status</h2>
            
            <div className="form-group">
              <label className="form-label">Application Number</label>
              <input type="text" className="form-input" value={selectedItem.appNumber} disabled style={{ opacity: 0.7 }} />
            </div>
            
            <div style={{ marginBottom: '2rem' }}>
              <label className="form-label">Status 3</label>
              <select className="form-input" value={status3} onChange={(e) => setStatus3(e.target.value)} style={{ backgroundColor: "#fff" }}>
                <option value="">Select Status 3</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Pending Info">Pending Info</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowModal(false)} disabled={submitting} style={{ background: "transparent", border: "1px solid var(--border-color)" }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> : 'Submit KILN Testing'}
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

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        
      `}</style>
    </div>
  );
};

export default KilnTesting;

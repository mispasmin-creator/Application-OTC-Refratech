import React, { useState, useEffect } from 'react';
import { serialFetch } from '../lib/serialFetch';
import { Search, Loader2, RefreshCcw, Edit2, Upload, X } from 'lucide-react';
import ActionButtons from '../components/ActionButtons';
import ApplicationTracker from '../components/ApplicationTracker';
import { findFileLink } from '../lib/fileLink';

const SCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;
const SHEET_NAME = 'FMS';

const MakeInvoice = () => {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [indents, setIndents] = useState([]);
  const [historyIndents, setHistoryIndents] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  
  const [status9, setStatus9] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billImage, setBillImage] = useState('');
  
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
        const planned9Idx = findIdx('Planned 9');
        const actual9Idx = findIdx('Actual 9');
        
        // Data starts from row 7, which is index 6
        const allMapped = result.data.slice(6).map((row, idx) => ({ rowData: row, originalIndex: idx + 7 }));

        const filteredRows = allMapped.filter(item => {
          const row = item.rowData;
          const hasPlanned9 = planned9Idx !== -1 && row[planned9Idx] !== undefined && row[planned9Idx] !== null && row[planned9Idx].toString().trim() !== '';
          const noActual9 = actual9Idx === -1 || row[actual9Idx] === undefined || row[actual9Idx] === null || row[actual9Idx].toString().trim() === '';
          return hasPlanned9 && noActual9;
        });

        const historyRows = allMapped.filter(item => {
          const row = item.rowData;
          const hasActual9 = actual9Idx !== -1 && row[actual9Idx] !== undefined && row[actual9Idx] !== null && row[actual9Idx].toString().trim() !== '';
          return hasActual9;
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
    setStatus9('');
    setBillNumber('');
    setBillAmount('');
    setBillImage('');
    setShowModal(true);
  };

  const handleFileUpload = (e, setFileState) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFileState(event.target.result); // Base64 Data URL
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!status9) {
      return alert('Please select a status');
    }
    
    setSubmitting(true);
    const headers = indents[0].rowData;
    const findIdx = (name) => headers.findIndex(h => h && h.toString().trim().toLowerCase() === name.toLowerCase());
    
    const status9Idx = findIdx('Status 9');
    const actual9Idx = findIdx('Actual 9');
    const billNumberIdx = findIdx('Bill Number');
    const billAmountIdx = findIdx('Bill Amount');
    const billImageIdx = findIdx('Bill Image');
    
    // Format timestamp: dd/mm/yyyy hh:mm:ss
    const pad = (n) => n.toString().padStart(2, '0');
    const d = new Date();
    const formattedDate = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    
    // We use the updateCell action to update ONLY the specific columns.
    const updates = [];
    if (status9Idx !== -1) updates.push({ col: status9Idx + 1, val: status9 });
    if (actual9Idx !== -1) updates.push({ col: actual9Idx + 1, val: formattedDate });
    if (billNumberIdx !== -1) updates.push({ col: billNumberIdx + 1, val: billNumber });
    if (billAmountIdx !== -1) updates.push({ col: billAmountIdx + 1, val: billAmount });
    if (billImageIdx !== -1 && billImage) updates.push({ col: billImageIdx + 1, val: billImage });
    
    if (updates.length === 0) {
      alert("Could not find the target columns in the sheet headers. Please ensure they exist.");
      setSubmitting(false);
      return;
    }

    try {
      // Calculate Delay 9
      const plannedIdx = findIdx('Planned 9');
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
      
      const delayIdx = findIdx('Time Delay 9');
      if (delayIdx !== -1) updates.push({ col: delayIdx + 1, val: timeDelay });
      
      // Calculate Planned 10 (T + 2 days) if not final step
      
      const nextPlannedIdx = findIdx('Planned 10');
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
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Make Invoice</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage records pending Invoice generation.</p>
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
                        {activeTab === 'pending' ? 'No records pending Invoice.' : 'No history records found.'}
                      </td>
                    </tr>
                  ) : (
                    rows.map((item, index) => {
                      const row = item.rowData;
                      const fileLink = findFileLink(rawHeaders, row, ['Bill Image', 'Work Order Copy']);
                      const rowActions = [
                        { key: 'view', label: 'View Details', onClick: () => setViewItem({ headers: rawHeaders, rowData: row }) },
                        ...(activeTab === 'pending' ? [{ key: 'edit', label: 'Update', onClick: () => openModal(item) }] : []),
                        ...(fileLink ? [{ key: 'download', label: 'Download Bill', href: fileLink }] : []),
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
          <div className="glass-panel animate-fade-in" style={{ padding: '2rem', borderRadius: '12px', minWidth: '400px', maxWidth: '90%', border: '1px solid var(--border-color)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Update Invoice Details</h2>
            
            <div className="form-group">
              <label className="form-label">Application Number</label>
              <input type="text" className="form-input" value={selectedItem.appNumber} disabled style={{ opacity: 0.7 }} />
            </div>
            
            <div className="form-group">
              <label className="form-label">Status 9</label>
              <select className="form-input" value={status9} onChange={(e) => setStatus9(e.target.value)} style={{ backgroundColor: "#fff" }}>
                <option value="">Select Status 9</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Pending Info">Pending Info</option>
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label">Bill Number</label>
              <input type="text" className="form-input" placeholder="Enter Bill Number" value={billNumber} onChange={(e) => setBillNumber(e.target.value)} />
            </div>
            
            <div className="form-group">
              <label className="form-label">Bill Amount</label>
              <input type="number" className="form-input" placeholder="Enter Bill Amount" value={billAmount} onChange={(e) => setBillAmount(e.target.value)} />
            </div>
            
            <div style={{ marginBottom: '2rem' }}>
              <label className="form-label">Bill Image</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="file" 
                  className="form-input" 
                  style={{ opacity: 0, position: 'absolute', inset: 0, cursor: 'pointer' }}
                  onChange={(e) => handleFileUpload(e, setBillImage)} 
                />
                <div className="form-input" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(15, 23, 42, 0.5)' }}>
                  <Upload size={16} />
                  {billImage ? 'File attached' : 'Click to upload bill image'}
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowModal(false)} disabled={submitting} style={{ background: "transparent", border: "1px solid var(--border-color)" }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> : 'Submit Invoice Details'}
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

export default MakeInvoice;

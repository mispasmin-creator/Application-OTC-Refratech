import React, { useState, useEffect } from 'react';
import { serialFetch } from '../lib/serialFetch';
import { filterRowsByFirmAccess } from '../lib/accessControl';
import { Search, Loader2, Edit2, ChevronDown } from 'lucide-react';
import ActionButtons from '../components/ActionButtons';
import { findFileLink } from '../lib/fileLink';
import TableCellValue from '../components/TableCell';

const SCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;
const SHEET_NAME = 'FMS';

const HeatingEntry = () => {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [indents, setIndents] = useState([]);
  const [historyIndents, setHistoryIndents] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  
  const [status7, setStatus7] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

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

  const fetchData = async () => {
    setFetching(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await serialFetch(`${SCRIPT_URL}?sheet=${SHEET_NAME}&action=stageSplit&presenceCol=${encodeURIComponent('Planned 7')}&completeCol=${encodeURIComponent('Actual 7')}`);
      const result = await response.json();
      if (result.success) {
        const headers = result.headers || [];
        const pendingRows = filterRowsByFirmAccess((result.pending || []).slice().reverse(), headers, '/heating-entry');
        const historyRows = filterRowsByFirmAccess((result.history || []).slice().reverse(), headers, '/heating-entry');
        setIndents([{ rowData: headers, originalIndex: -1 }, ...pendingRows]);
        setHistoryIndents([{ rowData: headers, originalIndex: -1 }, ...historyRows]);
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
    // Application Number is at index 1
    const appNumber = item.rowData[1] || 'N/A';
    setSelectedItem({ originalIndex: item.originalIndex, appNumber, rowData: item.rowData });
    
    // Reset modal fields
    setStatus7('');
    setImageFile(null);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!status7) {
      return alert('Please select a status');
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
    
    const status7Idx = findIdx('Status 7', 51);
    const actual7Idx = findIdx('Actual 7', 49);
    const planned7Idx = findIdx('Planned 7', 48);
    const delay7Idx = findIdx('Time Delay 7', 50);
    const planned8Idx = findIdx('Planned 8', 53);
    const heatingEntryImageIdx = findIdx('Heating Entry Image', 52);

    let uploadedImageUrl = '';
    if (status7 === 'Approved' && imageFile) {
      uploadedImageUrl = await uploadFile(imageFile);
    }
    
    // Format timestamp: dd/mm/yyyy hh:mm:ss
    const pad = (n) => n.toString().padStart(2, '0');
    const d = new Date();
    const formattedDate = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    
    // We use the updateCell action to update ONLY the specific columns.
    const updates = [];
    if (status7Idx !== -1) updates.push({ col: status7Idx + 1, val: status7 });
    if (actual7Idx !== -1) updates.push({ col: actual7Idx + 1, val: formattedDate });
    if (status7 === 'Approved' && heatingEntryImageIdx !== -1 && uploadedImageUrl) {
      updates.push({ col: heatingEntryImageIdx + 1, val: uploadedImageUrl });
    }
    
    // Calculate Delay 7
    let timeDelay = '';
    if (planned7Idx !== -1 && selectedItem?.rowData?.[planned7Idx]) {
      const pStr = selectedItem.rowData[planned7Idx].toString().trim();
      const pParts = pStr.split(' ')[0].split('/');
      if (pParts.length === 3) {
        const pDate = new Date(pParts[2], pParts[1] - 1, pParts[0]);
        if (!isNaN(pDate.getTime())) {
          const diffDays = Math.ceil((d.getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24));
          timeDelay = diffDays.toString();
        }
      }
    }
    if (delay7Idx !== -1) updates.push({ col: delay7Idx + 1, val: timeDelay });
    
    // Calculate Planned 8 (T + 2 days)
    const pNextDate = new Date();
    pNextDate.setDate(pNextDate.getDate() + 2);
    const formattedNextP = `${pad(pNextDate.getDate())}/${pad(pNextDate.getMonth() + 1)}/${pNextDate.getFullYear()} ${pad(pNextDate.getHours())}:${pad(pNextDate.getMinutes())}:${pad(pNextDate.getSeconds())}`;
    if (planned8Idx !== -1 && status7 !== 'Rejected' && status7 !== 'Not Done') updates.push({ col: planned8Idx + 1, val: formattedNextP });

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
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Heating Entry</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage records pending Heating Entry.</p>
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
            'Company', 'Incharge', 'Status 7', 'Heating Entry Image'
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
                        {activeTab === 'pending' ? 'No records pending Heating Entry.' : 'No history records found.'}
                      </td>
                    </tr>
                  ) : (
                    rows.map((item, index) => {
                      const row = item.rowData;
                      const fileLink = findFileLink(rawHeaders, row, ['Work Order Copy', 'Heating Entry Image']);
                      const rowActions = [
                        ...(activeTab === 'pending' ? [{ key: 'edit', label: 'Update', onClick: () => openModal(item) }] : []),
                        ...(fileLink ? [{ key: 'download', label: 'Download Attachment', href: fileLink }] : []),
                      ];
                      return (
                      <tr key={index}>
                        <td className="sticky-action" data-label="Action">
                          <ActionButtons actions={rowActions} />
                        </td>
                        {columnsToRender.map((col, idx) => {
                          const val = item.rowData ? item.rowData[col.colIdx] : '';
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
        <div className="modal-overlay">
          <div className="modal-card animate-fade-in" style={{ minWidth: "400px", padding: "2rem" }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Update Status</h2>
            
            <div className="form-group">
              <label className="form-label">Application Number</label>
              <input type="text" className="form-input" value={selectedItem.appNumber} disabled style={{ opacity: 0.7 }} />
            </div>
            
            <div style={{ marginBottom: '2rem' }}>
              <label className="form-label">Status</label>
              <div className="select-wrapper">
                <select className="form-input" value={status7} onChange={(e) => setStatus7(e.target.value)} style={{ backgroundColor: "#fff" }}>
                  <option value="">Select Status</option>
                  <option value="Done">Done</option>
                  <option value="Not Done">Not Done</option>
                </select>
                <ChevronDown size={16} className="select-chevron" />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowModal(false)} disabled={submitting} style={{ background: "transparent", border: "1px solid var(--border-color)" }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> : 'Submit Heating Entry'}
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

export default HeatingEntry;

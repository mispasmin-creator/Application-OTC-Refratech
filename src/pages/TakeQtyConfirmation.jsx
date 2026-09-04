import React, { useState, useEffect } from 'react';
import { serialFetch } from '../lib/serialFetch';
import { Search, Loader2, Edit2, Upload, ChevronDown } from 'lucide-react';
import ActionButtons from '../components/ActionButtons';
import { findFileLink } from '../lib/fileLink';
import TableCellValue from '../components/TableCell';

const SCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;
const SHEET_NAME = 'FMS';

const TakeQtyConfirmation = () => {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [indents, setIndents] = useState([]);
  const [historyIndents, setHistoryIndents] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  
  const [status8, setStatus8] = useState('');
  const [totalQtyApplied, setTotalQtyApplied] = useState('');
  const [photoOfCertifyCopy, setPhotoOfCertifyCopy] = useState('');
  const [vendorBillCopy, setVendorBillCopy] = useState('');
  const [photoFileObj, setPhotoFileObj] = useState(null);
  const [vendorFileObj, setVendorFileObj] = useState(null);
  
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const uploadFile = (file) => {
    return new Promise((resolve) => {
      const folderId = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID;
      if (!folderId) {
        resolve('');
        return;
      }
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

          const response = await serialFetch(SCRIPT_URL, {
            method: 'POST',
            body: params
          });
          const result = await response.json();
          if (result.success && result.fileUrl) {
            resolve(result.fileUrl);
          } else {
            console.error('File upload failed:', result);
            resolve('');
          }
        } catch (err) {
          console.error('Error uploading file:', err);
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
      const response = await serialFetch(`${SCRIPT_URL}?sheet=${SHEET_NAME}&action=stageSplit&presenceCol=${encodeURIComponent('Planned 8')}&completeCol=${encodeURIComponent('Actual 8')}`);
      const result = await response.json();
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
    // Application Number is at index 1
    const appNumber = item.rowData[1] || 'N/A';
    setSelectedItem({ originalIndex: item.originalIndex, appNumber, rowData: item.rowData });
    
    // Reset modal fields
    setStatus8('');
    setTotalQtyApplied('');
    setPhotoOfCertifyCopy('');
    setVendorBillCopy('');
    setPhotoFileObj(null);
    setVendorFileObj(null);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!status8) {
      return alert('Please select a status');
    }
    if (status8 === 'Approved' && !totalQtyApplied) {
      return alert('Please fill in the required fields (Total Qty Applied)');
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
    
    const status8Idx = findIdx('Status 8', 51);
    const actual8Idx = findIdx('Actual 8', 49);
    const planned8Idx = findIdx('Planned 8', 48);
    const delay8Idx = findIdx('Time Delay 8', 50);
    const totalQtyAppliedIdx = findIdx('Total Qty Applied', 52);
    const photoOfCertifyCopyIdx = findIdx('Photo Of Certify Copy', 53);
    const vendorBillCopyIdx = findIdx('Vendor Bill Copy', 54);
    const planned9Idx = findIdx('Planned 9', 55);
    
    // Format timestamp: dd/mm/yyyy hh:mm:ss
    const pad = (n) => n.toString().padStart(2, '0');
    const d = new Date();
    const formattedDate = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    
    // Handle File Uploads to Drive
    let finalPhotoUrl = photoOfCertifyCopy;
    let finalVendorUrl = vendorBillCopy;
    if (status8 === 'Approved') {
      if (photoFileObj) {
        const uploadedUrl = await uploadFile(photoFileObj);
        if (uploadedUrl) finalPhotoUrl = uploadedUrl;
      }
      if (vendorFileObj) {
        const uploadedUrl = await uploadFile(vendorFileObj);
        if (uploadedUrl) finalVendorUrl = uploadedUrl;
      }
    }

    // We use the updateCell action to update ONLY the specific columns.
    const updates = [];
    if (status8Idx !== -1) updates.push({ col: status8Idx + 1, val: status8 });
    if (actual8Idx !== -1) updates.push({ col: actual8Idx + 1, val: formattedDate });
    if (status8 === 'Approved') {
      if (totalQtyAppliedIdx !== -1 && totalQtyApplied) updates.push({ col: totalQtyAppliedIdx + 1, val: totalQtyApplied });
      if (photoOfCertifyCopyIdx !== -1 && finalPhotoUrl) updates.push({ col: photoOfCertifyCopyIdx + 1, val: finalPhotoUrl });
      if (vendorBillCopyIdx !== -1 && finalVendorUrl) updates.push({ col: vendorBillCopyIdx + 1, val: finalVendorUrl });
    }
    
    // Calculate Delay 8
    let timeDelay = '';
    if (planned8Idx !== -1 && selectedItem?.rowData?.[planned8Idx]) {
      const pStr = selectedItem.rowData[planned8Idx].toString().trim();
      const pParts = pStr.split(' ')[0].split('/');
      if (pParts.length === 3) {
        const pDate = new Date(pParts[2], pParts[1] - 1, pParts[0]);
        if (!isNaN(pDate.getTime())) {
          const diffDays = Math.ceil((d.getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24));
          timeDelay = diffDays.toString();
        }
      }
    }
    if (delay8Idx !== -1) updates.push({ col: delay8Idx + 1, val: timeDelay });
    
    // Calculate Planned 9 (T + 2 days)
    const pNextDate = new Date();
    pNextDate.setDate(pNextDate.getDate() + 2);
    const formattedNextP = `${pad(pNextDate.getDate())}/${pad(pNextDate.getMonth() + 1)}/${pNextDate.getFullYear()} ${pad(pNextDate.getHours())}:${pad(pNextDate.getMinutes())}:${pad(pNextDate.getSeconds())}`;
    if (planned9Idx !== -1 && status8 !== 'Rejected') updates.push({ col: planned9Idx + 1, val: formattedNextP });

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
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Take Qty Confirmation</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage records pending Take Qty Confirmation.</p>
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
            'Company', 'Incharge', 'Status 8'
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
                        {activeTab === 'pending' ? 'No records pending Take Qty Confirmation.' : 'No history records found.'}
                      </td>
                    </tr>
                  ) : (
                    rows.map((item, index) => {
                      const row = item.rowData;
                      const fileLink = findFileLink(rawHeaders, row, ['Photo Of Certify Copy', 'Vendor Bill Copy', 'Work Order Copy']);
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
          <div className="glass-panel animate-fade-in" style={{ padding: '2rem', borderRadius: '12px', minWidth: '400px', maxWidth: '90%', border: '1px solid var(--border-color)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Update Qty Confirmation</h2>
            
            <div className="form-group">
              <label className="form-label">Application Number</label>
              <input type="text" className="form-input" value={selectedItem.appNumber} disabled style={{ opacity: 0.7 }} />
            </div>
            
            <div className="form-group">
              <label className="form-label">Status</label>
              <div className="select-wrapper">
                <select className="form-input" value={status8} onChange={(e) => setStatus8(e.target.value)} style={{ backgroundColor: "#fff" }}>
                  <option value="">Select Status</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
                <ChevronDown size={16} className="select-chevron" />
              </div>
            </div>
            
            {status8 === 'Approved' && (
              <>
                <div className="form-group">
                  <label className="form-label">Total Qty Applied</label>
                  <input type="number" className="form-input" placeholder="Enter Total Qty Applied" value={totalQtyApplied} onChange={(e) => setTotalQtyApplied(e.target.value)} />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Photo Of Certify Copy</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="file" 
                      className="form-input" 
                      style={{ opacity: 0, position: 'absolute', inset: 0, cursor: 'pointer' }}
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          setPhotoFileObj(file);
                          setPhotoOfCertifyCopy(file.name);
                        }
                      }} 
                    />
                    <div className="form-input" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(15, 23, 42, 0.5)' }}>
                      <Upload size={16} />
                      {photoFileObj ? photoFileObj.name : (photoOfCertifyCopy ? 'File attached' : 'Click to upload photo')}
                    </div>
                  </div>
                </div>
                
                <div style={{ marginBottom: '2rem' }}>
                  <label className="form-label">Vendor Bill Copy</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="file" 
                      className="form-input" 
                      style={{ opacity: 0, position: 'absolute', inset: 0, cursor: 'pointer' }}
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          setVendorFileObj(file);
                          setVendorBillCopy(file.name);
                        }
                      }} 
                    />
                    <div className="form-input" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(15, 23, 42, 0.5)' }}>
                      <Upload size={16} />
                      {vendorFileObj ? vendorFileObj.name : (vendorBillCopy ? 'File attached' : 'Click to upload bill copy')}
                    </div>
                  </div>
                </div>
              </>
            )}
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowModal(false)} disabled={submitting} style={{ background: "transparent", border: "1px solid var(--border-color)" }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> : 'Submit Details'}
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

export default TakeQtyConfirmation;

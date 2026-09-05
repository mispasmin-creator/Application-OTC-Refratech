import React, { useState, useEffect } from 'react';
import { serialFetch } from '../lib/serialFetch';
import { filterRowsByFirmAccess } from '../lib/accessControl';
import { Search, Loader2, Edit2, ChevronDown } from 'lucide-react';
import ActionButtons from '../components/ActionButtons';
import { findFileLink } from '../lib/fileLink';
import TableCellValue from '../components/TableCell';

const SCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;
const SHEET_NAME = 'FMS';

const SoundTest = () => {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [indents, setIndents] = useState([]);
  const [historyIndents, setHistoryIndents] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  
  const [status6, setStatus6] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [videoZone2, setVideoZone2] = useState(null);
  const [videoZone4, setVideoZone4] = useState(null);
  const [videoZone7, setVideoZone7] = useState(null);
  const [photoFullKiln, setPhotoFullKiln] = useState(null);
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
      const response = await serialFetch(`${SCRIPT_URL}?sheet=${SHEET_NAME}&action=stageSplit&presenceCol=${encodeURIComponent('Planned 6')}&completeCol=${encodeURIComponent('Actual 6')}`);
      const result = await response.json();
      if (result.success) {
        const headers = result.headers || [];
        const pendingRows = filterRowsByFirmAccess((result.pending || []).slice().reverse(), headers, '/sound-test');
        const historyRows = filterRowsByFirmAccess((result.history || []).slice().reverse(), headers, '/sound-test');
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
    setStatus6('');
    setImageFile(null);
    setVideoZone2(null);
    setVideoZone4(null);
    setVideoZone7(null);
    setPhotoFullKiln(null);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!status6) {
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
    
    const status6Idx = findIdx('Status 6', 56);
    const actual6Idx = findIdx('Actual 6', 54);
    const planned6Idx = findIdx('Planned 6', 53);
    const delay6Idx = findIdx('Time Delay 6', 55);
    const planned7Idx = findIdx('Planned 7', 62);
    const soundTestImageIdx = findIdx('Sound Test Image', 57);
    const videoZone2Idx = findIdx('Video Of Zone 2', 58);
    const videoZone4Idx = findIdx('Video Of Zone 4', 59);
    const videoZone7Idx = findIdx('Video Of Zone 7', 60);
    const photoFullKilnIdx = findIdx('Photo Of Full Kiln', 61);
    
    let uploadedImageUrl = '';
    let uploadedVideoZone2 = '';
    let uploadedVideoZone4 = '';
    let uploadedVideoZone7 = '';
    let uploadedPhotoFullKiln = '';

    if (status6 === 'Approved') {
      [
        uploadedImageUrl,
        uploadedVideoZone2,
        uploadedVideoZone4,
        uploadedVideoZone7,
        uploadedPhotoFullKiln
      ] = await Promise.all([
        imageFile ? uploadFile(imageFile) : Promise.resolve(''),
        videoZone2 ? uploadFile(videoZone2) : Promise.resolve(''),
        videoZone4 ? uploadFile(videoZone4) : Promise.resolve(''),
        videoZone7 ? uploadFile(videoZone7) : Promise.resolve(''),
        photoFullKiln ? uploadFile(photoFullKiln) : Promise.resolve('')
      ]);
    }
    
    // Format timestamp: dd/mm/yyyy hh:mm:ss
    const pad = (n) => n.toString().padStart(2, '0');
    const d = new Date();
    const formattedDate = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    
    // We use the updateCell action to update ONLY the specific columns.
    const updates = [];
    if (status6Idx !== -1) updates.push({ col: status6Idx + 1, val: status6 });
    if (actual6Idx !== -1) updates.push({ col: actual6Idx + 1, val: formattedDate });
    if (status6 === 'Approved') {
      if (soundTestImageIdx !== -1 && uploadedImageUrl) {
        updates.push({ col: soundTestImageIdx + 1, val: uploadedImageUrl });
      }
      if (videoZone2Idx !== -1 && uploadedVideoZone2) {
        updates.push({ col: videoZone2Idx + 1, val: uploadedVideoZone2 });
      }
      if (videoZone4Idx !== -1 && uploadedVideoZone4) {
        updates.push({ col: videoZone4Idx + 1, val: uploadedVideoZone4 });
      }
      if (videoZone7Idx !== -1 && uploadedVideoZone7) {
        updates.push({ col: videoZone7Idx + 1, val: uploadedVideoZone7 });
      }
      if (photoFullKilnIdx !== -1 && uploadedPhotoFullKiln) {
        updates.push({ col: photoFullKilnIdx + 1, val: uploadedPhotoFullKiln });
      }
    }
    
    // Calculate Delay 6
    let timeDelay = '';
    if (planned6Idx !== -1 && selectedItem?.rowData?.[planned6Idx]) {
      const pStr = selectedItem.rowData[planned6Idx].toString().trim();
      const pParts = pStr.split(' ')[0].split('/');
      if (pParts.length === 3) {
        const pDate = new Date(pParts[2], pParts[1] - 1, pParts[0]);
        if (!isNaN(pDate.getTime())) {
          const diffDays = Math.ceil((d.getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24));
          timeDelay = diffDays.toString();
        }
      }
    }
    if (delay6Idx !== -1) updates.push({ col: delay6Idx + 1, val: timeDelay });
    
    // Calculate Planned 7 (T + 2 days)
    const pNextDate = new Date();
    pNextDate.setDate(pNextDate.getDate() + 2);
    const formattedNextP = `${pad(pNextDate.getDate())}/${pad(pNextDate.getMonth() + 1)}/${pNextDate.getFullYear()} ${pad(pNextDate.getHours())}:${pad(pNextDate.getMinutes())}:${pad(pNextDate.getSeconds())}`;
    if (planned7Idx !== -1 && status6 !== 'Rejected') updates.push({ col: planned7Idx + 1, val: formattedNextP });

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
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Sound Test</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage records pending Sound Test.</p>
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
            'Company', 'Incharge', 'Status 6', 'Sound Test Image',
            'Video Of Zone 2', 'Video Of Zone 4', 'Video Of Zone 7', 'Photo Of Full Kiln'
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
                        {activeTab === 'pending' ? 'No records pending Sound Test.' : 'No history records found.'}
                      </td>
                    </tr>
                  ) : (
                    rows.map((item, index) => {
                      const row = item.rowData;
                      const fileLink = findFileLink(rawHeaders, row, [
                        'Work Order Copy',
                        'Sound Test Image',
                        'Video Of Zone 2',
                        'Video Of Zone 4',
                        'Video Of Zone 7',
                        'Photo Of Full Kiln'
                      ]);
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
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div className="modal-card animate-fade-in" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', borderRadius: '12px', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color)' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', fontWeight: 600 }}>Update Status</h2>
            
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Application Number</label>
              <input type="text" className="form-input" value={selectedItem.appNumber} disabled style={{ opacity: 0.7 }} />
            </div>
            
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Status</label>
              <div className="select-wrapper">
                <select className="form-input" value={status6} onChange={(e) => setStatus6(e.target.value)} style={{ backgroundColor: "#fff" }}>
                  <option value="">Select Status</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
                <ChevronDown size={16} className="select-chevron" />
              </div>
            </div>

            {status6 === 'Approved' && (
              <>
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label">Sound Test Image / Video</label>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="form-input"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    disabled={submitting}
                  />
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem', marginBottom: '1.25rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.75rem' }}>Zone Videos</h3>
                  
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label">Video Of Zone 2</label>
                    <input
                      type="file"
                      accept="video/*,image/*"
                      className="form-input"
                      onChange={(e) => setVideoZone2(e.target.files?.[0] || null)}
                      disabled={submitting}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label">Video Of Zone 4</label>
                    <input
                      type="file"
                      accept="video/*,image/*"
                      className="form-input"
                      onChange={(e) => setVideoZone4(e.target.files?.[0] || null)}
                      disabled={submitting}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label">Video Of Zone 7</label>
                    <input
                      type="file"
                      accept="video/*,image/*"
                      className="form-input"
                      onChange={(e) => setVideoZone7(e.target.files?.[0] || null)}
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.75rem' }}>Kiln Photos</h3>
                  
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label">Photo Of Full Kiln</label>
                    <input
                      type="file"
                      accept="image/*"
                      className="form-input"
                      onChange={(e) => setPhotoFullKiln(e.target.files?.[0] || null)}
                      disabled={submitting}
                    />
                  </div>
                </div>
              </>
            )}
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
              <button className="btn" onClick={() => setShowModal(false)} disabled={submitting} style={{ background: "transparent", border: "1px solid var(--border-color)" }}>
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
        
        
      `}</style>
    </div>
  );
};

export default SoundTest;

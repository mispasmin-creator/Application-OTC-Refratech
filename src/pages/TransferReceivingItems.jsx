import React, { useState, useEffect } from 'react';
import { serialFetch } from '../lib/serialFetch';
import { Search, Loader2, Edit2, Upload, ChevronDown } from 'lucide-react';
import ActionButtons from '../components/ActionButtons';
import { findFileLink } from '../lib/fileLink';
import TableCellValue from '../components/TableCell';

const SCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;
const SHEET_NAME = 'FMS';

const TransferReceivingItems = () => {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [indents, setIndents] = useState([]);
  const [historyIndents, setHistoryIndents] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [masterOptions, setMasterOptions] = useState({});

  // ... (keep state definitions identical)
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  
  // Form fields for modal
  const [incharge, setIncharge] = useState('');
  const [assetName, setAssetName] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('');
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [transporterName, setTransporterName] = useState('');
  const [transportationCharges, setTransportationCharges] = useState('');
  const [transferDate, setTransferDate] = useState('');
  const [weighmentSlip, setWeighmentSlip] = useState('');
  const [weighmentSlipFileObj, setWeighmentSlipFileObj] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [transferStatus, setTransferStatus] = useState('');
  
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
    fetchMasterData();
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

        const options = {
          'Transfer Incharge': new Set(),
          'Incharge': new Set(),
          'Asset Name': new Set(),
          'Unit': new Set(),
          'From Location': new Set(),
          'To Location': new Set(),
          'Transporter Name': new Set(),
          'Transfer Status': new Set()
        };

        const getColIdx = (name) => headers.findIndex(h => h && h.toString().trim().toLowerCase() === name.toLowerCase());

        const colIndices = {
          'Transfer Incharge': getColIdx('Transfer Incharge'),
          'Incharge': getColIdx('Incharge'),
          'Asset Name': getColIdx('Asset Name'),
          'Unit': getColIdx('Unit'),
          'From Location': getColIdx('From Location'),
          'To Location': getColIdx('To Location'),
          'Transporter Name': getColIdx('Transporter Name'),
          'Transfer Status': getColIdx('Transfer Status')
        };

        dataRows.forEach(row => {
          Object.keys(colIndices).forEach(key => {
            const idx = colIndices[key];
            if (idx !== -1 && row[idx] && row[idx].toString().trim() !== '') {
              options[key].add(row[idx].toString().trim());
            }
          });
        });

        const formattedOptions = {};
        Object.keys(options).forEach(key => {
          formattedOptions[key] = Array.from(options[key]).sort();
        });
        setMasterOptions(formattedOptions);
      }
    } catch (e) {
      console.error("Error fetching master data", e);
    }
  };

  const fetchData = async () => {
    setFetching(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await serialFetch(`${SCRIPT_URL}?sheet=${SHEET_NAME}&action=stageSplit&presenceCol=${encodeURIComponent('Planned 13')}&completeCol=${encodeURIComponent('Actual 13')}`);
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
    setIncharge('');
    setAssetName('');
    setQty('');
    setUnit('');
    setFromLocation('');
    setToLocation('');
    setTransporterName('');
    setTransportationCharges('');
    setTransferDate('');
    setWeighmentSlip('');
    setWeighmentSlipFileObj(null);
    setRemarks('');
    setTransferStatus('');
    
    setShowModal(true);
  };

  const handleSubmit = async () => {
    // Validate required fields (can be customized)
    if (!transferStatus) {
      return alert('Please select a Transfer Status');
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
    // 'Incharge' and 'Qty' also exist earlier in the sheet (from the original order form),
    // so use the LAST matching column for these two — the one belonging to this Transfer stage.
    const findLastIdx = (name, fallbackIdx = -1) => {
      if (!headers || !Array.isArray(headers)) return fallbackIdx;
      const targetClean = cleanH(name);
      for (let i = headers.length - 1; i >= 0; i--) {
        if (headers[i] && cleanH(headers[i]) === targetClean) return i;
      }
      return fallbackIdx;
    };

    // Core workflow columns
    const actual13Idx = findIdx('Actual 13', 79);
    
    // Handle File Upload to Drive
    let finalWeighmentSlipUrl = weighmentSlip;
    if (weighmentSlipFileObj) {
      const uploadedUrl = await uploadFile(weighmentSlipFileObj);
      if (uploadedUrl) finalWeighmentSlipUrl = uploadedUrl;
    }

    // Custom payload columns
    const cols = {
      'Transfer Incharge': incharge,
      'Asset Name': assetName,
      'Transfer Qty': qty,
      'Unit': unit,
      'From Location': fromLocation,
      'To Location': toLocation,
      'Transporter Name': transporterName,
      'Transportation Charges': transportationCharges,
      'Transfer Date': transferDate,
      'Weighment Slip': finalWeighmentSlipUrl,
      'Remarks': remarks,
      'Transfer Status': transferStatus
    };
    
    // Format timestamp: dd/mm/yyyy hh:mm:ss
    const pad = (n) => n.toString().padStart(2, '0');
    const d = new Date();
    const formattedDate = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    
    const updates = [];
    
    if (actual13Idx !== -1) updates.push({ col: actual13Idx + 1, val: formattedDate });
    
    Object.keys(cols).forEach(colName => {
      let idx = -1;
      if (colName === 'Transfer Incharge') {
        idx = findIdx('Transfer Incharge');
        if (idx === -1) idx = findLastIdx('Incharge');
      } else if (colName === 'Transfer Qty') {
        idx = findIdx('Transfer Qty');
        if (idx === -1) idx = findLastIdx('Qty');
      } else {
        idx = findIdx(colName);
      }
      if (idx !== -1 && cols[colName]) {
        updates.push({ col: idx + 1, val: cols[colName] });
      }
    });
    
    if (updates.length === 0) {
      alert("Could not find the target columns in the sheet headers.");
      setSubmitting(false);
      return;
    }

    try {
      const promises = updates.map(u => {
        const params = new URLSearchParams();
        params.append('sheetName', SHEET_NAME);
        params.append('action', 'updateCell');
        params.append('rowIndex', selectedItem.originalIndex);
        params.append('columnIndex', u.col);
        params.append('value', u.val);
        
        return serialFetch(SCRIPT_URL, { method: 'POST', body: params }).then(r => r.json());
      });
      
      const results = await Promise.all(promises);
      const allSuccess = results.every(r => r.success);
      
      if (allSuccess) {
        setMessage({ type: 'success', text: 'Transfer details updated successfully!' });
        window.dispatchEvent(new Event('fms-updated'));
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

  // Helper for Dropdowns
  const renderSelect = (label, value, setter, optionsKey) => {
    let opts = masterOptions[optionsKey] ? Array.from(masterOptions[optionsKey]) : [];
    if (opts.length === 0 && optionsKey === 'Transfer Incharge' && masterOptions['Incharge']) {
      opts = Array.from(masterOptions['Incharge']);
    }
    return (
      <div className="form-group">
        <label className="form-label">{label}</label>
        <div className="select-wrapper">
          <select
            className="form-input"
            value={value}
            onChange={(e) => setter(e.target.value)}
            style={{ backgroundColor: "#fff" }}
          >
            <option value="">Select {label}</option>
            {opts.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <ChevronDown size={16} className="select-chevron" />
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Make Transfer / Receiving Items</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage records pending Transfer or Receiving Items.</p>
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
            'Company', 'Incharge', 'Transfer Status'
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
                        {activeTab === 'pending' ? 'No records pending Transfer/Receiving.' : 'No history records found.'}
                      </td>
                    </tr>
                  ) : (
                    rows.map((item, index) => {
                      const row = item.rowData;
                      const fileLink = findFileLink(rawHeaders, row, ['Weighment Slip', 'Work Order Copy']);
                      const rowActions = [
                        ...(activeTab === 'pending' ? [{ key: 'edit', label: 'Update', onClick: () => openModal(item) }] : []),
                        ...(fileLink ? [{ key: 'download', label: 'Download Weighment Slip', href: fileLink }] : []),
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
          <div className="glass-panel animate-fade-in" style={{ padding: '2rem', borderRadius: '12px', minWidth: '500px', maxWidth: '90%', border: '1px solid var(--border-color)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Transfer / Receiving Details</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ marginBottom: '0.5rem', gridColumn: '1 / -1' }}>
                <label className="form-label">Application Number</label>
                <input type="text" className="form-input" value={selectedItem.appNumber} disabled style={{ opacity: 0.7 }} />
              </div>
              
              {renderSelect('Transfer Incharge', incharge, setIncharge, 'Transfer Incharge')}
              {renderSelect('Asset Name', assetName, setAssetName, 'Asset Name')}
              
              <div className="form-group">
                <label className="form-label">Transfer Qty</label>
                <input type="number" className="form-input" placeholder="Transfer Qty" value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
              
              {renderSelect('Unit', unit, setUnit, 'Unit')}
              {renderSelect('From Location', fromLocation, setFromLocation, 'From Location')}
              {renderSelect('To Location', toLocation, setToLocation, 'To Location')}
              {renderSelect('Transporter Name', transporterName, setTransporterName, 'Transporter Name')}
              
              <div className="form-group">
                <label className="form-label">Transportation Charges</label>
                <input type="number" className="form-input" placeholder="Charges" value={transportationCharges} onChange={(e) => setTransportationCharges(e.target.value)} />
              </div>
              
              <div className="form-group">
                <label className="form-label">Transfer Date</label>
                <input type="date" className="form-input" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} />
              </div>
              
              {renderSelect('Transfer Status', transferStatus, setTransferStatus, 'Transfer Status')}
              
              <div style={{ marginBottom: '1rem', gridColumn: '1 / -1' }}>
                <label className="form-label">Remarks</label>
                <textarea className="form-input" placeholder="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows="3"></textarea>
              </div>
              
              <div style={{ marginBottom: '1rem', gridColumn: '1 / -1' }}>
                <label className="form-label">Weighment Slip</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="file" 
                    className="form-input" 
                    style={{ opacity: 0, position: 'absolute', inset: 0, cursor: 'pointer' }}
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        setWeighmentSlipFileObj(file);
                        setWeighmentSlip(file.name);
                      }
                    }} 
                  />
                  <div className="form-input" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(15, 23, 42, 0.5)' }}>
                    <Upload size={16} />
                    {weighmentSlipFileObj ? weighmentSlipFileObj.name : (weighmentSlip ? 'File attached' : 'Click to upload Weighment Slip')}
                  </div>
                </div>
              </div>

            </div>
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="btn" onClick={() => setShowModal(false)} disabled={submitting} style={{ background: "transparent", border: "1px solid var(--border-color)" }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> : 'Submit Transfer Details'}
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

export default TransferReceivingItems;

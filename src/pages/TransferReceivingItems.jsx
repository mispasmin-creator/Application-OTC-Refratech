import React, { useState, useEffect } from 'react';
import { serialFetch } from '../lib/serialFetch';
import { Search, Loader2, RefreshCcw, Edit2, Upload, X } from 'lucide-react';
import ActionButtons from '../components/ActionButtons';
import ApplicationTracker from '../components/ApplicationTracker';
import { findFileLink } from '../lib/fileLink';

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
  const [remarks, setRemarks] = useState('');
  const [transferStatus, setTransferStatus] = useState('');
  
  const [submitting, setSubmitting] = useState(false);

  // View (timeline) modal state
  const [viewItem, setViewItem] = useState(null);

  useEffect(() => {
    fetchData();
    fetchMasterData();
  }, []);

  const fetchMasterData = async () => {
    try {
      const response = await serialFetch(`${SCRIPT_URL}?sheet=Master`);
      const result = await response.json();
      if (result.success && result.data && result.data.length > 0) {
        const headers = result.data[0];
        const dataRows = result.data.slice(1);
        
        const options = {
          'Incharge': new Set(),
          'Asset Name': new Set(),
          'Unit': new Set(),
          'From Location': new Set(),
          'To Location': new Set(),
          'Transporter Name': new Set(),
          'Transfer Status': new Set()
        };

        const getColIdx = (name) => {
           let idx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === name.toLowerCase());
           if (idx === -1 && name === 'Incharge') idx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'supervisor name');
           if (idx === -1 && name === 'To Location') idx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'location');
           if (idx === -1 && name === 'From Location') idx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'location');
           return idx;
        };

        const colIndices = {
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
            if (idx !== -1 && row[idx]) {
              options[key].add(row[idx]);
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
      const response = await serialFetch(`${SCRIPT_URL}?sheet=${SHEET_NAME}`);
      const result = await response.json();
      if (result.success && result.data && result.data.length > 0) {
        
        // Use row 5 (index 4) as headers to match sheet exactly
        const headers = result.data.length > 4 ? result.data[4] : result.data[0];
        
        const findIdx = (name) => headers.findIndex(h => h && h.toString().trim().toLowerCase() === name.toLowerCase());
        
        // Find indices for filtering
        const planned13Idx = findIdx('Planned13');
        const actual13Idx = findIdx('Actual 13');
        
        // Data starts from row 6, which is index 5
        const allMapped = result.data.slice(6).map((row, idx) => ({ rowData: row, originalIndex: idx + 7 }));

        const filteredRows = allMapped.filter(item => {
          const row = item.rowData;
          const hasPlanned13 = planned13Idx !== -1 && row[planned13Idx] !== undefined && row[planned13Idx] !== null && row[planned13Idx].toString().trim() !== '';
          const noActual13 = actual13Idx === -1 || row[actual13Idx] === undefined || row[actual13Idx] === null || row[actual13Idx].toString().trim() === '';
          return hasPlanned13 && noActual13;
        });

        const historyRows = allMapped.filter(item => {
          const row = item.rowData;
          const hasActual13 = actual13Idx !== -1 && row[actual13Idx] !== undefined && row[actual13Idx] !== null && row[actual13Idx].toString().trim() !== '';
          return hasActual13;
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
    setRemarks('');
    setTransferStatus('');
    
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
    // Validate required fields (can be customized)
    if (!transferStatus) {
      return alert('Please select a Transfer Status');
    }
    
    setSubmitting(true);
    const headers = indents[0].rowData;
    const findIdx = (name) => headers.findIndex(h => h && h.toString().trim().toLowerCase() === name.toLowerCase());
    
    // Core workflow columns
    const actual13Idx = findIdx('Actual 13');
    
    // Custom payload columns
    const cols = {
      'Incharge': incharge,
      'Asset Name': assetName,
      'Qty': qty,
      'Unit': unit,
      'From Location': fromLocation,
      'To Location': toLocation,
      'Transporter Name': transporterName,
      'Transportation Charges': transportationCharges,
      'Transfer Date': transferDate,
      'Weighment Slip': weighmentSlip,
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
      const idx = findIdx(colName);
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
        
        return fetch(SCRIPT_URL, { method: 'POST', body: params }).then(r => r.json());
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
  const renderSelect = (label, value, setter, optionsKey) => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <select 
        className="form-input" 
        value={value} 
        onChange={(e) => setter(e.target.value)} 
        style={{ backgroundColor: "#fff" }}
      >
        <option value="">Select {label}</option>
        {masterOptions[optionsKey] && masterOptions[optionsKey].map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Make Transfer / Receiving Items</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage records pending Transfer or Receiving Items.</p>
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
                        {activeTab === 'pending' ? 'No records pending Transfer/Receiving.' : 'No history records found.'}
                      </td>
                    </tr>
                  ) : (
                    rows.map((item, index) => {
                      const row = item.rowData;
                      const fileLink = findFileLink(rawHeaders, row, ['Weighment Slip', 'Work Order Copy']);
                      const rowActions = [
                        { key: 'view', label: 'View Details', onClick: () => setViewItem({ headers: rawHeaders, rowData: row }) },
                        ...(activeTab === 'pending' ? [{ key: 'edit', label: 'Update', onClick: () => openModal(item) }] : []),
                        ...(fileLink ? [{ key: 'download', label: 'Download Weighment Slip', href: fileLink }] : []),
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
          <div className="glass-panel animate-fade-in" style={{ padding: '2rem', borderRadius: '12px', minWidth: '500px', maxWidth: '90%', border: '1px solid var(--border-color)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Transfer / Receiving Details</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ marginBottom: '0.5rem', gridColumn: '1 / -1' }}>
                <label className="form-label">Application Number</label>
                <input type="text" className="form-input" value={selectedItem.appNumber} disabled style={{ opacity: 0.7 }} />
              </div>
              
              {renderSelect('Incharge', incharge, setIncharge, 'Incharge')}
              {renderSelect('Asset Name', assetName, setAssetName, 'Asset Name')}
              
              <div className="form-group">
                <label className="form-label">Qty</label>
                <input type="number" className="form-input" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} />
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
                    onChange={(e) => handleFileUpload(e, setWeighmentSlip)} 
                  />
                  <div className="form-input" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(15, 23, 42, 0.5)' }}>
                    <Upload size={16} />
                    {weighmentSlip ? 'File attached' : 'Click to upload Weighment Slip'}
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

export default TransferReceivingItems;

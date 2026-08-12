import React, { useState, useEffect } from 'react';
import { serialFetch } from '../lib/serialFetch';
import { Loader2, RefreshCcw, Edit2, Upload } from 'lucide-react';

const SCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;
const SHEET_NAME = 'FMS';

const TransferReceivingItems = () => {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [indents, setIndents] = useState([]);
  const [historyIndents, setHistoryIndents] = useState([]);
  const [fetching, setFetching] = useState(true);
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
        
        const findIdx = (name) => headers.findIndex(h => h && h.toString().trim() === name);
        
        // Find indices for filtering
        const planned13Idx = findIdx('Planned13');
        const actual13Idx = findIdx('Actual 13');
        
        // Data starts from row 6, which is index 5
        const allMapped = result.data.slice(5).map((row, idx) => ({ rowData: row, originalIndex: idx + 6 }));

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
    setSelectedItem({ originalIndex: item.originalIndex, appNumber });
    
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
    const findIdx = (name) => headers.findIndex(h => h && h.toString().trim() === name);
    
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
    <div style={{ marginBottom: '1rem' }}>
      <label className="form-label">{label}</label>
      <select 
        className="form-input" 
        value={value} 
        onChange={(e) => setter(e.target.value)} 
        style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)' }}
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
            {activeTab === 'pending' ? 'Pending Transfers' : 'History Records'}
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
                        {activeTab === 'pending' ? 'No records pending Transfer/Receiving.' : 'No history records found.'}
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
          <div className="glass-panel animate-fade-in" style={{ padding: '2rem', borderRadius: '12px', minWidth: '500px', maxWidth: '90%', border: '1px solid var(--border-color)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Transfer / Receiving Details</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ marginBottom: '0.5rem', gridColumn: '1 / -1' }}>
                <label className="form-label">Application Number</label>
                <input type="text" className="form-input" value={selectedItem.appNumber} disabled style={{ opacity: 0.7 }} />
              </div>
              
              {renderSelect('Incharge', incharge, setIncharge, 'Incharge')}
              {renderSelect('Asset Name', assetName, setAssetName, 'Asset Name')}
              
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Qty</label>
                <input type="number" className="form-input" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
              
              {renderSelect('Unit', unit, setUnit, 'Unit')}
              {renderSelect('From Location', fromLocation, setFromLocation, 'From Location')}
              {renderSelect('To Location', toLocation, setToLocation, 'To Location')}
              {renderSelect('Transporter Name', transporterName, setTransporterName, 'Transporter Name')}
              
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Transportation Charges</label>
                <input type="number" className="form-input" placeholder="Charges" value={transportationCharges} onChange={(e) => setTransportationCharges(e.target.value)} />
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
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
              <button className="btn" onClick={() => setShowModal(false)} disabled={submitting} style={{ background: 'rgba(255,255,255,0.05)' }}>
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
        
        tbody tr:hover td {
          background: rgba(255, 255, 255, 0.05);
        }
      `}</style>
    </div>
  );
};

export default TransferReceivingItems;

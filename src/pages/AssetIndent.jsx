import React, { useState, useEffect } from 'react';
import { serialFetch } from '../lib/serialFetch';
import { Search, Loader2, Plus, X, Upload, CheckCircle2, ChevronDown, Eye } from 'lucide-react';
import TableCellValue from '../components/TableCell';
import AssetDetailsModal from '../components/AssetDetailsModal';

const SCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;
const SHEET_NAME = 'Asset Transfer';

const DEFAULT_HEADERS = [
  'Transfer ID',
  'Transfer Date',
  'Incharge',
  'Asset Name',
  'Qty',
  'Unit',
  'From Location',
  'To Location',
  'Transporter Status',
  'Transporter Name',
  'Transportation Charges ',
  'Asset Image',
  'Weighment Slip',
  'Remarks'
];

const emptyFormData = {
  transferId: '',
  incharge: '',
  assetName: '',
  qty: '',
  applicationNo: '',
  fromLocation: '',
  toLocation: '',
  transferDate: new Date().toISOString().split('T')[0],
  remarks: '',
  transporterName: '',
  transportationCharges: '',
  unit: '',
  transferStatus: ''
};

const AssetIndent = () => {
  const [rows, setRows] = useState([]);
  const [rawSheetHeaders, setRawSheetHeaders] = useState([]);
  const [headers, setHeaders] = useState(DEFAULT_HEADERS);
  const [fetching, setFetching] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState(emptyFormData);
  const [assetImageFile, setAssetImageFile] = useState(null);
  const [weighmentSlipFile, setWeighmentSlipFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // View Details Modal State
  const [selectedDetailsRow, setSelectedDetailsRow] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Master dropdown options
  const [masterOptions, setMasterOptions] = useState({
    incharges: [],
    assetNames: [],
    locations: [],
    transporters: [],
    units: [],
    statuses: ['In Transit', 'Dispatched', 'Transferred', 'Pending', 'Received']
  });

  useEffect(() => {
    fetchData();
    fetchMasterOptions();
  }, []);

  const cleanH = (s) => (s ? s.toString().trim().toLowerCase().replace(/[\s\u00a0\r\n\t_-]+/g, '') : '');

  const fetchMasterOptions = async () => {
    try {
      const response = await serialFetch(`${SCRIPT_URL}?sheet=Master`);
      const result = await response.json();
      if (result.success && result.data && result.data.length > 0) {
        const mHeaders = result.data[0];
        const dataRows = result.data.slice(1);

        const getIdx = (name) => {
          const target = cleanH(name);
          let idx = mHeaders.findIndex(h => cleanH(h) === target);
          if (idx !== -1) return idx;
          return mHeaders.findIndex(h => cleanH(h).includes(target));
        };
        const inchargeIdx = getIdx('Incharge');
        const assetIdx = getIdx('Asset Name');
        const fromLocIdx = getIdx('From Location');
        const toLocIdx = getIdx('To Location');
        const transpIdx = getIdx('Transporter Name');
        const unitIdx = getIdx('Unit');
        const statusIdx = getIdx('Transfer Status');

        const inchargeSet = new Set();
        const assetSet = new Set();
        const locSet = new Set();
        const transpSet = new Set();
        const unitSet = new Set();
        const statusSet = new Set(['In Transit', 'Dispatched', 'Transferred', 'Pending', 'Received']);

        dataRows.forEach(r => {
          if (!r) return;
          if (inchargeIdx !== -1 && r[inchargeIdx]?.toString().trim()) inchargeSet.add(r[inchargeIdx].toString().trim());
          if (assetIdx !== -1 && r[assetIdx]?.toString().trim()) assetSet.add(r[assetIdx].toString().trim());
          if (fromLocIdx !== -1 && r[fromLocIdx]?.toString().trim()) locSet.add(r[fromLocIdx].toString().trim());
          if (toLocIdx !== -1 && r[toLocIdx]?.toString().trim()) locSet.add(r[toLocIdx].toString().trim());
          if (transpIdx !== -1 && r[transpIdx]?.toString().trim()) transpSet.add(r[transpIdx].toString().trim());
          if (unitIdx !== -1 && r[unitIdx]?.toString().trim()) unitSet.add(r[unitIdx].toString().trim());
          if (statusIdx !== -1 && r[statusIdx]?.toString().trim()) statusSet.add(r[statusIdx].toString().trim());
        });

        setMasterOptions({
          incharges: Array.from(inchargeSet).sort(),
          assetNames: Array.from(assetSet).sort(),
          locations: Array.from(locSet).sort(),
          transporters: Array.from(transpSet).sort(),
          units: Array.from(unitSet),
          statuses: Array.from(statusSet)
        });
      }
    } catch (e) {
      console.warn('Error fetching master options:', e);
    }
  };

  const fetchData = async () => {
    setFetching(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await serialFetch(`${SCRIPT_URL}?sheet=${encodeURIComponent(SHEET_NAME)}`);
      const result = await response.json();

      if (result.success && result.data && result.data.length > 0) {
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(result.data.length, 7); i++) {
          if (result.data[i] && result.data[i].some(h => cleanH(h) === 'transferid' || cleanH(h) === 'assetname')) {
            headerRowIndex = i;
            break;
          }
        }

        const rawHeaders = result.data[headerRowIndex] || [];
        setRawSheetHeaders(rawHeaders);

        // Map to Indent specific columns
        const matchedCols = DEFAULT_HEADERS.map(target => {
          const tClean = cleanH(target);
          let colIdx = rawHeaders.findIndex(h => cleanH(h) === tClean);
          if (colIdx === -1 && tClean.includes('transporterstatus')) {
            colIdx = rawHeaders.findIndex(h => cleanH(h) === 'transferstatus');
          } else if (colIdx === -1 && tClean.includes('transferstatus')) {
            colIdx = rawHeaders.findIndex(h => cleanH(h) === 'transporterstatus');
          }
          return { label: target, colIdx };
        });

        setHeaders(DEFAULT_HEADERS);

        const dataRows = result.data.slice(headerRowIndex + 1)
          .map((row, idx) => {
            const mappedRow = matchedCols.map(col => col.colIdx !== -1 ? row[col.colIdx] : '');
            return {
              rowData: mappedRow,
              rawRow: row,
              originalIndex: idx + headerRowIndex + 2
            };
          })
          .filter(item => item.rowData.some(cell => cell && cell.toString().trim() !== ''));

        setRows(dataRows);
      } else {
        setHeaders(DEFAULT_HEADERS);
        setRows([]);
      }
    } catch (err) {
      console.error('Error fetching Asset Indent data:', err);
      setHeaders(DEFAULT_HEADERS);
      setRows([]);
    } finally {
      setFetching(false);
    }
  };

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

  const handleOpenCreateModal = () => {
    // Calculate next TID
    let maxNum = 0;
    rows.forEach(item => {
      const tid = item.rowData[0]; // Transfer ID is col 0
      if (tid) {
        const m = tid.toString().match(/(\d+)/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > maxNum) maxNum = n;
        }
      }
    });
    const nextTid = `TID-${String(maxNum + 1).padStart(2, '0')}`;

    setFormData({
      ...emptyFormData,
      transferId: nextTid,
      transferDate: new Date().toISOString().split('T')[0]
    });
    setAssetImageFile(null);
    setWeighmentSlipFile(null);
    setShowCreateModal(true);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.assetName || !formData.qty) {
      alert('Please fill required fields: Asset Name and Qty.');
      return;
    }
    if (!formData.transferStatus) {
      alert('Please select Transporter Status (Yes or No).');
      return;
    }

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      // 1. Format timestamp in dd/mm/yyyy hh:mm:ss proper date format
      const pad = (n) => n.toString().padStart(2, '0');
      const now = new Date();
      const formattedTimestamp = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

      // 2. Format transfer date to dd/mm/yyyy
      let formattedTransferDate = formData.transferDate || '';
      if (formattedTransferDate && formattedTransferDate.includes('-')) {
        const [y, m, d] = formattedTransferDate.split('-');
        formattedTransferDate = `${d}/${m}/${y}`;
      }

      // 3. Upload files to Google Drive if selected
      let assetImageUrl = '';
      if (assetImageFile) {
        assetImageUrl = await uploadFile(assetImageFile);
      }

      let weighmentSlipUrl = '';
      if (weighmentSlipFile) {
        weighmentSlipUrl = await uploadFile(weighmentSlipFile);
      }

      // 4. Build row data mapped to Sheet columns
      const fullHeaders = rawSheetHeaders.length > 0 ? rawSheetHeaders : [
        "Timestamp","Transfer ID","Incharge","Asset Name","Qty","Application No.",
        "From Location","To Location","Transfer Date","Asset Image","Remarks",
        "Transporter Name","Transportation Charges ","Weighment Slip","Unit",
        "Transfer Status","Site Incharge","Party Name","Firm Name",
        "Planned","Actual","Delay","Received Asset Image",
        "Planned1","Actual1","Delay1"
      ];

      const newRow = new Array(fullHeaders.length).fill('');
      const setCol = (targetName, val) => {
        const tClean = cleanH(targetName);
        const idx = fullHeaders.findIndex(h => cleanH(h) === tClean);
        if (idx !== -1) {
          newRow[idx] = val || '';
        }
      };

      const isTransporterYes = formData.transferStatus === 'Yes';
      const finalTransporterName = isTransporterYes ? formData.transporterName : '';
      const finalTransportationCharges = isTransporterYes ? formData.transportationCharges : '';

      setCol('Timestamp', formattedTimestamp);
      setCol('Transfer ID', formData.transferId);
      setCol('Incharge', formData.incharge);
      setCol('Asset Name', formData.assetName);
      setCol('Qty', formData.qty);
      setCol('Application No.', formData.applicationNo);
      setCol('From Location', formData.fromLocation);
      setCol('To Location', formData.toLocation);
      setCol('Transfer Date', formattedTransferDate);
      setCol('Asset Image', assetImageUrl);
      setCol('Remarks', formData.remarks);
      setCol('Transporter Name', finalTransporterName);
      setCol('Transportation Charges ', finalTransportationCharges);
      setCol('Weighment Slip', weighmentSlipUrl);
      setCol('Unit', formData.unit);
      setCol('Transfer Status', formData.transferStatus || 'No');
      setCol('Transporter Status', formData.transferStatus || 'No');

      // 5. Submit to Google Sheet via AppScript
      const params = new URLSearchParams();
      params.append('sheetName', SHEET_NAME);
      params.append('action', 'insert');
      params.append('rowData', JSON.stringify(newRow));

      const response = await serialFetch(SCRIPT_URL, {
        method: 'POST',
        body: params
      });
      const result = await response.json();

      if (result.success) {
        setMessage({
          type: 'success',
          text: `Asset Indent (${formData.transferId}) created successfully!`
        });
        setShowCreateModal(false);
        fetchData();
      } else {
        throw new Error(result.error || 'Failed to submit indent record.');
      }
    } catch (err) {
      console.error('Submit Error:', err);
      alert(err.message || 'Error submitting asset indent record.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRows = rows.filter(item => {
    if (!searchQuery) return true;
    return item.rowData.some(cell =>
      cell && cell.toString().toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Asset Indent</h1>
          <p style={{ color: 'var(--text-muted)' }}>Asset transfer initiation, dispatch details, and vehicle information.</p>
        </div>

        {/* Create Indent Button */}
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleOpenCreateModal}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.95rem',
            boxShadow: '0 4px 12px rgba(27, 91, 176, 0.25)'
          }}
        >
          <Plus size={18} /> Create Indent
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

      <div className="table-container">
        <div style={{ position: 'relative', width: '100%', maxWidth: '100%', marginBottom: '1.5rem', display: 'flex' }}>
          <Search size={18} style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by Transfer ID, Asset Name, Location, Transporter, or any keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input"
            style={{ width: '100%', paddingLeft: '3rem', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '1rem' }}
          />
        </div>

        {fetching ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={32} className="animate-spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
            <p>Loading Asset Indent records...</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ width: '65px' }}>Action</th>
                  {headers.map((h, idx) => (
                    <th key={idx}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={headers.length + 1} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No asset indent records found. Click "Create Indent" to add one.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((item, index) => (
                    <tr key={index}>
                      <td data-label="Action" style={{ width: '65px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDetailsRow(item);
                            setShowDetailsModal(true);
                          }}
                          title="View Complete Details"
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            padding: '0.45rem 0.55rem',
                            cursor: 'pointer',
                            color: 'var(--text-main)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--primary-color)';
                            e.currentTarget.style.color = '#fff';
                            e.currentTarget.style.borderColor = 'var(--primary-color)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                            e.currentTarget.style.color = 'var(--text-main)';
                            e.currentTarget.style.borderColor = 'var(--border-color)';
                          }}
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                      {headers.map((h, idx) => (
                        <td key={idx} data-label={h}>
                          <TableCellValue value={item.rowData[idx]} label={h} />
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* VIEW ALL DETAILS MODAL */}
      <AssetDetailsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        headers={rawSheetHeaders.length > 0 ? rawSheetHeaders : headers}
        rawRow={selectedDetailsRow?.rawRow}
        title={`Asset Transfer Details - ${selectedDetailsRow?.rawRow?.[1] || selectedDetailsRow?.rowData?.[0] || ''}`}
      />

      {/* CREATE INDENT MODAL POPUP */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => !submitting && setShowCreateModal(false)}>
          <div
            className="modal-card animate-fade-in"
            style={{ maxWidth: '820px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '2.25rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 600 }}>Create Asset Indent</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Fill in the asset transfer and dispatch details below.</p>
              </div>
              <button
                type="button"
                onClick={() => !submitting && setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
                
                {/* Transfer ID (Auto-generated) */}
                <div className="form-group">
                  <label className="form-label">Transfer ID</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.transferId}
                    onChange={(e) => handleInputChange('transferId', e.target.value)}
                    placeholder="e.g. TID-01"
                    style={{ fontWeight: 600 }}
                  />
                </div>

                {/* Transfer Date */}
                <div className="form-group">
                  <label className="form-label">Transfer Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.transferDate}
                    onChange={(e) => handleInputChange('transferDate', e.target.value)}
                    required
                  />
                </div>

                {/* Incharge */}
                <div className="form-group">
                  <label className="form-label">Incharge</label>
                  <div className="select-wrapper">
                    <select
                      className="form-input"
                      value={formData.incharge}
                      onChange={(e) => handleInputChange('incharge', e.target.value)}
                      disabled={submitting}
                    >
                      <option value="">Select Incharge</option>
                      {masterOptions.incharges.map((inc, i) => (
                        <option key={i} value={inc}>{inc}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="select-chevron" />
                  </div>
                </div>

                {/* Asset Name */}
                <div className="form-group">
                  <label className="form-label">
                    Asset Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div className="select-wrapper">
                    <select
                      className="form-input"
                      value={formData.assetName}
                      onChange={(e) => handleInputChange('assetName', e.target.value)}
                      required
                      disabled={submitting}
                    >
                      <option value="">Select Asset Name</option>
                      {masterOptions.assetNames.map((ast, i) => (
                        <option key={i} value={ast}>{ast}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="select-chevron" />
                  </div>
                </div>

                {/* Qty */}
                <div className="form-group">
                  <label className="form-label">Qty *</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    placeholder="Enter Quantity"
                    value={formData.qty}
                    onChange={(e) => handleInputChange('qty', e.target.value)}
                    required
                  />
                </div>

                {/* Unit */}
                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <div className="select-wrapper">
                    <select
                      className="form-input"
                      value={formData.unit}
                      onChange={(e) => handleInputChange('unit', e.target.value)}
                      disabled={submitting}
                    >
                      <option value="">Select Unit</option>
                      {masterOptions.units.map((u, i) => (
                        <option key={i} value={u}>{u}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="select-chevron" />
                  </div>
                </div>

                {/* Application No. */}
                <div className="form-group">
                  <label className="form-label">Application No.</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. AON-001"
                    value={formData.applicationNo}
                    onChange={(e) => handleInputChange('applicationNo', e.target.value)}
                  />
                </div>

                {/* From Location */}
                <div className="form-group">
                  <label className="form-label">From Location</label>
                  <div className="select-wrapper">
                    <select
                      className="form-input"
                      value={formData.fromLocation}
                      onChange={(e) => handleInputChange('fromLocation', e.target.value)}
                      disabled={submitting}
                    >
                      <option value="">Select From Location</option>
                      {masterOptions.locations.map((loc, i) => (
                        <option key={i} value={loc}>{loc}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="select-chevron" />
                  </div>
                </div>

                {/* To Location */}
                <div className="form-group">
                  <label className="form-label">To Location</label>
                  <div className="select-wrapper">
                    <select
                      className="form-input"
                      value={formData.toLocation}
                      onChange={(e) => handleInputChange('toLocation', e.target.value)}
                      disabled={submitting}
                    >
                      <option value="">Select To Location</option>
                      {masterOptions.locations.map((loc, i) => (
                        <option key={i} value={loc}>{loc}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="select-chevron" />
                  </div>
                </div>

                {/* Transporter Status Dropdown (Yes / No) */}
                <div className="form-group">
                  <label className="form-label">
                    Transporter Status <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div className="select-wrapper">
                    <select
                      className="form-input"
                      value={formData.transferStatus}
                      onChange={(e) => handleInputChange('transferStatus', e.target.value)}
                      required
                      disabled={submitting}
                    >
                      <option value="">Select Status</option>
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                    <ChevronDown size={16} className="select-chevron" />
                  </div>
                </div>

                {/* Conditional Transporter Fields (When Yes) */}
                {formData.transferStatus === 'Yes' && (
                  <>
                    {/* Transporter Name */}
                    <div className="form-group animate-fade-in">
                      <label className="form-label">Transporter Name</label>
                      <div className="select-wrapper">
                        <select
                          className="form-input"
                          value={formData.transporterName}
                          onChange={(e) => handleInputChange('transporterName', e.target.value)}
                          disabled={submitting}
                        >
                          <option value="">Select Transporter Name</option>
                          {masterOptions.transporters.map((t, i) => (
                            <option key={i} value={t}>{t}</option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="select-chevron" />
                      </div>
                    </div>

                    {/* Transportation Charges */}
                    <div className="form-group animate-fade-in">
                      <label className="form-label">Transportation Charges</label>
                      <input
                        type="number"
                        step="any"
                        className="form-input"
                        placeholder="Charges in ₹"
                        value={formData.transportationCharges}
                        onChange={(e) => handleInputChange('transportationCharges', e.target.value)}
                      />
                    </div>
                  </>
                )}

                {/* Asset Image Upload */}
                <div className="form-group">
                  <label className="form-label">Asset Image</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="file"
                      accept="image/*"
                      className="form-input"
                      style={{ opacity: 0, position: 'absolute', inset: 0, cursor: 'pointer', zIndex: 2 }}
                      onChange={(e) => setAssetImageFile(e.target.files[0] || null)}
                    />
                    <div className="form-input" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(255,255,255,0.04)' }}>
                      <Upload size={16} />
                      <span style={{ fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {assetImageFile ? assetImageFile.name : 'Click to upload Asset Image'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Weighment Slip Upload */}
                <div className="form-group">
                  <label className="form-label">Weighment Slip</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="form-input"
                      style={{ opacity: 0, position: 'absolute', inset: 0, cursor: 'pointer', zIndex: 2 }}
                      onChange={(e) => setWeighmentSlipFile(e.target.files[0] || null)}
                    />
                    <div className="form-input" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(255,255,255,0.04)' }}>
                      <Upload size={16} />
                      <span style={{ fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {weighmentSlipFile ? weighmentSlipFile.name : 'Click to upload Weighment Slip'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Remarks (Full width) */}
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Remarks</label>
                  <textarea
                    rows={2}
                    className="form-input"
                    placeholder="Enter any notes or remarks..."
                    value={formData.remarks}
                    onChange={(e) => handleInputChange('remarks', e.target.value)}
                    style={{ resize: 'vertical' }}
                  />
                </div>

              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submitting}
                  style={{ background: 'transparent', border: '1px solid var(--border-color)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  Submit Indent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetIndent;

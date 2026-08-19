import React, { useState, useEffect } from 'react';
import { serialFetch } from '../lib/serialFetch';
import { Plus, X, ChevronDown, Loader2, Search } from 'lucide-react';
import ActionButtons from '../components/ActionButtons';
import TableCellValue from '../components/TableCell';
import { findFileLink } from '../lib/fileLink';

const SCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;
const FMS_SHEET = 'FMS';
const MASTER_SHEET = 'Master';
const PLANNING_SHEET = 'Application Planning';

const TYPE_OF_WORK_OPTIONS = ['We will do', 'We will sublet'];

// Column order must match row 6 of the "Application Planning" sheet exactly.
const PLANNING_HEADERS = [
  'Timestamp', 'Application No.', 'Serial No.', 'Site Incharge Name', 'Type Of Work',
  'Name Of Ther Vendor', 'Rate Details', 'Qty Of Material', 'Vendor Order Copy',
  'Party Name', 'Pan No.', 'Pan Photo', 'Gst No.', 'Gst Copy', 'Planned 1', 'Actual 1',
];

const OrderFormPlanning = () => {
  const [fetching, setFetching] = useState(true);
  const [pendingRows, setPendingRows] = useState([]); // [{ appNumber, serialNumber, partyName }]
  const [siteInchargeOptions, setSiteInchargeOptions] = useState([]);
  const [vendorOptions, setVendorOptions] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Application Planning table
  const [planningHeaders, setPlanningHeaders] = useState([]);
  const [planningRows, setPlanningRows] = useState([]); // [{ rowData, originalIndex }]
  const [tableFetching, setTableFetching] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [applicationNumber, setApplicationNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [siteIncharge, setSiteIncharge] = useState('');
  const [typeOfWork, setTypeOfWork] = useState('');

  // "We will do" field
  const [workOrderCopyFile, setWorkOrderCopyFile] = useState(null);

  // "We will sublet" fields
  const [vendorName, setVendorName] = useState('');
  const [rateDetails, setRateDetails] = useState('');
  const [qtyOfMaterial, setQtyOfMaterial] = useState('');
  const [additionalFile, setAdditionalFile] = useState(null);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPendingOrders();
    fetchMasterOptions();
    fetchPlanningRecords();
  }, []);

  const fetchPlanningRecords = async () => {
    setTableFetching(true);
    try {
      const response = await serialFetch(`${SCRIPT_URL}?sheet=${PLANNING_SHEET}`);
      const result = await response.json();

      if (result.success && result.data && result.data.length > 5) {
        const headers = result.data[5];
        setPlanningHeaders(headers);
        const rows = result.data.slice(6)
          .map((row, idx) => ({ rowData: row, originalIndex: idx + 7 }))
          .filter(item => item.rowData.some(cell => cell && cell.toString().trim() !== ''));
        setPlanningRows(rows);
      } else {
        setPlanningHeaders(PLANNING_HEADERS);
        setPlanningRows([]);
      }
    } catch (error) {
      console.error('Error fetching Application Planning records:', error);
    } finally {
      setTableFetching(false);
    }
  };

  const fetchPendingOrders = async () => {
    setFetching(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await serialFetch(`${SCRIPT_URL}?sheet=${FMS_SHEET}`);
      const result = await response.json();
      const cleanH = (s) => (s ? s.toString().trim().toLowerCase() : '');

      if (result.success && result.data && result.data.length > 6) {
        const headers = result.data[5];
        const appIdx = headers.findIndex(h => cleanH(h) === 'application number');
        const serialIdx = headers.findIndex(h => cleanH(h) === 'serial number');
        const orderStatusIdx = headers.findIndex(h => cleanH(h) === 'order status');
        const partyNameIdx = headers.findIndex(h => cleanH(h) === 'party name');

        const rows = result.data.slice(6);
        const pending = [];
        rows.forEach(row => {
          if (!row) return;
          const status = orderStatusIdx !== -1 ? cleanH(row[orderStatusIdx]) : '';
          const appNumber = appIdx !== -1 && row[appIdx] ? row[appIdx].toString().trim() : '';
          const serial = serialIdx !== -1 && row[serialIdx] ? row[serialIdx].toString().trim() : '';
          const partyName = partyNameIdx !== -1 && row[partyNameIdx] ? row[partyNameIdx].toString().trim() : '';
          if (status === 'pending' && appNumber) {
            pending.push({ appNumber, serialNumber: serial, partyName });
          }
        });
        setPendingRows(pending);
      } else {
        setPendingRows([]);
        if (!result.success) {
          setMessage({ type: 'error', text: result.error || 'Failed to fetch data' });
        }
      }
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Error fetching pending orders.' });
    } finally {
      setFetching(false);
    }
  };

  const fetchMasterOptions = async () => {
    try {
      const response = await serialFetch(`${SCRIPT_URL}?sheet=${MASTER_SHEET}`);
      const result = await response.json();
      const cleanH = (s) => (s ? s.toString().trim().toLowerCase() : '');

      if (result.success && result.data && result.data.length > 0) {
        const headers = result.data[0];
        const siteInchargeIdx = headers.findIndex(h => cleanH(h) === 'site incharge');
        const vendorIdx = headers.findIndex(h => cleanH(h) === 'vendor');

        const siteInchargeValues = new Set();
        const vendorValues = new Set();
        result.data.slice(1).forEach(row => {
          if (siteInchargeIdx !== -1 && row[siteInchargeIdx] && row[siteInchargeIdx].toString().trim() !== '') {
            siteInchargeValues.add(row[siteInchargeIdx].toString().trim());
          }
          if (vendorIdx !== -1 && row[vendorIdx] && row[vendorIdx].toString().trim() !== '') {
            vendorValues.add(row[vendorIdx].toString().trim());
          }
        });
        setSiteInchargeOptions(Array.from(siteInchargeValues).sort());
        setVendorOptions(Array.from(vendorValues).sort());
      }
    } catch (error) {
      console.error('Error fetching Master data:', error);
    }
  };

  const applicationNumberOptions = Array.from(new Set(pendingRows.map(r => r.appNumber)));
  const serialNumberOptions = applicationNumber
    ? Array.from(new Set(
        pendingRows.filter(r => r.appNumber === applicationNumber).map(r => r.serialNumber)
      )).filter(Boolean)
    : [];

  const openModal = () => {
    setApplicationNumber('');
    setSerialNumber('');
    setSiteIncharge('');
    setTypeOfWork('');
    setWorkOrderCopyFile(null);
    setVendorName('');
    setRateDetails('');
    setQtyOfMaterial('');
    setAdditionalFile(null);
    setMessage({ type: '', text: '' });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

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

          const response = await serialFetch(SCRIPT_URL, { method: 'POST', body: params });
          const result = await response.json();
          resolve(result.success && result.fileUrl ? result.fileUrl : '');
        } catch (err) {
          console.error('Upload file error:', err);
          resolve('');
        }
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!applicationNumber || !serialNumber || !siteIncharge || !typeOfWork) {
      setMessage({ type: 'error', text: 'Please fill Application Number, Serial Number, Site Incharge, and Type Of Work.' });
      return;
    }
    if (typeOfWork === 'We will sublet' && (!vendorName || !rateDetails || !qtyOfMaterial)) {
      setMessage({ type: 'error', text: 'Please fill Name Of The Vendor, Rate Details, and Qty Of Material.' });
      return;
    }

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      let vendorOrderCopyUrl = '';
      if (typeOfWork === 'We will do' && workOrderCopyFile) {
        vendorOrderCopyUrl = await uploadFile(workOrderCopyFile);
      } else if (typeOfWork === 'We will sublet' && additionalFile) {
        vendorOrderCopyUrl = await uploadFile(additionalFile);
      }

      const matchedFmsRow = pendingRows.find(
        r => r.appNumber === applicationNumber && r.serialNumber === serialNumber
      );
      const partyName = matchedFmsRow ? matchedFmsRow.partyName : '';

      const pad = (n) => n.toString().padStart(2, '0');
      const d = new Date();
      const formattedDate = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

      const fieldValues = {
        'Timestamp': formattedDate,
        'Application No.': applicationNumber,
        'Serial No.': serialNumber,
        'Site Incharge Name': siteIncharge,
        'Type Of Work': typeOfWork,
        'Name Of Ther Vendor': typeOfWork === 'We will sublet' ? vendorName : '',
        'Rate Details': typeOfWork === 'We will sublet' ? rateDetails : '',
        'Qty Of Material': typeOfWork === 'We will sublet' ? qtyOfMaterial : '',
        'Vendor Order Copy': vendorOrderCopyUrl,
        'Party Name': partyName,
        'Pan No.': '',
        'Pan Photo': '',
        'Gst No.': '',
        'Gst Copy': '',
        'Planned 1': formattedDate,
        'Actual 1': '',
      };

      const rowData = PLANNING_HEADERS.map(h => fieldValues[h] ?? '');

      const params = new URLSearchParams();
      params.append('sheetName', PLANNING_SHEET);
      params.append('action', 'insert');
      params.append('rowData', JSON.stringify(rowData));

      const response = await serialFetch(SCRIPT_URL, { method: 'POST', body: params });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to save order.');
      }

      setMessage({ type: 'success', text: 'Order planning details saved successfully!' });
      setIsModalOpen(false);
      fetchPlanningRecords();
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: error.message || 'Network error occurred.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Vendor Work Order</h1>
          <p style={{ color: 'var(--text-muted)' }}>Plan pending orders by application number, serial number, site incharge, and type of work.</p>
        </div>
        <button className="btn btn-primary" onClick={openModal}>
          <Plus size={18} />
          Create New Indent
        </button>
      </div>

      {message.text && !isModalOpen && (
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
            placeholder="Search by Application No., Serial No., Vendor, or any keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input"
            style={{ width: '100%', paddingLeft: '3rem', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '1rem', transition: 'all 0.2s ease', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)' }}
            onFocus={(e) => e.target.style.borderColor = 'var(--primary-color)'}
            onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
          />
        </div>
        {tableFetching ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={32} className="animate-spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
            <p>Loading records...</p>
          </div>
        ) : (() => {
          const rows = planningRows.filter(item => {
            if (!searchQuery) return true;
            return item.rowData.some(cell =>
              cell && cell.toString().toLowerCase().includes(searchQuery.toLowerCase())
            );
          });

          return (
            <div>
              <table className="custom-table">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th className="sticky-action">Action</th>
                    {planningHeaders.map((h, idx) => (
                      <th key={idx}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={planningHeaders.length + 1} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No planning records found.
                      </td>
                    </tr>
                  ) : (
                    rows.map((item, index) => {
                      const fileLink = findFileLink(planningHeaders, item.rowData, ['Vendor Order Copy', 'Pan Photo', 'Gst Copy']);
                      const rowActions = [
                        ...(fileLink ? [{ key: 'download', label: 'View File', href: fileLink }] : []),
                      ];
                      return (
                        <tr key={index}>
                          <td className="sticky-action" data-label="Action">
                            <ActionButtons actions={rowActions} />
                          </td>
                          {planningHeaders.map((h, idx) => {
                            const val = item.rowData[idx];
                            return (
                              <td key={idx} data-label={h}>
                                <TableCellValue value={val} label={h} />
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

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card animate-fade-in" style={{ maxWidth: '640px', width: '100%', padding: '2.5rem' }}>
            <button onClick={closeModal} className="modal-close-btn">
              <X size={20} />
            </button>

            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--primary-color)' }}>
              Create New Order
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
              Select a pending application to plan.
            </p>

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

            {fetching ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Loader2 size={28} className="animate-spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
                <p>Loading pending orders...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Application Number</label>
                    <div className="select-wrapper">
                      <select
                        className="form-input"
                        value={applicationNumber}
                        onChange={(e) => { setApplicationNumber(e.target.value); setSerialNumber(''); }}
                        disabled={submitting}
                      >
                        <option value="">Select Application Number</option>
                        {applicationNumberOptions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="select-chevron" />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Serial Number</label>
                    <div className="select-wrapper">
                      <select
                        className="form-input"
                        value={serialNumber}
                        onChange={(e) => setSerialNumber(e.target.value)}
                        disabled={!applicationNumber || submitting}
                      >
                        <option value="">Select Serial Number</option>
                        {serialNumberOptions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="select-chevron" />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Site Incharge</label>
                    <div className="select-wrapper">
                      <select
                        className="form-input"
                        value={siteIncharge}
                        onChange={(e) => setSiteIncharge(e.target.value)}
                        disabled={submitting}
                      >
                        <option value="">Select Site Incharge</option>
                        {siteInchargeOptions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="select-chevron" />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Type Of Work</label>
                    <div className="select-wrapper">
                      <select
                        className="form-input"
                        value={typeOfWork}
                        onChange={(e) => setTypeOfWork(e.target.value)}
                        disabled={submitting}
                      >
                        <option value="">Select Type Of Work</option>
                        {TYPE_OF_WORK_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="select-chevron" />
                    </div>
                  </div>

                  {typeOfWork === 'We will do' && (
                    <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                      <label className="form-label">Work Order Copy</label>
                      <input
                        type="file"
                        accept="image/*"
                        className="form-input"
                        onChange={(e) => setWorkOrderCopyFile(e.target.files?.[0] || null)}
                        disabled={submitting}
                      />
                    </div>
                  )}

                  {typeOfWork === 'We will sublet' && (
                    <>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Name Of The Vendor</label>
                        <div className="select-wrapper">
                          <select
                            className="form-input"
                            value={vendorName}
                            onChange={(e) => setVendorName(e.target.value)}
                            disabled={submitting}
                          >
                            <option value="">Select Vendor</option>
                            {vendorOptions.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                          <ChevronDown size={16} className="select-chevron" />
                        </div>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Rate Details</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Enter Rate Details"
                          value={rateDetails}
                          onChange={(e) => setRateDetails(e.target.value)}
                          disabled={submitting}
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Qty Of Material</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Enter Qty Of Material"
                          value={qtyOfMaterial}
                          onChange={(e) => setQtyOfMaterial(e.target.value)}
                          disabled={submitting}
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                        <label className="form-label">Additional File</label>
                        <input
                          type="file"
                          accept="image/*"
                          className="form-input"
                          onChange={(e) => setAdditionalFile(e.target.files?.[0] || null)}
                          disabled={submitting}
                        />
                      </div>
                    </>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn" onClick={closeModal} disabled={submitting}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> : 'Save Order'}
                  </button>
                </div>
              </form>
            )}
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

export default OrderFormPlanning;

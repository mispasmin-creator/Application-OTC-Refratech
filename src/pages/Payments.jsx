import React, { useState, useEffect } from 'react';
import { serialFetch } from '../lib/serialFetch';
import { Search, Loader2, X, ChevronDown, CheckCircle2, Edit2 } from 'lucide-react';
import TableCellValue from '../components/TableCell';
import { filterRowsByFirmAccess } from '../lib/accessControl';

const SCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;
const PAYMENTS_SHEET = 'Payments';

const PAYMENTS_HEADERS = [
  'Timestamp',
  'Appliction No.',
  'Serial Number',
  'Firm',
  'Amount',
  'Contractor Name',
  'Pay To',
  'Remarks',
  'Save File',
  'Status'
];

const Payments = () => {
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState(PAYMENTS_HEADERS);
  const [fetching, setFetching] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'

  // Modal State for Action
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const cleanH = (s) => (s ? s.toString().trim().toLowerCase() : '');

  const fetchData = async () => {
    setFetching(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await serialFetch(`${SCRIPT_URL}?sheet=${encodeURIComponent(PAYMENTS_SHEET)}`);
      const result = await response.json();

      if (result.success && result.data && result.data.length > 0) {
        let headerRowIndex = 0;
        if (result.data.length > 5) {
          const row5Matches = result.data[5].some(h => ['timestamp', 'appliction no.', 'serial number', 'amount', 'contractor name'].includes(cleanH(h)));
          if (row5Matches) headerRowIndex = 5;
        }

        const detectedHeaders = result.data[headerRowIndex];
        let validHeaders = detectedHeaders && Array.isArray(detectedHeaders) && detectedHeaders.some(h => h && h.toString().trim() !== '')
          ? detectedHeaders.filter(h => h !== undefined && h !== null)
          : PAYMENTS_HEADERS;

        // Ensure 'Status' is included in headers list if not already present
        const hasStatus = validHeaders.some(h => cleanH(h) === 'status');
        if (!hasStatus) {
          validHeaders = [...validHeaders, 'Status'];
        }

        setHeaders(validHeaders);

        const dataRows = result.data.slice(headerRowIndex + 1)
          .map((row, idx) => ({ rowData: row, originalIndex: idx + headerRowIndex + 2 }))
          .filter(item => item.rowData.some(cell => cell && cell.toString().trim() !== ''))
          .reverse();

        setRows(filterRowsByFirmAccess(dataRows, validHeaders, '/payments'));
      } else {
        setHeaders(PAYMENTS_HEADERS);
        setRows([]);
      }
    } catch (err) {
      console.error('Error fetching Payments records:', err);
      setHeaders(PAYMENTS_HEADERS);
      setRows([]);
    } finally {
      setFetching(false);
    }
  };

  const statusIdx = headers.findIndex(h => cleanH(h) === 'status');

  const isStatusCompleted = (row) => {
    if (statusIdx === -1) return false;
    const val = row[statusIdx];
    return val !== undefined && val !== null && val.toString().trim() !== '';
  };

  const pendingRows = rows.filter(item => !isStatusCompleted(item.rowData));
  const historyRows = rows.filter(item => isStatusCompleted(item.rowData));

  const currentData = activeTab === 'pending' ? pendingRows : historyRows;

  const filteredRows = currentData.filter(item => {
    if (!searchQuery) return true;
    return item.rowData.some(cell =>
      cell && cell.toString().toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const openActionModal = (item) => {
    setSelectedItem(item);
    setPaymentStatus('');
    setShowModal(true);
  };

  const getFieldVal = (fieldName) => {
    if (!selectedItem || !selectedItem.rowData) return '';
    const idx = headers.findIndex(h => cleanH(h) === cleanH(fieldName));
    return idx !== -1 ? (selectedItem.rowData[idx] || '') : '';
  };

  const handleUpdateStatus = async () => {
    if (!paymentStatus) {
      alert('Please select Payment Status (Approved or Rejected).');
      return;
    }
    if (!selectedItem) return;

    setSubmitting(true);
    try {
      let targetColIdx = headers.findIndex(h => cleanH(h) === 'status');
      if (targetColIdx === -1) {
        targetColIdx = 8;
      }
      const columnIndex = targetColIdx + 1; // 1-based index for Apps Script

      const params = new URLSearchParams();
      params.append('sheetName', PAYMENTS_SHEET);
      params.append('action', 'updateCell');
      params.append('rowIndex', selectedItem.originalIndex);
      params.append('columnIndex', columnIndex);
      params.append('value', paymentStatus);

      const response = await serialFetch(SCRIPT_URL, {
        method: 'POST',
        body: params
      });
      const result = await response.json();

      if (result.success) {
        setMessage({
          type: 'success',
          text: `Payment status updated to "${paymentStatus}" successfully!`
        });

        // Optimistically update local rows so the record immediately moves to History
        setRows(prevRows =>
          prevRows.map(r => {
            if (r.originalIndex === selectedItem.originalIndex) {
              const updatedRow = [...r.rowData];
              updatedRow[targetColIdx] = paymentStatus;
              return { ...r, rowData: updatedRow };
            }
            return r;
          })
        );

        setShowModal(false);
        setSelectedItem(null);
        setPaymentStatus('');

        // Refresh data from Google Sheet in background
        fetchData();
      } else {
        throw new Error(result.error || 'Failed to update payment status in Google Sheet');
      }
    } catch (err) {
      console.error('Error updating payment status:', err);
      alert(err.message || 'Error updating payment status.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Make Payment</h1>
          <p style={{ color: 'var(--text-muted)' }}>Vendor disbursements, contractor payments, and expense vouchers records.</p>
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
            type="button"
            className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            Pending ({pendingRows.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            History ({historyRows.length})
          </button>
        </div>
      </div>

      <div className="table-container">
        <div style={{ position: 'relative', width: '100%', maxWidth: '100%', marginBottom: '1.5rem', display: 'flex' }}>
          <Search size={18} style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by Application No., Contractor, Pay To, Amount, or any keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input"
            style={{ width: '100%', paddingLeft: '3rem', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '1rem' }}
          />
        </div>

        {fetching ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={32} className="animate-spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
            <p>Loading Payments records...</p>
          </div>
        ) : (
          <div>
            <table className="custom-table">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {activeTab === 'pending' && (
                    <th className="sticky-action">Action</th>
                  )}
                  {headers.map((h, idx) => (
                    <th key={idx}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={activeTab === 'pending' ? headers.length + 1 : headers.length}
                      style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}
                    >
                      {activeTab === 'pending' ? 'No pending payment records found.' : 'No payment history records found.'}
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((item, index) => (
                    <tr key={index}>
                      {activeTab === 'pending' && (
                        <td className="sticky-action" data-label="Action">
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => openActionModal(item)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              padding: '0.35rem 0.8rem',
                              fontSize: '0.82rem',
                              fontWeight: 500,
                              borderRadius: '6px',
                              whiteSpace: 'nowrap',
                              cursor: 'pointer'
                            }}
                          >
                            <CheckCircle2 size={14} /> Action
                          </button>
                        </td>
                      )}
                      {headers.map((h, idx) => {
                        const cellVal = item.rowData[idx];
                        const isStatusCol = cleanH(h) === 'status';

                        return (
                          <td key={idx} data-label={h}>
                            {isStatusCol && cellVal ? (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '0.25rem 0.65rem',
                                  borderRadius: '9999px',
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  backgroundColor:
                                    cleanH(cellVal) === 'approved'
                                      ? 'rgba(16, 185, 129, 0.15)'
                                      : cleanH(cellVal) === 'rejected'
                                      ? 'rgba(239, 68, 68, 0.15)'
                                      : 'rgba(255, 255, 255, 0.08)',
                                  color:
                                    cleanH(cellVal) === 'approved'
                                      ? '#10b981'
                                      : cleanH(cellVal) === 'rejected'
                                      ? '#ef4444'
                                      : 'var(--text-main)',
                                  border: `1px solid ${
                                    cleanH(cellVal) === 'approved'
                                      ? 'rgba(16, 185, 129, 0.3)'
                                      : cleanH(cellVal) === 'rejected'
                                      ? 'rgba(239, 68, 68, 0.3)'
                                      : 'var(--border-color)'
                                  }`
                                }}
                              >
                                {cellVal}
                              </span>
                            ) : (
                              <TableCellValue value={cellVal} label={h} />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action Popup Modal for Updating Status */}
      {showModal && selectedItem && (
        <div className="modal-overlay" onClick={() => !submitting && setShowModal(false)}>
          <div
            className="modal-card animate-fade-in"
            style={{ minWidth: '400px', maxWidth: '520px', padding: '2rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Payment Status Action</h2>
              <button
                type="button"
                onClick={() => !submitting && setShowModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Selected Record Summary */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.75rem',
                marginBottom: '1.5rem',
                padding: '0.85rem 1rem',
                backgroundColor: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px'
              }}
            >
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Application No.</span>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                  {getFieldVal('Appliction No.') || getFieldVal('Application Number') || 'N/A'}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Serial Number</span>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                  {getFieldVal('Serial Number') || 'N/A'}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Amount</span>
                <strong style={{ fontSize: '0.9rem', color: '#10b981' }}>
                  {getFieldVal('Amount') ? `₹${getFieldVal('Amount')}` : 'N/A'}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Pay To / Contractor</span>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                  {getFieldVal('Pay To') || getFieldVal('Contractor Name') || 'N/A'}
                </strong>
              </div>
            </div>

            {/* Payment Status Selection */}
            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label className="form-label" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
                Payment Status <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div className="select-wrapper">
                <select
                  className="form-input"
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  style={{ backgroundColor: '#fff', width: '100%', color: '#111827' }}
                  disabled={submitting}
                >
                  <option value="">Select Status</option>
                  <option value="Approved">Approve</option>
                  <option value="Rejected">Reject</option>
                </select>
                <ChevronDown size={16} className="select-chevron" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setShowModal(false)}
                disabled={submitting}
                style={{ background: 'transparent', border: '1px solid var(--border-color)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleUpdateStatus}
                disabled={submitting || !paymentStatus}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {submitting ? (
                  <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                Submit Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payments;

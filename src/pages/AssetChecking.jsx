import React, { useState, useEffect } from 'react';
import { serialFetch } from '../lib/serialFetch';
import { Search, Loader2, CheckCircle2, Eye } from 'lucide-react';
import TableCellValue from '../components/TableCell';
import AssetDetailsModal from '../components/AssetDetailsModal';

const SCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;
const SHEET_NAME = 'Asset Transfer';

const DEFAULT_HEADERS = [
  'Transfer ID',
  'Asset Name',
  'Qty',
  'Transfer Status',
  'Planned1',
  'Actual1',
  'Delay1',
  'Remarks'
];

const AssetChecking = () => {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [pendingRows, setPendingRows] = useState([]);
  const [historyRows, setHistoryRows] = useState([]);
  const [rawHeaders, setRawHeaders] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [fetching, setFetching] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  // View Details Modal State
  const [selectedDetailsRow, setSelectedDetailsRow] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const cleanH = (s) => (s ? s.toString().trim().toLowerCase().replace(/[\s\u00a0\r\n\t_-]+/g, '') : '');

  const fetchData = async () => {
    setFetching(true);
    setMessage({ type: '', text: '' });
    setSelectedIds(new Set());
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

        const sheetHeaders = result.data[headerRowIndex] || [];
        setRawHeaders(sheetHeaders);

        const getColIdx = (target) => {
          const tClean = cleanH(target);
          let idx = sheetHeaders.findIndex(h => cleanH(h) === tClean);
          if (idx === -1 && tClean.includes('transporterstatus')) {
            idx = sheetHeaders.findIndex(h => cleanH(h) === 'transferstatus');
          } else if (idx === -1 && tClean.includes('transferstatus')) {
            idx = sheetHeaders.findIndex(h => cleanH(h) === 'transporterstatus');
          }
          return idx;
        };

        const matchedCols = DEFAULT_HEADERS.map(target => ({
          label: target,
          colIdx: getColIdx(target)
        }));

        const planned1ColIdx = sheetHeaders.findIndex(h => cleanH(h) === 'planned1');
        const actual1ColIdx = sheetHeaders.findIndex(h => cleanH(h) === 'actual1');

        const pendingList = [];
        const historyList = [];

        result.data.slice(headerRowIndex + 1).forEach((row, idx) => {
          const hasData = row && row.some(cell => cell && cell.toString().trim() !== '');
          if (!hasData) return;

          const p1 = planned1ColIdx !== -1 ? row[planned1ColIdx] : '';
          const a1 = actual1ColIdx !== -1 ? row[actual1ColIdx] : '';

          const isP1NotNull = p1 !== undefined && p1 !== null && p1.toString().trim() !== '';
          const isA1Null = a1 === undefined || a1 === null || a1.toString().trim() === '';
          const isA1NotNull = !isA1Null;

          const mappedRow = matchedCols.map(col => col.colIdx !== -1 ? row[col.colIdx] : '');
          const rowItem = {
            rowData: mappedRow,
            rawRow: row,
            originalIndex: idx + headerRowIndex + 2
          };

          // Pending: Planned1 is Not Null AND Actual1 is Null
          if (isP1NotNull && isA1Null) {
            pendingList.push(rowItem);
          }

          // History: Planned1 is Not Null AND Actual1 is Not Null
          if (isP1NotNull && isA1NotNull) {
            historyList.push(rowItem);
          }
        });

        setPendingRows(pendingList);
        setHistoryRows(historyList);
      } else {
        setPendingRows([]);
        setHistoryRows([]);
      }
    } catch (err) {
      console.error('Error fetching Asset Checking data:', err);
      setPendingRows([]);
      setHistoryRows([]);
    } finally {
      setFetching(false);
    }
  };

  const handleToggleSelect = (rowIndex) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(rowIndex)) {
        next.delete(rowIndex);
      } else {
        next.add(rowIndex);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredRows.length) {
      setSelectedIds(new Set());
    } else {
      const allIds = new Set(filteredRows.map(r => r.originalIndex));
      setSelectedIds(allIds);
    }
  };

  const handleSubmitChecking = async () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one record to submit.');
      return;
    }

    const actual1ColIdx = rawHeaders.findIndex(h => cleanH(h) === 'actual1');
    if (actual1ColIdx === -1) {
      alert('Could not find Actual1 column in sheet headers.');
      return;
    }

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    // Format timestamp in dd/mm/yyyy hh:mm:ss
    const pad = (n) => n.toString().padStart(2, '0');
    const now = new Date();
    const formattedTimestamp = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    try {
      const promises = Array.from(selectedIds).map(rowIndex => {
        const params = new URLSearchParams();
        params.append('sheetName', SHEET_NAME);
        params.append('action', 'updateCell');
        params.append('rowIndex', rowIndex);
        params.append('columnIndex', actual1ColIdx + 1);
        params.append('value', formattedTimestamp);
        return serialFetch(SCRIPT_URL, { method: 'POST', body: params }).then(r => r.json());
      });

      const results = await Promise.all(promises);
      const allSuccess = results.every(r => r.success);

      if (allSuccess) {
        const count = selectedIds.size;
        setMessage({
          type: 'success',
          text: `Successfully updated ${count} record(s)! Moved to History.`
        });
        setSelectedIds(new Set());
        fetchData();
      } else {
        throw new Error('Some records failed to update.');
      }
    } catch (err) {
      console.error('Submit Checking Error:', err);
      alert(err.message || 'Error updating Actual1 column.');
    } finally {
      setSubmitting(false);
    }
  };

  const currentRows = activeTab === 'pending' ? pendingRows : historyRows;

  const filteredRows = currentRows.filter(item => {
    if (!searchQuery) return true;
    return item.rowData.some(cell =>
      cell && cell.toString().toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Asset Checking</h1>
          <p style={{ color: 'var(--text-muted)' }}>Quality checking, inspection confirmation, and closure verification.</p>
        </div>

        {/* Top Right Corner Submit Button */}
        {activeTab === 'pending' && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmitChecking}
            disabled={selectedIds.size === 0 || submitting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.25rem',
              fontWeight: 600,
              fontSize: '0.95rem',
              boxShadow: '0 4px 12px rgba(27, 91, 176, 0.25)',
              opacity: selectedIds.size === 0 ? 0.6 : 1,
              cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            {submitting ? (
              <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <CheckCircle2 size={16} />
            )}
            Submit {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </button>
        )}
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

      {/* Tabs: Pending & History */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
        <button
          type="button"
          onClick={() => {
            setActiveTab('pending');
            setSelectedIds(new Set());
          }}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'pending' ? '2px solid var(--primary-color)' : '2px solid transparent',
            color: activeTab === 'pending' ? 'var(--primary-color)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          Pending
          <span style={{
            fontSize: '0.78rem',
            padding: '0.15rem 0.5rem',
            borderRadius: '12px',
            backgroundColor: activeTab === 'pending' ? 'var(--primary-color)' : 'rgba(255,255,255,0.08)',
            color: '#fff'
          }}>
            {pendingRows.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('history');
            setSelectedIds(new Set());
          }}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'history' ? '2px solid var(--primary-color)' : '2px solid transparent',
            color: activeTab === 'history' ? 'var(--primary-color)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          History
          <span style={{
            fontSize: '0.78rem',
            padding: '0.15rem 0.5rem',
            borderRadius: '12px',
            backgroundColor: activeTab === 'history' ? 'var(--primary-color)' : 'rgba(255,255,255,0.08)',
            color: '#fff'
          }}>
            {historyRows.length}
          </span>
        </button>
      </div>

      <div className="table-container">
        <div style={{ position: 'relative', width: '100%', maxWidth: '100%', marginBottom: '1.5rem', display: 'flex' }}>
          <Search size={18} style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder={`Search ${activeTab} checking records by Transfer ID, Asset Name, Status, Remarks...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input"
            style={{ width: '100%', paddingLeft: '3rem', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '1rem' }}
          />
        </div>

        {fetching ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={32} className="animate-spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
            <p>Loading Asset Checking records...</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {/* Checkbox column in Pending tab */}
                  {activeTab === 'pending' && (
                    <th style={{ width: '45px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        checked={filteredRows.length > 0 && selectedIds.size === filteredRows.length}
                        onChange={handleSelectAll}
                        title="Select All"
                      />
                    </th>
                  )}
                  <th style={{ width: '65px' }}>Action</th>
                  {DEFAULT_HEADERS.map((h, idx) => (
                    <th key={idx}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={DEFAULT_HEADERS.length + (activeTab === 'pending' ? 2 : 1)} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No {activeTab} asset checking records found.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((item, index) => {
                    const isSelected = selectedIds.has(item.originalIndex);
                    return (
                      <tr
                        key={index}
                        style={{ backgroundColor: isSelected ? 'rgba(27, 91, 176, 0.08)' : undefined }}
                      >
                        {/* Checkbox in Pending Tab */}
                        {activeTab === 'pending' && (
                          <td style={{ textAlign: 'center', width: '45px' }} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                              checked={isSelected}
                              onChange={() => handleToggleSelect(item.originalIndex)}
                            />
                          </td>
                        )}

                        {/* Action Column with Eye Icon */}
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

                        {item.rowData.map((cell, idx) => (
                          <td key={idx} data-label={DEFAULT_HEADERS[idx]}>
                            <TableCellValue value={cell} label={DEFAULT_HEADERS[idx]} />
                          </td>
                        ))}
                      </tr>
                    );
                  })
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
        headers={rawHeaders.length > 0 ? rawHeaders : DEFAULT_HEADERS}
        rawRow={selectedDetailsRow?.rawRow}
        title={`Asset Transfer Details - ${selectedDetailsRow?.rawRow?.[1] || selectedDetailsRow?.rowData?.[0] || ''}`}
      />
    </div>
  );
};

export default AssetChecking;

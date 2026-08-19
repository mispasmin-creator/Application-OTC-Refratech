import React, { useState, useEffect } from 'react';
import { serialFetch } from '../lib/serialFetch';
import { Search, Loader2, ImageIcon } from 'lucide-react';

const SCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;
const FMS_SHEET = 'FMS';

// Display label -> FMS sheet header it should be read from.
// (Matches the same "Order Status = Pending" data already used to
// populate the Application Number dropdown on the Vendor Work Order popup.)
const PENDING_ORDER_COLUMNS = [
  { label: 'Application Number', match: 'Application Number' },
  { label: 'Serial Number', match: 'Serial Number' },
  { label: 'Po Number', match: 'Po Number' },
  { label: 'Vendor Order Copy', match: 'Work Order Copy' },
  { label: 'Firm Name', match: 'Firm Name' },
  { label: 'Party Name', match: 'Party Name' },
  { label: 'Type Of Work', match: 'Type Of Work' },
  { label: 'Lead Time To Start', match: 'Lead Time To Start' },
  { label: 'Shift Type', match: 'Shift Type' },
  { label: 'Type Of Industry', match: 'Type Of Industry' },
  { label: 'Size Of Industry', match: 'Size Of Industry' },
  { label: 'Area Of Application', match: 'Area Of Application' },
  { label: 'Qty', match: 'Qty' },
  { label: 'Rate', match: 'Rate' },
];

const PendingOrderPlanning = () => {
  const [fetching, setFetching] = useState(true);
  const [rows, setRows] = useState([]); // [{ rowData }]
  const [columnsToRender, setColumnsToRender] = useState([]); // [{ label, colIdx }]
  const [message, setMessage] = useState({ type: '', text: '' });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchPendingOrders();
  }, []);

  const fetchPendingOrders = async () => {
    setFetching(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await serialFetch(`${SCRIPT_URL}?sheet=${FMS_SHEET}`);
      const result = await response.json();
      const cleanH = (s) => (s ? s.toString().trim().toLowerCase() : '');

      if (result.success && result.data && result.data.length > 6) {
        const headers = result.data[5];
        const orderStatusIdx = headers.findIndex(h => cleanH(h) === 'order status');

        setColumnsToRender(PENDING_ORDER_COLUMNS.map(col => ({
          label: col.label,
          colIdx: headers.findIndex(h => cleanH(h) === col.match.toLowerCase()),
        })));

        const pendingRows = result.data.slice(6)
          .filter(row => {
            if (!row) return false;
            const status = orderStatusIdx !== -1 ? cleanH(row[orderStatusIdx]) : '';
            return status === 'pending';
          })
          .map(row => ({ rowData: row }));

        setRows(pendingRows);
      } else {
        setRows([]);
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
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Pending Order</h1>
          <p style={{ color: 'var(--text-muted)' }}>Orders from the FMS sheet whose Order Status is Pending.</p>
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

      <div className="table-container">
        <div style={{ position: 'relative', width: '100%', maxWidth: '100%', marginBottom: '1.5rem', display: 'flex' }}>
          <Search size={18} style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by Application Number, PO Number, Firm Name, or any keyword..."
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
        ) : (
          <div>
            <table className="custom-table">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {PENDING_ORDER_COLUMNS.map((col, idx) => (
                    <th key={idx}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={PENDING_ORDER_COLUMNS.length} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No pending orders found.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((item, index) => (
                    <tr key={index}>
                      {columnsToRender.map((col, idx) => {
                        const val = col.colIdx !== -1 ? item.rowData[col.colIdx] : '';
                        const isFileColumn = col.label === 'Vendor Order Copy';
                        const strVal = val !== undefined && val !== null ? val.toString() : '';
                        return (
                          <td key={idx} data-label={col.label}>
                            {isFileColumn && strVal.startsWith('http') ? (
                              <a href={strVal} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)', fontWeight: 600 }}>
                                <ImageIcon size={20} />
                              </a>
                            ) : strVal}
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

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default PendingOrderPlanning;

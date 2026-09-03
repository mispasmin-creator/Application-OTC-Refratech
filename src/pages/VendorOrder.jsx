import React, { useState, useEffect } from 'react';
import { serialFetch } from '../lib/serialFetch';
import { Search, Loader2 } from 'lucide-react';
import ActionButtons from '../components/ActionButtons';
import TableCellValue from '../components/TableCell';
import { findFileLink } from '../lib/fileLink';

const SCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;
const VENDOR_SHEET = 'Vendor Order';

const VENDOR_ORDER_HEADERS = [
  'Timestamp',
  'Application No.',
  'Serial No.',
  'Firm',
  'Side Incharge Name',
  'Type Of Work',
  'Name Of Ther Vandor',
  'Rate Details',
  'Qty Of Material',
  'Vendor Order Copy',
  'Party Name',
  'Pan No.',
  'Pan Photo',
  'Gst No.',
  'Gst Copy'
];

const VendorOrder = () => {
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState(VENDOR_ORDER_HEADERS);
  const [fetching, setFetching] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setFetching(true);
    setMessage({ type: '', text: '' });
    try {
      let response = await serialFetch(`${SCRIPT_URL}?sheet=${encodeURIComponent(VENDOR_SHEET)}`);
      let result = await response.json();

      if (!result.success || !result.data || result.data.length === 0) {
        response = await serialFetch(`${SCRIPT_URL}?sheet=Application%20Planning`);
        result = await response.json();
      }

      if (result.success && result.data && result.data.length > 0) {
        const cleanH = (s) => (s ? s.toString().trim().toLowerCase() : '');
        let headerRowIndex = 0;
        if (result.data.length > 5) {
          const row5Matches = result.data[5].some(h => ['timestamp', 'application no.', 'serial no.', 'vendor'].includes(cleanH(h)));
          if (row5Matches) headerRowIndex = 5;
        }

        const detectedHeaders = result.data[headerRowIndex];
        const validHeaders = detectedHeaders && Array.isArray(detectedHeaders) && detectedHeaders.some(h => h && h.toString().trim() !== '')
          ? detectedHeaders.filter(h => h !== undefined && h !== null)
          : VENDOR_ORDER_HEADERS;

        setHeaders(validHeaders);

        const dataRows = result.data.slice(headerRowIndex + 1)
          .map((row, idx) => ({ rowData: row, originalIndex: idx + headerRowIndex + 2 }))
          .filter(item => item.rowData.some(cell => cell && cell.toString().trim() !== ''))
          .reverse();

        setRows(dataRows);
      } else {
        setHeaders(VENDOR_ORDER_HEADERS);
        setRows([]);
      }
    } catch (err) {
      console.error('Error fetching Vendor Order records:', err);
      setHeaders(VENDOR_ORDER_HEADERS);
      setRows([]);
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
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Vendor Order</h1>
          <p style={{ color: 'var(--text-muted)' }}>Vendor work orders, subcontractor contracts, rate agreements, and document copies.</p>
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
            placeholder="Search by Application No., Vendor, Rate, Party Name, or any keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input"
            style={{ width: '100%', paddingLeft: '3rem', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '1rem' }}
          />
        </div>

        {fetching ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={32} className="animate-spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
            <p>Loading Vendor Orders...</p>
          </div>
        ) : (
          <div>
            <table className="custom-table">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {headers.map((h, idx) => (
                    <th key={idx}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={headers.length} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No vendor order records found.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((item, index) => (
                    <tr key={index}>
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
    </div>
  );
};

export default VendorOrder;

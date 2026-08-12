import React, { useState, useEffect } from 'react';
import { serialFetch } from '../lib/serialFetch';
import { Loader2, Plus, Edit2, Trash2, RefreshCcw } from 'lucide-react';

const SCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;
const SHEET_NAME = 'FMS';

const initialForm = {
  'Timestamp': '',
  'Application Number': '',
  'Serial Number': '',
  'Po Number': '',
  'Work Order Copy': '',
  'Firm Name': '',
  'Party Name': '',
  'Type Of Work': '',
  'Lead Time To Start': '',
  'Shift Type': '',
  'Type Of Industry': '',
  'Size Of Industry': '',
  'Area Of Application': '',
  'Qty': '',
  'Rate': '',
  'Company': '',
  'Incharge': '',
  'Planned 1': ''
};

// Form fields configuration
const formFields = Object.keys(initialForm);

const CreateIndent = () => {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [formData, setFormData] = useState(initialForm);
  const [indents, setIndents] = useState([]);
  const [historyIndents, setHistoryIndents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [editingRowIndex, setEditingRowIndex] = useState(null);
  const [masterOptions, setMasterOptions] = useState({});

  useEffect(() => {
    const init = async () => {
      await fetchIndents();
      await fetchMasterData();
    };
    init();
  }, []);

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
          'Firm Name': new Set(),
          'Company': new Set(),
          'Incharge': new Set(),
          'Party Name': new Set(),
          'Type Of Work': new Set(),
          'Shift Type': new Set()
        };

        const getColIdx = (name) => {
           let idx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === name.toLowerCase());
           if (idx === -1 && name === 'Company') idx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'company name');
           if (idx === -1 && name === 'Shift Type') idx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'shit type');
           return idx;
        };

        const colIndices = {
          'Firm Name': getColIdx('Firm Name'),
          'Company': getColIdx('Company'),
          'Incharge': getColIdx('Incharge'),
          'Party Name': getColIdx('Party Name'),
          'Type Of Work': getColIdx('Type Of Work'),
          'Shift Type': getColIdx('Shift Type')
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

  const fetchIndents = async () => {
    setFetching(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await serialFetch(`${SCRIPT_URL}?sheet=${SHEET_NAME}`);
      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (err) {
        setIndents([]);
        setHistoryIndents([]);
        setMessage({ type: 'error', text: 'Google AppScript server link is unavailable or returning HTML (404).' });
        return;
      }
      if (result.success && result.data && result.data.length > 0) {
        const headers = result.data.length > 4 ? result.data[4] : result.data[0];
        const dataRows = result.data.slice(5);

        // Find Actual 1 idx to separate pending from history indents
        const actual1Idx = headers.findIndex(h => h && h.toString().trim() === 'Actual 1');
        
        const pendingRows = dataRows.filter(row => {
          const actual1Val = actual1Idx !== -1 ? row[actual1Idx] : null;
          return actual1Val === undefined || actual1Val === null || actual1Val.toString().trim() === '';
        });

        const historyRows = dataRows.filter(row => {
          const actual1Val = actual1Idx !== -1 ? row[actual1Idx] : null;
          return actual1Val !== undefined && actual1Val !== null && actual1Val.toString().trim() !== '';
        });

        setIndents([headers, ...pendingRows]);
        setHistoryIndents([headers, ...historyRows]);
      } else {
        setIndents([]);
        setHistoryIndents([]);
        if (!result.success) {
          setMessage({ type: 'error', text: result.error || 'Failed to fetch data' });
        }
      }
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Error fetching indents.' });
    } finally {
      setFetching(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    // Ensure timestamp is present
    const payloadData = { ...formData };
    
    // Format: dd/mm/yyyy hh:mm:ss
    const pad = (n) => n.toString().padStart(2, '0');
    const d = new Date();
    const formattedDate = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    
    payloadData['Timestamp'] = formattedDate;
    payloadData['Planned 1'] = formattedDate;
    payloadData['Application Number'] = ''; // Empty string so formula can generate it

    try {
      // Convert form data object to array ordered strictly by formFields 
      // This guarantees an exact 17-element array (Columns A through Q) 
      // regardless of header spacing/formatting in rows 1-5 of the sheet.
      const rowDataArray = formFields.map(field => payloadData[field] !== undefined ? payloadData[field] : '');

      const params = new URLSearchParams();
      params.append('sheetName', SHEET_NAME);
      params.append('action', editingRowIndex ? 'update' : 'insert');
      params.append('rowData', JSON.stringify(rowDataArray));
      
      if (editingRowIndex) {
        params.append('rowIndex', editingRowIndex);
      }

      const response = await serialFetch(SCRIPT_URL, {
        method: 'POST',
        body: params
      });
      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: result.message || 'Operation successful!' });
        setFormData(initialForm);
        setEditingRowIndex(null);
        fetchIndents();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to save.' });
      }
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Network error occurred while saving.' });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (rowIndex, dataArray) => {
    const headers = indents[0];
    const dataObj = {};
    headers.forEach((header, i) => {
      dataObj[header] = dataArray[i] || '';
    });
    setFormData({ ...initialForm, ...dataObj });
    setEditingRowIndex(rowIndex);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (rowIndex) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    
    setLoading(true);
    setMessage({ type: '', text: '' });
    
    try {
      const params = new URLSearchParams();
      params.append('sheetName', SHEET_NAME);
      params.append('action', 'delete');
      params.append('rowIndex', rowIndex);

      const response = await serialFetch(SCRIPT_URL, {
        method: 'POST',
        body: params
      });
      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: 'Record deleted successfully.' });
        fetchIndents();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to delete.' });
      }
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Network error while deleting.' });
    } finally {
      setLoading(false);
    }
  };

  const cancelEdit = () => {
    setFormData(initialForm);
    setEditingRowIndex(null);
    setMessage({ type: '', text: '' });
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Create Indent</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage indent records here.</p>
        </div>
        <button className="btn btn-primary" onClick={fetchIndents} disabled={fetching}>
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

      {/* Form Section */}
      <div className="glass-panel" style={{ padding: '2rem', borderRadius: '12px', marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>
          {editingRowIndex ? 'Update Indent' : 'New Indent'}
        </h2>
        
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
            {formFields.filter(f => f !== 'Timestamp' && f !== 'Application Number' && f !== 'Planned 1').map((field) => (
              <div key={field} className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{field}</label>
                {masterOptions[field] && masterOptions[field].length > 0 ? (
                  <select
                    name={field}
                    value={formData[field]}
                    onChange={handleChange}
                    className="form-input"
                    disabled={loading}
                    style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)' }}
                  >
                    <option value="">Select {field}</option>
                    {masterOptions[field].map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field === 'Qty' || field === 'Rate' ? 'number' : 'text'}
                    name={field}
                    value={formData[field]}
                    onChange={handleChange}
                    className="form-input"
                    placeholder={`Enter ${field}`}
                    disabled={loading}
                  />
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <Loader2 size={20} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> : (editingRowIndex ? <Edit2 size={20} /> : <Plus size={20} />)}
              {editingRowIndex ? 'Update Record' : 'Save Record'}
            </button>
            {editingRowIndex && (
              <button type="button" className="btn" onClick={cancelEdit} disabled={loading} style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Table Section */}
      <div className="glass-panel" style={{ padding: '2rem', borderRadius: '12px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem' }}>All Indents ({Math.max(0, indents.length - 1)})</h2>
        </div>
        
        {fetching ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={32} className="animate-spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
            <p>Loading records...</p>
          </div>
        ) : (() => {
          const currentData = indents;
          const rawHeaders = currentData[0] || [];
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
                    <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap', position: 'sticky', top: 0, left: 0, background: 'var(--bg-darker)', zIndex: 20 }}>
                      Actions
                    </th>
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
                      <td colSpan={columnsToRender.length + 1} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No records found.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, index) => {
                      const actualRowIndex = index + 2;
                      return (
                        <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
                          <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem', position: 'sticky', left: 0, background: 'var(--bg-darker)', zIndex: 10 }}>
                              <button 
                                onClick={() => handleEdit(actualRowIndex, row)}
                                style={{ background: 'rgba(79, 70, 229, 0.2)', color: 'var(--primary-color)', border: 'none', padding: '0.5rem', borderRadius: '6px', cursor: 'pointer' }}
                                title="Edit"
                                disabled={loading}
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                onClick={() => handleDelete(actualRowIndex)}
                                style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--error-color)', border: 'none', padding: '0.5rem', borderRadius: '6px', cursor: 'pointer' }}
                                title="Delete"
                                disabled={loading}
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          {columnsToRender.map((col, idx) => {
                            const val = row ? row[col.colIdx] : '';
                            return (
                              <td key={idx} style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
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

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        tbody tr:hover {
          background: rgba(255, 255, 255, 0.02);
        }
      `}</style>
    </div>
  );
};

export default CreateIndent;

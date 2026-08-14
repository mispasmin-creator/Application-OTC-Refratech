import React, { useState, useEffect } from 'react';
import { serialFetch } from '../lib/serialFetch';
import { Search, Loader2, Plus, Edit2, Trash2, RefreshCcw, X, Activity } from 'lucide-react';
import ApplicationTracker from '../components/ApplicationTracker';
import ActionButtons from '../components/ActionButtons';
import { findFileLink } from '../lib/fileLink';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [editingRowIndex, setEditingRowIndex] = useState(null);
  const [trackingItem, setTrackingItem] = useState(null);
  const [masterOptions, setMasterOptions] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);

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
        const headers = result.data.length > 5 ? result.data[5] : result.data[0];
        const dataRows = result.data.slice(6);

        // Find Actual 1 idx to separate pending from history indents
        const actual1Idx = headers.findIndex(h => h && h.toString().trim() === 'Actual 1');
        
        setIndents([headers, ...dataRows]);
        setHistoryIndents([]); // Not used on this page
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
      const params = new URLSearchParams();
      params.append('sheetName', SHEET_NAME);
      params.append('action', editingRowIndex ? 'updateByHeader' : 'insertByHeader');
      params.append('payloadData', JSON.stringify(payloadData));
      
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
        window.dispatchEvent(new Event('fms-updated'));
        setFormData(initialForm);
        setEditingRowIndex(null);
        setIsModalOpen(false);
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
    setIsModalOpen(true);
  };

  const openNewModal = () => {
    setFormData(initialForm);
    setEditingRowIndex(null);
    setMessage({ type: '', text: '' });
    setIsModalOpen(true);
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
        window.dispatchEvent(new Event('fms-updated'));
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
    setIsModalOpen(false);
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Application Order Form</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage indent records here.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-primary" onClick={openNewModal}>
            <Plus size={18} />
            Create New Indent
          </button>
          <button className="btn" onClick={fetchIndents} disabled={fetching} style={{ background: 'rgba(111, 123, 57, 0.1)', color: 'var(--primary-color)' }}>
            <RefreshCcw size={18} className={fetching ? "animate-spin" : ""} style={fetching ? { animation: 'spin 1s linear infinite' } : {}} />
            Refresh
          </button>
        </div>
      </div>

      {message.text && !isModalOpen && (
        <div className="animate-fade-in" style={{
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

      {/* Modal Form Section */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card animate-fade-in">
            <button onClick={cancelEdit} style={{
              position: 'absolute',
              top: '1.5rem',
              right: '1.5rem',
              background: 'rgba(111, 123, 57, 0.1)',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-main)',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(111, 123, 57, 0.2)'; e.currentTarget.style.color = 'var(--primary-color)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(111, 123, 57, 0.1)'; e.currentTarget.style.color = 'var(--text-main)'; }}
            >
              <X size={20} />
            </button>
            
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--primary-color)' }}>
              {editingRowIndex ? 'Update Indent Record' : 'Create New Indent'}
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
              Fill in the details below to {editingRowIndex ? 'update the' : 'create a new'} application order.
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
            
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {formFields.filter(f => f !== 'Timestamp' && f !== 'Application Number' && f !== 'Planned 1').map((field) => (
                  <div key={field} className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-main)' }}>{field}</label>
                    {field === 'Work Order Copy' ? (
                      <div>
                        {formData[field] && formData[field].startsWith('http') && (
                          <div style={{ marginBottom: '0.5rem' }}>
                            <a href={formData[field]} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)', fontSize: '0.9rem', textDecoration: 'underline' }}>View Current File</a>
                          </div>
                        )}
                        <input
                          type="file"
                          name={field}
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                setFormData(prev => ({ ...prev, [field]: event.target.result }));
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="form-input"
                          disabled={loading}
                          style={{ backgroundColor: '#fff', boxShadow: 'inset 0 2px 4px 0 rgba(0,0,0,0.02)', width: '100%' }}
                        />
                      </div>
                    ) : masterOptions[field] && masterOptions[field].length > 0 ? (
                      <select
                        name={field}
                        value={formData[field]}
                        onChange={handleChange}
                        className="form-input"
                        disabled={loading}
                        style={{ backgroundColor: '#fff', boxShadow: 'inset 0 2px 4px 0 rgba(0,0,0,0.02)' }}
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
                        style={{ backgroundColor: '#fff', boxShadow: 'inset 0 2px 4px 0 rgba(0,0,0,0.02)' }}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem', justifyContent: 'flex-end', borderTop: '1px solid rgba(111, 123, 57, 0.1)', paddingTop: '1.5rem' }}>
                <button type="button" className="btn" onClick={cancelEdit} disabled={loading} style={{ background: 'var(--bg-dark)', color: 'var(--text-main)' }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: '150px' }}>
                  {loading ? <Loader2 size={20} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> : (editingRowIndex ? <Edit2 size={20} /> : <Plus size={20} />)}
                  {editingRowIndex ? 'Update Record' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
            style={{ width: '100%', paddingLeft: '3rem', borderRadius: '12px', fontSize: '1rem' }}
          />
        </div>
        {fetching ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={32} className="animate-spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
            <p>Loading records...</p>
          </div>
        ) : (() => {
          const currentData = indents;
          const rawHeaders = currentData[0] || [];
          const rows = indents.slice(1).filter(item => {
            const isRowEmpty = item.every(cell => !cell || cell.toString().trim() === '');
            if (isRowEmpty) return false;
            if (!searchQuery) return true;
            return item.some(cell => 
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
                      Actions
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
                        No records found.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, index) => {
                      const actualRowIndex = index + 2;
                      const fileLink = findFileLink(rawHeaders, row, ['Work Order Copy']);
                      const rowActions = [
                        { key: 'view', label: 'Track Progress', onClick: () => setTrackingItem(row) },
                        { key: 'edit', label: 'Edit', onClick: () => handleEdit(actualRowIndex, row), disabled: loading },
                        ...(fileLink ? [{ key: 'download', label: 'Download Work Order', href: fileLink }] : []),
                        { key: 'delete', label: 'Delete', onClick: () => handleDelete(actualRowIndex), disabled: loading },
                      ];
                      return (
                        <tr key={index}>
                          <td className="sticky-action">
                            <ActionButtons actions={rowActions} maxInline={3} />
                          </td>
                          {columnsToRender.map((col, idx) => {
                            const val = row ? row[col.colIdx] : '';
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

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        
      `}</style>
      {/* Tracking Modal */}
      {trackingItem && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '1rem' }}>
          <div className="glass-panel animate-fade-in" style={{ padding: '2rem', borderRadius: '12px', minWidth: '500px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border-color)', position: 'relative' }}>
            <button 
              onClick={() => setTrackingItem(null)} 
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={24} />
            </button>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Application Progress</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Tracking Application: {trackingItem[indents[0].findIndex(h => h && h.toString().trim() === 'Application Number')] || 'Unknown'}</p>
            
            <ApplicationTracker headers={indents[0]} rowData={trackingItem} />
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateIndent;

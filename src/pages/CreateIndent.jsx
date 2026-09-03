import React, { useState, useEffect } from 'react';
import { serialFetch } from '../lib/serialFetch';
import { Search, Loader2, Plus, Edit2, Trash2, X, Activity, ChevronDown } from 'lucide-react';
import ActionButtons from '../components/ActionButtons';
import { findFileLink } from '../lib/fileLink';
import TableCellValue from '../components/TableCell';

const SCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;
const SHEET_NAME = 'FMS';

const initialMainForm = {
  'Po Number': '',
  'Work Order Copy': '',
  'Firm Name': '',
  'Company': '',
  'Incharge': '',
  'Party Name': '',
  'Type Of Work': '',
  'Lead Time To Start': '',
  'Shift Type': ''
};

const initialArea = {
  'Type Of Industry': '',
  'Size Of Industry': '',
  'Area Of Application': '',
  'Qty': '',
  'Rate': ''
};

const CreateIndent = () => {
  const [mainFormData, setMainFormData] = useState(initialMainForm);
  const [areas, setAreas] = useState([{ ...initialArea }]);
  const [indents, setIndents] = useState([]);
  const [historyIndents, setHistoryIndents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [editingRowIndex, setEditingRowIndex] = useState(null);
  const [editingRowData, setEditingRowData] = useState(null);
  const [masterOptions, setMasterOptions] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fileObj, setFileObj] = useState(null);

  useEffect(() => {
    const init = async () => {
      await fetchIndents();
      await fetchMasterData();
    };
    init();
  }, []);

  const getNextApplicationNumber = () => {
    if (!indents || indents.length <= 1) {
      return 'AON-001';
    }
    const headers = indents[0] || [];
    const appNumColIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'application number');
    if (appNumColIdx === -1) {
      return 'AON-001';
    }

    let maxNum = 0;
    let prefix = 'AON-';
    let padLength = 3;

    for (let i = 1; i < indents.length; i++) {
      const row = indents[i];
      if (!row) continue;
      const val = row[appNumColIdx];
      if (!val) continue;

      const str = val.toString().trim();
      const match = str.match(/([a-zA-Z-]+)(\d+)/);
      if (match) {
        prefix = match[1];
        const digits = match[2];
        padLength = Math.max(padLength, digits.length);
        const num = parseInt(digits, 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      } else {
        const numOnly = parseInt(str, 10);
        if (!isNaN(numOnly) && numOnly > maxNum) {
          maxNum = numOnly;
        }
      }
    }

    const nextNum = maxNum + 1;
    const formattedNextNum = nextNum.toString().padStart(padLength, '0');
    return `${prefix}${formattedNextNum}`;
  };

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
          'Shift Type': new Set(),
          'Type Of Industry': new Set()
        };

        const clean = (str) => (str ? str.toString().trim().toLowerCase().replace(/\s+/g, ' ') : '');

        const getColIdx = (name) => {
          const target = clean(name);
          let idx = headers.findIndex(h => clean(h) === target);
          if (idx !== -1) return idx;

          if (name === 'Type Of Industry') {
            const aliases = ['industry', 'type of industry', 'industry type', 'type of industries', 'industries'];
            idx = headers.findIndex(h => aliases.includes(clean(h)));
            if (idx === -1) {
              idx = headers.findIndex(h => clean(h).includes('industry'));
            }
          } else if (name === 'Shift Type') {
            const aliases = ['shift type', 'shift', 'shit type', 'shift types', 'shifttype'];
            idx = headers.findIndex(h => aliases.includes(clean(h)));
            if (idx === -1) {
              idx = headers.findIndex(h => clean(h).includes('shift') || clean(h).includes('shit'));
            }
          } else if (name === 'Company') {
            const aliases = ['company', 'company name'];
            idx = headers.findIndex(h => aliases.includes(clean(h)));
          } else if (name === 'Firm Name') {
            const aliases = ['firm name', 'firm'];
            idx = headers.findIndex(h => aliases.includes(clean(h)));
          } else if (name === 'Party Name') {
            const aliases = ['party name', 'party'];
            idx = headers.findIndex(h => aliases.includes(clean(h)));
          } else if (name === 'Type Of Work') {
            const aliases = ['type of work', 'work type', 'work'];
            idx = headers.findIndex(h => aliases.includes(clean(h)));
          } else if (name === 'Incharge') {
            const aliases = ['incharge', 'in charge', 'incharge name'];
            idx = headers.findIndex(h => aliases.includes(clean(h)));
          }
          return idx;
        };

        const colIndices = {
          'Firm Name': getColIdx('Firm Name'),
          'Company': getColIdx('Company'),
          'Incharge': getColIdx('Incharge'),
          'Party Name': getColIdx('Party Name'),
          'Type Of Work': getColIdx('Type Of Work'),
          'Shift Type': getColIdx('Shift Type'),
          'Type Of Industry': getColIdx('Type Of Industry')
        };

        dataRows.forEach(row => {
          Object.keys(colIndices).forEach(key => {
            const idx = colIndices[key];
            if (idx !== -1 && row[idx]) {
              const val = row[idx].toString().trim();
              if (val) {
                options[key].add(val);
              }
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
        setIndents([headers, ...dataRows]);
        setHistoryIndents([]);
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

  const handleMainChange = (e) => {
    const { name, value } = e.target;
    setMainFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAreaChange = (index, e) => {
    const { name, value } = e.target;
    setAreas(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [name]: value };
      return updated;
    });
  };

  const addArea = () => {
    setAreas(prev => [...prev, { ...initialArea }]);
  };

  const removeArea = (index) => {
    if (areas.length === 1) {
      setAreas([{ ...initialArea }]);
    } else {
      setAreas(prev => prev.filter((_, i) => i !== index));
    }
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

          const response = await serialFetch(SCRIPT_URL, {
            method: 'POST',
            body: params
          });
          const result = await response.json();
          if (result.success && result.fileUrl) {
            resolve(result.fileUrl);
          } else {
            resolve('');
          }
        } catch (err) {
          console.error('Upload file error:', err);
          resolve('');
        }
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  const buildRowData = (mainData, areaData, appNumber, serialNumber, formattedDate, existingRow = null, customWorkOrderUrl = null) => {
    const headers = indents[0] || [];
    const totalCols = Math.max(headers.length, 82);
    const row = existingRow ? [...existingRow] : new Array(totalCols).fill('');
    while (row.length < totalCols) row.push('');

    const fieldValues = {
      'Timestamp': formattedDate,
      'Application Number': appNumber,
      'Serial Number': serialNumber,
      'Po Number': mainData['Po Number'] || '',
      'Work Order Copy': customWorkOrderUrl !== null ? customWorkOrderUrl : (mainData['Work Order Copy'] || ''),
      'Firm Name': mainData['Firm Name'] || '',
      'Party Name': mainData['Party Name'] || '',
      'Type Of Work': mainData['Type Of Work'] || '',
      'Lead Time To Start': mainData['Lead Time To Start'] || '',
      'Shift Type': mainData['Shift Type'] || '',
      'Type Of Industry': areaData['Type Of Industry'] || '',
      'Size Of Industry': areaData['Size Of Industry'] || '',
      'Area Of Application': areaData['Area Of Application'] || '',
      'Qty': areaData['Qty'] || '',
      'Rate': areaData['Rate'] || '',
      'Company': mainData['Company'] || '',
      'Incharge': mainData['Incharge'] || '',
      'Planned 1': formattedDate
    };

    // Standard fallback indices if headers are missing
    const fallbackIndices = {
      'Timestamp': 0,
      'Application Number': 1,
      'Serial Number': 2,
      'Po Number': 3,
      'Work Order Copy': 4,
      'Firm Name': 5,
      'Party Name': 6,
      'Type Of Work': 7,
      'Lead Time To Start': 8,
      'Shift Type': 9,
      'Type Of Industry': 10,
      'Size Of Industry': 11,
      'Area Of Application': 12,
      'Qty': 13,
      'Rate': 14,
      'Company': 15,
      'Incharge': 16,
      'Planned 1': 17
    };

    // Apply fallbacks
    Object.keys(fallbackIndices).forEach(key => {
      const idx = fallbackIndices[key];
      if (fieldValues[key] !== undefined && fieldValues[key] !== '') {
        row[idx] = fieldValues[key];
      }
    });

    // Match dynamically according to actual sheet headers
    if (Array.isArray(headers) && headers.length > 0) {
      headers.forEach((h, colIdx) => {
        if (!h) return;
        const hClean = h.toString().trim().toLowerCase();
        for (const [key, val] of Object.entries(fieldValues)) {
          if (hClean === key.toLowerCase()) {
            row[colIdx] = val;
            break;
          }
        }
      });
    }

    return row;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    const pad = (n) => n.toString().padStart(2, '0');
    const d = new Date();
    const formattedDate = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    try {
      let workOrderUrl = mainFormData['Work Order Copy'] || '';
      if (fileObj) {
        const uploadedUrl = await uploadFile(fileObj);
        if (uploadedUrl) {
          workOrderUrl = uploadedUrl;
        }
      }

      if (editingRowIndex) {
        const existingHeaders = indents[0] || [];
        const appColIdx = existingHeaders.findIndex(h => h && h.toString().trim().toLowerCase() === 'application number');
        const serialColIdx = existingHeaders.findIndex(h => h && h.toString().trim().toLowerCase() === 'serial number');
        
        const existingRow = indents[editingRowIndex - 6] || [];
        const existingAppNumber = editingRowData?.['Application Number'] || (appColIdx !== -1 ? existingRow[appColIdx] : '');
        const existingSerialNumber = editingRowData?.['Serial Number'] || (serialColIdx !== -1 ? existingRow[serialColIdx] : '1');

        const updatedRowData = buildRowData(
          mainFormData,
          areas[0],
          existingAppNumber,
          existingSerialNumber,
          formattedDate,
          existingRow,
          workOrderUrl
        );

        const params = new URLSearchParams();
        params.append('sheetName', SHEET_NAME);
        params.append('action', 'update');
        params.append('rowIndex', editingRowIndex);
        params.append('rowData', JSON.stringify(updatedRowData));

        const response = await serialFetch(SCRIPT_URL, {
          method: 'POST',
          body: params
        });
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to update record.');
        }
      } else {
        // Generate a single Application Number for this new indent
        const appNumber = getNextApplicationNumber();

        // Build row data for all areas
        const allRows = areas.map((area, i) =>
          buildRowData(mainFormData, area, appNumber, i + 1, formattedDate, null, workOrderUrl)
        );

        const params = new URLSearchParams();
        params.append('sheetName', SHEET_NAME);
        params.append('action', 'batchInsert');
        params.append('rowsData', JSON.stringify(allRows));

        const response = await serialFetch(SCRIPT_URL, {
          method: 'POST',
          body: params
        });
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to save new indent records.');
        }
      }

      setMessage({ type: 'success', text: editingRowIndex ? 'Record updated successfully!' : 'Record(s) created successfully!' });
      window.dispatchEvent(new Event('fms-updated'));
      setMainFormData(initialMainForm);
      setAreas([{ ...initialArea }]);
      setFileObj(null);
      setEditingRowIndex(null);
      setEditingRowData(null);
      setIsModalOpen(false);
      fetchIndents();
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: error.message || 'Network error occurred while saving.' });
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

    setEditingRowData(dataObj);
    setMainFormData({
      'Po Number': dataObj['Po Number'] || '',
      'Work Order Copy': dataObj['Work Order Copy'] || '',
      'Firm Name': dataObj['Firm Name'] || '',
      'Company': dataObj['Company'] || '',
      'Incharge': dataObj['Incharge'] || '',
      'Party Name': dataObj['Party Name'] || '',
      'Type Of Work': dataObj['Type Of Work'] || '',
      'Lead Time To Start': dataObj['Lead Time To Start'] || '',
      'Shift Type': dataObj['Shift Type'] || ''
    });

    setAreas([{
      'Type Of Industry': dataObj['Type Of Industry'] || '',
      'Size Of Industry': dataObj['Size Of Industry'] || '',
      'Area Of Application': dataObj['Area Of Application'] || '',
      'Qty': dataObj['Qty'] || '',
      'Rate': dataObj['Rate'] || ''
    }]);

    setFileObj(null);
    setEditingRowIndex(rowIndex);
    setIsModalOpen(true);
  };

  const openNewModal = () => {
    setMainFormData(initialMainForm);
    setAreas([{ ...initialArea }]);
    setFileObj(null);
    setEditingRowIndex(null);
    setEditingRowData(null);
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
    setMainFormData(initialMainForm);
    setAreas([{ ...initialArea }]);
    setFileObj(null);
    setEditingRowIndex(null);
    setEditingRowData(null);
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
          {(() => {
            let isViewOnly = false;
            try {
              const u = JSON.parse(localStorage.getItem('botivate_user') || '{}');
              if (
                u.isViewOnly === true ||
                u.isViewOnly === 'Yes' ||
                u.viewOnly === 'Yes' ||
                u.viewOnly === 'View Only' ||
                u['View Only'] === 'Yes' ||
                u['View Only'] === 'View Only' ||
                u.role === 'View Only' ||
                u.role === 'ViewOnly' ||
                u.role?.toLowerCase() === 'view only'
              ) isViewOnly = true;
            } catch (e) {}
            return (
              <button 
                className="btn btn-primary" 
                onClick={openNewModal}
                disabled={isViewOnly}
                style={isViewOnly ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                title={isViewOnly ? "Creation disabled for View Only users" : "Create New Indent"}
              >
                <Plus size={18} />
                Create New Indent
              </button>
            );
          })()}
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

      {/* Modal Form Section using System Styling */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card animate-fade-in" style={{ maxWidth: '850px', width: '100%', padding: '2.5rem' }}>
            <button onClick={cancelEdit} className="modal-close-btn">
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
              {/* Main Form Fields Section - Styled with System Form Controls */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                {/* PO Number */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">PO Number</label>
                  <input
                    type="text"
                    name="Po Number"
                    value={mainFormData['Po Number']}
                    onChange={handleMainChange}
                    className="form-input"
                    placeholder="Enter PO Number"
                    disabled={loading}
                  />
                </div>

                {/* Select File: Work Order Copy */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Select File (Work Order Copy)</label>
                  {mainFormData['Work Order Copy'] && mainFormData['Work Order Copy'].startsWith('http') && (
                    <div style={{ marginBottom: '0.35rem' }}>
                      <a href={mainFormData['Work Order Copy']} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)', fontSize: '0.85rem', textDecoration: 'underline' }}>View Current File</a>
                    </div>
                  )}
                  <input
                    type="file"
                    name="Work Order Copy"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        setFileObj(file);
                        setMainFormData(prev => ({ ...prev, 'Work Order Copy': file.name }));
                      }
                    }}
                    className="form-input"
                    disabled={loading}
                  />
                </div>

                {/* Firm Name */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Firm Name</label>
                  <div className="select-wrapper">
                    <select
                      name="Firm Name"
                      value={mainFormData['Firm Name']}
                      onChange={handleMainChange}
                      className="form-input"
                      disabled={loading}
                    >
                      <option value="">Select Firm Name</option>
                      {masterOptions['Firm Name']?.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="select-chevron" />
                  </div>
                </div>

                {/* Company Name */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Company Name</label>
                  <div className="select-wrapper">
                    <select
                      name="Company"
                      value={mainFormData['Company']}
                      onChange={handleMainChange}
                      className="form-input"
                      disabled={loading}
                    >
                      <option value="">Select Company Name</option>
                      {masterOptions['Company']?.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="select-chevron" />
                  </div>
                </div>

                {/* Incharge */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Incharge</label>
                  <div className="select-wrapper">
                    <select
                      name="Incharge"
                      value={mainFormData['Incharge']}
                      onChange={handleMainChange}
                      className="form-input"
                      disabled={loading}
                    >
                      <option value="">Select Incharge</option>
                      {masterOptions['Incharge']?.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="select-chevron" />
                  </div>
                </div>

                {/* Party Name */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Party Name</label>
                  <div className="select-wrapper">
                    <select
                      name="Party Name"
                      value={mainFormData['Party Name']}
                      onChange={handleMainChange}
                      className="form-input"
                      disabled={loading}
                    >
                      <option value="">Select Party Name</option>
                      {masterOptions['Party Name']?.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="select-chevron" />
                  </div>
                </div>

                {/* Type Of Work */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Type Of Work</label>
                  <div className="select-wrapper">
                    <select
                      name="Type Of Work"
                      value={mainFormData['Type Of Work']}
                      onChange={handleMainChange}
                      className="form-input"
                      disabled={loading}
                    >
                      <option value="">Select Type Of Work</option>
                      {masterOptions['Type Of Work']?.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="select-chevron" />
                  </div>
                </div>

                {/* Lead Time To Start */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Lead Time To Start</label>
                  <input
                    type="text"
                    name="Lead Time To Start"
                    value={mainFormData['Lead Time To Start']}
                    onChange={handleMainChange}
                    className="form-input"
                    placeholder="Enter Lead Time"
                    disabled={loading}
                  />
                </div>

                {/* Shift Type */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Shift Type</label>
                  <div className="select-wrapper">
                    <select
                      name="Shift Type"
                      value={mainFormData['Shift Type']}
                      onChange={handleMainChange}
                      className="form-input"
                      disabled={loading}
                    >
                      <option value="">Select Shift Type</option>
                      {masterOptions['Shift Type']?.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="select-chevron" />
                  </div>
                </div>
              </div>

              {/* Dynamic Area Cards Section - Styled with System Design */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1rem' }}>
                  Area Details
                </h3>

                {areas.map((area, index) => (
                  <div key={index} style={{
                    background: 'var(--bg-page)',
                    border: '1.5px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.5rem',
                    marginBottom: '1.25rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                      <h4 style={{ fontSize: '1.05rem', color: 'var(--primary-800)', fontWeight: 700, margin: 0 }}>
                        Area {index + 1}
                      </h4>
                      {areas.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => removeArea(index)}
                          disabled={loading}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem', borderRadius: '8px' }}
                        >
                          <Trash2 size={14} style={{ marginRight: '0.35rem' }} />
                          Delete Area
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                      {/* Type of Industry */}
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Type of Industry</label>
                        <div className="select-wrapper">
                          <select
                            name="Type Of Industry"
                            value={area['Type Of Industry']}
                            onChange={(e) => handleAreaChange(index, e)}
                            className="form-input"
                            disabled={loading}
                          >
                            <option value="">Select Type of Industry</option>
                            {masterOptions['Type Of Industry']?.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                          <ChevronDown size={16} className="select-chevron" />
                        </div>
                      </div>

                      {/* Size of Industry */}
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Size of Industry</label>
                        <input
                          type="text"
                          name="Size Of Industry"
                          value={area['Size Of Industry']}
                          onChange={(e) => handleAreaChange(index, e)}
                          className="form-input"
                          placeholder="Enter Size of Industry"
                          disabled={loading}
                        />
                      </div>

                      {/* Area of Application */}
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Area of Application</label>
                        <input
                          type="text"
                          name="Area Of Application"
                          value={area['Area Of Application']}
                          onChange={(e) => handleAreaChange(index, e)}
                          className="form-input"
                          placeholder="Enter Area of Application"
                          disabled={loading}
                        />
                      </div>

                      {/* Quantity */}
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Quantity</label>
                        <input
                          type="number"
                          name="Qty"
                          value={area['Qty']}
                          onChange={(e) => handleAreaChange(index, e)}
                          className="form-input"
                          placeholder="Enter Quantity"
                          disabled={loading}
                        />
                      </div>

                      {/* Rate */}
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Rate</label>
                        <input
                          type="number"
                          name="Rate"
                          value={area['Rate']}
                          onChange={(e) => handleAreaChange(index, e)}
                          className="form-input"
                          placeholder="Enter Rate"
                          disabled={loading}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons Section - System Styled */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={addArea}
                  disabled={loading}
                  style={{
                    background: 'var(--success-bg)',
                    color: 'var(--success-color)',
                    border: '1.5px solid var(--success-border)',
                    fontWeight: 600
                  }}
                >
                  <Plus size={18} style={{ marginRight: '0.35rem' }} />
                  Add Area
                </button>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button type="button" className="btn" onClick={cancelEdit} disabled={loading} style={{ background: 'var(--bg-dark)', color: 'var(--text-main)' }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: '150px' }}>
                    {loading ? <Loader2 size={20} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> : (editingRowIndex ? <Edit2 size={20} /> : <Plus size={20} />)}
                    {editingRowIndex ? 'Update Record' : 'Save Record'}
                  </button>
                </div>
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
                      const actualRowIndex = index + 7;
                      const fileLink = findFileLink(rawHeaders, row, ['Work Order Copy']);
                      const rowActions = [
                        { key: 'edit', label: 'Edit', onClick: () => handleEdit(actualRowIndex, row), disabled: loading },
                        ...(fileLink ? [{ key: 'download', label: 'Download Work Order', href: fileLink }] : []),
                        { key: 'delete', label: 'Delete', onClick: () => handleDelete(actualRowIndex), disabled: loading },
                      ];
                      return (
                        <tr key={index}>
                          <td className="sticky-action" data-label="Action">
                            <ActionButtons actions={rowActions} maxInline={3} />
                          </td>
                          {columnsToRender.map((col, idx) => {
                            const val = row ? row[col.colIdx] : '';
                            return (
                              <td key={idx} data-label={col.label}>
                                <TableCellValue value={val} label={col.label} />
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
    </div>
  );
};

export default CreateIndent;


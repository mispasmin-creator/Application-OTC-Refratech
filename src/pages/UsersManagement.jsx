import React, { useState, useEffect } from 'react';
import { serialFetch } from '../lib/serialFetch';
import { Search, Loader2, Plus, Edit2, Trash2, Eye, EyeOff, Users, X, ChevronDown } from 'lucide-react';
import ActionButtons from '../components/ActionButtons';

const SCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;
const SHEET_NAME = 'login';

const ALL_PAGES = [
  'Dashboard',
  'Order Form',
  'PO Confirmation',
  'Site Received',
  'KILN Testing',
  'Board Suttering',
  'Casting Inspection',
  'Sound Test',
  'Heating Entry',
  'Take Qty Conf.',
  'Make Invoice',
  'Collection',
  'Settle Account',
  'Profit & Loss',
  'Transfer Items',
  'Users'
];

const emptyForm = { Name: '', 'Firm Name': '', 'User Name': '', Password: '', Role: 'User', 'View Only': 'No', 'Page Acess': 'All' };
const ROLES = ['Admin', 'User'];

const UsersManagement = () => {
  const [users, setUsers] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState(emptyForm);
  const [editingRow, setEditingRow] = useState(null); // null = add, number = edit row index
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState({});
  const [firmOptions, setFirmOptions] = useState([]);
  const [selectedPages, setSelectedPages] = useState(ALL_PAGES);

  useEffect(() => {
    fetchUsers();
    fetchMasterData();
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
        const mHeaders = result.data[0];
        const dataRows = result.data.slice(1);
        const clean = (str) => (str ? str.toString().trim().toLowerCase().replace(/\s+/g, ' ') : '');
        const firmIdx = mHeaders.findIndex(h => clean(h) === 'firm name' || clean(h).includes('firm'));
        
        if (firmIdx !== -1) {
          const firms = new Set();
          dataRows.forEach(row => {
            if (row && row[firmIdx] && row[firmIdx].toString().trim() !== '') {
              firms.add(row[firmIdx].toString().trim());
            }
          });
          setFirmOptions(Array.from(firms));
        }
      }
    } catch (e) {
      console.error("Error fetching Master sheet firm names:", e);
    }
  };

  const fetchUsers = async (retryCount = 0) => {
    setFetching(true);
    if (retryCount === 0) setMessage({ type: '', text: '' });
    let didRetry = false;
    try {
      const response = await serialFetch(`${SCRIPT_URL}?sheet=${SHEET_NAME}`);
      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch {
        if (retryCount < 2) {
          didRetry = true;
          setTimeout(() => fetchUsers(retryCount + 1), 1200);
          return;
        }
        setMessage({ type: 'error', text: 'Failed to connect to Google Sheet. Please click Refresh.' });
        return;
      }
      if (result.success && result.data && result.data.length > 0) {
        setHeaders(result.data[0]);
        setUsers(result.data.slice(1).map((row, i) => ({ rowData: row, originalIndex: i + 2 })));
      } else {
        setHeaders([]);
        setUsers([]);
      }
    } catch (e) {
      if (retryCount < 2) {
        didRetry = true;
        setTimeout(() => fetchUsers(retryCount + 1), 1200);
        return;
      }
      setMessage({ type: 'error', text: 'Network error fetching users. Please click Refresh.' });
    } finally {
      if (!didRetry) setFetching(false);
    }
  };

  const getColIdx = (name) => headers.findIndex(h => {
    if (!h) return false;
    const clean = (s) => s.toString().trim().toLowerCase().replace(/\s+/g, '');
    const target = clean(name);
    const curr = clean(h);
    if (curr === target) return true;
    if (target.includes('pageac') && curr.includes('pageac')) return true;
    if ((target.includes('viewonly') || target === 'permission') && (curr.includes('viewonly') || curr === 'permission')) return true;
    return false;
  });

  const getVal = (row, colName) => {
    const idx = getColIdx(colName);
    return idx !== -1 && row[idx] !== undefined ? row[idx] : '';
  };

  const openAdd = () => {
    setFormData({ ...emptyForm, Role: 'User', 'View Only': 'No', 'Page Acess': 'All' });
    setSelectedPages(ALL_PAGES);
    setEditingRow(null);
    setShowForm(true);
    setMessage({ type: '', text: '' });
  };

  const openEdit = (item) => {
    const rawPageAccess = getVal(item.rowData, 'Page Acess') || getVal(item.rowData, 'Page Access');
    let pages = ALL_PAGES;
    if (rawPageAccess && rawPageAccess.trim() !== '' && rawPageAccess.trim().toLowerCase() !== 'all' && rawPageAccess.trim() !== '*') {
      const parsed = rawPageAccess.split(',').map(s => s.trim()).filter(Boolean);
      pages = ALL_PAGES.filter(p => parsed.some(userP => userP.toLowerCase() === p.toLowerCase()));
    }
    setSelectedPages(pages);

    const rawVO = getVal(item.rowData, 'View Only') || getVal(item.rowData, 'ViewOnly') || getVal(item.rowData, 'Permission');
    const isVO = rawVO === 'Yes' || rawVO === 'View Only' || rawVO === 'true' || rawVO === true;

    setFormData({
      Name: getVal(item.rowData, 'Name'),
      'Firm Name': getVal(item.rowData, 'Firm Name'),
      'User Name': getVal(item.rowData, 'User Name'),
      Password: getVal(item.rowData, 'Password'),
      Role: getVal(item.rowData, 'Role') || 'User',
      'View Only': isVO ? 'Yes' : 'No',
      'Page Acess': rawPageAccess || 'All',
    });
    setEditingRow(item.originalIndex);
    setShowForm(true);
    setMessage({ type: '', text: '' });
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingRow(null);
    setFormData(emptyForm);
    setSelectedPages(ALL_PAGES);
  };

  const handlePageCheckboxChange = (page) => {
    setSelectedPages(prev => {
      let updated;
      if (prev.includes(page)) {
        updated = prev.filter(p => p !== page);
      } else {
        updated = [...prev, page];
      }
      const pageAccessStr = updated.length === ALL_PAGES.length ? 'All' : updated.join(', ');
      setFormData(f => ({ ...f, 'Page Acess': pageAccessStr }));
      return updated;
    });
  };

  const handleToggleAllPages = () => {
    if (selectedPages.length === ALL_PAGES.length) {
      setSelectedPages([]);
      setFormData(f => ({ ...f, 'Page Acess': '' }));
    } else {
      setSelectedPages(ALL_PAGES);
      setFormData(f => ({ ...f, 'Page Acess': 'All' }));
    }
  };

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData['User Name'] || !formData.Password) {
      setMessage({ type: 'error', text: 'User Name and Password are required.' });
      return;
    }
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Build row array ordered by current headers
      let rowArray;
      if (headers.length > 0) {
        rowArray = headers.map(h => {
          if (!h) return '';
          const cleanH = h.toString().trim().toLowerCase().replace(/\s+/g, '');
          const key = Object.keys(formData).find(k => {
            const cleanK = k.toLowerCase().replace(/\s+/g, '');
            if (cleanK === cleanH) return true;
            if (cleanK.includes('pageac') && cleanH.includes('pageac')) return true;
            if (cleanK.includes('viewonly') && cleanH.includes('viewonly')) return true;
            return false;
          });
          return key ? (formData[key] || '') : '';
        });
      } else {
        rowArray = ['Name', 'Firm Name', 'User Name', 'Password', 'Role', 'View Only', 'Page Acess'].map(k => formData[k] || '');
      }

      const params = new URLSearchParams();
      params.append('sheetName', SHEET_NAME);
      params.append('action', editingRow ? 'update' : 'insert');
      params.append('rowData', JSON.stringify(rowArray));
      if (editingRow) params.append('rowIndex', editingRow);

      const res = await serialFetch(SCRIPT_URL, { method: 'POST', body: params });
      const result = await res.json();

      if (result.success) {
        setMessage({ type: 'success', text: editingRow ? 'User updated successfully!' : 'User added successfully!' });
        window.dispatchEvent(new Event('fms-updated'));
        setShowForm(false);
        setEditingRow(null);
        setFormData(emptyForm);
        fetchUsers();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to save user.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error while saving.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (item) => {
    const uname = getVal(item.rowData, 'User Name') || `Row ${item.originalIndex}`;
    if (!window.confirm(`Delete user "${uname}"?`)) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('sheetName', SHEET_NAME);
      params.append('action', 'delete');
      params.append('rowIndex', item.originalIndex);
      const res = await serialFetch(SCRIPT_URL, { method: 'POST', body: params });
      const result = await res.json();
      if (result.success) {
        setMessage({ type: 'success', text: 'User deleted successfully.' });
        window.dispatchEvent(new Event('fms-updated'));
        fetchUsers();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to delete.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error while deleting.' });
    } finally {
      setLoading(false);
    }
  };

  const togglePassword = (idx) => setShowPasswords(prev => ({ ...prev, [idx]: !prev[idx] }));

  const colNames = ['Name', 'Firm Name', 'User Name', 'Password', 'Role', 'View Only', 'Page Acess'];

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Users Management</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage admin panel users from the Login sheet.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {(() => {
            let isViewOnly = false;
            try {
              const u = JSON.parse(localStorage.getItem('botivate_user') || '{}');
              if (u.role === 'View Only' || u.role === 'ViewOnly' || u.role?.toLowerCase() === 'view only') isViewOnly = true;
            } catch (e) {}
            return (
              <button 
                className="btn btn-primary" 
                onClick={openAdd} 
                disabled={fetching || loading || isViewOnly}
                style={isViewOnly ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                title={isViewOnly ? "Adding users is disabled for View Only users" : "Add User"}
              >
                <Plus size={18} /> Add User
              </button>
            );
          })()}
        </div>
      </div>

      {/* Message */}
      {message.text && (
        <div style={{
          padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem',
          background: message.type === 'error' ? 'var(--error-bg)' : 'var(--success-bg)',
          color: message.type === 'error' ? 'var(--error-color)' : 'var(--success-color)',
          border: `1px solid ${message.type === 'error' ? 'var(--error-border)' : 'var(--success-border)'}`
        }}>
          {message.text}
        </div>
      )}

      {/* Add / Edit Form Modal Popup */}
      {showForm && (
        <div className="modal-overlay">
          <div className="glass-panel animate-fade-in" style={{ padding: '2rem', borderRadius: '12px', width: '560px', maxWidth: '90%', border: '1px solid var(--border-color)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem' }}>
                {editingRow ? 'Edit User' : 'Add New User'}
              </h2>
              <button 
                onClick={handleCancel} 
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                disabled={loading}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Name</label>
                  <input
                    type="text"
                    name="Name"
                    value={formData.Name}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="Enter Name"
                    disabled={loading}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Firm Name</label>
                  <div className="select-wrapper">
                    <select
                      name="Firm Name"
                      value={formData['Firm Name']}
                      onChange={handleChange}
                      className="form-input"
                      disabled={loading}
                      style={{ backgroundColor: '#fff' }}
                    >
                      <option value="">Select Firm Name</option>
                      {firmOptions.map(firm => (
                        <option key={firm} value={firm}>{firm}</option>
                      ))}
                      {formData['Firm Name'] && !firmOptions.includes(formData['Firm Name']) && (
                        <option value={formData['Firm Name']}>{formData['Firm Name']}</option>
                      )}
                    </select>
                    <ChevronDown size={16} className="select-chevron" />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">User Name *</label>
                  <input
                    type="text"
                    name="User Name"
                    value={formData['User Name']}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="Enter User Name"
                    disabled={loading}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Password *</label>
                  <input
                    type="text"
                    name="Password"
                    value={formData.Password}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="Enter Password"
                    disabled={loading}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Role</label>
                  <div className="select-wrapper">
                    <select
                      name="Role"
                      value={formData.Role}
                      onChange={(e) => {
                        const newRole = e.target.value;
                        if (newRole === 'Admin') {
                          setFormData(prev => ({ ...prev, Role: newRole, 'Page Acess': 'All' }));
                          setSelectedPages(ALL_PAGES);
                        } else {
                          setFormData(prev => ({ ...prev, Role: newRole }));
                        }
                      }}
                      className="form-input"
                      disabled={loading}
                      style={{ backgroundColor: '#fff' }}
                    >
                      <option value="">Select Role</option>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <ChevronDown size={16} className="select-chevron" />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Permission</label>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    cursor: 'pointer',
                    height: '42px',
                    padding: '0 0.75rem',
                    background: formData['View Only'] === 'Yes' ? 'rgba(234, 88, 12, 0.08)' : 'rgba(255,255,255,0.7)',
                    border: `1px solid ${formData['View Only'] === 'Yes' ? 'rgba(234, 88, 12, 0.4)' : 'var(--border-color)'}`,
                    borderRadius: '8px',
                    transition: 'all 0.15s ease'
                  }}>
                    <input
                      type="checkbox"
                      name="View Only"
                      checked={formData['View Only'] === 'Yes'}
                      onChange={(e) => setFormData(prev => ({ ...prev, 'View Only': e.target.checked ? 'Yes' : 'No' }))}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--primary-color)', cursor: 'pointer' }}
                      disabled={loading}
                    />
                    <span style={{ fontSize: '0.85rem', fontWeight: formData['View Only'] === 'Yes' ? '600' : 'normal', color: formData['View Only'] === 'Yes' ? '#ea580c' : 'var(--text-main)' }}>
                      View Only (Disable Edits)
                    </span>
                  </label>
                </div>

                {formData.Role === 'User' && (
                  <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <label className="form-label" style={{ marginBottom: 0 }}>Page Access</label>
                      <button
                        type="button"
                        onClick={handleToggleAllPages}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary-color)',
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          fontWeight: '600'
                        }}
                      >
                        {selectedPages.length === ALL_PAGES.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                      gap: '0.5rem',
                      maxHeight: '160px',
                      overflowY: 'auto',
                      padding: '0.75rem',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.7)'
                    }}>
                      {ALL_PAGES.map(page => {
                        const isChecked = selectedPages.includes(page);
                        return (
                          <label
                            key={page}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              fontSize: '0.82rem',
                              cursor: 'pointer',
                              padding: '4px 6px',
                              borderRadius: '4px',
                              background: isChecked ? 'rgba(111, 123, 57, 0.1)' : 'transparent',
                              color: isChecked ? 'var(--primary-color)' : 'var(--text-main)',
                              fontWeight: isChecked ? '600' : 'normal',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handlePageCheckboxChange(page)}
                              style={{ accentColor: 'var(--primary-color)', cursor: 'pointer' }}
                            />
                            <span>{page}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={handleCancel} disabled={loading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading
                    ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                    : (editingRow ? <Edit2 size={18} /> : <Plus size={18} />)
                  }
                  {editingRow ? 'Update User' : 'Add User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="glass-panel" style={{ padding: '2rem', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.15rem' }}>
            <Users size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
            All Users ({users.length})
          </h2>
        </div>

        {fetching ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem', display: 'block' }} />
            <p>Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Users size={48} style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.3 }} />
            <p>No users found in the Login sheet.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th className="sticky-action">Actions</th>
                  {colNames.map(col => (
                    <th key={col}>{col === 'Page Acess' ? 'Page Access' : col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((item, idx) => {
                  const rowActions = [
                    { key: 'edit', label: 'Edit', onClick: () => openEdit(item), disabled: loading },
                    { key: 'delete', label: 'Delete', onClick: () => handleDelete(item), disabled: loading },
                  ];
                  return (
                    <tr key={idx}>
                      <td className="sticky-action" data-label="Action">
                        <ActionButtons actions={rowActions} />
                      </td>
                      {colNames.map(col => {
                        const val = getVal(item.rowData, col);
                        if (col === 'Password') {
                          return (
                            <td key={col} data-label={col}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontFamily: 'monospace', letterSpacing: showPasswords[idx] ? 0 : '0.1em' }}>
                                  {showPasswords[idx] ? val : '••••••••'}
                                </span>
                                <button
                                  onClick={() => togglePassword(idx)}
                                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem' }}>
                                  {showPasswords[idx] ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                              </div>
                            </td>
                          );
                        }
                        if (col === 'Role') {
                          const roleColors = {
                            Admin: 'rgba(220,53,69,0.12)',
                            User: 'rgba(30,154,111,0.12)',
                            Manager: 'rgba(214,137,16,0.14)',
                            Supervisor: 'var(--primary-tint)',
                          };
                          const roleText = {
                            Admin: 'var(--error-color)',
                            User: 'var(--success-color)',
                            Manager: 'var(--warning-color)',
                            Supervisor: 'var(--primary-color)',
                          };
                          return (
                            <td key={col} data-label={col}>
                              <span className="status-pill" style={{
                                background: roleColors[val] || 'var(--bg-dark)',
                                color: roleText[val] || 'var(--text-muted)',
                              }}>
                                {val || '—'}
                              </span>
                            </td>
                          );
                        }
                        if (col === 'View Only') {
                          const isVO = val === 'Yes' || val === 'View Only' || val === 'true' || val === true;
                          return (
                            <td key={col} data-label="View Only">
                              <span className="status-pill" style={{
                                background: isVO ? 'rgba(234, 88, 12, 0.12)' : 'rgba(30, 154, 111, 0.12)',
                                color: isVO ? '#ea580c' : 'var(--success-color)',
                                fontSize: '0.8rem'
                              }}>
                                {isVO ? 'View Only' : 'Full Edit'}
                              </span>
                            </td>
                          );
                        }
                        if (col === 'Page Acess') {
                          return (
                            <td key={col} data-label="Page Access">
                              <span
                                style={{
                                  fontSize: '0.85rem',
                                  color: 'var(--text-main)',
                                  maxWidth: '220px',
                                  display: 'inline-block',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                                title={val || 'All'}
                              >
                                {val || 'All'}
                              </span>
                            </td>
                          );
                        }
                        return (
                          <td key={col} data-label={col}>
                            {val || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
      `}</style>
    </div>
  );
};

export default UsersManagement;

import React, { useState, useEffect } from 'react';
import { serialFetch } from '../lib/serialFetch';
import { Search, Loader2, RefreshCcw, Plus, Edit2, Trash2, Eye, EyeOff, Users } from 'lucide-react';
import ActionButtons from '../components/ActionButtons';

const SCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;
const SHEET_NAME = 'login';

const emptyForm = { Name: '', 'Firm Name': '', 'User Name': '', Password: '', Role: '' };
const ROLES = ['Admin', 'Manager', 'Supervisor', 'User'];

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

  useEffect(() => {
    fetchUsers();
  }, []);

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

  const getColIdx = (name) => headers.findIndex(h => h && h.toString().trim().toLowerCase() === name.toLowerCase());

  const getVal = (row, colName) => {
    const idx = getColIdx(colName);
    return idx !== -1 && row[idx] !== undefined ? row[idx] : '';
  };

  const openAdd = () => {
    setFormData(emptyForm);
    setEditingRow(null);
    setShowForm(true);
    setMessage({ type: '', text: '' });
  };

  const openEdit = (item) => {
    setFormData({
      Name: getVal(item.rowData, 'Name'),
      'Firm Name': getVal(item.rowData, 'Firm Name'),
      'User Name': getVal(item.rowData, 'User Name'),
      Password: getVal(item.rowData, 'Password'),
      Role: getVal(item.rowData, 'Role'),
    });
    setEditingRow(item.originalIndex);
    setShowForm(true);
    setMessage({ type: '', text: '' });
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingRow(null);
    setFormData(emptyForm);
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
          const key = Object.keys(emptyForm).find(k => k.toLowerCase() === h.toString().trim().toLowerCase());
          return key ? (formData[key] || '') : '';
        });
      } else {
        rowArray = ['Name', 'Firm Name', 'User Name', 'Password', 'Role'].map(k => formData[k] || '');
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

  const colNames = ['Name', 'Firm Name', 'User Name', 'Password', 'Role'];

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Users Management</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage admin panel users from the Login sheet.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn" onClick={fetchUsers} disabled={fetching || loading}>
            <RefreshCcw size={18} style={fetching ? { animation: 'spin 1s linear infinite' } : {}} />
            Refresh
          </button>
          <button className="btn btn-primary" onClick={openAdd} disabled={fetching || loading}>
            <Plus size={18} /> Add User
          </button>
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

      {/* Add / Edit Form */}
      {showForm && (
        <div className="glass-panel" style={{ padding: '2rem', borderRadius: '12px', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.15rem', marginBottom: '1.5rem' }}>
            {editingRow ? 'Edit User' : 'Add New User'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
              {['Name', 'Firm Name', 'User Name'].map(field => (
                <div key={field} className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{field}</label>
                  <input
                    type="text"
                    name={field}
                    value={formData[field]}
                    onChange={handleChange}
                    className="form-input"
                    placeholder={`Enter ${field}`}
                    disabled={loading}
                    required={field === 'User Name'}
                  />
                </div>
              ))}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Password</label>
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
                <select
                  name="Role"
                  value={formData.Role}
                  onChange={handleChange}
                  className="form-input"
                  disabled={loading}
                >
                  <option value="">Select Role</option>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading
                  ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  : (editingRow ? <Edit2 size={18} /> : <Plus size={18} />)
                }
                {editingRow ? 'Update User' : 'Add User'}
              </button>
              <button type="button" className="btn" onClick={handleCancel} disabled={loading}>
                Cancel
              </button>
            </div>
          </form>
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
                    <th key={col}>{col}</th>
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
                      <td className="sticky-action">
                        <ActionButtons actions={rowActions} />
                      </td>
                      {colNames.map(col => {
                        const val = getVal(item.rowData, col);
                        if (col === 'Password') {
                          return (
                            <td key={col}>
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
                            Manager: 'rgba(214,137,16,0.14)',
                            Supervisor: 'var(--primary-tint)',
                            User: 'rgba(30,154,111,0.12)',
                          };
                          const roleText = {
                            Admin: 'var(--error-color)',
                            Manager: 'var(--warning-color)',
                            Supervisor: 'var(--primary-color)',
                            User: 'var(--success-color)',
                          };
                          return (
                            <td key={col}>
                              <span className="status-pill" style={{
                                background: roleColors[val] || 'var(--bg-dark)',
                                color: roleText[val] || 'var(--text-muted)',
                              }}>
                                {val || '—'}
                              </span>
                            </td>
                          );
                        }
                        return (
                          <td key={col}>
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

import React, { useState, useEffect } from 'react';
import { serialFetch } from '../lib/serialFetch';
import { 
  Search, Loader2, Plus, Edit2, Trash2, Eye, EyeOff, Users, X, ChevronDown, 
  Check, Layers, Building2, Sliders, CheckSquare, Square
} from 'lucide-react';
import ActionButtons from '../components/ActionButtons';

const SCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;
const SHEET_NAME = 'login';

export const PAGE_GROUPS = [
  {
    group: 'General',
    description: 'System and Overview pages',
    pages: [
      'Dashboard',
      'Users'
    ]
  },
  {
    group: 'Application OTC',
    description: 'Order To Collection process pipeline',
    pages: [
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
      'Transfer Items'
    ]
  },
  {
    group: 'Application Planning',
    description: 'Order Planning and execution tracking',
    pages: [
      'Pending Order',
      'Actual Work Done',
      'Received At Site',
      'Planning Order',
      'Vendor Order',
      'Store',
      'Make Payment',
      'Application IMS'
    ]
  },
  {
    group: 'Asset Transfer',
    description: 'Fixed asset transfer and verification workflow',
    pages: [
      'Indent',
      'Site Received',
      'Checking'
    ]
  }
];

const ALL_PAGES = PAGE_GROUPS.flatMap(g => g.pages);

const emptyForm = { 
  Name: '', 
  'Firm Name': '', 
  'User Name': '', 
  Password: '', 
  Role: 'User', 
  'View Only': 'No', 
  'Page Acess': 'All' 
};
const ROLES = ['Admin', 'User'];

const UsersManagement = () => {
  const [users, setUsers] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState(emptyForm);
  const [editingRow, setEditingRow] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState({});
  const [firmOptions, setFirmOptions] = useState([]);
  
  // Page and Firm permission state
  const [selectedPages, setSelectedPages] = useState(ALL_PAGES);
  const [selectedFirms, setSelectedFirms] = useState([]); // Global/default firms
  const [pageFirmMap, setPageFirmMap] = useState({}); // Per-page firm custom overrides: { [pageName]: ['Firm1', 'Firm2'] }
  const [customizePageFirm, setCustomizePageFirm] = useState({}); // Toggles expanded custom firm selector for a page

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
        const clean = (str) => (str ? str.toString().trim().toLowerCase().replace(/\s+/g, '') : '');
        const firmIdx = mHeaders.findIndex(h => clean(h) === 'firmname' || clean(h).includes('firm'));
        
        if (firmIdx !== -1) {
          const firms = new Set();
          dataRows.forEach(row => {
            if (row && row[firmIdx] && row[firmIdx].toString().trim() !== '') {
              firms.add(row[firmIdx].toString().trim());
            }
          });
          const list = Array.from(firms);
          if (list.length > 0) {
            setFirmOptions(list);
            if (selectedFirms.length === 0) setSelectedFirms(list);
          }
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
          setTimeout(() => fetchUsers(retryCount + 1), 1000);
          return;
        }
        throw new Error("Could not parse users data");
      }

      if (result.success && result.data && result.data.length > 0) {
        const detectedHeaders = result.data[0];
        const rows = result.data.slice(1)
          .map((row, idx) => ({ rowData: row, originalIndex: idx + 2 }))
          .filter(item => item.rowData.some(cell => cell && cell.toString().trim() !== ''));

        setHeaders(detectedHeaders);
        setUsers(rows);
      } else {
        setHeaders(['Name', 'Firm Name', 'User Name', 'Password', 'Role', 'View Only', 'Page Acess']);
        setUsers([]);
      }
    } catch (err) {
      if (!didRetry) {
        console.error('Error fetching users:', err);
        setMessage({ type: 'error', text: 'Failed to load users from the Login sheet.' });
      }
    } finally {
      if (!didRetry) setFetching(false);
    }
  };

  const getColIdx = (colName) => {
    const clean = (s) => (s ? s.toString().trim().toLowerCase().replace(/\s+/g, '') : '');
    const target = clean(colName);
    let idx = headers.findIndex(h => clean(h) === target);
    if (idx !== -1) return idx;

    if (target.includes('pageac')) {
      idx = headers.findIndex(h => clean(h).includes('pageac'));
    } else if (target.includes('firm')) {
      idx = headers.findIndex(h => clean(h).includes('firm'));
    } else if (target.includes('username') || target.includes('user')) {
      idx = headers.findIndex(h => clean(h) === 'username' || clean(h) === 'user');
    } else if (target.includes('pass')) {
      idx = headers.findIndex(h => clean(h).includes('pass'));
    } else if (target.includes('role')) {
      idx = headers.findIndex(h => clean(h).includes('role'));
    } else if (target.includes('viewonly') || target.includes('permission')) {
      idx = headers.findIndex(h => clean(h).includes('viewonly') || clean(h).includes('permission'));
    }
    return idx;
  };

  const getVal = (row, colName) => {
    const idx = getColIdx(colName);
    return idx !== -1 && row[idx] !== undefined ? row[idx] : '';
  };

  const openAdd = () => {
    setFormData({ ...emptyForm, Role: 'User', 'View Only': 'No', 'Page Acess': 'All' });
    setSelectedPages(ALL_PAGES);
    setSelectedFirms(firmOptions.length > 0 ? firmOptions : []);
    setPageFirmMap({});
    setCustomizePageFirm({});
    setEditingRow(null);
    setShowForm(true);
    setMessage({ type: '', text: '' });
  };

  const openEdit = (item) => {
    // Parse Page Access
    const rawPageAccess = getVal(item.rowData, 'Page Acess') || getVal(item.rowData, 'Page Access');
    let pages = ALL_PAGES;
    if (rawPageAccess && rawPageAccess.trim() !== '' && rawPageAccess.trim().toLowerCase() !== 'all' && rawPageAccess.trim() !== '*') {
      const parsed = rawPageAccess.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      pages = ALL_PAGES.filter(p => parsed.some(userP => userP === p.toLowerCase() || p.toLowerCase().includes(userP) || userP.includes(p.toLowerCase())));
    }
    setSelectedPages(pages);

    // Parse Firm Name (supports simple comma string, 'All', or JSON page map)
    const rawFirmName = getVal(item.rowData, 'Firm Name');
    let defaultFirms = firmOptions.length > 0 ? [...firmOptions] : [];
    let customMap = {};

    if (rawFirmName) {
      const trimmed = rawFirmName.toString().trim();
      if (trimmed.startsWith('{')) {
        try {
          const parsedObj = JSON.parse(trimmed);
          if (parsedObj.default && Array.isArray(parsedObj.default)) {
            defaultFirms = parsedObj.default;
          }
          if (parsedObj.pages && typeof parsedObj.pages === 'object') {
            customMap = parsedObj.pages;
          }
        } catch (_) {}
      } else if (trimmed.toLowerCase() === 'all' || trimmed === '*') {
        defaultFirms = firmOptions.length > 0 ? [...firmOptions] : [];
      } else {
        defaultFirms = trimmed.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    setSelectedFirms(defaultFirms);
    setPageFirmMap(customMap);
    setCustomizePageFirm(
      Object.keys(customMap).reduce((acc, p) => ({ ...acc, [p]: true }), {})
    );

    const rawVO = getVal(item.rowData, 'View Only') || getVal(item.rowData, 'ViewOnly') || getVal(item.rowData, 'Permission');
    const isVO = rawVO === 'Yes' || rawVO === 'View Only' || rawVO === 'true' || rawVO === true;

    setFormData({
      Name: getVal(item.rowData, 'Name'),
      'Firm Name': rawFirmName || 'All',
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
    setSelectedFirms([]);
    setPageFirmMap({});
    setCustomizePageFirm({});
  };

  // Global Firm toggle
  const handleToggleFirm = (firm) => {
    setSelectedFirms(prev => {
      if (prev.includes(firm)) {
        return prev.filter(f => f !== firm);
      } else {
        return [...prev, firm];
      }
    });
  };

  const handleToggleAllFirms = () => {
    if (selectedFirms.length === firmOptions.length) {
      setSelectedFirms([]);
    } else {
      setSelectedFirms([...firmOptions]);
    }
  };

  // Page Checkbox Change
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

  // Per-Page Firm customization
  const togglePageFirmCustomize = (page) => {
    setCustomizePageFirm(prev => {
      const nextState = !prev[page];
      if (nextState && !pageFirmMap[page]) {
        // Initialize page's custom firms with default selected firms
        setPageFirmMap(pm => ({ ...pm, [page]: [...selectedFirms] }));
      }
      return { ...prev, [page]: nextState };
    });
  };

  const handlePageSpecificFirmToggle = (page, firm) => {
    setPageFirmMap(prev => {
      const currentList = prev[page] || [...selectedFirms];
      let updated;
      if (currentList.includes(firm)) {
        updated = currentList.filter(f => f !== firm);
      } else {
        updated = [...currentList, firm];
      }
      return { ...prev, [page]: updated };
    });
  };

  const handlePageSpecificFirmToggleAll = (page) => {
    setPageFirmMap(prev => {
      const currentList = prev[page] || [];
      if (currentList.length === firmOptions.length) {
        return { ...prev, [page]: [] };
      } else {
        return { ...prev, [page]: [...firmOptions] };
      }
    });
  };

  const handleToggleGroup = (groupPages) => {
    const allGroupSelected = groupPages.every(p => selectedPages.includes(p));
    setSelectedPages(prev => {
      let updated;
      if (allGroupSelected) {
        updated = prev.filter(p => !groupPages.includes(p));
      } else {
        const toAdd = groupPages.filter(p => !prev.includes(p));
        updated = [...prev, ...toAdd];
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
      // Build Firm Name value
      const hasCustomPageFirms = Object.keys(pageFirmMap).some(
        page => customizePageFirm[page] && pageFirmMap[page] && pageFirmMap[page].length > 0
      );

      let finalFirmNameStr = '';
      if (hasCustomPageFirms) {
        finalFirmNameStr = JSON.stringify({
          default: selectedFirms,
          pages: pageFirmMap
        });
      } else {
        if (selectedFirms.length === 0) {
          finalFirmNameStr = '';
        } else if (selectedFirms.length === firmOptions.length && firmOptions.length > 0) {
          finalFirmNameStr = 'All';
        } else {
          finalFirmNameStr = selectedFirms.join(', ');
        }
      }

      const finalPageAccessStr = selectedPages.length === ALL_PAGES.length ? 'All' : selectedPages.join(', ');

      const updatedFormData = {
        ...formData,
        'Firm Name': finalFirmNameStr,
        'Page Acess': finalPageAccessStr
      };

      let rowArray;
      if (headers.length > 0) {
        rowArray = headers.map(h => {
          if (!h) return '';
          const cleanH = h.toString().trim().toLowerCase().replace(/\s+/g, '');
          const key = Object.keys(updatedFormData).find(k => {
            const cleanK = k.toLowerCase().replace(/\s+/g, '');
            if (cleanK === cleanH) return true;
            if (cleanK.includes('pageac') && cleanH.includes('pageac')) return true;
            if (cleanK.includes('viewonly') && cleanH.includes('viewonly')) return true;
            if (cleanK.includes('firm') && cleanH.includes('firm')) return true;
            return false;
          });
          return key ? (updatedFormData[key] || '') : '';
        });
      } else {
        rowArray = ['Name', 'Firm Name', 'User Name', 'Password', 'Role', 'View Only', 'Page Acess'].map(k => updatedFormData[k] || '');
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

  const filteredUsers = users.filter(item => {
    if (!searchQuery) return true;
    return item.rowData.some(cell =>
      cell && cell.toString().toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Users Management</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage user page access & flexible firm checkboxes per page.</p>
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
          <div className="modal-card animate-fade-in" style={{ maxWidth: '780px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.35rem', color: 'var(--primary-color)' }}>
                {editingRow ? 'Edit User & Firm Permissions' : 'Add New User & Firm Permissions'}
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    name="Name"
                    value={formData.Name}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="Enter Full Name"
                    disabled={loading}
                  />
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
                          setSelectedFirms(firmOptions);
                        } else {
                          setFormData(prev => ({ ...prev, Role: newRole }));
                        }
                      }}
                      className="form-input"
                      disabled={loading}
                    >
                      <option value="">Select Role</option>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <ChevronDown size={16} className="select-chevron" />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                  <label className="form-label">Permission Mode</label>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    cursor: 'pointer',
                    height: '42px',
                    padding: '0 0.75rem',
                    background: formData['View Only'] === 'Yes' ? 'rgba(234, 88, 12, 0.12)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${formData['View Only'] === 'Yes' ? '#ea580c' : 'var(--border-color)'}`,
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
                      View Only (Read Only - Disable Form Submissions & Edits)
                    </span>
                  </label>
                </div>
              </div>

              {/* GLOBAL FIRMS CHECKBOX SELECTOR */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <label className="form-label" style={{ marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                      <Building2 size={16} color="var(--primary-color)" /> Default / Allowed Firm Names (Checkboxes)
                    </label>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Selected firms apply by default to all pages unless customized for a specific page below.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleAllFirms}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary-color)',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                      textDecoration: 'underline'
                    }}
                  >
                    {selectedFirms.length === firmOptions.length ? 'Deselect All Firms' : 'Select All Firms'}
                  </button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                  {firmOptions.map(firm => {
                    const isChecked = selectedFirms.includes(firm);
                    return (
                      <label
                        key={firm}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          background: isChecked ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${isChecked ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-color)'}`,
                          color: isChecked ? '#34d399' : 'var(--text-main)',
                          fontSize: '0.85rem',
                          fontWeight: isChecked ? 600 : 'normal',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleFirm(firm)}
                          style={{ accentColor: '#10b981', cursor: 'pointer' }}
                        />
                        <span>{firm}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* PAGE ACCESS & PER-PAGE FIRM PERMISSION SELECTOR */}
              {formData.Role === 'User' && (
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Layers size={18} color="var(--primary-color)" /> Page Access & Page-Level Firm Permissions
                      </h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {selectedPages.length} of {ALL_PAGES.length} pages allowed. You can customize which firms a user sees on each individual page.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleAllPages}
                      className="btn-action-stage"
                      style={{ borderColor: 'var(--primary-color)', color: 'var(--primary-color)', padding: '0.3rem 0.8rem' }}
                    >
                      {selectedPages.length === ALL_PAGES.length ? 'Deselect All Pages' : 'Select All Pages'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {PAGE_GROUPS.map((grp) => {
                      const groupCount = grp.pages.filter(p => selectedPages.includes(p)).length;
                      const allGroupSelected = groupCount === grp.pages.length;

                      return (
                        <div 
                          key={grp.group} 
                          style={{ 
                            background: 'rgba(255,255,255,0.03)', 
                            border: '1px solid var(--border-color)', 
                            borderRadius: '10px', 
                            padding: '1rem' 
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <div>
                              <strong style={{ fontSize: '0.95rem', color: grp.group === 'Application Planning' ? '#38bdf8' : (grp.group === 'Application OTC' ? '#a78bfa' : 'var(--text-main)') }}>
                                {grp.group}
                              </strong>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                                ({groupCount}/{grp.pages.length} allowed)
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleGroup(grp.pages)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--primary-color)',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                fontWeight: 600,
                                textDecoration: 'underline'
                              }}
                            >
                              {allGroupSelected ? `Deselect ${grp.group}` : `Select All ${grp.group}`}
                            </button>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {grp.pages.map(page => {
                              const isPageChecked = selectedPages.includes(page);
                              const isCustomFirmsOpen = customizePageFirm[page];
                              const pageFirms = pageFirmMap[page] || selectedFirms;

                              return (
                                <div
                                  key={page}
                                  style={{
                                    border: `1px solid ${isPageChecked ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255,255,255,0.05)'}`,
                                    borderRadius: '8px',
                                    background: isPageChecked ? 'rgba(59, 130, 246, 0.05)' : 'rgba(255,255,255,0.01)',
                                    padding: '0.6rem 0.85rem',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <label
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        fontSize: '0.88rem',
                                        cursor: 'pointer',
                                        color: isPageChecked ? '#60a5fa' : 'var(--text-main)',
                                        fontWeight: isPageChecked ? 600 : 'normal'
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isPageChecked}
                                        onChange={() => handlePageCheckboxChange(page)}
                                        style={{ accentColor: '#3b82f6', cursor: 'pointer' }}
                                      />
                                      <span>{page}</span>
                                    </label>

                                    {isPageChecked && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontSize: '0.75rem', color: isCustomFirmsOpen ? '#34d399' : 'var(--text-muted)' }}>
                                          {isCustomFirmsOpen ? `${pageFirms.length} firms configured` : 'Default firms'}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => togglePageFirmCustomize(page)}
                                          style={{
                                            background: isCustomFirmsOpen ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)',
                                            border: `1px solid ${isCustomFirmsOpen ? '#10b981' : 'var(--border-color)'}`,
                                            color: isCustomFirmsOpen ? '#34d399' : 'var(--text-muted)',
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            fontSize: '0.72rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.3rem'
                                          }}
                                        >
                                          <Sliders size={12} />
                                          {isCustomFirmsOpen ? 'Hide Firm Setup' : 'Custom Firms'}
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  {/* Custom Page Firms Drawer */}
                                  {isPageChecked && isCustomFirmsOpen && (
                                    <div style={{
                                      marginTop: '0.6rem',
                                      paddingTop: '0.6rem',
                                      borderTop: '1px dashed rgba(255,255,255,0.1)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '0.4rem'
                                    }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                          Select firms accessible for <strong>{page}</strong>:
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handlePageSpecificFirmToggleAll(page)}
                                          style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '0.72rem', cursor: 'pointer', textDecoration: 'underline' }}
                                        >
                                          {pageFirms.length === firmOptions.length ? 'Deselect All' : 'Select All'}
                                        </button>
                                      </div>

                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                        {firmOptions.map(firm => {
                                          const isFirmAllowedForPage = pageFirms.includes(firm);
                                          return (
                                            <label
                                              key={firm}
                                              style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.3rem',
                                                padding: '3px 8px',
                                                borderRadius: '4px',
                                                background: isFirmAllowedForPage ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255,255,255,0.02)',
                                                border: `1px solid ${isFirmAllowedForPage ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.08)'}`,
                                                color: isFirmAllowedForPage ? '#34d399' : 'var(--text-muted)',
                                                fontSize: '0.75rem',
                                                cursor: 'pointer'
                                              }}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={isFirmAllowedForPage}
                                                onChange={() => handlePageSpecificFirmToggle(page, firm)}
                                                style={{ accentColor: '#10b981', cursor: 'pointer', transform: 'scale(0.85)' }}
                                              />
                                              <span>{firm}</span>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={handleCancel} disabled={loading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading
                    ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                    : (editingRow ? <Edit2 size={18} /> : <Plus size={18} />)
                  }
                  {editingRow ? 'Update User' : 'Save User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="table-container">
        <div style={{ position: 'relative', width: '100%', maxWidth: '100%', marginBottom: '1.5rem', display: 'flex' }}>
          <Search size={18} style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by User Name, Name, Firm Name, Role, or Page Access..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input"
            style={{ width: '100%', paddingLeft: '3rem', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '1rem' }}
          />
        </div>

        {fetching ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem', display: 'block' }} />
            <p>Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Users size={48} style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.3 }} />
            <p>No users found.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th className="sticky-action">Actions</th>
                  {colNames.map(col => (
                    <th key={col}>{col === 'Page Acess' ? 'Page Access' : col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((item, idx) => {
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
                                  type="button"
                                  onClick={() => togglePassword(idx)}
                                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem' }}>
                                  {showPasswords[idx] ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                              </div>
                            </td>
                          );
                        }
                        if (col === 'Firm Name') {
                          const str = (val || 'All').toString().trim();
                          let isJson = false;
                          let defaultFirms = [];
                          let customPagesCount = 0;

                          if (str.startsWith('{')) {
                            try {
                              const parsed = JSON.parse(str);
                              isJson = true;
                              defaultFirms = parsed.default || [];
                              customPagesCount = Object.keys(parsed.pages || {}).length;
                            } catch (_) {}
                          }

                          if (isJson) {
                            return (
                              <td key={col} data-label="Firm Name">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                  <span style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: 600 }}>
                                    {defaultFirms.length === firmOptions.length ? 'All Default Firms' : defaultFirms.join(', ')}
                                  </span>
                                  {customPagesCount > 0 && (
                                    <span style={{ fontSize: '0.7rem', color: '#38bdf8' }}>
                                      ({customPagesCount} pages customized)
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          }

                          const isAll = str.toLowerCase() === 'all' || str === '*';
                          return (
                            <td key={col} data-label="Firm Name">
                              {isAll ? (
                                <span className="status-pill" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', fontSize: '0.8rem' }}>
                                  All Firms
                                </span>
                              ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                  {str.split(',').map((f, fIdx) => (
                                    <span key={fIdx} style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                                      {f.trim()}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                          );
                        }
                        if (col === 'Role') {
                          const roleColors = {
                            Admin: 'rgba(220,53,69,0.12)',
                            User: 'rgba(30,154,111,0.12)',
                          };
                          const roleText = {
                            Admin: 'var(--error-color)',
                            User: 'var(--success-color)',
                          };
                          return (
                            <td key={col} data-label={col}>
                              <span className="status-pill" style={{
                                background: roleColors[val] || 'rgba(255,255,255,0.05)',
                                color: roleText[val] || 'var(--text-main)',
                              }}>
                                {val || 'User'}
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
                          const str = (val || 'All').toString().trim();
                          const isAll = str.toLowerCase() === 'all' || str === '*';
                          return (
                            <td key={col} data-label="Page Access" style={{ maxWidth: '300px' }}>
                              {isAll ? (
                                <span className="status-pill" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa', fontSize: '0.8rem' }}>
                                  All Pages (Full Access)
                                </span>
                              ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                  {str.split(',').map((p, pIdx) => (
                                    <span key={pIdx} style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                                      {p.trim()}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                          );
                        }
                        return (
                          <td key={col} data-label={col}>
                            {val || '—'}
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
    </div>
  );
};

export default UsersManagement;

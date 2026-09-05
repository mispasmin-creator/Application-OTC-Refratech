import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Loader2, Building2, Layers, Clock3, RefreshCw, ArrowRight, CheckCircle2,
  ListChecks, ClipboardCheck, Flame, Box, SearchCheck, Volume2, Thermometer,
  Receipt, Banknote, UserCheck, TrendingUp, Truck
} from 'lucide-react';
import { useFMS } from '../contexts/FMSContext';
import { serialFetch } from '../lib/serialFetch';
import { getCurrentUser, getAllowedFirms, filterRowsByFirmAccess } from '../lib/accessControl';
import { PIPELINE_STAGES, getCurrentStageForRow } from '../lib/pipelineStages';

const SCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;

// Icon + accent color per pipeline stage, in the same order as PIPELINE_STAGES.
const STAGE_META = [
  { icon: <ListChecks size={20} />, color: '#1B5BB0' },
  { icon: <ClipboardCheck size={20} />, color: '#0EA5E9' },
  { icon: <Flame size={20} />, color: '#D97706' },
  { icon: <Box size={20} />, color: '#8B5CF6' },
  { icon: <SearchCheck size={20} />, color: '#0891B2' },
  { icon: <Volume2 size={20} />, color: '#EC4899' },
  { icon: <Thermometer size={20} />, color: '#EF4444' },
  { icon: <CheckCircle2 size={20} />, color: '#10B981' },
  { icon: <Receipt size={20} />, color: '#F59E0B' },
  { icon: <Banknote size={20} />, color: '#059669' },
  { icon: <UserCheck size={20} />, color: '#6366F1' },
  { icon: <TrendingUp size={20} />, color: '#14B8A6' },
  { icon: <Truck size={20} />, color: '#F97316' },
];

const formatFirmAccess = (user) => {
  if (!user) return 'N/A';
  const allowed = getAllowedFirms(user, '/');
  if (allowed === null) return 'All Firms';
  if (!allowed.length) return 'No Firms Assigned';
  if (allowed.length === 1) return allowed[0];
  return `${allowed.length} Firms Assigned`;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const { pendingCounts, refreshCounts } = useFMS();

  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null); // null = no search run yet
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    const userDataStr = localStorage.getItem('botivate_user');
    if (userDataStr) {
      setUser(JSON.parse(userDataStr));
    }
  }, []);

  const totalPending = Object.values(pendingCounts).reduce((sum, n) => sum + (n || 0), 0);
  const stagesNeedingAttention = Object.values(pendingCounts).filter(n => n > 0).length;

  const runSearch = async (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    setSearching(true);
    setSearchError('');
    setSearchResults(null);

    try {
      const response = await serialFetch(`${SCRIPT_URL}?sheet=FMS`);
      const result = await response.json();

      if (!result.success || !result.data || result.data.length <= 6) {
        setSearchResults([]);
        return;
      }

      const headers = result.data[5];
      const cleanH = (s) => (s ? s.toString().trim().toLowerCase().replace(/\s+/g, '') : '');
      const appIdx = headers.findIndex(h => cleanH(h) === 'applicationnumber');
      const poIdx = headers.findIndex(h => cleanH(h) === 'ponumber');
      const partyIdx = headers.findIndex(h => cleanH(h) === 'partyname');
      const firmIdx = headers.findIndex(h => cleanH(h).includes('firm'));
      const qLower = q.toLowerCase();

      const allRows = result.data.slice(6).filter(row => row && row.some(c => c && c.toString().trim() !== ''));
      const allowedRows = filterRowsByFirmAccess(allRows, headers, '/', getCurrentUser());

      const matches = allowedRows
        .filter(row => {
          const app = appIdx !== -1 ? (row[appIdx] || '').toString().toLowerCase() : '';
          const po = poIdx !== -1 ? (row[poIdx] || '').toString().toLowerCase() : '';
          const party = partyIdx !== -1 ? (row[partyIdx] || '').toString().toLowerCase() : '';
          return app.includes(qLower) || po.includes(qLower) || party.includes(qLower);
        })
        .slice(0, 8)
        .map(row => ({
          appNumber: appIdx !== -1 ? row[appIdx] : '',
          poNumber: poIdx !== -1 ? row[poIdx] : '',
          partyName: partyIdx !== -1 ? row[partyIdx] : '',
          firmName: firmIdx !== -1 ? row[firmIdx] : '',
          stage: getCurrentStageForRow(row, headers),
        }));

      setSearchResults(matches);
    } catch (err) {
      console.error('Dashboard search error:', err);
      setSearchError('Search failed. Please try again.');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="dashboard-page animate-fade-in">
      <section className="dashboard-hero">
        <div>
          <span className="eyebrow">Operations overview</span>
          <h1>Welcome back, {user?.name || 'Admin'}!</h1>
          <p>
            Track every application across the Order-To-Collection pipeline, search any Application or PO number instantly, and jump straight to what needs action — no more hunting through each page.
          </p>
        </div>
        <div className="dashboard-hero-badge">
          <strong>Today's snapshot</strong>
          <span>{new Date().toLocaleDateString()}</span>
        </div>
      </section>

      <div className="dashboard-card-grid">
        <article className="stat-card">
          <div className="card-icon" style={{ background: '#1B5BB020', color: 'var(--primary-color)' }}>
            <Clock3 size={24} />
          </div>
          <div>
            <h3>Total Pending Actions</h3>
            <p className="card-value">{totalPending}</p>
          </div>
        </article>
        <article className="stat-card">
          <div className="card-icon" style={{ background: '#D19F2920', color: '#D19F29' }}>
            <Layers size={24} />
          </div>
          <div>
            <h3>Stages Needing Attention</h3>
            <p className="card-value">{stagesNeedingAttention} / {PIPELINE_STAGES.length}</p>
          </div>
        </article>
        <article className="stat-card">
          <div className="card-icon" style={{ background: '#3E9F5B20', color: '#3E9F5B' }}>
            <Building2 size={24} />
          </div>
          <div>
            <h3>Firm Access</h3>
            <p className="card-value" style={{ fontSize: '1.3rem' }}>{formatFirmAccess(user)}</p>
          </div>
        </article>
        <article className="stat-card">
          <div className="card-icon" style={{ background: '#8FB6EE33', color: 'var(--primary-color)' }}>
            <UserCheck size={24} />
          </div>
          <div>
            <h3>Logged In As</h3>
            <p className="card-value" style={{ fontSize: '1.3rem' }}>{user?.role || 'User'}</p>
          </div>
        </article>
      </div>

      <section className="dashboard-panel">
        <div className="panel-title-row">
          <h2>Quick Search</h2>
          <span className="badge badge-soft" style={{ color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
            Search by Application No. / PO No. / Party Name
          </span>
        </div>
        <form className="quick-search-box" onSubmit={runSearch}>
          <input
            type="text"
            className="form-input"
            placeholder="Enter Application Number, PO Number, or Party Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={searching || !searchQuery.trim()}>
            {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Search
          </button>
        </form>

        {searchError && (
          <div style={{ marginTop: '1rem', color: 'var(--error-color)' }}>{searchError}</div>
        )}

        {searchResults !== null && (
          <div className="quick-search-results">
            {searchResults.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No matching applications found.</p>
            ) : (
              searchResults.map((item, idx) => {
                const stage = item.stage || {};
                const pillClass = stage.completed ? 'completed' : (stage.queued ? 'queued' : 'pending');
                const pillLabel = stage.completed
                  ? 'All stages complete'
                  : `${stage.queued ? 'Next' : 'Pending'}: ${stage.label}`;
                return (
                  <div className="search-result-card" key={idx}>
                    <div className="search-result-meta">
                      <strong>{item.appNumber || 'N/A'}{item.poNumber ? ` · PO ${item.poNumber}` : ''}</strong>
                      <span>{item.partyName || 'Unknown party'}{item.firmName ? ` · ${item.firmName}` : ''}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span className={`stage-pill ${pillClass}`}>{pillLabel}</span>
                      {!stage.completed && stage.path && (
                        <button className="btn" onClick={() => navigate(stage.path)}>
                          Open <ArrowRight size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </section>

      <section className="dashboard-panel">
        <div className="panel-title-row">
          <h2>Pending Action Center</h2>
          <button
            type="button"
            className="badge badge-soft"
            style={{ color: 'var(--primary-color)', border: '1px solid var(--border-color)', cursor: 'pointer', background: 'var(--primary-tint)' }}
            onClick={refreshCounts}
          >
            <RefreshCw size={14} style={{ marginRight: '0.4rem' }} /> Refresh
          </button>
        </div>
        <div className="action-center-grid">
          {PIPELINE_STAGES.map((stage, idx) => {
            const count = pendingCounts[stage.path] || 0;
            const meta = STAGE_META[idx] || STAGE_META[0];
            return (
              <button
                key={stage.path}
                type="button"
                className={`action-card ${count > 0 ? 'has-pending' : 'zero'}`}
                onClick={() => navigate(stage.path)}
              >
                <div className="action-card-icon" style={{ background: `${meta.color}20`, color: meta.color }}>
                  {meta.icon}
                </div>
                <div className="action-card-body">
                  <strong>{stage.label}</strong>
                  <span className="action-card-count">{count > 0 ? `${count} pending` : 'All caught up'}</span>
                </div>
                <div className="action-card-badge">{count > 99 ? '99+' : count}</div>
              </button>
            );
          })}
        </div>
      </section>

      <aside className="dashboard-panel summary-panel">
        <div className="panel-title-row">
          <h2>Firm details</h2>
        </div>
        <div className="dashboard-summary-list">
          <div>
            <span>Firm Access</span>
            <strong>{formatFirmAccess(user)}</strong>
          </div>
          <div>
            <span>User Role</span>
            <strong>{user?.role || 'N/A'}</strong>
          </div>
          <div>
            <span>Username</span>
            <strong>{user?.username || 'N/A'}</strong>
          </div>
        </div>
        <p className="summary-note">
          Every table in this app now only shows data for the firm(s) you have access to. Click any card above to jump straight to its pending list — no manual filtering needed.
        </p>
      </aside>
    </div>
  );
};

export default Dashboard;

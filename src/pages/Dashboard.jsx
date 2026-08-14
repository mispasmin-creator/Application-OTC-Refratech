import React, { useEffect, useState } from 'react';
import { Activity, Users, FileText, Zap, CheckCircle2, Clock3, TrendingUp, Layers } from 'lucide-react';

const Dashboard = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userDataStr = localStorage.getItem('botivate_user');
    if (userDataStr) {
      setUser(JSON.parse(userDataStr));
    }
  }, []);

  const stats = [
    { title: 'Total Users', value: '1,234', icon: <Users size={24} />, accent: 'var(--primary-color)' },
    { title: 'Active Sessions', value: '89', icon: <Activity size={24} />, accent: 'var(--secondary-color)' },
    { title: 'New Requests', value: '34', icon: <FileText size={24} />, accent: '#D19F29' },
    { title: 'System Uptime', value: '99.9%', icon: <Zap size={24} />, accent: '#3E9F5B' },
  ];

  const highlights = [
    { label: 'Urgent approvals', value: '12 items', icon: <Clock3 size={18} />, status: 'Attention needed' },
    { label: 'Inspection completed', value: '27 reports', icon: <CheckCircle2 size={18} />, status: 'Reviewed today' },
    { label: 'Supply orders', value: '5 pending', icon: <Layers size={18} />, status: 'Awaiting dispatch' },
    { label: 'Process efficiency', value: '88%', icon: <TrendingUp size={18} />, status: 'Stable performance' },
  ];

  return (
    <div className="dashboard-page animate-fade-in">
      <section className="dashboard-hero">
        <div>
          <span className="eyebrow">Operations overview</span>
          <h1>Welcome back, {user?.name || 'Admin'}!</h1>
          <p>
            Your Refratech dashboard gives you a clean, modern view of the most important operational metrics and status updates.
          </p>
        </div>
        <div className="dashboard-hero-badge">
          <strong>Today’s snapshot</strong>
          <span>{new Date().toLocaleDateString()}</span>
        </div>
      </section>

      <div className="dashboard-card-grid">
        {stats.map((stat, index) => (
          <article key={index} className="stat-card">
            <div className="card-icon" style={{ background: `${stat.accent}20`, color: stat.accent }}>
              {stat.icon}
            </div>
            <div>
              <h3>{stat.title}</h3>
              <p className="card-value">{stat.value}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="dashboard-section-grid">
        <section className="dashboard-panel">
          <div className="panel-title-row">
            <h2>Operational metrics</h2>
            <span className="badge badge-soft">Live</span>
          </div>
          <div className="dashboard-panel-grid">
            <div className="dashboard-panel-item">
              <span>Weekly compliance</span>
              <strong>96%</strong>
            </div>
            <div className="dashboard-panel-item">
              <span>Month-to-date orders</span>
              <strong>584</strong>
            </div>
            <div className="dashboard-panel-item">
              <span>Pending approvals</span>
              <strong>14</strong>
            </div>
            <div className="dashboard-panel-item">
              <span>Task completion</span>
              <strong>82%</strong>
            </div>
          </div>
        </section>

        <aside className="dashboard-panel summary-panel">
          <div className="panel-title-row">
            <h2>Firm details</h2>
          </div>
          <div className="dashboard-summary-list">
            <div>
              <span>Firm Name</span>
              <strong>{user?.firmName || 'N/A'}</strong>
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
            Keep your firm profile updated and review key actions daily to maintain smooth operations.
          </p>
        </aside>
      </div>

      <section className="dashboard-panel">
        <div className="panel-title-row">
          <h2>Recent highlights</h2>
          <span className="badge badge-soft">Insights</span>
        </div>
        <div className="dashboard-recent-list">
          {highlights.map((item, index) => (
            <article key={index} className="dashboard-recent-item">
              <div className="recent-meta">
                <div className="recent-icon">{item.icon}</div>
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.status}</p>
                </div>
              </div>
              <p className="recent-value">{item.value}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;

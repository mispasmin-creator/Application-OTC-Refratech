import React, { useEffect, useState } from 'react';
import { Activity, Users, FileText, Zap } from 'lucide-react';

const Dashboard = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userDataStr = localStorage.getItem('botivate_user');
    if (userDataStr) {
      setUser(JSON.parse(userDataStr));
    }
  }, []);

  const stats = [
    { title: 'Total Users', value: '1,234', icon: <Users size={24} />, color: 'var(--primary-color)' },
    { title: 'Active Sessions', value: '89', icon: <Activity size={24} />, color: 'var(--secondary-color)' },
    { title: 'New Registrations', value: '34', icon: <FileText size={24} />, color: '#F59E0B' },
    { title: 'System Health', value: '99.9%', icon: <Zap size={24} />, color: '#10B981' },
  ];

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>
          Welcome back, {user?.name || 'Admin'}!
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Here's what's happening in your system today.
        </p>
      </div>

      <div className="stat-grid">
        {stats.map((stat, index) => (
          <div key={index} className="stat-card glass-panel">
            <div className="stat-icon-wrapper" style={{ color: stat.color, background: `${stat.color}15` }}>
              {stat.icon}
            </div>
            <div className="stat-info">
              <h3>{stat.title}</h3>
              <p>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-panel" style={{ padding: '2rem', borderRadius: '12px' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Firm Details</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', color: 'var(--text-muted)' }}>
          <div>
            <strong style={{ color: 'var(--text-main)' }}>Firm Name: </strong> 
            {user?.firmName || 'N/A'}
          </div>
          <div>
            <strong style={{ color: 'var(--text-main)' }}>Role: </strong> 
            {user?.role || 'N/A'}
          </div>
          <div>
            <strong style={{ color: 'var(--text-main)' }}>Username: </strong> 
            {user?.username || 'N/A'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

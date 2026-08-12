import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  LogOut, 
  Hexagon,
  FilePlus,
  ListChecks,
  ClipboardCheck,
  Flame,
  Box,
  Search,
  Volume2,
  Thermometer,
  CheckCircle2,
  Receipt,
  Banknote,
  UserCheck,
  TrendingUp,
  Truck
} from 'lucide-react';

const AdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userDataStr = localStorage.getItem('botivate_user');
    if (!userDataStr) {
      navigate('/login');
    } else {
      try {
        setUser(JSON.parse(userDataStr));
      } catch (e) {
        localStorage.removeItem('botivate_user');
        navigate('/login');
      }
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('botivate_user');
    navigate('/login');
  };

  if (!user) return null; // or a loading spinner

  const navItems = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} /> },
    { name: 'Create Indent', path: '/create-indent', icon: <FilePlus size={20} /> },
    { name: 'PO Confirmation', path: '/po-confirmation', icon: <ListChecks size={20} /> },
    { name: 'Site Received', path: '/site-received', icon: <ClipboardCheck size={20} /> },
    { name: 'KILN Testing', path: '/kiln-testing', icon: <Flame size={20} /> },
    { name: 'Board Suttering', path: '/board-suttering', icon: <Box size={20} /> },
    { name: 'Casting Inspection', path: '/casting-inspection', icon: <Search size={20} /> },
    { name: 'Sound Test', path: '/sound-test', icon: <Volume2 size={20} /> },
    { name: 'Heating Entry', path: '/heating-entry', icon: <Thermometer size={20} /> },
    { name: 'Take Qty Conf.', path: '/take-qty-confirmation', icon: <CheckCircle2 size={20} /> },
    { name: 'Make Invoice', path: '/make-invoice', icon: <Receipt size={20} /> },
    { name: 'Collection', path: '/collection', icon: <Banknote size={20} /> },
    { name: 'Settle Account', path: '/settle-account-supervisor', icon: <UserCheck size={20} /> },
    { name: 'Profit & Loss', path: '/profit-loss-sheet', icon: <TrendingUp size={20} /> },
    { name: 'Transfer Items', path: '/transfer-receiving-items', icon: <Truck size={20} /> },
    { name: 'Users', path: '/users', icon: <Users size={20} /> },
    { name: 'Settings', path: '/settings', icon: <Settings size={20} /> },
  ];

  return (
    <div className="admin-layout animate-fade-in">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Hexagon className="sidebar-logo-icon" size={28} />
            <span>Admin Panel</span>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link 
              key={item.name} 
              to={item.path} 
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              {item.icon}
              <span>{item.name}</span>
            </Link>
          ))}
        </nav>
        
        <div className="sidebar-footer-info">
          <button 
            className="nav-item" 
            onClick={handleLogout} 
            style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <LogOut size={20} color="var(--error-color)" />
            <span style={{ color: 'var(--error-color)' }}>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-wrapper">
        <header className="topbar">
          <div className="user-profile">
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{user.name}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{user.role}</div>
            </div>
            <div className="avatar">
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
          </div>
        </header>
        
        <main className="main-content">
          <Outlet />
        </main>
        
        <footer className="app-footer">
          Powered by <span>Botivate</span>
        </footer>
      </div>
    </div>
  );
};

export default AdminLayout;

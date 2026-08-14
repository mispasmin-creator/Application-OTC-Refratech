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
  Truck,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

import { useFMS } from '../contexts/FMSContext';

const AdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const { pendingCounts } = useFMS();

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
    { name: 'Order Form', path: '/create-indent', icon: <FilePlus size={20} /> },
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

  const toggleSidebar = () => setCollapsed(prev => !prev);

  return (
    <div className={`admin-layout animate-fade-in${collapsed ? ' collapsed' : ''}`}>
      {/* Sidebar */}
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img src="/logo.png" alt="Refratech logo" className="sidebar-logo-image" />
            <div>
              <span>Application</span>
              <p>Order To Collection</p>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
        
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const count = pendingCounts[item.path] || 0;
            return (
              <Link 
                key={item.name} 
                to={item.path} 
                className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              >
                {item.icon}
                <span>{item.name}</span>
                {count > 0 && <div className="nav-badge">{count > 99 ? '99+' : count}</div>}
              </Link>
            );
          })}
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

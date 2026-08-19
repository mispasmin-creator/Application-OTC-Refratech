import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard,
  Users,
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
  ChevronRight,
  ChevronDown,
  ClipboardList,
  FileClock,
  Hourglass,
  Menu,
  X,
  CheckSquare,
  PackageCheck,
  FileSignature,
  Boxes,
  CreditCard
} from 'lucide-react';

import { useFMS } from '../contexts/FMSContext';

const AdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({ otc: true, planning: true });
  const { pendingCounts } = useFMS();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

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
    { name: 'Pending Order', path: '/pending-order', icon: <Hourglass size={20} /> },
    { name: 'Actual Work Done', path: '/actual-work-done', icon: <CheckSquare size={20} /> },
    { name: 'Received At Site', path: '/received-at-site', icon: <PackageCheck size={20} /> },
    { name: 'Planning Order', path: '/planning-order', icon: <ClipboardList size={20} /> },
    { name: 'Vendor Order', path: '/vendor-order', icon: <FileSignature size={20} /> },
    { name: 'Store', path: '/store', icon: <Boxes size={20} /> },
    { name: 'Payments', path: '/payments', icon: <CreditCard size={20} /> },
  ];

  const toggleSidebar = () => setCollapsed(prev => !prev);

  const allowedNavItems = navItems.filter(item => {
    if (user.role === 'Admin') return true;
    const pageAccess = user.pageAccess || user['Page Acess'] || user['Page Access'];
    if (!pageAccess || pageAccess === 'All' || pageAccess === '*') return true;
    const allowed = pageAccess.split(',').map(s => s.trim().toLowerCase());
    return allowed.some(a => a === item.name.toLowerCase() || a === item.path.toLowerCase() || a.includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(a));
  });

  // "Application OTC" groups everything from Order Form through Transfer Items under one parent menu.
  const otcPaths = [
    '/create-indent', '/po-confirmation', '/site-received', '/kiln-testing',
    '/board-suttering', '/casting-inspection', '/sound-test', '/heating-entry',
    '/take-qty-confirmation', '/make-invoice', '/collection',
    '/settle-account-supervisor', '/profit-loss-sheet', '/transfer-receiving-items',
  ];

  // "Application Planning" groups the standalone planning pages under one parent menu.
  const planningPaths = [
    '/pending-order',
    '/actual-work-done',
    '/received-at-site',
    '/planning-order',
    '/vendor-order',
    '/store',
    '/payments'
  ];

  const dashboardItem = allowedNavItems.find(item => item.path === '/');
  const usersItem = allowedNavItems.find(item => item.path === '/users');
  const otcItems = allowedNavItems.filter(item => otcPaths.includes(item.path));
  const planningItems = allowedNavItems.filter(item => planningPaths.includes(item.path));
  const isOtcActive = otcItems.some(item => item.path === location.pathname);
  const isPlanningActive = planningItems.some(item => item.path === location.pathname);

  const toggleGroup = (key) => setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className={`admin-layout animate-fade-in${collapsed ? ' collapsed' : ''}`}>
      {/* Mobile Topbar */}
      <div className="mobile-topbar">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <div className="mobile-topbar-brand">
          <img src="/logo.png" alt="Refratech logo" />
          <span>Application OTC</span>
        </div>
        <div style={{ width: '40px' }} />
      </div>

      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay${mobileOpen ? ' mobile-open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
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
          <button
            type="button"
            className="sidebar-mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>
        
        <nav className="sidebar-nav">
          {collapsed ? (
            allowedNavItems.map((item) => {
              const count = pendingCounts[item.path] || 0;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                >
                  {item.icon}
                  <span>{item.name}</span>
                  {count > 0 && <div className="nav-badge">{count > 99 ? '99+' : count}</div>}
                </Link>
              );
            })
          ) : (
            <>
              {dashboardItem && (
                <Link
                  to={dashboardItem.path}
                  className={`nav-item ${location.pathname === dashboardItem.path ? 'active' : ''}`}
                >
                  {dashboardItem.icon}
                  <span>{dashboardItem.name}</span>
                </Link>
              )}

              {otcItems.length > 0 && (
                <div className="nav-group">
                  <button
                    type="button"
                    className={`nav-group-header${isOtcActive ? ' active-parent' : ''}`}
                    onClick={() => toggleGroup('otc')}
                    aria-expanded={expandedGroups.otc}
                  >
                    <Hexagon size={20} />
                    <span>Application OTC</span>
                    <ChevronDown size={16} className={`nav-group-chevron${expandedGroups.otc ? ' open' : ''}`} />
                  </button>
                  {expandedGroups.otc && (
                    <div className="nav-group-children">
                      {otcItems.map((item) => {
                        const count = pendingCounts[item.path] || 0;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            className={`nav-item nav-subitem ${location.pathname === item.path ? 'active' : ''}`}
                          >
                            {item.icon}
                            <span>{item.name}</span>
                            {count > 0 && <div className="nav-badge">{count > 99 ? '99+' : count}</div>}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="nav-group">
                <button
                  type="button"
                  className={`nav-group-header${isPlanningActive ? ' active-parent' : ''}`}
                  onClick={() => toggleGroup('planning')}
                  aria-expanded={expandedGroups.planning}
                >
                  <ClipboardList size={20} />
                  <span>Application Planning</span>
                  <ChevronDown size={16} className={`nav-group-chevron${expandedGroups.planning ? ' open' : ''}`} />
                </button>
                {expandedGroups.planning && (
                  <div className="nav-group-children">
                    {planningItems.map((item) => {
                      const count = pendingCounts[item.path] || 0;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={`nav-item nav-subitem ${location.pathname === item.path ? 'active' : ''}`}
                        >
                          {item.icon}
                          <span>{item.name}</span>
                          {count > 0 && <div className="nav-badge">{count > 99 ? '99+' : count}</div>}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {usersItem && (
                <Link
                  to={usersItem.path}
                  className={`nav-item ${location.pathname === usersItem.path ? 'active' : ''}`}
                >
                  {usersItem.icon}
                  <span>{usersItem.name}</span>
                </Link>
              )}
            </>
          )}
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
          
          Powered by <a href="https://www.botivate.in/" target="_blank" style={{color:"white", fontWeight:"bold", textDecoration:"none"}}><span><b>Botivate</b></span></a>
        </footer>
      </div>
    </div>
  );
};

export default AdminLayout;

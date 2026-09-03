// Force reload
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AdminLayout from './layouts/AdminLayout';
import Dashboard from './pages/Dashboard';
import CreateIndent from './pages/CreateIndent';
import PoConfirmation from './pages/PoConfirmation';
import SiteReceived from './pages/SiteReceived';
import KilnTesting from './pages/KilnTesting';
import BoardSuttering from './pages/BoardSuttering';
import CastingInspection from './pages/CastingInspection';
import SoundTest from './pages/SoundTest';
import HeatingEntry from './pages/HeatingEntry';
import TakeQtyConfirmation from './pages/TakeQtyConfirmation';
import MakeInvoice from './pages/MakeInvoice';
import Collection from './pages/Collection';
import SettleAccountSupervisor from './pages/SettleAccountSupervisor';
import ProfitLossSheet from './pages/ProfitLossSheet';
import TransferReceivingItems from './pages/TransferReceivingItems';
import UsersManagement from './pages/UsersManagement';
import PendingOrderPlanning from './pages/PendingOrderPlanning';
import ActualWorkDone from './pages/ActualWorkDone';
import ReceivedAtSite from './pages/ReceivedAtSite';
import PlanningOrder from './pages/PlanningOrder';
import VendorOrder from './pages/VendorOrder';
import Store from './pages/Store';
import Payments from './pages/Payments';
import ApplicationIMS from './pages/ApplicationIMS';
import AssetIndent from './pages/AssetIndent';
import AssetSiteReceived from './pages/AssetSiteReceived';
import AssetChecking from './pages/AssetChecking';
import { FMSProvider } from './contexts/FMSContext';

const App = () => {
  return (
    <FMSProvider>
      <BrowserRouter>
        <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="create-indent" element={<CreateIndent />} />
          <Route path="po-confirmation" element={<PoConfirmation />} />
          <Route path="site-received" element={<SiteReceived />} />
          <Route path="kiln-testing" element={<KilnTesting />} />
          <Route path="board-suttering" element={<BoardSuttering />} />
          <Route path="casting-inspection" element={<CastingInspection />} />
          <Route path="sound-test" element={<SoundTest />} />
          <Route path="heating-entry" element={<HeatingEntry />} />
          <Route path="take-qty-confirmation" element={<TakeQtyConfirmation />} />
          <Route path="make-invoice" element={<MakeInvoice />} />
          <Route path="collection" element={<Collection />} />
          <Route path="settle-account-supervisor" element={<SettleAccountSupervisor />} />
          <Route path="profit-loss-sheet" element={<ProfitLossSheet />} />
          <Route path="transfer-receiving-items" element={<TransferReceivingItems />} />
          <Route path="users" element={<UsersManagement />} />
          <Route path="pending-order" element={<PendingOrderPlanning />} />
          <Route path="actual-work-done" element={<ActualWorkDone />} />
          <Route path="received-at-site" element={<ReceivedAtSite />} />
          <Route path="planning-order" element={<PlanningOrder />} />
          <Route path="vendor-order" element={<VendorOrder />} />
          <Route path="store" element={<Store />} />
          <Route path="payments" element={<Payments />} />
          <Route path="application-ims" element={<ApplicationIMS />} />
          <Route path="planning-order-form" element={<PlanningOrder />} />
          <Route path="assets-indent" element={<AssetIndent />} />
          <Route path="assets-site-received" element={<AssetSiteReceived />} />
          <Route path="assets-checking" element={<AssetChecking />} />
          <Route path="settings" element={<div className="glass-panel" style={{padding: '2rem', borderRadius: '12px'}}><h2>Settings</h2><p style={{marginTop: '1rem', color: 'var(--text-muted)'}}>Placeholder for Settings.</p></div>} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </BrowserRouter>
    </FMSProvider>
  );
};

export default App;
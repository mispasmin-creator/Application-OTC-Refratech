import React, { useState, useEffect, useMemo } from 'react';
import { serialFetch } from '../lib/serialFetch';
import { 
  Search, Loader2, Package, Boxes, Truck, CheckCircle2, 
  AlertCircle, ArrowDownToLine, Wrench, RefreshCw, ChevronDown, 
  Building2, MapPin, Hash, Layers, FileSpreadsheet
} from 'lucide-react';

const SCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;

const ApplicationIMS = () => {
  const [fetching, setFetching] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAppNo, setSelectedAppNo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  // Raw sheet datasets
  const [fmsData, setFmsData] = useState([]);
  const [planningOrderData, setPlanningOrderData] = useState([]);
  const [receivedSiteData, setReceivedSiteData] = useState([]);
  const [actualWorkData, setActualWorkData] = useState([]);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setFetching(true);
    setMessage({ type: '', text: '' });

    try {
      // Parallel fast fetch of all relevant sheets
      const [fmsRes, planRes, recvRes, workRes] = await Promise.all([
        serialFetch(`${SCRIPT_URL}?sheet=FMS`),
        serialFetch(`${SCRIPT_URL}?sheet=Planning%20Order`),
        serialFetch(`${SCRIPT_URL}?sheet=Received%20At%20Site`),
        serialFetch(`${SCRIPT_URL}?sheet=Actual%20Work%20Done`)
      ]);

      const [fmsJson, planJson, recvJson, workJson] = await Promise.all([
        fmsRes.json().catch(() => ({ success: false })),
        planRes.json().catch(() => ({ success: false })),
        recvRes.json().catch(() => ({ success: false })),
        workRes.json().catch(() => ({ success: false }))
      ]);

      if (fmsJson.success && fmsJson.data) setFmsData(fmsJson.data);
      if (planJson.success && planJson.data) setPlanningOrderData(planJson.data);
      if (recvJson.success && recvJson.data) setReceivedSiteData(recvJson.data);
      if (workJson.success && workJson.data) setActualWorkData(workJson.data);

    } catch (err) {
      console.error('Error fetching IMS datasets:', err);
      setMessage({ type: 'error', text: 'Error loading IMS inventory data.' });
    } finally {
      setFetching(false);
      setRefreshing(false);
    }
  };

  // Helper to normalize strings for exact/fuzzy matches
  const cleanStr = (s) => (s ? s.toString().trim().toLowerCase() : '');
  const parseNum = (v) => {
    if (v === null || v === undefined) return 0;
    const clean = v.toString().replace(/[^0-9.-]/g, '');
    const n = parseFloat(clean);
    return isNaN(n) ? 0 : n;
  };
  const formatNum = (n) => {
    if (n === 0) return '0';
    return Number.isInteger(n) ? n.toString() : n.toFixed(2);
  };

  // Extract all distinct Application Numbers from FMS, Planning Order, Received At Site, and Actual Work Done
  const applicationList = useMemo(() => {
    const appsMap = new Map();

    // 1. Read FMS Sheet for Application Number, Party Name, Area Of Application, PO Number
    if (fmsData && fmsData.length > 0) {
      const headerRowIndex = fmsData.length > 5 ? 5 : 0;
      const headers = fmsData[headerRowIndex] || [];
      const cleanH = (s) => cleanStr(s).replace(/[^a-z0-9]/g, '');

      const appIdx = headers.findIndex(h => cleanH(h) === 'applicationnumber' || cleanH(h) === 'applicationno');
      const partyIdx = headers.findIndex(h => cleanH(h) === 'partyname' || cleanH(h) === 'party');
      const areaIdx = headers.findIndex(h => cleanH(h) === 'areaofapplication' || cleanH(h).includes('area'));
      const poIdx = headers.findIndex(h => cleanH(h) === 'ponumber' || cleanH(h) === 'po');
      const firmIdx = headers.findIndex(h => cleanH(h) === 'firmname' || cleanH(h).includes('firm'));

      fmsData.slice(headerRowIndex + 1).forEach(row => {
        if (!row) return;
        const appNo = appIdx !== -1 && row[appIdx] ? row[appIdx].toString().trim() : '';
        if (!appNo) return;

        if (!appsMap.has(appNo)) {
          appsMap.set(appNo, {
            appNo,
            partyName: partyIdx !== -1 && row[partyIdx] ? row[partyIdx].toString().trim() : '',
            areaOfApplication: areaIdx !== -1 && row[areaIdx] ? row[areaIdx].toString().trim() : '',
            poNumber: poIdx !== -1 && row[poIdx] ? row[poIdx].toString().trim() : '',
            firmName: firmIdx !== -1 && row[firmIdx] ? row[firmIdx].toString().trim() : ''
          });
        }
      });
    }

    // 2. Supplement from Planning Order
    if (planningOrderData && planningOrderData.length > 1) {
      const headers = planningOrderData[0] || [];
      const appIdx = headers.findIndex(h => cleanStr(h).includes('application'));
      const partyIdx = headers.findIndex(h => cleanStr(h).includes('party'));

      planningOrderData.slice(1).forEach(row => {
        if (!row) return;
        const appNo = appIdx !== -1 && row[appIdx] ? row[appIdx].toString().trim() : '';
        if (appNo && !appsMap.has(appNo)) {
          appsMap.set(appNo, {
            appNo,
            partyName: partyIdx !== -1 && row[partyIdx] ? row[partyIdx].toString().trim() : '',
            areaOfApplication: '',
            poNumber: '',
            firmName: ''
          });
        }
      });
    }

    return Array.from(appsMap.values()).sort((a, b) => a.appNo.localeCompare(b.appNo, undefined, { numeric: true }));
  }, [fmsData, planningOrderData]);

  // Set default selected application on initial load if none selected
  useEffect(() => {
    if (!selectedAppNo && applicationList.length > 0) {
      setSelectedAppNo(applicationList[0].appNo);
    }
  }, [applicationList, selectedAppNo]);

  // Current selected Application Details metadata
  const selectedAppMeta = useMemo(() => {
    if (!selectedAppNo) return null;
    return applicationList.find(a => cleanStr(a.appNo) === cleanStr(selectedAppNo)) || {
      appNo: selectedAppNo,
      partyName: '',
      areaOfApplication: '',
      poNumber: '',
      firmName: ''
    };
  }, [selectedAppNo, applicationList]);

  // Compute IMS Table Rows according to user's exact Google Sheet Formula Logic:
  // 1. Products = UNIQUE(Planning Order Col 3 where Col 1 = A1) + products from other sheets if present
  // 2. Order Received Qty = SUMIFS('Planning Order'!$E:$E, 'Planning Order'!$B:$B, A1, 'Planning Order'!$D:$D, Product)
  // 3. Total Qty Receive At Site = SUMIFS('Received At Site'!$E:$E, 'Received At Site'!$B:$B, A1, 'Received At Site'!$D:$D, Product)
  // 4. Dispatch Pending Qty = Order Received Qty - Total Qty Receive At Site
  // 5. Total Planning Qty = SUMIFS('Planning Order'!$E:$E, 'Planning Order'!$B:$B, A1, 'Planning Order'!$D:$D, Product)
  // 6. Total Qty Used = SUMIFS('Actual Work Done'!$K:$K, 'Actual Work Done'!$J:$J, Product, 'Actual Work Done'!$B:$B, A1)
  // 7. Current Stock = Total Qty Receive At Site - Total Qty Used
  const imsRows = useMemo(() => {
    if (!selectedAppNo) return [];

    const targetAppClean = cleanStr(selectedAppNo);
    const productSet = new Set();
    let partyNameFromData = selectedAppMeta?.partyName || '';

    // Index mappings for Planning Order
    let planAppIdx = 1;
    let planProdIdx = 3;
    let planQtyIdx = 4;
    let planPartyIdx = 6;

    if (planningOrderData && planningOrderData.length > 0) {
      const pHeaders = planningOrderData[0] || [];
      const cleanH = (s) => cleanStr(s).replace(/[^a-z0-9]/g, '');
      const aIdx = pHeaders.findIndex(h => cleanH(h).includes('application'));
      const prIdx = pHeaders.findIndex(h => cleanH(h).includes('product'));
      const qIdx = pHeaders.findIndex(h => cleanH(h) === 'qty' || cleanH(h).includes('qty') || cleanH(h).includes('quantity'));
      const ptIdx = pHeaders.findIndex(h => cleanH(h).includes('party'));

      if (aIdx !== -1) planAppIdx = aIdx;
      if (prIdx !== -1) planProdIdx = prIdx;
      if (qIdx !== -1) planQtyIdx = qIdx;
      if (ptIdx !== -1) planPartyIdx = ptIdx;

      // Extract Products for this Application
      planningOrderData.slice(1).forEach(row => {
        if (!row) return;
        const rowApp = cleanStr(row[planAppIdx]);
        if (rowApp === targetAppClean) {
          const prod = row[planProdIdx] ? row[planProdIdx].toString().trim() : '';
          if (prod) productSet.add(prod);
          if (!partyNameFromData && row[planPartyIdx]) {
            partyNameFromData = row[planPartyIdx].toString().trim();
          }
        }
      });
    }

    // Index mappings for Received At Site
    let recvAppIdx = 1;
    let recvProdIdx = 3;
    let recvQtyIdx = 4;
    let recvPartyIdx = 6;

    if (receivedSiteData && receivedSiteData.length > 0) {
      const rHeaders = receivedSiteData[0] || [];
      const cleanH = (s) => cleanStr(s).replace(/[^a-z0-9]/g, '');
      const aIdx = rHeaders.findIndex(h => cleanH(h).includes('application'));
      const prIdx = rHeaders.findIndex(h => cleanH(h).includes('product'));
      const qIdx = rHeaders.findIndex(h => cleanH(h).includes('qty') || cleanH(h).includes('quantity'));
      const ptIdx = rHeaders.findIndex(h => cleanH(h).includes('party'));

      if (aIdx !== -1) recvAppIdx = aIdx;
      if (prIdx !== -1) recvProdIdx = prIdx;
      if (qIdx !== -1) recvQtyIdx = qIdx;
      if (ptIdx !== -1) recvPartyIdx = ptIdx;

      receivedSiteData.slice(1).forEach(row => {
        if (!row) return;
        const rowApp = cleanStr(row[recvAppIdx]);
        if (rowApp === targetAppClean) {
          const prod = row[recvProdIdx] ? row[recvProdIdx].toString().trim() : '';
          if (prod) productSet.add(prod);
          if (!partyNameFromData && row[recvPartyIdx]) {
            partyNameFromData = row[recvPartyIdx].toString().trim();
          }
        }
      });
    }

    // Index mappings for Actual Work Done
    let workAppIdx = 1;
    let workProdIdx = 9;
    let workQtyIdx = 10;
    let workPartyIdx = 12;

    if (actualWorkData && actualWorkData.length > 0) {
      const wHeaders = actualWorkData[0] || [];
      const cleanH = (s) => cleanStr(s).replace(/[^a-z0-9]/g, '');
      const aIdx = wHeaders.findIndex(h => cleanH(h).includes('application'));
      const prIdx = wHeaders.findIndex(h => cleanH(h).includes('product'));
      const qIdx = wHeaders.findIndex(h => cleanH(h).includes('qty') || cleanH(h).includes('quantity'));
      const ptIdx = wHeaders.findIndex(h => cleanH(h).includes('party'));

      if (aIdx !== -1) workAppIdx = aIdx;
      if (prIdx !== -1) workProdIdx = prIdx;
      if (qIdx !== -1) workQtyIdx = qIdx;
      if (ptIdx !== -1) workPartyIdx = ptIdx;

      actualWorkData.slice(1).forEach(row => {
        if (!row) return;
        const rowApp = cleanStr(row[workAppIdx]);
        if (rowApp === targetAppClean) {
          const prod = row[workProdIdx] ? row[workProdIdx].toString().trim() : '';
          if (prod) productSet.add(prod);
          if (!partyNameFromData && row[workPartyIdx]) {
            partyNameFromData = row[workPartyIdx].toString().trim();
          }
        }
      });
    }

    const party = partyNameFromData || selectedAppMeta?.partyName || '—';
    const productsArray = Array.from(productSet).sort();

    return productsArray.map(product => {
      const prodClean = cleanStr(product);

      // 1. Order Received Qty (SUMIFS Planning Order)
      let orderReceivedQty = 0;
      if (planningOrderData && planningOrderData.length > 1) {
        planningOrderData.slice(1).forEach(row => {
          if (!row) return;
          if (cleanStr(row[planAppIdx]) === targetAppClean && cleanStr(row[planProdIdx]) === prodClean) {
            orderReceivedQty += parseNum(row[planQtyIdx]);
          }
        });
      }

      // 2. Total Qty Receive At Site (SUMIFS Received At Site)
      let totalQtyReceivedAtSite = 0;
      if (receivedSiteData && receivedSiteData.length > 1) {
        receivedSiteData.slice(1).forEach(row => {
          if (!row) return;
          if (cleanStr(row[recvAppIdx]) === targetAppClean && cleanStr(row[recvProdIdx]) === prodClean) {
            totalQtyReceivedAtSite += parseNum(row[recvQtyIdx]);
          }
        });
      }

      // 3. Dispatch Pending Qty = Order Received Qty - Total Qty Receive At Site
      const dispatchPendingQty = orderReceivedQty - totalQtyReceivedAtSite;

      // 4. Total Planning Qty = Order Received Qty
      const totalPlanningQty = orderReceivedQty;

      // 5. Total Qty Used (SUMIFS Actual Work Done)
      let totalQtyUsed = 0;
      if (actualWorkData && actualWorkData.length > 1) {
        actualWorkData.slice(1).forEach(row => {
          if (!row) return;
          if (cleanStr(row[workAppIdx]) === targetAppClean && cleanStr(row[workProdIdx]) === prodClean) {
            totalQtyUsed += parseNum(row[workQtyIdx]);
          }
        });
      }

      // 6. Current Stock = Total Qty Receive At Site - Total Qty Used
      const currentStock = totalQtyReceivedAtSite - totalQtyUsed;

      return {
        partyName: party,
        productName: product,
        orderReceivedQty,
        totalQtyReceivedAtSite,
        dispatchPendingQty,
        totalPlanningQty,
        totalQtyUsed,
        currentStock
      };
    });
  }, [selectedAppNo, selectedAppMeta, planningOrderData, receivedSiteData, actualWorkData]);

  // Overall Totals for KPI Cards
  const summaryTotals = useMemo(() => {
    return imsRows.reduce((acc, row) => ({
      orderReceivedQty: acc.orderReceivedQty + row.orderReceivedQty,
      totalQtyReceivedAtSite: acc.totalQtyReceivedAtSite + row.totalQtyReceivedAtSite,
      dispatchPendingQty: acc.dispatchPendingQty + row.dispatchPendingQty,
      totalPlanningQty: acc.totalPlanningQty + row.totalPlanningQty,
      totalQtyUsed: acc.totalQtyUsed + row.totalQtyUsed,
      currentStock: acc.currentStock + row.currentStock
    }), {
      orderReceivedQty: 0,
      totalQtyReceivedAtSite: 0,
      dispatchPendingQty: 0,
      totalPlanningQty: 0,
      totalQtyUsed: 0,
      currentStock: 0
    });
  }, [imsRows]);

  const filteredRows = useMemo(() => {
    if (!searchQuery) return imsRows;
    const q = searchQuery.toLowerCase();
    return imsRows.filter(r => 
      r.productName.toLowerCase().includes(q) ||
      r.partyName.toLowerCase().includes(q)
    );
  }, [imsRows, searchQuery]);

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <FileSpreadsheet size={28} color="var(--primary-color)" /> Application IMS
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Real-time Inventory Management: Order Received, Site Receipts, Dispatches, Material Consumed & Available Stock.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button 
            type="button" 
            className="btn btn-outline" 
            onClick={() => fetchAllData(true)} 
            disabled={fetching || refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Refreshing...' : 'Refresh IMS'}
          </button>
        </div>
      </div>

      {message.text && (
        <div style={{
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          background: message.type === 'error' ? 'var(--error-bg)' : 'var(--success-bg)',
          color: message.type === 'error' ? 'var(--error-color)' : 'var(--success-color)',
          border: `1px solid ${message.type === 'error' ? 'var(--error-border)' : 'var(--success-border)'}`
        }}>
          {message.text}
        </div>
      )}

      {/* APPLICATION SELECTOR & METADATA BAR */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '1.5rem',
        marginBottom: '1.75rem',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', alignItems: 'center' }}>
          {/* Select Application No */}
          <div>
            <label className="form-label" style={{ marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Hash size={16} color="var(--primary-color)" /> Select Application Number
            </label>
            <div className="select-wrapper">
              <select
                className="form-input"
                value={selectedAppNo}
                onChange={(e) => setSelectedAppNo(e.target.value)}
                style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--primary-color)', backgroundColor: 'rgba(255,255,255,0.06)' }}
              >
                {applicationList.map(item => (
                  <option key={item.appNo} value={item.appNo}>
                    {item.appNo} {item.partyName ? `— ${item.partyName}` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown size={18} className="select-chevron" />
            </div>
          </div>

          {/* Party Name */}
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
              Party Name
            </span>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Building2 size={16} color="#38bdf8" />
              {selectedAppMeta?.partyName || (imsRows[0]?.partyName) || '—'}
            </div>
          </div>

          {/* Area of Application */}
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
              Area Of Application
            </span>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <MapPin size={16} color="#f59e0b" />
              {selectedAppMeta?.areaOfApplication || '—'}
            </div>
          </div>
        </div>
      </div>

      {/* SUMMARY KPI CARDS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '10px', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#93c5fd', fontWeight: 600 }}>Order Received Qty</span>
            <Package size={18} color="#60a5fa" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#60a5fa' }}>
            {formatNum(summaryTotals.orderReceivedQty)}
          </div>
        </div>

        <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#6ee7b7', fontWeight: 600 }}>Received At Site</span>
            <ArrowDownToLine size={18} color="#34d399" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#34d399' }}>
            {formatNum(summaryTotals.totalQtyReceivedAtSite)}
          </div>
        </div>

        <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '10px', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#fcd34d', fontWeight: 600 }}>Dispatch Pending</span>
            <Truck size={18} color="#fbbf24" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fbbf24' }}>
            {formatNum(summaryTotals.dispatchPendingQty)}
          </div>
        </div>

        <div style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '10px', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#c4b5fd', fontWeight: 600 }}>Total Qty Used</span>
            <Wrench size={18} color="#a78bfa" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#a78bfa' }}>
            {formatNum(summaryTotals.totalQtyUsed)}
          </div>
        </div>

        <div style={{ background: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.3)', borderRadius: '10px', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#67e8f9', fontWeight: 600 }}>Current Stock</span>
            <Boxes size={18} color="#22d3ee" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#22d3ee' }}>
            {formatNum(summaryTotals.currentStock)}
          </div>
        </div>
      </div>

      {/* IMS TABLE CONTAINER */}
      <div className="table-container">
        <div style={{ position: 'relative', width: '100%', maxWidth: '100%', marginBottom: '1.5rem', display: 'flex' }}>
          <Search size={18} style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by Product Name or Party Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input"
            style={{ width: '100%', paddingLeft: '3rem', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '1rem' }}
          />
        </div>

        {fetching ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={32} className="animate-spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
            <p>Loading Inventory Management Data...</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th>Party Name</th>
                  <th>Product Name</th>
                  <th style={{ textAlign: 'right' }}>Order Received Qty</th>
                  <th style={{ textAlign: 'right' }}>Total Qty Receive At Site</th>
                  <th style={{ textAlign: 'right' }}>Dispatch Pending Qty</th>
                  <th style={{ textAlign: 'right' }}>Total Planning Qty</th>
                  <th style={{ textAlign: 'right' }}>Total Qty Used</th>
                  <th style={{ textAlign: 'right' }}>Current Stock</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No inventory records found for Application <strong>{selectedAppNo}</strong>.
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredRows.map((row, idx) => (
                      <tr key={idx}>
                        <td data-label="Party Name" style={{ fontWeight: 500 }}>
                          {row.partyName}
                        </td>
                        <td data-label="Product Name" style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                          {row.productName}
                        </td>
                        <td data-label="Order Received Qty" style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                          {formatNum(row.orderReceivedQty)}
                        </td>
                        <td data-label="Total Qty Receive At Site" style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.95rem', color: '#34d399' }}>
                          {formatNum(row.totalQtyReceivedAtSite)}
                        </td>
                        <td data-label="Dispatch Pending Qty" style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: row.dispatchPendingQty > 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.05)',
                            color: row.dispatchPendingQty > 0 ? '#fbbf24' : 'var(--text-muted)',
                            fontWeight: row.dispatchPendingQty > 0 ? 600 : 'normal'
                          }}>
                            {formatNum(row.dispatchPendingQty)}
                          </span>
                        </td>
                        <td data-label="Total Planning Qty" style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                          {formatNum(row.totalPlanningQty)}
                        </td>
                        <td data-label="Total Qty Used" style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.95rem', color: '#a78bfa' }}>
                          {formatNum(row.totalQtyUsed)}
                        </td>
                        <td data-label="Current Stock" style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: '6px',
                            background: row.currentStock > 0 ? 'rgba(6, 182, 212, 0.15)' : (row.currentStock < 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.05)'),
                            color: row.currentStock > 0 ? '#22d3ee' : (row.currentStock < 0 ? '#f87171' : 'var(--text-muted)'),
                            fontWeight: 700
                          }}>
                            {formatNum(row.currentStock)}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {/* TOTAL SUMMARY FOOTER ROW */}
                    <tr style={{ background: 'rgba(255, 255, 255, 0.05)', borderTop: '2px solid var(--border-color)', fontWeight: 700 }}>
                      <td colSpan={2} style={{ fontSize: '1rem', color: 'var(--primary-color)' }}>
                        TOTAL SUMMARY
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '1.05rem', color: '#60a5fa' }}>
                        {formatNum(summaryTotals.orderReceivedQty)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '1.05rem', color: '#34d399' }}>
                        {formatNum(summaryTotals.totalQtyReceivedAtSite)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '1.05rem', color: '#fbbf24' }}>
                        {formatNum(summaryTotals.dispatchPendingQty)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '1.05rem', color: '#60a5fa' }}>
                        {formatNum(summaryTotals.totalPlanningQty)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '1.05rem', color: '#a78bfa' }}>
                        {formatNum(summaryTotals.totalQtyUsed)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '1.05rem', color: '#22d3ee' }}>
                        {formatNum(summaryTotals.currentStock)}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ApplicationIMS;

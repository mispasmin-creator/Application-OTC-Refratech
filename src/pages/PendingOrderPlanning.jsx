import React, { useState, useEffect } from 'react';
import { serialFetch } from '../lib/serialFetch';
import { filterRowsByFirmAccess } from '../lib/accessControl';
import { 
  Search, Loader2, ImageIcon, X, ChevronDown, CheckCircle2, Calendar, 
  FileText, Upload, Users, Clock, Package, Boxes, CreditCard, FileSignature, 
  MapPin, CheckSquare, PackageCheck, ClipboardList, ShieldCheck, Plus, Trash2
} from 'lucide-react';

const SCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;
const PLANNING_SHEET = 'Application Planning';
const MASTER_SHEET = 'Master';

// Display label -> Application Planning sheet header it should be read from.
const PENDING_ORDER_COLUMNS = [
  { label: 'Application Number', match: 'Application Number' },
  { label: 'Serial Number', match: 'Serial Number' },
  { label: 'Po Number', match: 'Po Number' },
  { label: 'Vender Order Copy', match: 'Vender Order Copy' },
  { label: 'Firm Name', match: 'Firm Name' },
  { label: 'Party Name', match: 'Party Name' },
  { label: 'Type Of Work', match: 'Type Of Work' },
  { label: 'Lead Time To Start', match: 'Lead Time To Start' },
  { label: 'Shift Type', match: 'Shift Type' },
  { label: 'Type Of Industry', match: 'Type Of Industry' },
  { label: 'Size Of Industry', match: 'Size Of Industry' },
  { label: 'Area Of Application', match: 'Area Of Application' },
  { label: 'Qty', match: 'Qty' },
  { label: 'Rate', match: 'Rate' },
];

const ACTION_COLUMNS = [
  { id: 'planningOrder', label: 'Planning Order', color: '#8b5cf6' },
  { id: 'actualWork', label: 'Actual Work Done', color: '#3b82f6' },
  { id: 'receivedSite', label: 'Received At Site', color: '#10b981' },
  { id: 'vendorOrder', label: 'Vendor Order', color: '#f59e0b' },
  { id: 'store', label: 'Store', color: '#ec4899' },
  { id: 'payments', label: 'Payments', color: '#06b6d4' }
];

const SHIFT_OPTIONS = ['Day', 'Night', 'General', 'Shift A', 'Shift B', 'Shift C'];
const TYPE_OF_WORK_OPTIONS = ['We will do', 'We will sublet'];
const STORE_STATUS_OPTIONS = ['Issued', 'Dispatched', 'In Store', 'Pending'];

const PendingOrderPlanning = () => {
  const [fetching, setFetching] = useState(true);
  const [rows, setRows] = useState([]);
  const [columnsToRender, setColumnsToRender] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [searchQuery, setSearchQuery] = useState('');

  // Master sheet options
  const [siteInchargeOptions, setSiteInchargeOptions] = useState([]);
  const [contractorOptions, setContractorOptions] = useState([]);
  const [vendorOptions, setVendorOptions] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [shiftOptions, setShiftOptions] = useState(['Day', 'Night', 'General']);

  // Dynamic Products state for Actual Work Done
  const [actualWorkProducts, setActualWorkProducts] = useState([
    { productName: '', quantity: '', remarks: '' }
  ]);

  // Dynamic Products state for Received At Site
  const [receivedSiteProducts, setReceivedSiteProducts] = useState([
    { productName: '', qtyNumber: '' }
  ]);
  const [fetchingActualWork, setFetchingActualWork] = useState(false);

  // Dynamic Products state for Planning Order
  const [planningOrderProducts, setPlanningOrderProducts] = useState([
    { productName: '', qty: '' }
  ]);

  // Dynamic Products state for Store Dispatch / Issue
  const [storeProducts, setStoreProducts] = useState([
    { productName: '', qty: '' }
  ]);

  // Active Modal state: null | 'actualWork' | 'receivedSite' | 'planningOrder' | 'vendorOrder' | 'store' | 'payments'
  const [activeModal, setActiveModal] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Common Form Fields
  const [formData, setFormData] = useState({});
  const [files, setFiles] = useState({});

  useEffect(() => {
    fetchPendingOrders();
    fetchMasterOptions();
  }, []);

  const fetchPendingOrders = async () => {
    setFetching(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await serialFetch(`${SCRIPT_URL}?sheet=${encodeURIComponent(PLANNING_SHEET)}`);
      const result = await response.json();
      const cleanH = (s) => (s ? s.toString().trim().toLowerCase().replace(/[\s\u00a0\r\n\t_-]+/g, '') : '');

      if (result.success && result.data && result.data.length > 0) {
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(result.data.length, 5); i++) {
          if (result.data[i] && result.data[i].some(h => cleanH(h) === 'applicationnumber')) {
            headerRowIndex = i;
            break;
          }
        }

        const headers = result.data[headerRowIndex];

        setColumnsToRender(PENDING_ORDER_COLUMNS.map(col => {
          const targetClean = cleanH(col.match);
          let colIdx = headers.findIndex(h => cleanH(h) === targetClean);
          if (colIdx === -1) {
            if (targetClean.includes('vender')) {
              colIdx = headers.findIndex(h => cleanH(h) === targetClean.replace('vender', 'vendor'));
            } else if (targetClean.includes('vendor')) {
              colIdx = headers.findIndex(h => cleanH(h) === targetClean.replace('vendor', 'vender'));
            }
          }
          return {
            label: col.label,
            colIdx
          };
        }));

        const pendingData = result.data.slice(headerRowIndex + 1)
          .map((row, idx) => ({ rowData: row, originalIndex: idx + headerRowIndex + 2 }))
          .filter(item => item.rowData && item.rowData.some(cell => cell && cell.toString().trim() !== ''))
          .reverse();

        setRows(filterRowsByFirmAccess(pendingData, headers, '/pending-order'));
      } else {
        setRows([]);
        if (!result.success) {
          setMessage({ type: 'error', text: result.error || 'Failed to fetch data' });
        }
      }
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Error fetching pending orders.' });
    } finally {
      setFetching(false);
    }
  };

  const fetchMasterOptions = async () => {
    try {
      const response = await serialFetch(`${SCRIPT_URL}?sheet=${MASTER_SHEET}`);
      const result = await response.json();
      const cleanH = (s) => (s ? s.toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '') : '');

      if (result.success && result.data && result.data.length > 0) {
        const mHeaders = result.data[0];
        let siIdx = mHeaders.findIndex(h => cleanH(h) === 'siteincharge');
        if (siIdx === -1) {
          siIdx = mHeaders.findIndex(h => cleanH(h).includes('siteincharge'));
        }
        if (siIdx === -1) {
          siIdx = mHeaders.findIndex(h => cleanH(h).includes('site') && cleanH(h).includes('incharge'));
        }
        if (siIdx === -1) {
          siIdx = mHeaders.findIndex(h => cleanH(h) === 'incharge' || cleanH(h).includes('incharge'));
        }
        // Find Contractor column specifically from Master sheet
        const contIdx = mHeaders.findIndex(h => cleanH(h) === 'contractor' || cleanH(h) === 'contractorname' || cleanH(h).includes('contractor'));
        const vendIdx = mHeaders.findIndex(h => cleanH(h) === 'vendor' || cleanH(h).includes('vendor'));
        // Find Product Name column specifically from Master sheet
        const prodIdx = mHeaders.findIndex(h => {
          const c = cleanH(h);
          return c === 'productname' || c === 'product' || c === 'products' || c === 'nameofproduct' || c.includes('product');
        });
        // Find Shift Type column from Master sheet
        const shiftIdx = mHeaders.findIndex(h => cleanH(h) === 'shifttype' || cleanH(h) === 'shift' || cleanH(h).includes('shift'));

        const inchargeSet = new Set();
        const contractorSet = new Set();
        const vendorSet = new Set();
        const productSet = new Set();
        const shiftSet = new Set();

        result.data.slice(1).forEach(row => {
          if (!row) return;
          if (siIdx !== -1 && row[siIdx] && row[siIdx].toString().trim()) inchargeSet.add(row[siIdx].toString().trim());
          if (contIdx !== -1 && row[contIdx] && row[contIdx].toString().trim()) contractorSet.add(row[contIdx].toString().trim());
          if (vendIdx !== -1 && row[vendIdx] && row[vendIdx].toString().trim()) vendorSet.add(row[vendIdx].toString().trim());
          if (prodIdx !== -1 && row[prodIdx] && row[prodIdx].toString().trim()) productSet.add(row[prodIdx].toString().trim());
          if (shiftIdx !== -1 && row[shiftIdx] && row[shiftIdx].toString().trim()) shiftSet.add(row[shiftIdx].toString().trim());
        });

        if (inchargeSet.size > 0) setSiteInchargeOptions(Array.from(inchargeSet).sort());
        if (contractorSet.size > 0) setContractorOptions(Array.from(contractorSet).sort());
        if (vendorSet.size > 0) setVendorOptions(Array.from(vendorSet).sort());
        if (productSet.size > 0) setProductOptions(Array.from(productSet).sort());
        if (shiftSet.size > 0) setShiftOptions(Array.from(shiftSet).sort());
      }
    } catch (e) {
      console.warn('Error fetching Master options:', e);
    }
  };

  const getRowValue = (item, label) => {
    const col = columnsToRender.find(c => 
      c.label === label ||
      (label === 'Vendor Order Copy' && c.label === 'Vender Order Copy') ||
      (label === 'Vender Order Copy' && c.label === 'Vendor Order Copy')
    );
    if (col && col.colIdx !== -1 && item.rowData[col.colIdx] !== undefined && item.rowData[col.colIdx] !== null) {
      return item.rowData[col.colIdx].toString().trim();
    }
    return '';
  };

  const getLoggedInUser = () => {
    try {
      const u = localStorage.getItem('botivate_user');
      if (u) {
        const parsed = JSON.parse(u);
        return parsed['User Name'] || parsed.username || parsed.Name || 'Admin';
      }
    } catch (_) {}
    return 'Admin';
  };

  const handleAddActualWorkProduct = () => {
    setActualWorkProducts(prev => [
      ...prev,
      { productName: '', quantity: '', remarks: '' }
    ]);
  };

  const handleRemoveActualWorkProduct = (index) => {
    setActualWorkProducts(prev => prev.filter((_, i) => i !== index));
  };

  const handleActualWorkProductChange = (index, field, value) => {
    setActualWorkProducts(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddReceivedSiteProduct = () => {
    setReceivedSiteProducts(prev => [
      ...prev,
      { productName: '', qtyNumber: '' }
    ]);
  };

  const handleRemoveReceivedSiteProduct = (index) => {
    setReceivedSiteProducts(prev => prev.filter((_, i) => i !== index));
  };

  const handleReceivedSiteProductChange = (index, field, value) => {
    setReceivedSiteProducts(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddPlanningOrderProduct = () => {
    setPlanningOrderProducts(prev => [
      ...prev,
      { productName: '', qty: '' }
    ]);
  };

  const handleRemovePlanningOrderProduct = (index) => {
    setPlanningOrderProducts(prev => prev.filter((_, i) => i !== index));
  };

  const handlePlanningOrderProductChange = (index, field, value) => {
    setPlanningOrderProducts(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddStoreProduct = () => {
    setStoreProducts(prev => [
      ...prev,
      { productName: '', qty: '' }
    ]);
  };

  const handleRemoveStoreProduct = (index) => {
    setStoreProducts(prev => prev.filter((_, i) => i !== index));
  };

  const handleStoreProductChange = (index, field, value) => {
    setStoreProducts(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const fetchActualWorkProducts = async (appNo, serialNo, fallbackQty) => {
    setFetchingActualWork(true);
    try {
      const res = await serialFetch(`${SCRIPT_URL}?sheet=Actual%20Work%20Done`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 1) {
        const cleanCol = (s) => (s ? s.toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '') : '');
        const headers = json.data[0];
        const tsIdx = headers.findIndex(h => cleanCol(h).includes('timestamp'));
        const appIdx = headers.findIndex(h => cleanCol(h).includes('application'));
        const serIdx = headers.findIndex(h => cleanCol(h).includes('serial'));
        const prodIdx = headers.findIndex(h => cleanCol(h).includes('product'));
        const qtyIdx = headers.findIndex(h => cleanCol(h).includes('quantity') || cleanCol(h) === 'qty');

        const parseTimestamp = (ts) => {
          if (!ts) return 0;
          const parts = ts.toString().split(/[\s,/:]+/);
          if (parts.length >= 6) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            const hours = parseInt(parts[3], 10);
            const minutes = parseInt(parts[4], 10);
            const seconds = parseInt(parts[5], 10);
            return new Date(year, month, day, hours, minutes, seconds).getTime() || 0;
          }
          const d = Date.parse(ts);
          return isNaN(d) ? 0 : d;
        };

        if (appIdx !== -1 && serIdx !== -1 && prodIdx !== -1) {
          const matchedProducts = [];
          const cleanVal = (v) => (v !== undefined && v !== null ? v.toString().trim() : '');

          for (let i = 1; i < json.data.length; i++) {
            const row = json.data[i];
            if (!row || row.length === 0) continue;
            const rApp = cleanVal(row[appIdx]);
            const rSer = cleanVal(row[serIdx]);
            // Match by Application Number only — Actual Work Done entries for this application
            // can legitimately be logged under different Serial Numbers, so each product must
            // carry its own originating Serial Number instead of being forced onto whichever
            // serial happens to be selected in the form above.
            if (rApp.toLowerCase() === cleanVal(appNo).toLowerCase()) {
              const pName = cleanVal(row[prodIdx]);
              const pQty = qtyIdx !== -1 ? cleanVal(row[qtyIdx]) : '';
              const rTs = tsIdx !== -1 ? cleanVal(row[tsIdx]) : '';
              if (pName || pQty) {
                matchedProducts.push({
                  rowIndex: i,
                  timestampStr: rTs,
                  timestampNum: parseTimestamp(rTs),
                  productName: pName,
                  qtyNumber: pQty,
                  serialNumber: rSer,
                  fromActualWork: true
                });
              }
            }
          }

          if (matchedProducts.length > 0) {
            // Latest data first (newest timestamp / latest batch first)
            matchedProducts.sort((a, b) => {
              if (b.timestampNum && a.timestampNum && b.timestampNum !== a.timestampNum) {
                return b.timestampNum - a.timestampNum;
              }
              return b.rowIndex - a.rowIndex;
            });

            setReceivedSiteProducts(matchedProducts);
            setFetchingActualWork(false);
            return;
          }
        }
      }
    } catch (err) {
      console.error('Error fetching actual work products:', err);
    }

    setReceivedSiteProducts([
      { productName: '', qtyNumber: fallbackQty || '', fromActualWork: false }
    ]);
    setFetchingActualWork(false);
  };

  const applicationNumberOptions = Array.from(
    new Set(rows.map(r => getRowValue(r, 'Application Number')).filter(Boolean))
  );

  const serialNumberOptions = formData.applicationNo
    ? Array.from(
        new Set(
          rows
            .filter(r => getRowValue(r, 'Application Number') === formData.applicationNo)
            .map(r => getRowValue(r, 'Serial Number'))
            .filter(Boolean)
        )
      )
    : [];

  const handleAppNumberChange = (newAppNo) => {
    const matchingRows = rows.filter(r => getRowValue(r, 'Application Number') === newAppNo);
    const firstMatching = matchingRows[0];
    const firstSerial = firstMatching ? getRowValue(firstMatching, 'Serial Number') : '';
    const party = firstMatching ? getRowValue(firstMatching, 'Party Name') : '';
    const firm = firstMatching ? getRowValue(firstMatching, 'Firm Name') : '';
    const firstQty = firstMatching ? getRowValue(firstMatching, 'Qty') : '';
    setFormData(prev => ({
      ...prev,
      applicationNo: newAppNo,
      serialNumber: firstSerial,
      partyName: party,
      firmName: firm
    }));
    setActualWorkProducts(prev => {
      if (prev.length === 1 && !prev[0].productName) {
        return [{ ...prev[0], quantity: firstQty }];
      }
      return prev;
    });
  };

  const handleSerialNumberChange = (newSerialNo) => {
    const matchingRow = rows.find(r => 
      getRowValue(r, 'Application Number') === formData.applicationNo && 
      getRowValue(r, 'Serial Number') === newSerialNo
    );
    const party = matchingRow ? getRowValue(matchingRow, 'Party Name') : formData.partyName;
    const firm = matchingRow ? getRowValue(matchingRow, 'Firm Name') : formData.firmName;
    const rowQty = matchingRow ? getRowValue(matchingRow, 'Qty') : '';
    setFormData(prev => ({
      ...prev,
      serialNumber: newSerialNo,
      partyName: party,
      firmName: firm
    }));
    setActualWorkProducts(prev => {
      if (prev.length === 1 && !prev[0].productName) {
        return [{ ...prev[0], quantity: rowQty }];
      }
      return prev;
    });
  };

  // Generic Application/Serial Number dropdown helpers, shared by the Received At Site,
  // Planning Order, Vendor Order, Store and Payments forms (field names differ per form,
  // so appField/serialField are passed in per call site).
  const getSerialOptionsForApp = (appNo) => (
    appNo
      ? Array.from(new Set(
          rows
            .filter(r => getRowValue(r, 'Application Number') === appNo)
            .map(r => getRowValue(r, 'Serial Number'))
            .filter(Boolean)
        ))
      : []
  );

  const handleModalAppNumberChange = (newAppNo, appField, serialField, onResolved) => {
    const matchingRows = rows.filter(r => getRowValue(r, 'Application Number') === newAppNo);
    const firstMatching = matchingRows[0];
    const firstSerial = firstMatching ? getRowValue(firstMatching, 'Serial Number') : '';
    const party = firstMatching ? getRowValue(firstMatching, 'Party Name') : '';
    const firm = firstMatching ? getRowValue(firstMatching, 'Firm Name') : '';
    const rowQty = firstMatching ? getRowValue(firstMatching, 'Qty') : '';
    setFormData(prev => ({
      ...prev,
      [appField]: newAppNo,
      [serialField]: firstSerial,
      partyName: party,
      firmName: firm
    }));
    if (onResolved) onResolved({ appNo: newAppNo, serial: firstSerial, qty: rowQty });
  };

  const handleModalSerialNumberChange = (newSerialNo, appNo, serialField, onResolved) => {
    const matchingRow = rows.find(r =>
      getRowValue(r, 'Application Number') === appNo &&
      getRowValue(r, 'Serial Number') === newSerialNo
    );
    const party = matchingRow ? getRowValue(matchingRow, 'Party Name') : formData.partyName;
    const firm = matchingRow ? getRowValue(matchingRow, 'Firm Name') : formData.firmName;
    const rowQty = matchingRow ? getRowValue(matchingRow, 'Qty') : '';
    setFormData(prev => ({
      ...prev,
      [serialField]: newSerialNo,
      partyName: party,
      firmName: firm
    }));
    if (onResolved) onResolved({ appNo, serial: newSerialNo, qty: rowQty });
  };

  const openFormModal = (modalType, item) => {
    setSelectedRow(item);
    setActiveModal(modalType);
    setFiles({});
    setMessage({ type: '', text: '' });

    const appNo = getRowValue(item, 'Application Number');
    const serialNo = getRowValue(item, 'Serial Number');
    const party = getRowValue(item, 'Party Name');
    const firm = getRowValue(item, 'Firm Name');
    const typeWork = getRowValue(item, 'Type Of Work') || 'We will do';
    const rowQty = getRowValue(item, 'Qty');
    const rowRate = getRowValue(item, 'Rate');
    const today = new Date().toISOString().split('T')[0];

    if (modalType === 'actualWork') {
      setFormData({
        applicationNo: appNo,
        serialNumber: serialNo,
        firmName: firm,
        date: today,
        siteIncharge: '',
        contractorName: '',
        shift: 'Day',
        numberOfLabours: '',
        partyName: party,
      });
      setActualWorkProducts([
        { productName: '', quantity: rowQty || '', remarks: '' }
      ]);
    } else if (modalType === 'receivedSite') {
      setFormData({
        applicationNo: appNo,
        serialNumber: serialNo,
        firmName: firm,
        dispatchDate: today,
        partyName: party,
        supervisorName: '',
        phoneNumber: '',
      });
      setReceivedSiteProducts([]);
      fetchActualWorkProducts(appNo, serialNo, rowQty);
    } else if (modalType === 'planningOrder') {
      setFormData({
        applicationNo: appNo,
        serialNo: serialNo,
        firmName: firm,
        userId: getLoggedInUser(),
        partyName: party,
      });
      setPlanningOrderProducts([
        { productName: '', qty: rowQty || '' }
      ]);
    } else if (modalType === 'vendorOrder') {
      setFormData({
        applicationNo: appNo,
        serialNo: serialNo,
        firmName: firm,
        siteInchargeName: '',
        typeOfWork: typeWork,
        nameOfTheVendor: '',
        rateDetails: rowRate,
        qtyOfMaterial: rowQty,
        partyName: party,
        panNo: '',
        gstNo: '',
      });
    } else if (modalType === 'store') {
      setFormData({
          applicationNumber: appNo,
        serialNo: serialNo,
        firmName: firm,
        date: today,
        status: 'Issued',
        partyName: party,
      });
      setStoreProducts([
        { productName: '', qty: rowQty || '' }
      ]);
    } else if (modalType === 'payments') {
      setFormData({
        applicationNo: appNo,
        serialNumber: serialNo,
        firmName: firm,
        amount: '',
        contractorName: '',
        payTo: '',
        remarks: '',
        partyName: party,
      });
    }
  };

  const uploadFile = (file) => {
    return new Promise((resolve) => {
      const folderId = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID;
      if (!folderId) { resolve(''); return; }
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64Data = e.target.result;
          const params = new URLSearchParams();
          params.append('action', 'uploadFile');
          params.append('base64Data', base64Data);
          params.append('fileName', file.name);
          params.append('mimeType', file.type || 'application/octet-stream');
          params.append('folderId', folderId);

          const response = await serialFetch(SCRIPT_URL, { method: 'POST', body: params });
          const result = await response.json();
          resolve(result.success && result.fileUrl ? result.fileUrl : '');
        } catch (err) {
          console.error('Upload error:', err);
          resolve('');
        }
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const pad = (n) => n.toString().padStart(2, '0');
      const d = new Date();
      const timestamp = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

      let sheetName = '';
      let rowData = [];

      // 1. Actual Work Done
      if (activeModal === 'actualWork') {
        sheetName = 'Actual Work Done';
        let fileUrl = '';
        if (files.saveFiles) fileUrl = await uploadFile(files.saveFiles);

        // Fetch target sheet headers to ensure dynamic column placement
        let targetHeaders = [
          'Timestamp', 'Application No.', 'Serial Number', 'Firm',
          'Date', 'Site Incharge', 'Contractor Name', 'Shift',
          'Save Files', 'Number Of Labours', 'Product Names', 'Quantity',
          'Remarks', 'Party Name'
        ];
        try {
          const hRes = await serialFetch(`${SCRIPT_URL}?sheet=${encodeURIComponent(sheetName)}`);
          const hJson = await hRes.json();
          if (hJson.success && hJson.data && hJson.data.length > 0) {
            targetHeaders = hJson.data[0];
          }
        } catch (_) {}

        const cleanCol = (s) => (s ? s.toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '') : '');
        const findColIdx = (name) => {
          const target = cleanCol(name);
          let idx = targetHeaders.findIndex(h => cleanCol(h) === target);
          if (idx !== -1) return idx;
          return targetHeaders.findIndex(h => cleanCol(h).includes(target));
        };

        const tsIdx = findColIdx('Timestamp');
        const appIdx = findColIdx('Application No');
        const serIdx = findColIdx('Serial Number');
        const firmIdx = findColIdx('Firm');
        const dateIdx = findColIdx('Date');
        const siIdx = findColIdx('Site Incharge');
        const contIdx = findColIdx('Contractor Name');
        const shiftIdx = findColIdx('Shift');
        const fileIdx = findColIdx('Save Files');
        const labourIdx = findColIdx('Number Of Labours');
        const prodIdx = findColIdx('Product Names');
        const qtyIdx = findColIdx('Quantity');
        const remIdx = findColIdx('Remarks');
        const partyIdx = findColIdx('Party Name');

        const productsToSave = actualWorkProducts.filter(p => p.productName || p.quantity || p.remarks);
        const finalProducts = productsToSave.length > 0
          ? productsToSave
          : actualWorkProducts;

        for (const prod of finalProducts) {
          const rowData = new Array(targetHeaders.length).fill('');
          if (tsIdx !== -1) rowData[tsIdx] = timestamp;
          if (appIdx !== -1) rowData[appIdx] = formData.applicationNo || '';
          if (serIdx !== -1) rowData[serIdx] = formData.serialNumber || '';
          if (firmIdx !== -1) rowData[firmIdx] = formData.firmName || '';
          if (dateIdx !== -1) rowData[dateIdx] = formData.date || '';
          if (siIdx !== -1) rowData[siIdx] = formData.siteIncharge || '';
          if (contIdx !== -1) rowData[contIdx] = formData.contractorName || '';
          if (shiftIdx !== -1) rowData[shiftIdx] = formData.shift || '';
          if (fileIdx !== -1) rowData[fileIdx] = fileUrl;
          if (labourIdx !== -1) rowData[labourIdx] = formData.numberOfLabours || '';
          if (prodIdx !== -1) rowData[prodIdx] = prod.productName || '';
          if (qtyIdx !== -1) rowData[qtyIdx] = prod.quantity || '';
          if (remIdx !== -1) rowData[remIdx] = prod.remarks || '';
          if (partyIdx !== -1) rowData[partyIdx] = formData.partyName || '';

          const params = new URLSearchParams();
          params.append('sheetName', sheetName);
          params.append('action', 'insert');
          params.append('rowData', JSON.stringify(rowData));

          const response = await serialFetch(SCRIPT_URL, { method: 'POST', body: params });
          const result = await response.json();
          if (!result.success) throw new Error(result.error || 'Failed to submit form to Google Sheet');
        }

        setMessage({ type: 'success', text: `${sheetName} record(s) submitted successfully!` });
        setActiveModal(null);
        setActualWorkProducts([{ productName: '', quantity: '', remarks: '' }]);
        return;
      }

      // 2. Received At Site
      else if (activeModal === 'receivedSite') {
        sheetName = 'Received At Site';

        const productsToSave = receivedSiteProducts.filter(p => p.productName || p.qtyNumber);
        const finalProducts = productsToSave.length > 0
          ? productsToSave
          : receivedSiteProducts;

        for (const prod of finalProducts) {
          // Products pulled in from Actual Work Done carry their own originating Serial Number
          // (a single application can have actual work logged under different serials), so use
          // that per-product value instead of always forcing the form's selected Serial Number.
          const rowData = [
            timestamp,
            formData.applicationNo || '',
            prod.serialNumber || formData.serialNumber || '',
            formData.firmName || '',
            prod.productName || '',
            prod.qtyNumber || '',
            formData.dispatchDate || '',
            formData.partyName || '',
            formData.supervisorName || '',
            formData.phoneNumber || ''
          ];

          const params = new URLSearchParams();
          params.append('sheetName', sheetName);
          params.append('action', 'insert');
          params.append('rowData', JSON.stringify(rowData));

          const response = await serialFetch(SCRIPT_URL, { method: 'POST', body: params });
          const result = await response.json();
          if (!result.success) throw new Error(result.error || 'Failed to submit form to Google Sheet');
        }

        setMessage({ type: 'success', text: `${sheetName} record(s) submitted successfully!` });
        setActiveModal(null);
        setReceivedSiteProducts([{ productName: '', qtyNumber: '' }]);
        return;
      }

      // 3. Planning Order
      else if (activeModal === 'planningOrder') {
        sheetName = 'Planning Order';

        const productsToSave = planningOrderProducts.filter(p => p.productName || p.qty);
        const finalProducts = productsToSave.length > 0
          ? productsToSave
          : planningOrderProducts;

        for (const prod of finalProducts) {
          const rowData = [
            timestamp,
            formData.applicationNo || '',
            formData.serialNo || '',
            formData.firmName || '',
            prod.productName || '',
            prod.qty || '',
            formData.userId || '',
            formData.partyName || ''
          ];

          const params = new URLSearchParams();
          params.append('sheetName', sheetName);
          params.append('action', 'insert');
          params.append('rowData', JSON.stringify(rowData));

          const response = await serialFetch(SCRIPT_URL, { method: 'POST', body: params });
          const result = await response.json();
          if (!result.success) throw new Error(result.error || 'Failed to submit form to Google Sheet');
        }

        setMessage({ type: 'success', text: `${sheetName} record(s) submitted successfully!` });
        setActiveModal(null);
        setPlanningOrderProducts([{ productName: '', qty: '' }]);
        return;
      }

      // 4. Vendor Order
      else if (activeModal === 'vendorOrder') {
        sheetName = 'Vendor Order';
        let vendorOrderCopyUrl = '';
        let panPhotoUrl = '';
        let gstCopyUrl = '';

        if (files.vendorOrderCopy) vendorOrderCopyUrl = await uploadFile(files.vendorOrderCopy);
        if (files.panPhoto) panPhotoUrl = await uploadFile(files.panPhoto);
        if (files.gstCopy) gstCopyUrl = await uploadFile(files.gstCopy);

        rowData = [
          timestamp,
          formData.applicationNo || '',
          formData.serialNo || '',
          formData.firmName || '',
          formData.siteInchargeName || '',
          formData.typeOfWork || '',
          formData.nameOfTheVendor || '',
          formData.rateDetails || '',
          formData.qtyOfMaterial || '',
          vendorOrderCopyUrl,
          formData.partyName || '',
          formData.panNo || '',
          panPhotoUrl,
          formData.gstNo || '',
          gstCopyUrl
        ];
      }

      // 5. Store
      else if (activeModal === 'store') {
        sheetName = 'Store';
        const productsToSave = storeProducts.filter(p => p.productName || p.qty);
        const finalProducts = productsToSave.length > 0
          ? productsToSave
          : [{ productName: '', qty: '' }];

        if (finalProducts.length === 1 && !finalProducts[0].productName && !finalProducts[0].qty) {
          throw new Error('Please select at least one Product Name and enter Quantity.');
        }

        for (const prod of finalProducts) {
          const itemRowData = [
            timestamp,
            formData.applicationNumber || '',
            formData.serialNo || '',
            formData.firmName || '',
            formData.date || '',
            formData.status || '',
            prod.productName || '',
            prod.qty || '',
            formData.partyName || ''
          ];

          const params = new URLSearchParams();
          params.append('sheetName', sheetName);
          params.append('action', 'insert');
          params.append('rowData', JSON.stringify(itemRowData));

          const response = await serialFetch(SCRIPT_URL, { method: 'POST', body: params });
          const result = await response.json();
          if (!result.success) throw new Error(result.error || 'Failed to submit form to Google Sheet');
        }

        setMessage({ type: 'success', text: `${sheetName} record(s) submitted successfully!` });
        setActiveModal(null);
        setStoreProducts([{ productName: '', qty: '' }]);
        return;
      }

      // 6. Payments
      else if (activeModal === 'payments') {
        sheetName = 'Payments';
        let saveFileUrl = '';
        if (files.saveFile) saveFileUrl = await uploadFile(files.saveFile);

        // Fetch target sheet headers to ensure dynamic column placement (the Payments sheet
        // can gain/reorder columns like Product Name, Planned, Actual, Delay over time).
        let targetHeaders = [
          'Timestamp', 'Appliction No.', 'Serial Number', 'Firm', 'Amount',
          'Contractor Name', 'Pay To', 'Remarks', 'Save File', 'Party Name', 'Status'
        ];
        try {
          const hRes = await serialFetch(`${SCRIPT_URL}?sheet=${encodeURIComponent(sheetName)}`);
          const hJson = await hRes.json();
          if (hJson.success && hJson.data && hJson.data.length > 0) {
            targetHeaders = hJson.data[0];
          }
        } catch (_) {}

        const cleanCol = (s) => (s ? s.toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '') : '');
        const findColIdx = (name) => {
          const target = cleanCol(name);
          let idx = targetHeaders.findIndex(h => cleanCol(h) === target);
          if (idx !== -1) return idx;
          return targetHeaders.findIndex(h => cleanCol(h).includes(target));
        };

        const tsIdx = findColIdx('Timestamp');
        const appIdx = findColIdx('Appliction No');
        const serIdx = findColIdx('Serial Number');
        const firmIdx = findColIdx('Firm');
        const amountIdx = findColIdx('Amount');
        const contIdx = findColIdx('Contractor Name');
        const payToIdx = findColIdx('Pay To');
        const remIdx = findColIdx('Remarks');
        const fileIdx = findColIdx('Save File');
        const partyIdx = findColIdx('Party Name');
        const statusIdx = findColIdx('Status');

        rowData = new Array(targetHeaders.length).fill('');
        if (tsIdx !== -1) rowData[tsIdx] = timestamp;
        if (appIdx !== -1) rowData[appIdx] = formData.applicationNo || '';
        if (serIdx !== -1) rowData[serIdx] = formData.serialNumber || '';
        if (firmIdx !== -1) rowData[firmIdx] = formData.firmName || '';
        if (amountIdx !== -1) rowData[amountIdx] = formData.amount || '';
        if (contIdx !== -1) rowData[contIdx] = formData.contractorName || '';
        if (payToIdx !== -1) rowData[payToIdx] = formData.payTo || '';
        if (remIdx !== -1) rowData[remIdx] = formData.remarks || '';
        if (fileIdx !== -1) rowData[fileIdx] = saveFileUrl;
        if (partyIdx !== -1) rowData[partyIdx] = formData.partyName || '';
        if (statusIdx !== -1) rowData[statusIdx] = 'Pending';
      }

      const params = new URLSearchParams();
      params.append('sheetName', sheetName);
      params.append('action', 'insert');
      params.append('rowData', JSON.stringify(rowData));

      const response = await serialFetch(SCRIPT_URL, { method: 'POST', body: params });
      const result = await response.json();

      if (!result.success) throw new Error(result.error || 'Failed to submit form to Google Sheet');

      setMessage({ type: 'success', text: `${sheetName} record submitted successfully!` });
      setActiveModal(null);
    } catch (err) {
      console.error('Submit error:', err);
      setMessage({ type: 'error', text: err.message || 'Error submitting form.' });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRows = rows.filter(item => {
    if (!searchQuery) return true;
    return item.rowData.some(cell =>
      cell && cell.toString().toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Pending Order</h1>
          <p style={{ color: 'var(--text-muted)' }}>Orders from FMS sheet. Click action buttons in table columns to submit respective stage forms.</p>
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

      <div className="table-container">
        <div style={{ position: 'relative', width: '100%', maxWidth: '100%', marginBottom: '1.5rem', display: 'flex' }}>
          <Search size={18} style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by Application Number, PO Number, Firm Name, or any keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input"
            style={{ width: '100%', paddingLeft: '3rem', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '1rem', transition: 'all 0.2s ease', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)' }}
            onFocus={(e) => e.target.style.borderColor = 'var(--primary-color)'}
            onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
          />
        </div>

        {fetching ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={32} className="animate-spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
            <p>Loading records...</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {PENDING_ORDER_COLUMNS.map((col, idx) => (
                    <th key={idx}>{col.label}</th>
                  ))}
                  {/* 6 Action Stage Columns */}
                  {ACTION_COLUMNS.map((act) => (
                    <th key={act.id} style={{ textAlign: 'center', whiteSpace: 'nowrap', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                      {act.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={PENDING_ORDER_COLUMNS.length + ACTION_COLUMNS.length} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No pending orders found.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((item, index) => (
                    <tr key={index}>
                      {columnsToRender.map((col, idx) => {
                        const val = col.colIdx !== -1 ? item.rowData[col.colIdx] : '';
                        const isFileColumn = col.label === 'Vender Order Copy' || col.label === 'Vendor Order Copy' || col.label.toLowerCase().includes('copy');
                        const strVal = val !== undefined && val !== null ? val.toString() : '';
                        return (
                          <td key={idx} data-label={col.label}>
                            {isFileColumn && strVal.startsWith('http') ? (
                              <a href={strVal} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)', fontWeight: 600 }}>
                                <ImageIcon size={20} />
                              </a>
                            ) : strVal}
                          </td>
                        );
                      })}

                      {/* 6 Action Buttons */}
                      <td style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                        <button
                          type="button"
                          className="btn-action-stage"
                          style={{ borderColor: '#3b82f6', color: '#60a5fa' }}
                          onClick={() => openFormModal('actualWork', item)}
                        >
                          Actual Work
                        </button>
                      </td>

                      <td style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                        <button
                          type="button"
                          className="btn-action-stage"
                          style={{ borderColor: '#10b981', color: '#34d399' }}
                          onClick={() => openFormModal('receivedSite', item)}
                        >
                          Received Site
                        </button>
                      </td>

                      <td style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                        <button
                          type="button"
                          className="btn-action-stage"
                          style={{ borderColor: '#8b5cf6', color: '#a78bfa' }}
                          onClick={() => openFormModal('planningOrder', item)}
                        >
                          Planning Order
                        </button>
                      </td>

                      <td style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                        <button
                          type="button"
                          className="btn-action-stage"
                          style={{ borderColor: '#f59e0b', color: '#fbbf24' }}
                          onClick={() => openFormModal('vendorOrder', item)}
                        >
                          Vendor Order
                        </button>
                      </td>

                      <td style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                        <button
                          type="button"
                          className="btn-action-stage"
                          style={{ borderColor: '#ec4899', color: '#f472b6' }}
                          onClick={() => openFormModal('store', item)}
                        >
                          Store
                        </button>
                      </td>

                      <td style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                        <button
                          type="button"
                          className="btn-action-stage"
                          style={{ borderColor: '#06b6d4', color: '#22d3ee' }}
                          onClick={() => openFormModal('payments', item)}
                        >
                          Payments
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===================== MODAL FORMS ===================== */}
      {activeModal && (
        <div className="modal-overlay">
          <div className="modal-card animate-fade-in" style={{ maxWidth: '750px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '2.5rem' }}>
            <button onClick={() => setActiveModal(null)} className="modal-close-btn">
              <X size={20} />
            </button>

            {/* Modal Title */}
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--primary-color)' }}>
              {activeModal === 'actualWork' && 'Actual Work Done Form'}
              {activeModal === 'receivedSite' && 'Received At Site Form'}
              {activeModal === 'planningOrder' && 'Planning Order Form'}
              {activeModal === 'vendorOrder' && 'Vendor Order Form'}
              {activeModal === 'store' && 'Store Dispatch / Issue Form'}
              {activeModal === 'payments' && 'Payments Entry Form'}
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
              Submitting for Application No: <strong style={{ color: 'var(--text-primary)' }}>{formData.applicationNo || formData.applicationNumber}</strong>
            </p>

            <form onSubmit={handleFormSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>

                {/* 1. ACTUAL WORK DONE FORM */}
                {activeModal === 'actualWork' && (
                  <>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Application Number</label>
                      <div className="select-wrapper">
                        <select
                          className="form-input"
                          value={formData.applicationNo || ''}
                          onChange={(e) => handleAppNumberChange(e.target.value)}
                          disabled={submitting}
                        >
                          <option value="">Select Application Number</option>
                          {applicationNumberOptions.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="select-chevron" />
                      </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Serial Number</label>
                      <div className="select-wrapper">
                        <select
                          className="form-input"
                          value={formData.serialNumber || ''}
                          onChange={(e) => handleSerialNumberChange(e.target.value)}
                          disabled={!formData.applicationNo || submitting}
                        >
                          <option value="">Select Serial Number</option>
                          {serialNumberOptions.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="select-chevron" />
                      </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Date *</label>
                      <input
                        type="date"
                        className="form-input"
                        value={formData.date || ''}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        required
                        disabled={submitting}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Party Name</label>
                      <input type="text" className="form-input" value={formData.partyName || ''} readOnly />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Firm</label>
                      <input type="text" className="form-input" value={formData.firmName || ''} readOnly />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Site Incharge</label>
                      <div className="select-wrapper">
                        <select
                          className="form-input"
                          value={formData.siteIncharge || ''}
                          onChange={(e) => setFormData({ ...formData, siteIncharge: e.target.value })}
                          disabled={submitting}
                        >
                          <option value="">Select Site Incharge</option>
                          {siteInchargeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        <ChevronDown size={16} className="select-chevron" />
                      </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Contractor Name</label>
                      <div className="select-wrapper">
                        <select
                          className="form-input"
                          value={formData.contractorName || ''}
                          onChange={(e) => setFormData({ ...formData, contractorName: e.target.value })}
                          disabled={submitting}
                        >
                          <option value="">Select Contractor</option>
                          {contractorOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        <ChevronDown size={16} className="select-chevron" />
                      </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Shift</label>
                      <div className="select-wrapper">
                        <select
                          className="form-input"
                          value={formData.shift || ''}
                          onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                          disabled={submitting}
                        >
                          <option value="">Select Shift</option>
                          {shiftOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        <ChevronDown size={16} className="select-chevron" />
                      </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Number Of Labours</label>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="e.g. 6"
                        value={formData.numberOfLabours || ''}
                        onChange={(e) => setFormData({ ...formData, numberOfLabours: e.target.value })}
                        disabled={submitting}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                      <label className="form-label">Save Files (Photo / Document)</label>
                      <input
                        type="file"
                        className="form-input"
                        onChange={(e) => setFiles({ ...files, saveFiles: e.target.files?.[0] || null })}
                        disabled={submitting}
                      />
                    </div>

                    {/* Dynamic Products Section */}
                    <div style={{ gridColumn: '1 / -1', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Package size={18} style={{ color: 'var(--primary-color)' }} />
                          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Products</h3>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.55rem', borderRadius: '12px' }}>
                            {actualWorkProducts.length} {actualWorkProducts.length === 1 ? 'Item' : 'Items'}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={handleAddActualWorkProduct}
                          disabled={submitting}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
                        >
                          <Plus size={16} /> Add Product
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {actualWorkProducts.map((prod, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: '1.25rem',
                              borderRadius: '10px',
                              background: 'rgba(255, 255, 255, 0.02)',
                              border: '1px solid var(--border-color)'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                Product #{idx + 1}
                              </span>
                              {actualWorkProducts.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveActualWorkProduct(idx)}
                                  disabled={submitting}
                                  style={{
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                    color: '#ef4444',
                                    padding: '0.25rem 0.6rem',
                                    borderRadius: '6px',
                                    fontSize: '0.78rem',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem'
                                  }}
                                >
                                  <Trash2 size={13} /> Remove
                                </button>
                              )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Product Name</label>
                                <div className="select-wrapper">
                                  <select
                                    className="form-input"
                                    value={prod.productName || ''}
                                    onChange={(e) => handleActualWorkProductChange(idx, 'productName', e.target.value)}
                                    disabled={submitting}
                                  >
                                    <option value="">Select Product</option>
                                    {productOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                  </select>
                                  <ChevronDown size={16} className="select-chevron" />
                                </div>
                              </div>

                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Quantity</label>
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder="Quantity"
                                  value={prod.quantity || ''}
                                  onChange={(e) => handleActualWorkProductChange(idx, 'quantity', e.target.value)}
                                  disabled={submitting}
                                />
                              </div>

                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Remark</label>
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder="Remarks / Notes"
                                  value={prod.remarks || ''}
                                  onChange={(e) => handleActualWorkProductChange(idx, 'remarks', e.target.value)}
                                  disabled={submitting}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* 2. RECEIVED AT SITE FORM */}
                {activeModal === 'receivedSite' && (
                  <>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Application No.</label>
                      <div className="select-wrapper">
                        <select
                          className="form-input"
                          value={formData.applicationNo || ''}
                          onChange={(e) => handleModalAppNumberChange(e.target.value, 'applicationNo', 'serialNumber', ({ appNo, serial, qty }) => fetchActualWorkProducts(appNo, serial, qty))}
                          disabled={submitting}
                        >
                          <option value="">Select Application Number</option>
                          {applicationNumberOptions.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="select-chevron" />
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Serial Number</label>
                      <div className="select-wrapper">
                        <select
                          className="form-input"
                          value={formData.serialNumber || ''}
                          onChange={(e) => handleModalSerialNumberChange(e.target.value, formData.applicationNo, 'serialNumber', ({ appNo, serial, qty }) => fetchActualWorkProducts(appNo, serial, qty))}
                          disabled={!formData.applicationNo || submitting}
                        >
                          <option value="">Select Serial Number</option>
                          {getSerialOptionsForApp(formData.applicationNo).map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="select-chevron" />
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">PARTY NAME</label>
                      <input type="text" className="form-input" value={formData.partyName || ''} readOnly />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Firm</label>
                      <input type="text" className="form-input" value={formData.firmName || ''} readOnly />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Dispatch Date *</label>
                      <input
                        type="date"
                        className="form-input"
                        value={formData.dispatchDate || ''}
                        onChange={(e) => setFormData({ ...formData, dispatchDate: e.target.value })}
                        required
                        disabled={submitting}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Supervisor Name</label>
                      <div className="select-wrapper">
                        <select
                          className="form-input"
                          value={formData.supervisorName || ''}
                          onChange={(e) => setFormData({ ...formData, supervisorName: e.target.value })}
                          disabled={submitting}
                        >
                          <option value="">Select Supervisor</option>
                          {siteInchargeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        <ChevronDown size={16} className="select-chevron" />
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Phone number</label>
                      <input
                        type="tel"
                        className="form-input"
                        placeholder="Phone Number"
                        value={formData.phoneNumber || ''}
                        onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                        disabled={submitting}
                      />
                    </div>

                    {/* Dynamic Products Section for Received At Site */}
                    <div style={{ gridColumn: '1 / -1', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Package size={18} style={{ color: 'var(--primary-color)' }} />
                          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Products (From Actual Work Done)</h3>
                          {!fetchingActualWork && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.55rem', borderRadius: '12px' }}>
                              {receivedSiteProducts.length} {receivedSiteProducts.length === 1 ? 'Item' : 'Items'}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={handleAddReceivedSiteProduct}
                          disabled={submitting || fetchingActualWork}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
                        >
                          <Plus size={16} /> Add Product
                        </button>
                      </div>

                      {fetchingActualWork ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
                          <p style={{ margin: 0, fontSize: '0.85rem' }}>Fetching products and quantities from Actual Work Done...</p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {receivedSiteProducts.map((prod, idx) => (
                            <div
                              key={idx}
                              style={{
                                padding: '1.25rem',
                                borderRadius: '10px',
                                background: 'rgba(255, 255, 255, 0.02)',
                                border: '1px solid var(--border-color)'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                    Product #{idx + 1}
                                  </span>
                                  {prod.fromActualWork && (
                                    <span style={{ fontSize: '0.72rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                                      Actual Work Done
                                    </span>
                                  )}
                                </div>
                                {receivedSiteProducts.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveReceivedSiteProduct(idx)}
                                    disabled={submitting}
                                    style={{
                                      background: 'rgba(239, 68, 68, 0.1)',
                                      border: '1px solid rgba(239, 68, 68, 0.2)',
                                      color: '#ef4444',
                                      padding: '0.25rem 0.6rem',
                                      borderRadius: '6px',
                                      fontSize: '0.78rem',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.3rem'
                                    }}
                                  >
                                    <Trash2 size={13} /> Remove
                                  </button>
                                )}
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                  <label className="form-label">
                                    Product Name {prod.fromActualWork && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}></span>}
                                  </label>
                                  {prod.fromActualWork ? (
                                    <input
                                      type="text"
                                      className="form-input"
                                      value={prod.productName || ''}
                                      readOnly
                                      style={{ background: 'rgba(255, 255, 255, 0.03)', cursor: 'not-allowed' }}
                                    />
                                  ) : (
                                    <div className="select-wrapper">
                                      <select
                                        className="form-input"
                                        value={prod.productName || ''}
                                        onChange={(e) => handleReceivedSiteProductChange(idx, 'productName', e.target.value)}
                                        disabled={submitting}
                                      >
                                        <option value="">Select Product</option>
                                        {productOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                      </select>
                                      <ChevronDown size={16} className="select-chevron" />
                                    </div>
                                  )}
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                  <label className="form-label">
                                    Qty Number <span style={{ fontSize: '0.75rem', color: 'var(--primary-color)' }}></span>
                                  </label>
                                  <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Qty Number"
                                    value={prod.qtyNumber || ''}
                                    onChange={(e) => handleReceivedSiteProductChange(idx, 'qtyNumber', e.target.value)}
                                    disabled={submitting}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* 3. PLANNING ORDER FORM */}
                {activeModal === 'planningOrder' && (
                  <>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Application No.</label>
                      <div className="select-wrapper">
                        <select
                          className="form-input"
                          value={formData.applicationNo || ''}
                          onChange={(e) => handleModalAppNumberChange(e.target.value, 'applicationNo', 'serialNo')}
                          disabled={submitting}
                        >
                          <option value="">Select Application Number</option>
                          {applicationNumberOptions.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="select-chevron" />
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Serial No.</label>
                      <div className="select-wrapper">
                        <select
                          className="form-input"
                          value={formData.serialNo || ''}
                          onChange={(e) => handleModalSerialNumberChange(e.target.value, formData.applicationNo, 'serialNo')}
                          disabled={!formData.applicationNo || submitting}
                        >
                          <option value="">Select Serial Number</option>
                          {getSerialOptionsForApp(formData.applicationNo).map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="select-chevron" />
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Party Name</label>
                      <input type="text" className="form-input" value={formData.partyName || ''} readOnly />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Firm</label>
                      <input type="text" className="form-input" value={formData.firmName || ''} readOnly />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">User ID</label>
                      <input type="text" className="form-input" value={formData.userId || ''} readOnly />
                    </div>

                    {/* Dynamic Products Section for Planning Order */}
                    <div style={{ gridColumn: '1 / -1', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Package size={18} style={{ color: 'var(--primary-color)' }} />
                          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Products</h3>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.55rem', borderRadius: '12px' }}>
                            {planningOrderProducts.length} {planningOrderProducts.length === 1 ? 'Item' : 'Items'}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={handleAddPlanningOrderProduct}
                          disabled={submitting}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
                        >
                          <Plus size={16} /> Add Product
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {planningOrderProducts.map((prod, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: '1.25rem',
                              borderRadius: '10px',
                              background: 'rgba(255, 255, 255, 0.02)',
                              border: '1px solid var(--border-color)'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                Product #{idx + 1}
                              </span>
                              {planningOrderProducts.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemovePlanningOrderProduct(idx)}
                                  disabled={submitting}
                                  style={{
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                    color: '#ef4444',
                                    padding: '0.25rem 0.6rem',
                                    borderRadius: '6px',
                                    fontSize: '0.78rem',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem'
                                  }}
                                >
                                  <Trash2 size={13} /> Remove
                                </button>
                              )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Product Name</label>
                                <div className="select-wrapper">
                                  <select
                                    className="form-input"
                                    value={prod.productName || ''}
                                    onChange={(e) => handlePlanningOrderProductChange(idx, 'productName', e.target.value)}
                                    disabled={submitting}
                                  >
                                    <option value="">Select Product</option>
                                    {productOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                  </select>
                                  <ChevronDown size={16} className="select-chevron" />
                                </div>
                              </div>

                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Quantity</label>
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder="Enter Quantity"
                                  value={prod.qty || ''}
                                  onChange={(e) => handlePlanningOrderProductChange(idx, 'qty', e.target.value)}
                                  disabled={submitting}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* 4. VENDOR ORDER FORM */}
                {activeModal === 'vendorOrder' && (
                  <>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Application No.</label>
                      <div className="select-wrapper">
                        <select
                          className="form-input"
                          value={formData.applicationNo || ''}
                          onChange={(e) => handleModalAppNumberChange(e.target.value, 'applicationNo', 'serialNo')}
                        >
                          <option value="">Select Application Number</option>
                          {applicationNumberOptions.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="select-chevron" />
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Serial No.</label>
                      <div className="select-wrapper">
                        <select
                          className="form-input"
                          value={formData.serialNo || ''}
                          onChange={(e) => handleModalSerialNumberChange(e.target.value, formData.applicationNo, 'serialNo')}
                          disabled={!formData.applicationNo}
                        >
                          <option value="">Select Serial Number</option>
                          {getSerialOptionsForApp(formData.applicationNo).map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="select-chevron" />
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Party Name</label>
                      <input type="text" className="form-input" value={formData.partyName || ''} readOnly />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Firm</label>
                      <input type="text" className="form-input" value={formData.firmName || ''} readOnly />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Side Incharge Name</label>
                      <div className="select-wrapper">
                        <select
                          className="form-input"
                          value={formData.siteInchargeName || ''}
                          onChange={(e) => setFormData({ ...formData, siteInchargeName: e.target.value })}
                        >
                          <option value="">Select Incharge</option>
                          {siteInchargeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        <ChevronDown size={16} className="select-chevron" />
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Type Of Work</label>
                      <div className="select-wrapper">
                        <select
                          className="form-input"
                          value={formData.typeOfWork || 'We will do'}
                          onChange={(e) => setFormData({ ...formData, typeOfWork: e.target.value })}
                        >
                          {TYPE_OF_WORK_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        <ChevronDown size={16} className="select-chevron" />
                      </div>
                    </div>

                    {/* When 'We will sublet' is selected, show Name Of Ther Vandor, Rate Details, Qty Of Material */}
                    {formData.typeOfWork === 'We will sublet' && (
                      <>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Name Of Ther Vandor</label>
                          <div className="select-wrapper">
                            <select
                              className="form-input"
                              value={formData.nameOfTheVendor || ''}
                              onChange={(e) => setFormData({ ...formData, nameOfTheVendor: e.target.value })}
                            >
                              <option value="">Select Vendor</option>
                              {vendorOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                            <ChevronDown size={16} className="select-chevron" />
                          </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Rate Details</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Rate Details"
                            value={formData.rateDetails || ''}
                            onChange={(e) => setFormData({ ...formData, rateDetails: e.target.value })}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Qty Of Material</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Qty of Material"
                            value={formData.qtyOfMaterial || ''}
                            onChange={(e) => setFormData({ ...formData, qtyOfMaterial: e.target.value })}
                          />
                        </div>
                      </>
                    )}

                    {/* Vendor Order Copy shown for both 'We will do' and 'We will sublet' */}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Vendor Order Copy</label>
                      <input
                        type="file"
                        className="form-input"
                        onChange={(e) => setFiles({ ...files, vendorOrderCopy: e.target.files?.[0] || null })}
                      />
                    </div>

                    {/* Always visible: Pan No., Pan Photo, Gst No., Gst Copy */}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Pan No.</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Vendor Pan No."
                        value={formData.panNo || ''}
                        onChange={(e) => setFormData({ ...formData, panNo: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Pan Photo</label>
                      <input
                        type="file"
                        className="form-input"
                        onChange={(e) => setFiles({ ...files, panPhoto: e.target.files?.[0] || null })}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Gst No.</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Vendor Gst No."
                        value={formData.gstNo || ''}
                        onChange={(e) => setFormData({ ...formData, gstNo: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                      <label className="form-label">Gst Copy</label>
                      <input
                        type="file"
                        className="form-input"
                        onChange={(e) => setFiles({ ...files, gstCopy: e.target.files?.[0] || null })}
                      />
                    </div>
                  </>
                )}

                {/* 5. STORE FORM */}
                {activeModal === 'store' && (
                  <>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Application Number</label>
                      <div className="select-wrapper">
                        <select
                          className="form-input"
                          value={formData.applicationNumber || ''}
                          onChange={(e) => handleModalAppNumberChange(e.target.value, 'applicationNumber', 'serialNo')}
                        >
                          <option value="">Select Application Number</option>
                          {applicationNumberOptions.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="select-chevron" />
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Serial No.</label>
                      <div className="select-wrapper">
                        <select
                          className="form-input"
                          value={formData.serialNo || ''}
                          onChange={(e) => handleModalSerialNumberChange(e.target.value, formData.applicationNumber, 'serialNo')}
                          disabled={!formData.applicationNumber}
                        >
                          <option value="">Select Serial Number</option>
                          {getSerialOptionsForApp(formData.applicationNumber).map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="select-chevron" />
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Party Name</label>
                      <input type="text" className="form-input" value={formData.partyName || ''} readOnly />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Firm</label>
                      <input type="text" className="form-input" value={formData.firmName || ''} readOnly />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Date *</label>
                      <input
                        type="date"
                        className="form-input"
                        value={formData.date || ''}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Status</label>
                      <div className="select-wrapper">
                        <select
                          className="form-input"
                          value={formData.status || 'Issued'}
                          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        >
                          {STORE_STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        <ChevronDown size={16} className="select-chevron" />
                      </div>
                    </div>
                    {/* Dynamic Products Section for Store */}
                    <div style={{ gridColumn: '1 / -1', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Package size={18} style={{ color: 'var(--primary-color)' }} />
                          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Products</h3>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.55rem', borderRadius: '12px' }}>
                            {storeProducts.length} {storeProducts.length === 1 ? 'Item' : 'Items'}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={handleAddStoreProduct}
                          disabled={submitting}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
                        >
                          <Plus size={16} /> Add Product
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {storeProducts.map((prod, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: '1.25rem',
                              borderRadius: '10px',
                              background: 'rgba(255, 255, 255, 0.02)',
                              border: '1px solid var(--border-color)'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                Product #{idx + 1}
                              </span>
                              {storeProducts.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveStoreProduct(idx)}
                                  disabled={submitting}
                                  style={{
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                    color: '#ef4444',
                                    padding: '0.25rem 0.6rem',
                                    borderRadius: '6px',
                                    fontSize: '0.78rem',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem'
                                  }}
                                >
                                  <Trash2 size={13} /> Remove
                                </button>
                              )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Product Name</label>
                                <div className="select-wrapper">
                                  <select
                                    className="form-input"
                                    value={prod.productName || ''}
                                    onChange={(e) => handleStoreProductChange(idx, 'productName', e.target.value)}
                                    disabled={submitting}
                                  >
                                    <option value="">Select Product</option>
                                    {productOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                  </select>
                                  <ChevronDown size={16} className="select-chevron" />
                                </div>
                              </div>

                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Quantity</label>
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder="Quantity"
                                  value={prod.qty || ''}
                                  onChange={(e) => handleStoreProductChange(idx, 'qty', e.target.value)}
                                  disabled={submitting}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* 6. PAYMENTS FORM */}
                {activeModal === 'payments' && (
                  <>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Appliction No.</label>
                      <div className="select-wrapper">
                        <select
                          className="form-input"
                          value={formData.applicationNo || ''}
                          onChange={(e) => handleModalAppNumberChange(e.target.value, 'applicationNo', 'serialNumber')}
                        >
                          <option value="">Select Application Number</option>
                          {applicationNumberOptions.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="select-chevron" />
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Serial Number</label>
                      <div className="select-wrapper">
                        <select
                          className="form-input"
                          value={formData.serialNumber || ''}
                          onChange={(e) => handleModalSerialNumberChange(e.target.value, formData.applicationNo, 'serialNumber')}
                          disabled={!formData.applicationNo}
                        >
                          <option value="">Select Serial Number</option>
                          {getSerialOptionsForApp(formData.applicationNo).map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="select-chevron" />
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Firm</label>
                      <input type="text" className="form-input" value={formData.firmName || ''} readOnly />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Amount (₹) *</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. ₹50,000"
                        value={formData.amount || ''}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Contractor Name</label>
                      <div className="select-wrapper">
                        <select
                          className="form-input"
                          value={formData.contractorName || ''}
                          onChange={(e) => setFormData({ ...formData, contractorName: e.target.value })}
                        >
                          <option value="">Select Contractor</option>
                          {contractorOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        <ChevronDown size={16} className="select-chevron" />
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Pay To</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Payee Name / Vendor"
                        value={formData.payTo || ''}
                        onChange={(e) => setFormData({ ...formData, payTo: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Remarks</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Remarks / Note"
                        value={formData.remarks || ''}
                        onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Party Name</label>
                      <input type="text" className="form-input" value={formData.partyName || ''} readOnly />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                      <label className="form-label">Save File (Receipt / Voucher)</label>
                      <input
                        type="file"
                        className="form-input"
                        onChange={(e) => setFiles({ ...files, saveFile: e.target.files?.[0] || null })}
                      />
                    </div>
                  </>
                )}

              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={() => setActiveModal(null)} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> : 'Submit Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .btn-action-stage {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-color);
          padding: 0.35rem 0.75rem;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }
        .btn-action-stage:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
};

export default PendingOrderPlanning;

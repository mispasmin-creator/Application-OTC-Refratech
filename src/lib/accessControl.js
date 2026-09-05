// Centralized firm-based data access control.
//
// A non-Admin user's "Firm Name" access value (set in Users Management) can be:
//   - '' / 'All' / '*'                  -> access to every firm (no restriction)
//   - 'Firm A, Firm B'                   -> restricted to that comma list, for every page
//   - '{"default":[...],"pages":{...}}'  -> JSON with a default firm list plus per-page overrides
//
// This module resolves, for the logged-in user and a given page (route path), which firms
// they may see, and filters sheet rows against that row's "Firm" / "Firm Name" column.

// Route path -> page label, matching UsersManagement's PAGE_GROUPS / AdminLayout nav names.
// Used to resolve per-page firm overrides stored on a user record.
export const PAGE_NAME_BY_PATH = {
  '/': 'Dashboard',
  '/users': 'Users',
  '/create-indent': 'Order Form',
  '/po-confirmation': 'PO Confirmation',
  '/site-received': 'Site Received',
  '/kiln-testing': 'KILN Testing',
  '/board-suttering': 'Board Suttering',
  '/casting-inspection': 'Casting Inspection',
  '/sound-test': 'Sound Test',
  '/heating-entry': 'Heating Entry',
  '/take-qty-confirmation': 'Take Qty Conf.',
  '/make-invoice': 'Make Invoice',
  '/collection': 'Collection',
  '/settle-account-supervisor': 'Settle Account',
  '/profit-loss-sheet': 'Profit & Loss',
  '/transfer-receiving-items': 'Transfer Items',
  '/pending-order': 'Pending Order',
  '/actual-work-done': 'Actual Work Done',
  '/received-at-site': 'Received At Site',
  '/planning-order': 'Planning Order',
  '/vendor-order': 'Vendor Order',
  '/store': 'Store',
  '/payments': 'Make Payment',
  '/application-ims': 'Application IMS',
  '/assets-indent': 'Indent',
  '/assets-site-received': 'Site Received',
  '/assets-checking': 'Checking',
};

export const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem('botivate_user');
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
};

const cleanFirm = (s) => (s ? s.toString().trim().toLowerCase() : '');

// Parses the raw "Firm Name" access value stored on a user record.
export const parseFirmAccess = (rawFirmName) => {
  if (!rawFirmName) return { default: null, pages: {} };
  const trimmed = rawFirmName.toString().trim();
  if (!trimmed || trimmed.toLowerCase() === 'all' || trimmed === '*') {
    return { default: null, pages: {} };
  }
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const defaultFirms = Array.isArray(parsed.default) ? parsed.default : null;
      const pages = parsed.pages && typeof parsed.pages === 'object' ? parsed.pages : {};
      return { default: defaultFirms, pages };
    } catch (_) {
      return { default: null, pages: {} };
    }
  }
  return { default: trimmed.split(',').map(s => s.trim()).filter(Boolean), pages: {} };
};

// Returns null when the user may see every firm's data ('All'/'*'/blank Firm Name access).
// Otherwise returns the array of firm names the user is allowed to see for this page.
// Note: this is independent of Role — Users Management lets an Admin-role user be scoped to
// a specific firm too (Role only governs page-level access elsewhere), so Role is not used here.
export const getAllowedFirms = (user, pathOrPageName) => {
  if (!user) return [];
  const access = parseFirmAccess(user.firmName);
  const pageName = PAGE_NAME_BY_PATH[pathOrPageName] || pathOrPageName;
  if (pageName && access.pages && Array.isArray(access.pages[pageName])) {
    return access.pages[pageName];
  }
  return access.default;
};

const findFirmColumnIndex = (headers) => {
  if (!Array.isArray(headers)) return -1;
  const clean = (s) => (s ? s.toString().trim().toLowerCase().replace(/\s+/g, '') : '');
  let idx = headers.findIndex(h => clean(h) === 'firmname');
  if (idx === -1) idx = headers.findIndex(h => clean(h) === 'firm');
  if (idx === -1) idx = headers.findIndex(h => clean(h).includes('firm'));
  return idx;
};

// True if a single firm value is visible to the user on the given page.
export const isFirmAllowed = (firmValue, pathOrPageName, user = getCurrentUser()) => {
  const allowed = getAllowedFirms(user, pathOrPageName);
  if (allowed === null) return true;
  if (!allowed.length) return false;
  if (!firmValue) return false;
  const allowedSet = new Set(allowed.map(cleanFirm));
  return allowedSet.has(cleanFirm(firmValue));
};

// Filters a list of rows (plain arrays, or { rowData: [...] } items) down to the firms the
// current user may see. `headers` is the header row used to locate the Firm/Firm Name column.
// If the sheet has no firm column at all, rows are returned unchanged (nothing to restrict on).
export const filterRowsByFirmAccess = (rows, headers, pathOrPageName, user = getCurrentUser()) => {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const allowed = getAllowedFirms(user, pathOrPageName);
  if (allowed === null) return rows;

  const firmIdx = findFirmColumnIndex(headers);
  if (firmIdx === -1) return rows;

  const allowedSet = new Set(allowed.map(cleanFirm));
  if (allowedSet.size === 0) return [];

  return rows.filter(item => {
    const rowData = Array.isArray(item) ? item : item && item.rowData;
    if (!Array.isArray(rowData)) return false;
    const firmVal = cleanFirm(rowData[firmIdx]);
    return firmVal && allowedSet.has(firmVal);
  });
};

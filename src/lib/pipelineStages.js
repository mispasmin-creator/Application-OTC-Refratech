// Shared definition of the Order-To-Collection pipeline stages, in order.
// Mirrors the Planned/Actual column pairs on the 'FMS' sheet that FMSContext
// uses to compute sidebar pending counts, so the Dashboard can show the same
// "which stage is this application stuck at" logic for a single searched row.

export const PIPELINE_STAGES = [
  { path: '/po-confirmation', label: 'PO Confirmation', planned: 'Planned 1', actual: 'Actual 1' },
  { path: '/site-received', label: 'Site Received', status: 'Status 1', dateReceived: 'Date Of Site Received' },
  { path: '/kiln-testing', label: 'KILN Testing', planned: 'Planned 3', actual: 'Actual 3' },
  { path: '/board-suttering', label: 'Board Suttering', planned: 'Planned 4', actual: 'Actual 4' },
  { path: '/casting-inspection', label: 'Casting Inspection', planned: 'Planned 5', actual: 'Actual 5' },
  { path: '/sound-test', label: 'Sound Test', planned: 'Planned 6', actual: 'Actual 6' },
  { path: '/heating-entry', label: 'Heating Entry', planned: 'Planned 7', actual: 'Actual 7' },
  { path: '/take-qty-confirmation', label: 'Take Qty Confirmation', planned: 'Planned 8', actual: 'Actual 8' },
  { path: '/make-invoice', label: 'Make Invoice', planned: 'Planned 9', actual: 'Actual 9' },
  { path: '/collection', label: 'Collection', planned: 'Planned 10', actual: 'Actual 10' },
  { path: '/settle-account-supervisor', label: 'Settle Account', planned: 'Planned 11', actual: 'Actual 11' },
  { path: '/profit-loss-sheet', label: 'Profit & Loss', planned: 'Planned12', actual: 'Actual 12' },
  { path: '/transfer-receiving-items', label: 'Transfer Items', planned: 'Planned13', actual: 'Actual 13' },
];

const cleanH = (s) => (s ? s.toString().trim().toLowerCase().replace(/\s+/g, '') : '');
const hasValue = (v) => v !== undefined && v !== null && v.toString().trim() !== '';

// Walks the pipeline in order and returns the stage an FMS row is currently sitting at.
// { completed: true }               -> every stage's Actual column is filled in
// { ...stage, queued: true }        -> previous stage done, this one not yet planned
// { ...stage, queued: false }       -> this stage is planned and awaiting its Actual entry
export const getCurrentStageForRow = (row, headers) => {
  if (!Array.isArray(row) || !Array.isArray(headers)) return null;
  const idx = (name) => headers.findIndex(h => cleanH(h) === cleanH(name));

  for (const stage of PIPELINE_STAGES) {
    if (stage.status) {
      const sIdx = idx(stage.status);
      const dIdx = idx(stage.dateReceived);
      const hasStatus = sIdx !== -1 && hasValue(row[sIdx]);
      const hasDate = dIdx !== -1 && hasValue(row[dIdx]);
      if (!hasStatus) return { ...stage, queued: true };
      if (!hasDate) return { ...stage, queued: false };
      continue;
    }
    const pIdx = idx(stage.planned);
    const aIdx = idx(stage.actual);
    const hasPlanned = pIdx !== -1 && hasValue(row[pIdx]);
    const hasActual = aIdx !== -1 && hasValue(row[aIdx]);
    if (!hasPlanned) return { ...stage, queued: true };
    if (!hasActual) return { ...stage, queued: false };
  }
  return { completed: true };
};

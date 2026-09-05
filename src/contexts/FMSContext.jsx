import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { serialFetch } from '../lib/serialFetch';
import { getCurrentUser, isFirmAllowed } from '../lib/accessControl';

const FMSContext = createContext();

const SCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;
const SHEET_NAME = 'FMS';

export const FMSProvider = ({ children }) => {
  const [pendingCounts, setPendingCounts] = useState({
    '/po-confirmation': 0,
    '/site-received': 0,
    '/kiln-testing': 0,
    '/board-suttering': 0,
    '/casting-inspection': 0,
    '/sound-test': 0,
    '/heating-entry': 0,
    '/take-qty-confirmation': 0,
    '/make-invoice': 0,
    '/collection': 0,
    '/settle-account-supervisor': 0,
    '/profit-loss-sheet': 0,
    '/transfer-receiving-items': 0,
  });

  const refreshCounts = useCallback(async () => {
    try {
      const response = await serialFetch(`${SCRIPT_URL}?sheet=${SHEET_NAME}`);
      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (err) {
        return;
      }
      
      if (result.success && result.data && result.data.length > 5) {
        const headers = result.data[5];
        const findIdx = (name) => headers.findIndex(h => h && h.toString().trim().toLowerCase().replace(/\s+/g, '') === name.toLowerCase().replace(/\s+/g, ''));
        const firmIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase().replace(/\s+/g, '').includes('firm'));
        const user = getCurrentUser();

        // Find all indices
        const idxMap = {
          '1': { p: findIdx('Planned 1'), a: findIdx('Actual 1') },
          '2': { s: findIdx('Status 1'), site: findIdx('Date Of Site Received') },
          '3': { p: findIdx('Planned 3'), a: findIdx('Actual 3') },
          '4': { p: findIdx('Planned 4'), a: findIdx('Actual 4') },
          '5': { p: findIdx('Planned 5'), a: findIdx('Actual 5') },
          '6': { p: findIdx('Planned 6'), a: findIdx('Actual 6') },
          '7': { p: findIdx('Planned 7'), a: findIdx('Actual 7') },
          '8': { p: findIdx('Planned 8'), a: findIdx('Actual 8') },
          '9': { p: findIdx('Planned 9'), a: findIdx('Actual 9') },
          '10': { p: findIdx('Planned 10'), a: findIdx('Actual 10') },
          '11': { p: findIdx('Planned 11'), a: findIdx('Actual 11') },
          '12': { p: findIdx('Planned12'), a: findIdx('Actual 12') },
          '13': { p: findIdx('Planned13'), a: findIdx('Actual 13') },
        };

        // Stage index -> sidebar path, also used to resolve per-page firm access overrides.
        const stagePath = {
          '1': '/po-confirmation',
          '2': '/site-received',
          '3': '/kiln-testing',
          '4': '/board-suttering',
          '5': '/casting-inspection',
          '6': '/sound-test',
          '7': '/heating-entry',
          '8': '/take-qty-confirmation',
          '9': '/make-invoice',
          '10': '/collection',
          '11': '/settle-account-supervisor',
          '12': '/profit-loss-sheet',
          '13': '/transfer-receiving-items',
        };

        const dataRows = result.data.slice(6);

        const counts = {};
        Object.values(stagePath).forEach(path => { counts[path] = 0; });

        dataRows.forEach(row => {
          const check = (stageIdx) => {
            const m = idxMap[stageIdx];
            if (!m) return false;

            if (stageIdx === '2') {
              const hasStatus = m.s !== -1 && row[m.s] !== undefined && row[m.s] !== null && row[m.s].toString().trim() !== '';
              const noActual = m.site === -1 || row[m.site] === undefined || row[m.site] === null || row[m.site].toString().trim() === '';
              return hasStatus && noActual;
            } else {
              const hasPlanned = m.p !== -1 && row[m.p] !== undefined && row[m.p] !== null && row[m.p].toString().trim() !== '';
              const noActual = m.a === -1 || row[m.a] === undefined || row[m.a] === null || row[m.a].toString().trim() === '';
              return hasPlanned && noActual;
            }
          };

          const firmVal = firmIdx !== -1 ? row[firmIdx] : null;

          Object.keys(stagePath).forEach(stageIdx => {
            const path = stagePath[stageIdx];
            if (check(stageIdx) && isFirmAllowed(firmVal, path, user)) {
              counts[path]++;
            }
          });
        });

        setPendingCounts(counts);
      }
    } catch (e) {
      console.error("Failed to fetch global pending counts", e);
    }
  }, []);

  useEffect(() => {
    refreshCounts();
    
    // Listen for custom event from pages when they update data
    const handleUpdate = () => {
      refreshCounts();
    };
    
    window.addEventListener('fms-updated', handleUpdate);
    return () => window.removeEventListener('fms-updated', handleUpdate);
  }, [refreshCounts]);

  return (
    <FMSContext.Provider value={{ pendingCounts, refreshCounts }}>
      {children}
    </FMSContext.Provider>
  );
};

export const useFMS = () => useContext(FMSContext);

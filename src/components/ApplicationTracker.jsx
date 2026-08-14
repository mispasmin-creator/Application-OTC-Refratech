import React from 'react';
import { CheckCircle2, Clock, Circle, FileText, MapPin, ThermometerSnowflake, Hammer, Search, Ear, Flame, LayoutList, FileSpreadsheet, IndianRupee, UserCheck, TrendingUp, Package, AlertTriangle, XCircle, AlertCircle } from 'lucide-react';

const stages = [
  { id: '1', name: 'PO Confirmation', icon: FileText },
  { id: '2', name: 'Site Received', icon: MapPin },
  { id: '3', name: 'Kiln Testing', icon: ThermometerSnowflake },
  { id: '4', name: 'Board & Suttering', icon: Hammer },
  { id: '5', name: 'Casting Inspection', icon: Search },
  { id: '6', name: 'Sound Test', icon: Ear },
  { id: '7', name: 'Heating Entry', icon: Flame },
  { id: '8', name: 'Take Qty Confirmation', icon: LayoutList },
  { id: '9', name: 'Make Invoice', icon: FileSpreadsheet },
  { id: '10', name: 'Collection', icon: IndianRupee },
  { id: '11', name: 'Settle Account Supervisor', icon: UserCheck },
  { id: '12', name: 'Profit/Loss Sheet', icon: TrendingUp },
  { id: '13', name: 'Transfer Receiving Items', icon: Package }
];

const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const str = dateStr.toString().trim();
  const parts = str.split(' ');
  const dateParts = parts[0].split('/');
  if (dateParts.length !== 3) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }
  const day = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1;
  const year = parseInt(dateParts[2], 10);
  
  let hours = 0, mins = 0, secs = 0;
  if (parts.length > 1) {
    const timeParts = parts[1].split(':');
    hours = parseInt(timeParts[0] || '0', 10);
    mins = parseInt(timeParts[1] || '0', 10);
    secs = parseInt(timeParts[2] || '0', 10);
  }
  
  return new Date(year, month, day, hours, mins, secs);
};

const getDelayInfoFromSheet = (delayVal) => {
  if (delayVal === null || delayVal === undefined || delayVal.toString().trim() === '') return null;
  const diffDays = parseInt(delayVal, 10);
  if (isNaN(diffDays)) return null;
  
  if (diffDays <= 0) return { text: 'ON TIME', days: diffDays, color: '#10b981', icon: CheckCircle2 };
  if (diffDays <= 7) return { text: 'DELAYED', days: diffDays, color: '#f59e0b', icon: AlertTriangle };
  if (diffDays <= 30) return { text: 'OVERDUE', days: diffDays, color: '#ef4444', icon: AlertCircle };
  return { text: 'CRITICAL', days: diffDays, color: '#dc2626', icon: AlertCircle }; // Critical Overdue
};

const getDelayInfo = (planned, actual, isCompleted) => {
  const pDate = parseDate(planned);
  if (!pDate) return null;
  
  const aDate = actual ? parseDate(actual) : new Date();
  if (!aDate) return null;
  
  const diffTime = aDate.getTime() - pDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) return { text: 'ON TIME', days: diffDays, color: '#10b981', icon: CheckCircle2 };
  
  if (isCompleted) {
    if (diffDays <= 7) return { text: 'DELAYED', days: diffDays, color: '#f59e0b', icon: AlertTriangle };
    return { text: 'OVERDUE', days: diffDays, color: '#ef4444', icon: AlertCircle };
  } else {
    if (diffDays <= 7) return { text: 'AT RISK', days: diffDays, color: '#f59e0b', icon: AlertTriangle };
    if (diffDays <= 30) return { text: 'OVERDUE', days: diffDays, color: '#ef4444', icon: AlertCircle };
    return { text: 'CRITICAL', days: diffDays, color: '#dc2626', icon: AlertCircle };
  }
};

const ApplicationTracker = ({ headers, rowData }) => {
  const findIdx = (name) => headers.findIndex(h => h && h.toString().trim().toLowerCase() === name.toLowerCase());
  
  const idxMap = {
    '1': { p: findIdx('Planned 1'), a: findIdx('Actual 1'), s: findIdx('Status 1'), d: findIdx('Time Delay 1') },
    '2': { s: findIdx('Status 1'), site: findIdx('Date Of Site Received'), p: findIdx('Planned 2'), a: findIdx('Actual 2'), d: findIdx('Time Delay 2') },
    '3': { p: findIdx('Planned 3'), a: findIdx('Actual 3'), d: findIdx('Time Delay 3') },
    '4': { p: findIdx('Planned 4'), a: findIdx('Actual 4'), d: findIdx('Time Delay 4') },
    '5': { p: findIdx('Planned 5'), a: findIdx('Actual 5'), d: findIdx('Time Delay 5') },
    '6': { p: findIdx('Planned 6'), a: findIdx('Actual 6'), d: findIdx('Time Delay 6') },
    '7': { p: findIdx('Planned 7'), a: findIdx('Actual 7'), d: findIdx('Time Delay 7') },
    '8': { p: findIdx('Planned 8'), a: findIdx('Actual 8'), d: findIdx('Time Delay 8') },
    '9': { p: findIdx('Planned 9'), a: findIdx('Actual 9'), d: findIdx('Time Delay 9') },
    '10': { p: findIdx('Planned 10'), a: findIdx('Actual 10'), d: findIdx('Time Delay 10') },
    '11': { p: findIdx('Planned 11'), a: findIdx('Actual 11'), d: findIdx('Time Delay 11') },
    '12': { p: findIdx('Planned12'), a: findIdx('Actual 12'), d: findIdx('Time Delay 12') },
    '13': { p: findIdx('Planned13'), a: findIdx('Actual 13'), d: findIdx('Time Delay 13') }
  };

  const getStageStatus = (stageId) => {
    const m = idxMap[stageId];
    if (!m) return { status: 'not_started' };
    
    if (stageId === '2') {
      const hasStatus1 = m.s !== -1 && rowData[m.s] && rowData[m.s].toString().trim() !== '';
      const hasSiteReceived = m.site !== -1 && rowData[m.site] && rowData[m.site].toString().trim() !== '';
      
      if (hasSiteReceived) return { status: 'completed', date: rowData[m.site], delay: getDelayInfoFromSheet(m.d !== -1 ? rowData[m.d] : null) };
      if (hasStatus1) return { status: 'in_progress', delay: getDelayInfoFromSheet(m.d !== -1 ? rowData[m.d] : null) };
      return { status: 'not_started' };
    } else {
      const pStr = m.p !== -1 ? rowData[m.p] : null;
      const aStr = m.a !== -1 ? rowData[m.a] : null;
      const dStr = m.d !== -1 ? rowData[m.d] : null;
      
      const hasPlanned = pStr && pStr.toString().trim() !== '';
      const hasActual = aStr && aStr.toString().trim() !== '';
      
      // Special check for PO Confirmation (Status 1)
      if (stageId === '1' && m.s !== -1) {
        const status1 = rowData[m.s] ? rowData[m.s].toString().trim() : '';
        if (status1 === 'Rejected') return { status: 'rejected', date: aStr, delay: getDelayInfoFromSheet(dStr) };
      }
      
      if (hasActual) {
        return { status: 'completed', date: aStr, delay: getDelayInfoFromSheet(dStr) || getDelayInfo(pStr, aStr, true) };
      }
      if (hasPlanned) {
        return { status: 'in_progress', date: pStr, delay: getDelayInfoFromSheet(dStr) || getDelayInfo(pStr, null, false) };
      }
      return { status: 'not_started' };
    }
  };

  let totalDelayDays = 0;

  return (
    <div className="tracker-container" style={{ padding: '0 1rem 1rem 1rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {stages.map((stage, index) => {
          const { status, date, delay } = getStageStatus(stage.id);
          const isLast = index === stages.length - 1;
          
          if (delay && delay.days > 0 && status === 'completed') {
            totalDelayDays += delay.days;
          }
          
          let color = 'var(--text-muted)';
          let StatusIcon = Circle;
          let label = 'Pending';

          if (status === 'completed') {
            color = '#10b981'; // Emerald
            StatusIcon = CheckCircle2;
            label = 'Completed';
          } else if (status === 'in_progress') {
            color = '#3b82f6'; // Blue
            StatusIcon = Clock;
            label = 'In Progress';
          } else if (status === 'rejected') {
            color = '#ef4444'; // Red
            StatusIcon = XCircle;
            label = 'Rejected';
          }

          const StageIcon = stage.icon;

          return (
            <div key={stage.id} style={{ display: 'flex', position: 'relative' }}>
              {/* Timeline Line */}
              {!isLast && (
                <div style={{ 
                  position: 'absolute', 
                  left: '23px', 
                  top: '40px', 
                  bottom: '-10px', 
                  width: '2px', 
                  backgroundColor: status === 'completed' ? '#10b981' : 'var(--border-color)',
                  zIndex: 0
                }} />
              )}
              
              <div style={{ display: 'flex', gap: '1.5rem', width: '100%', paddingBottom: isLast ? '0' : '1.5rem' }}>
                {/* Node Icon */}
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: status !== 'not_started' ? `${color}18` : 'var(--bg-dark)',
                  color: color,
                  border: `2px solid ${status !== 'not_started' ? color : 'var(--border-color)'}`,
                  zIndex: 1,
                  boxShadow: status === 'in_progress' ? '0 0 15px rgba(59, 130, 246, 0.25)' : 'none',
                }}>
                  <StageIcon size={20} />
                </div>

                {/* Content */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: status !== 'not_started' ? 'var(--text-main)' : 'var(--text-soft)' }}>
                        {stage.name}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 600, color: color, background: status !== 'not_started' ? `${color}18` : 'transparent', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>
                        <StatusIcon size={14} />
                        <span style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
                      </div>
                    </div>
                    
                    {/* Delay Badge */}
                    {delay && status !== 'not_started' && status !== 'rejected' && (
                      <div style={{ 
                        display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 700,
                        color: delay.color, background: `${delay.color}15`, padding: '0.3rem 0.6rem', borderRadius: '4px',
                        border: `1px solid ${delay.color}40`
                      }}>
                        <delay.icon size={14} />
                        <span>{delay.text}</span>
                        {delay.days > 0 && <span style={{ opacity: 0.8 }}>({delay.days}d)</span>}
                      </div>
                    )}
                  </div>
                  
                  {/* Date details */}
                  {date && (
                    <div style={{ marginTop: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {status === 'in_progress' ? 'Planned: ' : (status === 'rejected' ? 'Rejected on: ' : 'Completed: ')} 
                      <strong style={{ color: 'var(--text-main)' }}>{date.toString()}</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Total Summary Footer */}
      {totalDelayDays > 0 && (
        <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', fontWeight: 600 }}>
            <AlertCircle size={18} />
            Cumulative Delay Across All Stages
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ef4444' }}>
            {totalDelayDays} Days
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicationTracker;

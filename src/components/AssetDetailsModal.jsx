import React from 'react';
import { 
  X, 
  Package, 
  Truck, 
  ClipboardCheck, 
  ShieldCheck, 
  ArrowRight, 
  Paperclip, 
  Calendar,
  MapPin,
  ExternalLink,
  Image as ImageIcon
} from 'lucide-react';
import TableCellValue from './TableCell';

const AssetDetailsModal = ({ isOpen, onClose, headers = [], rawRow = [], title = 'Asset Record Details' }) => {
  if (!isOpen || !rawRow || rawRow.length === 0) return null;

  const cleanH = (s) => (s ? s.toString().trim().toLowerCase().replace(/[\s\u00a0\r\n\t_-]+/g, '') : '');

  const getValue = (...keys) => {
    for (const key of keys) {
      const target = cleanH(key);
      const idx = headers.findIndex(h => cleanH(h) === target);
      if (idx !== -1 && rawRow[idx] !== undefined && rawRow[idx] !== null && rawRow[idx].toString().trim() !== '') {
        return { val: rawRow[idx], header: headers[idx] };
      }
    }
    return { val: '', header: '' };
  };

  const transferId = getValue('Transfer ID', 'TID').val || 'N/A';
  const assetName = getValue('Asset Name').val || 'Unnamed Asset';
  const qty = getValue('Qty').val;
  const unit = getValue('Unit').val || '';
  const status = getValue('Transfer Status').val || 'Pending';
  const fromLoc = getValue('From Location').val || '-';
  const toLoc = getValue('To Location').val || '-';
  const transferDate = getValue('Transfer Date').val || '-';
  const incharge = getValue('Incharge').val || '-';
  const appNo = getValue('Application No.', 'Application Number').val || '-';
  const remarks = getValue('Remarks').val || '-';

  // Transporter
  const transporterStatus = getValue('Transporter Status').val || '-';
  const transporterName = getValue('Transporter Name').val || '-';
  const transporterCharges = getValue('Transportation Charges', 'Transportation Charges ').val;

  // Site Received
  const siteIncharge = getValue('Site Incharge').val || '-';
  const partyName = getValue('Party Name').val || '-';
  const firmName = getValue('Firm Name').val || '-';
  const planned = getValue('Planned').val || '-';
  const actual = getValue('Actual').val;
  const delay = getValue('Delay').val || '-';

  // Checking
  const planned1 = getValue('Planned1').val || '-';
  const actual1 = getValue('Actual1').val;
  const delay1 = getValue('Delay1').val || '-';

  // Images & Docs
  const assetImage = getValue('Asset Image').val;
  const weighmentSlip = getValue('Weighment Slip').val;
  const receivedAssetImage = getValue('Received Asset Image').val;

  const statusLower = status.toLowerCase();
  const isReceived = statusLower.includes('received');
  const isTransit = statusLower.includes('transit') || statusLower.includes('dispatch');

  const statusBadgeStyle = isReceived
    ? { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' }
    : isTransit
    ? { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' }
    : { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' };

  // Helper styles for tables
  const thStyle = {
    width: '18%',
    backgroundColor: '#F8FAFC',
    color: '#64748B',
    fontSize: '0.78rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    padding: '0.75rem 1rem',
    borderBottom: '1px solid #E2E8F0',
    borderRight: '1px solid #E2E8F0',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap'
  };

  const tdStyle = {
    width: '32%',
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    fontSize: '0.9rem',
    fontWeight: 500,
    padding: '0.75rem 1rem',
    borderBottom: '1px solid #E2E8F0',
    verticalAlign: 'middle',
    wordBreak: 'break-word'
  };

  const hasAttachments = !!(assetImage || weighmentSlip || receivedAssetImage);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-card animate-fade-in"
        style={{
          maxWidth: '840px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '2rem',
          borderRadius: '16px',
          backgroundColor: '#FFFFFF',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
          border: '1px solid #E2E8F0',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* CLOSE BUTTON */}
        <button
          type="button"
          className="modal-close-btn"
          onClick={onClose}
          title="Close"
          style={{
            top: '1.25rem',
            right: '1.25rem',
            backgroundColor: '#F1F5F9',
            border: '1px solid #E2E8F0',
            color: '#475569'
          }}
        >
          <X size={18} />
        </button>

        {/* HEADER BLOCK */}
        <div style={{
          paddingBottom: '1.25rem',
          borderBottom: '2px solid #E2E8F0',
          marginBottom: '1.5rem',
          paddingRight: '3rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0F2B56', margin: 0 }}>
              {transferId}
            </h2>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.25rem 0.75rem',
              borderRadius: '20px',
              backgroundColor: statusBadgeStyle.bg,
              color: statusBadgeStyle.text,
              border: `1px solid ${statusBadgeStyle.border}`,
              textTransform: 'uppercase'
            }}>
              {status}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', color: '#475569', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#0F2B56', fontWeight: 600 }}>
              <Package size={16} color="var(--primary-color)" />
              <span>{assetName}</span>
              {qty && (
                <span style={{
                  fontSize: '0.8rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '6px',
                  backgroundColor: '#E2E8F0',
                  color: '#1E293B',
                  fontWeight: 600
                }}>
                  {qty} {unit}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <MapPin size={15} color="var(--primary-color)" />
              <span style={{ color: '#334155' }}>{fromLoc}</span>
              <ArrowRight size={13} style={{ opacity: 0.5 }} />
              <span style={{ color: '#0F2B56', fontWeight: 600 }}>{toLoc}</span>
            </div>

            {transferDate !== '-' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748B' }}>
                <Calendar size={14} />
                <span>{transferDate}</span>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 1: INDENT DETAILS TABLE */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.85rem',
            fontWeight: 700,
            color: 'var(--primary-color)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: '0.6rem'
          }}>
            <Package size={17} />
            1. Indent & Origin Details
          </div>

          <div style={{ borderRadius: '8px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <tbody>
                <tr>
                  <th style={thStyle}>Incharge</th>
                  <td style={tdStyle}>{incharge}</td>
                  <th style={{ ...thStyle, borderLeft: '1px solid #E2E8F0' }}>Application No.</th>
                  <td style={tdStyle}>{appNo}</td>
                </tr>
                <tr>
                  <th style={thStyle}>Asset Name</th>
                  <td style={tdStyle}><strong>{assetName}</strong></td>
                  <th style={{ ...thStyle, borderLeft: '1px solid #E2E8F0' }}>Quantity & Unit</th>
                  <td style={tdStyle}>{qty ? `${qty} ${unit}` : '-'}</td>
                </tr>
                <tr>
                  <th style={thStyle}>From Location</th>
                  <td style={tdStyle}>{fromLoc}</td>
                  <th style={{ ...thStyle, borderLeft: '1px solid #E2E8F0' }}>To Location</th>
                  <td style={tdStyle}>{toLoc}</td>
                </tr>
                <tr>
                  <th style={{ ...thStyle, borderBottom: 'none' }}>Transfer Date</th>
                  <td style={{ ...tdStyle, borderBottom: 'none' }}>{transferDate}</td>
                  <th style={{ ...thStyle, borderBottom: 'none', borderLeft: '1px solid #E2E8F0' }}>Remarks</th>
                  <td style={{ ...tdStyle, borderBottom: 'none' }}>{remarks}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 2: TRANSPORTER & LOGISTICS TABLE */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.85rem',
            fontWeight: 700,
            color: '#0284C7',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: '0.6rem'
          }}>
            <Truck size={17} />
            2. Transporter & Logistics
          </div>

          <div style={{ borderRadius: '8px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <tbody>
                <tr>
                  <th style={thStyle}>Transporter Status</th>
                  <td style={tdStyle}>
                    <span style={{
                      fontWeight: 600,
                      color: transporterStatus.toLowerCase() === 'yes' ? '#059669' : '#64748B'
                    }}>
                      {transporterStatus}
                    </span>
                  </td>
                  <th style={{ ...thStyle, borderLeft: '1px solid #E2E8F0' }}>Transporter Name</th>
                  <td style={tdStyle}>{transporterName}</td>
                </tr>
                <tr>
                  <th style={{ ...thStyle, borderBottom: 'none' }}>Transportation Charges</th>
                  <td style={{ ...tdStyle, borderBottom: 'none', color: transporterCharges ? '#059669' : '#64748B', fontWeight: 600 }}>
                    {transporterCharges ? `₹ ${transporterCharges}` : '-'}
                  </td>
                  <th style={{ ...thStyle, borderBottom: 'none', borderLeft: '1px solid #E2E8F0' }}>Dispatch From</th>
                  <td style={{ ...tdStyle, borderBottom: 'none' }}>{fromLoc}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 3: SITE RECEIVED TABLE */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.85rem',
            fontWeight: 700,
            color: '#059669',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: '0.6rem'
          }}>
            <ClipboardCheck size={17} />
            3. Site Received Stage
          </div>

          <div style={{ borderRadius: '8px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <tbody>
                <tr>
                  <th style={thStyle}>Site Incharge</th>
                  <td style={tdStyle}>{siteIncharge}</td>
                  <th style={{ ...thStyle, borderLeft: '1px solid #E2E8F0' }}>Party Name</th>
                  <td style={tdStyle}>{partyName}</td>
                </tr>
                <tr>
                  <th style={thStyle}>Firm Name</th>
                  <td style={tdStyle}>{firmName}</td>
                  <th style={{ ...thStyle, borderLeft: '1px solid #E2E8F0' }}>Site Delay</th>
                  <td style={{ ...tdStyle, color: delay !== '-' ? '#DC2626' : '#64748B' }}>{delay}</td>
                </tr>
                <tr>
                  <th style={{ ...thStyle, borderBottom: 'none' }}>Planned Date</th>
                  <td style={{ ...tdStyle, borderBottom: 'none' }}>{planned}</td>
                  <th style={{ ...thStyle, borderBottom: 'none', borderLeft: '1px solid #E2E8F0' }}>Actual Date</th>
                  <td style={{
                    ...tdStyle,
                    borderBottom: 'none',
                    color: actual ? '#059669' : '#94A3B8',
                    fontWeight: actual ? 600 : 400
                  }}>
                    {actual ? `✓ ${actual}` : 'Pending Receipt'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 4: QUALITY CHECKING TABLE */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.85rem',
            fontWeight: 700,
            color: '#7C3AED',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: '0.6rem'
          }}>
            <ShieldCheck size={17} />
            4. Quality Checking Stage
          </div>

          <div style={{ borderRadius: '8px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <tbody>
                <tr>
                  <th style={thStyle}>Planned (Checking)</th>
                  <td style={tdStyle}>{planned1}</td>
                  <th style={{ ...thStyle, borderLeft: '1px solid #E2E8F0' }}>Actual (Checking)</th>
                  <td style={{
                    ...tdStyle,
                    color: actual1 ? '#059669' : '#94A3B8',
                    fontWeight: actual1 ? 600 : 400
                  }}>
                    {actual1 ? `✓ ${actual1}` : 'Pending Checking'}
                  </td>
                </tr>
                <tr>
                  <th style={{ ...thStyle, borderBottom: 'none' }}>Checking Delay</th>
                  <td style={{ ...tdStyle, borderBottom: 'none', color: delay1 !== '-' ? '#DC2626' : '#64748B' }}>{delay1}</td>
                  <th style={{ ...thStyle, borderBottom: 'none', borderLeft: '1px solid #E2E8F0' }}>Checking Status</th>
                  <td style={{ ...tdStyle, borderBottom: 'none', fontWeight: 600, color: actual1 ? '#059669' : '#D97706' }}>
                    {actual1 ? 'Verified & Completed' : 'Pending Verification'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 5: ATTACHMENTS & IMAGES */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.85rem',
            fontWeight: 700,
            color: '#D97706',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: '0.6rem'
          }}>
            <Paperclip size={17} />
            5. Attached Documents & Photos
          </div>

          <div style={{
            borderRadius: '8px',
            border: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            padding: '1rem 1.25rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem'
          }}>
            {/* Asset Image */}
            <div style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              padding: '0.85rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem'
            }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.78rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                  Asset Image
                </span>
                <span style={{ fontSize: '0.85rem', color: assetImage ? '#0F172A' : '#94A3B8' }}>
                  {assetImage ? 'Uploaded' : 'Not attached'}
                </span>
              </div>
              {assetImage && (
                <a
                  href={assetImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    backgroundColor: '#EFF6FF',
                    color: '#1D4ED8',
                    border: '1px solid #BFDBFE',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    textDecoration: 'none'
                  }}
                >
                  <ImageIcon size={14} /> View
                </a>
              )}
            </div>

            {/* Weighment Slip */}
            <div style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              padding: '0.85rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem'
            }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.78rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                  Weighment Slip
                </span>
                <span style={{ fontSize: '0.85rem', color: weighmentSlip ? '#0F172A' : '#94A3B8' }}>
                  {weighmentSlip ? 'Uploaded' : 'Not attached'}
                </span>
              </div>
              {weighmentSlip && (
                <a
                  href={weighmentSlip}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    backgroundColor: '#EFF6FF',
                    color: '#1D4ED8',
                    border: '1px solid #BFDBFE',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    textDecoration: 'none'
                  }}
                >
                  <ImageIcon size={14} /> View
                </a>
              )}
            </div>

            {/* Received Asset Image */}
            <div style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              padding: '0.85rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem'
            }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.78rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                  Received Asset Image
                </span>
                <span style={{ fontSize: '0.85rem', color: receivedAssetImage ? '#0F172A' : '#94A3B8' }}>
                  {receivedAssetImage ? 'Uploaded' : 'Not attached'}
                </span>
              </div>
              {receivedAssetImage && (
                <a
                  href={receivedAssetImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    backgroundColor: '#EFF6FF',
                    color: '#1D4ED8',
                    border: '1px solid #BFDBFE',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    textDecoration: 'none'
                  }}
                >
                  <ImageIcon size={14} /> View
                </a>
              )}
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          paddingTop: '1.25rem',
          borderTop: '1px solid #E2E8F0'
        }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onClose}
            style={{
              padding: '0.6rem 2rem',
              fontSize: '0.95rem',
              fontWeight: 600,
              borderRadius: '8px'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssetDetailsModal;

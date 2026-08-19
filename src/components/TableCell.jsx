import React from 'react';
import { Image as ImageIcon } from 'lucide-react';

const isFileLink = (val, label = '') => {
  if (!val) return false;
  const str = val.toString().trim();
  if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('data:image')) {
    return true;
  }
  const l = (label || '').toLowerCase();
  const fileKeywords = ['copy', 'image', 'photo', 'slip', 'sheet', 'file', 'attachment', 'doc', 'proof'];
  return fileKeywords.some(k => l.includes(k)) && str.length > 5;
};

const isFileColumn = (label = '') => {
  const l = (label || '').toLowerCase();
  const fileKeywords = [
    'work order copy',
    'vendor order copy',
    'photo of certify copy',
    'vendor bill copy',
    'bill image',
    'profit / loss sheet',
    'weighment slip',
    'pan photo',
    'gst copy'
  ];
  return fileKeywords.some(k => l.includes(k));
};

export const TableCellValue = ({ value, label }) => {
  if (isFileLink(value, label)) {
    const url = value.toString().trim();
    return (
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer"
        title={`View ${label || 'Attachment'}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px',
          borderRadius: '6px',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          color: '#3b82f6',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          textDecoration: 'none',
          cursor: 'pointer'
        }}
      >
        <ImageIcon size={18} />
      </a>
    );
  }

  if (isFileColumn(label) && (!value || value.toString().trim() === '')) {
    return <span style={{ color: 'var(--text-muted)' }}>-</span>;
  }

  return value !== undefined && value !== null ? value.toString() : '';
};

export default TableCellValue;

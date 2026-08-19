import React, { useEffect, useRef, useState } from 'react';
import { Eye, Edit2, CheckCircle2, Download, Trash2, MoreVertical } from 'lucide-react';

const ICONS = {
  view: Eye,
  edit: Edit2,
  approve: CheckCircle2,
  download: Download,
  delete: Trash2,
};

/**
 * Consistent row-action button group: View -> Edit/Approve -> Download -> Delete.
 * Pass only the actions relevant to that row; irrelevant ones should simply be omitted
 * by the caller rather than passed with show:false, so the row never shows dead buttons.
 *
 * actions: [{ key: 'view'|'edit'|'approve'|'download'|'delete', label, onClick, href }]
 * Up to 3 actions render inline; beyond that, extras collapse into a "More" (⋮) menu.
 */
const ActionButtons = ({ actions = [], maxInline = 3 }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Check if current user is View Only
  let isViewOnly = false;
  try {
    const userStr = localStorage.getItem('botivate_user');
    if (userStr) {
      const u = JSON.parse(userStr);
      if (
        u.isViewOnly === true ||
        u.isViewOnly === 'Yes' ||
        u.viewOnly === 'Yes' ||
        u.viewOnly === 'View Only' ||
        u['View Only'] === 'Yes' ||
        u['View Only'] === 'View Only' ||
        u.role === 'View Only' ||
        u.role === 'ViewOnly' ||
        u.role?.toLowerCase() === 'view only'
      ) {
        isViewOnly = true;
      }
    }
  } catch (e) {}

  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [menuOpen]);

  if (!actions.length) return null;

  const inline = actions.length > maxInline ? actions.slice(0, maxInline - 1) : actions;
  const overflow = actions.length > maxInline ? actions.slice(maxInline - 1) : [];

  const renderButton = (action) => {
    const Icon = ICONS[action.key] || Eye;
    const isEditKey = ['edit', 'approve', 'delete'].includes(action.key);
    const disabled = action.disabled || (isViewOnly && isEditKey);
    const className = `icon-btn ${action.key}`;
    const commonProps = {
      className,
      title: (isViewOnly && isEditKey) ? `${action.label} (Disabled for View Only)` : action.label,
      'aria-label': action.label,
      disabled: disabled,
      style: disabled ? { opacity: 0.35, cursor: 'not-allowed' } : undefined
    };

    if (action.href) {
      return (
        <a key={action.key} {...commonProps} href={action.href} target="_blank" rel="noopener noreferrer">
          <Icon size={16} />
        </a>
      );
    }
    return (
      <button key={action.key} {...commonProps} type="button" onClick={disabled ? undefined : action.onClick}>
        <Icon size={16} />
      </button>
    );
  };

  return (
    <div className="action-group">
      {inline.map(renderButton)}
      {overflow.length > 0 && (
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button
            type="button"
            className="icon-btn more"
            title="More actions"
            aria-label="More actions"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div className="action-menu">
              {overflow.map((action) => {
                const Icon = ICONS[action.key] || Eye;
                const isEditKey = ['edit', 'approve', 'delete'].includes(action.key);
                const disabled = action.disabled || (isViewOnly && isEditKey);
                return (
                  <button
                    key={action.key}
                    type="button"
                    className={`action-menu-item ${action.key === 'delete' ? 'danger' : ''}`}
                    disabled={disabled}
                    style={disabled ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
                    onClick={() => {
                      if (disabled) return;
                      setMenuOpen(false);
                      if (action.href) {
                        window.open(action.href, '_blank', 'noopener,noreferrer');
                      } else {
                        action.onClick?.();
                      }
                    }}
                  >
                    <Icon size={15} />
                    {action.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ActionButtons;

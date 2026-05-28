import React, { useState } from 'react';

export interface HierarchyItem {
  id: string;
  label: string;
  icon?: string;
  subtitle?: string;
  color?: string;
  isHeader?: boolean;
  actions?: React.ReactNode;
  children?: HierarchyItem[];
}

export interface HierarchySection {
  id: string;
  title: string;
  collapsed?: boolean;
  items: HierarchyItem[];
  onAdd?: () => void;
  actions?: React.ReactNode;
}

interface HierarchyPanelProps {
  sections: HierarchySection[];
  selectedId: string;
  onSelect: (id: string) => void;
  onRemove?: (id: string) => void;
  onContextMenu?: (id: string, x: number, y: number) => void;
}

export function HierarchyPanel({
  sections, selectedId, onSelect, onRemove, onContextMenu,
}: HierarchyPanelProps) {
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    sections.forEach((s) => { if (s.collapsed) m[s.id] = true; });
    return m;
  });

  const toggleCollapse = (id: string) => {
    setCollapsedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const [collapsedItems, setCollapsedItems] = useState<Record<string, boolean>>({});

  const toggleItemCollapse = (id: string) => {
    setCollapsedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderNode = (node: HierarchyItem, depth: number) => {
    const hasChildren = node.children && node.children.length > 0;
    const isCollapsed = collapsedItems[node.id] ?? false;

    if (node.isHeader) {
      return (
        <div key={node.id}>
          <div
            onClick={() => toggleItemCollapse(node.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 3,
              padding: '3px 6px 3px 8px',
              paddingLeft: 8 + depth * 14,
              cursor: 'pointer', userSelect: 'none', marginTop: 4,
            }}
          >
            {hasChildren && (
              <span style={{ color: '#666', fontSize: 8, transition: 'transform 0.12s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                ▼
              </span>
            )}
            <span style={{
              color: '#888', fontSize: 9, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>
              {node.label}
            </span>
          </div>
          {hasChildren && !isCollapsed && node.children?.map((child) => renderNode(child, depth + 1))}
        </div>
      );
    }

    return (
      <div key={node.id}>
        <div
          onClick={() => onSelect(node.id)}
          onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(node.id, e.clientX, e.clientY); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 8px 5px 8px',
            paddingLeft: 8 + depth * 14,
            cursor: 'pointer',
            background: selectedId === node.id ? 'var(--bg-raised)' : 'transparent',
            borderRadius: 4,
            fontSize: 12,
            color: selectedId === node.id ? '#c4a0f0' : 'var(--text-secondary)',
            marginBottom: 1,
            userSelect: 'none',
          }}
          onMouseEnter={(e) => {
            if (selectedId !== node.id) e.currentTarget.style.background = '#2a2a30';
          }}
          onMouseLeave={(e) => {
            if (selectedId !== node.id) e.currentTarget.style.background = 'transparent';
          }}
        >
          {node.icon && <span style={{ fontSize: 12, width: 16, textAlign: 'center', flexShrink: 0 }}>{node.icon}</span>}
          {node.color && !node.icon && (
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: node.color, flexShrink: 0, display: 'inline-block',
            }} />
          )}
          <span
            style={{
              flex: 1,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
          >
            {node.label}
          </span>
          {node.actions && (
            <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
              {node.actions}
            </div>
          )}
          {node.subtitle && (
            <span style={{ color: '#666', fontSize: 10, flexShrink: 0 }}>{node.subtitle}</span>
          )}
          {onRemove && (
            <span
              onClick={(e) => { e.stopPropagation(); onRemove(node.id); }}
              style={{
                color: '#666', cursor: 'pointer', fontSize: 12, padding: '0 4px',
                opacity: 0,
              }}
              className="hierarchy-rm"
              onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}
            >
              ✕
            </span>
          )}
        </div>
        {node.children?.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div
      style={{
        width: '100%',
        background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        overflow: 'hidden',
      }}
    >
      <style>{`
        .hierarchy-rm { opacity: 0 !important; }
        div:hover > .hierarchy-rm { opacity: 1 !important; }
      `}</style>
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 6px 6px 6px' }}>
        {sections.map((sec) => {
          const collapsed = collapsedMap[sec.id] ?? false;
          return (
            <div key={sec.id} style={{ marginBottom: 8 }}>
              {/* Section header */}
              <div
                onClick={() => toggleCollapse(sec.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 6px',
                  marginBottom: 2,
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <span style={{ color: '#666', fontSize: 10, transition: 'transform 0.12s', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                  ▼
                </span>
                <span style={{
                  color: 'var(--accent)', fontSize: 10, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.5px', flex: 1,
                }}>
                  {sec.title}
                </span>
                <div style={{ display: 'flex', gap: 2 }}>
                  {sec.actions}
                  {sec.onAdd && (
                    <button
                      onClick={(e) => { e.stopPropagation(); sec.onAdd!(); }}
                      style={{
                        background: 'var(--accent)',
                        border: 'none',
                        borderRadius: 3,
                        color: '#fff',
                        width: 18,
                        height: 18,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        lineHeight: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Agregar"
                    >
                      +
                    </button>
                  )}
                </div>
              </div>
              {/* Items */}
              {!collapsed && (
                sec.items.length === 0 ? (
                  <div style={{ color: '#555', fontSize: 10, textAlign: 'center', padding: '8px 0' }}>
                    Sin elementos
                  </div>
                ) : (
                  sec.items.map((item) => renderNode(item, 0))
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

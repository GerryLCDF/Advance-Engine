import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, ChevronDownIcon, EyeIcon, EyeOffIcon, FocusIcon, VolumeIcon, VolumeOffIcon, XIcon } from './tabs/icons';

export interface HierarchyToggle {
  on: boolean;
  onToggle: () => void;
  title?: string;
  disabled?: boolean;
}

export interface HierarchyItem {
  id: string;
  label: string;
  icon?: string | React.ReactNode;
  subtitle?: string;
  color?: string;
  isHeader?: boolean;
  removable?: boolean;
  actions?: React.ReactNode;
  dimmed?: boolean;
  toggles?: { eye?: HierarchyToggle; solo?: HierarchyToggle; mute?: HierarchyToggle };
  children?: HierarchyItem[];
  /** Si es true, los hijos solo se despliegan cuando este nodo (o un descendiente) está seleccionado. */
  expandWhenSelected?: boolean;
}

export interface HierarchySection {
  id: string;
  title: string;
  collapsed?: boolean;
  items: HierarchyItem[];
  onAdd?: () => void;
  actions?: React.ReactNode;
  subtitle?: string;
}

interface HierarchyPanelProps {
  sections: HierarchySection[];
  selectedId: string;
  onSelect: (id: string) => void;
  onRemove?: (id: string) => void;
  onContextMenu?: (id: string, x: number, y: number) => void;
  editingId?: string | null;
  /** Devuelve false si el nombre no es válido (vacío/duplicado): se restaura el anterior. */
  onRename?: (id: string, name: string) => boolean | void;
  /** Aviso de nombre vacío (el rename no llega a llamarse en ese caso). */
  onNameError?: (msg: string) => void;
  onEditingChange?: (id: string | null) => void;
  onDoubleClick?: (id: string) => void;
  /**
   * Ids de cabeceras (isHeader) que deben quedar expandidas al cambiar de
   * selección: las demás se colapsan. El usuario puede volver a expandirlas a
   * mano después (el colapso automático solo actúa al cambiar la selección).
   */
  expandHeaderIds?: string[];
}

export function RowIconButton({
  title, onClick, active, disabled, danger, children,
}: {
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={(e) => { e.stopPropagation(); if (!disabled) onClick(); }}
      onPointerDown={(e) => e.stopPropagation()}
      whileHover={danger && !active ? { backgroundColor: '#e5484d', color: '#ffffff' } : { opacity: 0.75 }}
      whileTap={{ scale: 0.9 }}
      style={{
        width: 22, height: 22, padding: 0, flexShrink: 0,
        display: 'grid', placeItems: 'center',
        borderRadius: 7, cursor: disabled ? 'default' : 'pointer',
        border: '1px solid transparent',
        background: active
          ? 'var(--accent-fill, linear-gradient(135deg, var(--accent), var(--accent-light)))'
          : 'transparent',
        color: active ? '#0b110d' : disabled ? 'var(--text-muted)' : danger ? 'var(--text-muted)' : 'var(--text-secondary)',
        opacity: disabled ? 0.55 : 1,
        transition: 'background 0.15s, color 0.15s, border-color 0.15s',
      }}
    >
      {children}
    </motion.button>
  );
}

/** True si algún descendiente del nodo está seleccionado (el padre se mantiene desplegado). */
function hasDescendant(node: HierarchyItem, id: string): boolean {
  if (!node.children) return false;
  return node.children.some((c) => c.id === id || hasDescendant(c, id));
}

function ToggleButtons({ toggles }: { toggles: NonNullable<HierarchyItem['toggles']> }) {
  return (
    <>
      {toggles.eye && (
        <RowIconButton
          title={toggles.eye.title ?? (toggles.eye.on ? 'Ocultar' : 'Mostrar')}
          onClick={toggles.eye.onToggle}
          active={toggles.eye.on}
          disabled={toggles.eye.disabled}
        >
          {toggles.eye.on ? <EyeIcon size={13} /> : <EyeOffIcon size={13} />}
        </RowIconButton>
      )}
      {toggles.solo && (
        <RowIconButton
          title={toggles.solo.title ?? (toggles.solo.on ? 'Quitar solo' : 'Solo')}
          onClick={toggles.solo.onToggle}
          active={toggles.solo.on}
          disabled={toggles.solo.disabled}
        >
          <FocusIcon size={13} />
        </RowIconButton>
      )}
      {toggles.mute && (
        <RowIconButton
          title={toggles.mute.title ?? (toggles.mute.on ? 'Activar sonido' : 'Mute')}
          onClick={toggles.mute.onToggle}
          active={toggles.mute.on}
          disabled={toggles.mute.disabled}
        >
          {toggles.mute.on ? <VolumeOffIcon size={13} /> : <VolumeIcon size={13} />}
        </RowIconButton>
      )}
    </>
  );
}

export function HierarchyPanel({
  sections, selectedId, onSelect, onRemove, onContextMenu, editingId, onRename, onEditingChange, onDoubleClick,
  onNameError, expandHeaderIds,
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

  // Colapso automático por selección: solo las cabeceras indicadas quedan
  // abiertas. Se recalcula únicamente cuando cambia `selectedId`, así los
  // toggles manuales del usuario se respetan después.
  useEffect(() => {
    if (!expandHeaderIds) return;
    const keep = new Set(expandHeaderIds);
    const headerIds: string[] = [];
    const walk = (items: typeof sections[number]['items']) => {
      for (const it of items) {
        if (it.isHeader && it.children && it.children.length > 0) headerIds.push(it.id);
        if (it.children) walk(it.children);
      }
    };
    sections.forEach((s) => walk(s.items));
    setCollapsedItems((prev) => {
      const next = { ...prev };
      for (const id of headerIds) next[id] = !keep.has(id);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const editingInputRef = useRef<HTMLInputElement>(null);

  // Si el ítem confirmado desaparece (se borró en otro sitio), cerrar la pregunta
  useEffect(() => {
    if (!confirmId) return;
    const exists = (items: HierarchyItem[]): boolean =>
      items.some((it) => it.id === confirmId || (it.children ? exists(it.children) : false));
    if (!sections.some((s) => exists(s.items))) setConfirmId(null);
  }, [confirmId, sections]);

  useEffect(() => {
    if (editingId && editingInputRef.current) {
      editingInputRef.current.focus();
      editingInputRef.current.select();
    }
  }, [editingId]);

  const toggleItemCollapse = (id: string) => {
    setCollapsedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderNode = (node: HierarchyItem, depth: number) => {
    const hasChildren = node.children && node.children.length > 0;
    const isCollapsed = node.expandWhenSelected
      ? selectedId !== node.id && !hasDescendant(node, selectedId)
      : (collapsedItems[node.id] ?? false);
    const isEditing = editingId === node.id;
    const isSelected = selectedId === node.id;
    const dim = node.dimmed ? 0.42 : 1;

    if (node.isHeader) {
      return (
        <div key={node.id}>
          <div
            onClick={() => toggleItemCollapse(node.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 6px 3px 8px',
              paddingLeft: 8 + depth * 12,
              cursor: 'pointer', userSelect: 'none',
            }}
          >
            {hasChildren && (
              <span style={{ color: 'var(--text-muted)', display: 'flex', transition: 'transform 0.12s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                <ChevronDownIcon size={11} />
              </span>
            )}
            <span style={{
              color: 'var(--text-muted)', fontSize: 9, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.6px',
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
          className="hp-row"
          data-selected={isSelected ? 'true' : undefined}
          data-editing={isEditing ? 'true' : undefined}
          onClick={() => { if (isEditing) return; if (confirmId && confirmId !== node.id) setConfirmId(null); onSelect(node.id); }}
          onDoubleClick={() => { onDoubleClick?.(node.id); }}
          onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(node.id, e.clientX, e.clientY); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            height: 34,
            marginBottom: 2,
            padding: '0 6px 0 6px',
            paddingLeft: 8 + depth * 12,
            cursor: isEditing ? 'default' : 'pointer',
            borderRadius: 8,
            opacity: dim,
            color: isSelected ? 'var(--text)' : 'var(--text-secondary)',
            userSelect: 'none',
            transition: 'background 0.12s, border-color 0.12s',
          }}
        >
          {node.icon ? (
            <span
              style={{
                width: 22, height: 22, flexShrink: 0,
                display: 'grid', placeItems: 'center',
                borderRadius: 7,
                background: isSelected
                  ? 'var(--accent-fill, linear-gradient(135deg, var(--accent), var(--accent-light)))'
                  : 'var(--bg-splitter)',
                color: isSelected ? '#0b110d' : 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
              }}
            >
              <span style={{ width: 14, height: 14, display: 'grid', placeItems: 'center', fontSize: 12, lineHeight: 1 }}>
                {node.icon}
              </span>
            </span>
          ) : node.color ? (
            <span style={{
              width: 8, height: 8, borderRadius: '50%', marginLeft: 7, marginRight: 7,
              background: node.color, flexShrink: 0, display: 'inline-block',
            }} />
          ) : null}
          {isEditing ? (
            <input
              ref={editingInputRef}
              defaultValue={node.label}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const el = e.currentTarget;
                  const val = el.value.trim();
                  if (!val) {
                    el.value = node.label;
                    onNameError?.('El nombre no puede estar vacío.');
                  } else if (onRename) {
                    const res = onRename(node.id, val);
                    if (res === false) el.value = node.label;
                  }
                  onEditingChange?.(null);
                } else if (e.key === 'Escape') {
                  onEditingChange?.(null);
                }
              }}
              onBlur={(e) => {
                const el = e.currentTarget;
                const val = el.value.trim();
                if (!val) {
                  el.value = node.label;
                  onNameError?.('El nombre no puede estar vacío.');
                } else if (onRename) {
                  const res = onRename(node.id, val);
                  if (res === false) el.value = node.label;
                }
                onEditingChange?.(null);
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                flex: 1,
                background: 'var(--bg-dark)',
                border: '1px solid var(--accent)',
                borderRadius: 4,
                color: '#fff',
                fontSize: 12,
                padding: '2px 5px',
                outline: 'none',
                minWidth: 0,
              }}
            />
          ) : (
            <span style={{
              flex: 1, minWidth: 0,
              fontSize: 12, fontWeight: isSelected ? 600 : 400,
              overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
            }}>
              {node.label}
            </span>
          )}
          {node.toggles && <ToggleButtons toggles={node.toggles} />}
          {node.actions && (
            <div style={{ display: 'flex', gap: 2, flexShrink: 0, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
              {node.actions}
            </div>
          )}
          {node.subtitle && (
            <span style={{ color: 'var(--text-muted)', fontSize: 10, flexShrink: 0, maxWidth: 70, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {node.subtitle}
            </span>
          )}
          {confirmId === node.id ? (
            <div
              style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <span style={{ color: 'var(--text-secondary)', fontSize: 10, whiteSpace: 'nowrap' }}>¿Eliminar?</span>
              <RowIconButton
                title="Sí, eliminar"
                danger
                onClick={() => { setConfirmId(null); onRemove?.(node.id); }}
              >
                <CheckIcon size={12} />
              </RowIconButton>
              <RowIconButton title="Cancelar" onClick={() => setConfirmId(null)}>
                <XIcon size={12} />
              </RowIconButton>
            </div>
          ) : onRemove && node.removable !== false ? (
            <RowIconButton
              title="Eliminar"
              danger
              onClick={() => setConfirmId(node.id)}
            >
              <XIcon size={12} />
            </RowIconButton>
          ) : null}
        </div>
        {hasChildren && (
          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.14, ease: 'easeOut' }}
                style={{ overflow: 'hidden' }}
              >
                {node.children?.map((child) => renderNode(child, depth + 1))}
              </motion.div>
            )}
          </AnimatePresence>
        )}
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
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px 10px 6px' }}>
        {sections.map((sec) => {
          const collapsed = collapsedMap[sec.id] ?? false;
          const total = sec.items.length;
          return (
            <div key={sec.id} style={{ marginBottom: 10 }}>
              <div
                onClick={() => toggleCollapse(sec.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  height: 24,
                  padding: '0 4px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <span style={{
                  color: 'var(--text-muted)', display: 'flex', flexShrink: 0,
                  transition: 'transform 0.12s',
                  transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                }}>
                  <ChevronDownIcon size={12} />
                </span>
                <span style={{
                  color: 'var(--accent)', fontSize: 10, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                  flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                }}>
                  {sec.title}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 10, flexShrink: 0 }}>
                  {total}
                </span>
                <div style={{ display: 'flex', gap: 2, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                  {sec.actions}
                  {sec.onAdd && (
                    <button
                      onClick={(e) => { e.stopPropagation(); sec.onAdd!(); }}
                      style={{
                        background: 'var(--accent)',
                        border: 'none',
                        borderRadius: 6,
                        color: '#0b110d',
                        width: 20, height: 20,
                        cursor: 'pointer',
                        display: 'grid', placeItems: 'center',
                      }}
                      title="Agregar"
                    >
                      +
                    </button>
                  )}
                </div>
              </div>
              <AnimatePresence initial={false}>
                {!collapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    {total === 0 ? (
                      <div style={{
                        color: 'var(--text-muted)', fontSize: 10, textAlign: 'center',
                        padding: '8px 0',
                      }}>
                        Sin elementos
                      </div>
                    ) : (
                      sec.items.map((item) => renderNode(item, 0))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

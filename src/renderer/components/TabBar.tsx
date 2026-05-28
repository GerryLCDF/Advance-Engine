import React from 'react';
import { motion } from 'framer-motion';
import type { LauncherTab } from '../types';

interface TabBarProps {
  active: LauncherTab;
  onChange: (tab: LauncherTab) => void;
}

const TABS: { id: LauncherTab; label: string }[] = [
  { id: 'recientes', label: 'Reciente' },
  { id: 'crear',     label: 'Crear' },
  { id: 'importar',  label: 'importar' },
];

export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        borderTop: '1px solid var(--border-color)',
        background: 'var(--bg-terminal)',
        flexShrink: 0,
        height: 44,
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <motion.button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              flex: 1,
              border: 'none',
              background: isActive ? 'var(--accent)' : 'transparent',
              color: isActive ? '#fff' : 'var(--text-dim)',
              fontSize: 14,
              fontWeight: isActive ? 700 : 400,
              cursor: 'pointer',
              position: 'relative',
              transition: 'background 0.2s, color 0.2s',
            }}
            whileHover={{ background: isActive ? 'var(--accent-light)' : 'var(--bg-inspector)' } as any}
          >
            {tab.label}
            {isActive && (
              <motion.div
                layoutId="tab-indicator"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: 'var(--accent-light)',
                  borderRadius: '0 0 2px 2px',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

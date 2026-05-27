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
        borderTop: '1px solid #1a1a2e',
        background: '#1a1a2e',
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
              background: isActive ? '#5a3fa0' : 'transparent',
              color: isActive ? '#fff' : '#aaa',
              fontSize: 14,
              fontWeight: isActive ? 700 : 400,
              cursor: 'pointer',
              position: 'relative',
              transition: 'background 0.2s, color 0.2s',
            }}
            whileHover={{ background: isActive ? '#6a4fba' : '#2a2a4e' } as any}
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
                  background: '#a78bfa',
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

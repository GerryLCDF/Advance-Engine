import React from 'react';
import type { Icon as TablerIcon } from '@tabler/icons-react';

export interface IconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}

export type TablerWrapper = (props: IconProps) => React.ReactElement;

export function tabler(Component: TablerIcon, name: string): TablerWrapper {
  const Wrapped = ({ size = 14, strokeWidth = 1.5, className, style }: IconProps) => (
    <Component size={size} stroke={strokeWidth} className={className} style={style} />
  );
  Wrapped.displayName = name;
  return Wrapped;
}

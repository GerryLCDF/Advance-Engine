import React, { useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { validateItemName } from '../../utils/validateName';

interface Props {
  value: string;
  onChange: (name: string) => void;
  /** Nombres de los demás elementos (para detectar duplicados). */
  others: string[];
  placeholder?: string;
  style?: React.CSSProperties;
  inputRef?: React.Ref<HTMLInputElement>;
}

/**
 * Campo de nombre con validación al salir del campo (blur o Enter):
 * si queda vacío o repetido, avisa con un toast y restaura el valor anterior.
 */
export function ValidatedNameInput({ value, onChange, others, placeholder, style, inputRef }: Props) {
  const prevRef = useRef(value);
  const skipCommitRef = useRef(false);
  const pushToast = useAppStore((s) => s.pushToast);

  const commit = () => {
    const err = validateItemName(value, others);
    if (err) {
      pushToast(err);
      onChange(prevRef.current);
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      placeholder={placeholder}
      onFocus={() => { prevRef.current = value; }}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => {
        // Escape ya restauró el valor: no volver a validar (sería un aviso falso).
        if (skipCommitRef.current) { skipCommitRef.current = false; return; }
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        else if (e.key === 'Escape') {
          skipCommitRef.current = true;
          onChange(prevRef.current);
          e.currentTarget.blur();
        }
      }}
      style={style}
    />
  );
}

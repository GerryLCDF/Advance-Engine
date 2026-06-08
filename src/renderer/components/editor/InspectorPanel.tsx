import React from 'react';

export interface InspectorField {
  label: string;
  value: string | number | boolean;
  type: 'text' | 'number' | 'color' | 'select' | 'toggle' | 'textarea';
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  readonly?: boolean;
  onChange: (val: string | number | boolean) => void;
}

export interface InspectorSection {
  title: string;
  fields?: InspectorField[];
  content?: React.ReactNode;
}

interface InspectorPanelProps {
  title: string;
  sections: InspectorSection[];
  emptyMessage?: string;
}

export function InspectorPanel({ title, sections, emptyMessage }: InspectorPanelProps) {
  return (
    <div
      style={{
        width: '100%',
        background: 'var(--bg-inspector)',
        borderLeft: '1px solid var(--border-light)',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '8px 10px',
          borderBottom: '1px solid var(--border-light)',
          color: 'var(--text-muted)',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {title}
      </div>

      {sections.length === 0 && emptyMessage && (
        <div style={{ color: '#555', fontSize: 11, textAlign: 'center', padding: 24 }}>
          {emptyMessage}
        </div>
      )}

      {sections.map((sec) => (
        <div key={sec.title} style={{ borderBottom: '1px solid #22223a', padding: '8px 10px' }}>
          <div style={{ color: 'var(--accent-light)', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
            {sec.title}
          </div>
          {sec.content ?? (sec.fields ?? []).map((f) => (
            <FieldRow key={f.label} field={f} />
          ))}
        </div>
      ))}
    </div>
  );
}

function FieldRow({ field }: { field: InspectorField }) {
  const label = (
    <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 64, flexShrink: 0 }}>
      {field.label}
    </span>
  );

  if (field.type === 'toggle') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        {label}
        <input
          type="checkbox"
          checked={field.value as boolean}
          onChange={(e) => field.onChange(e.target.checked)}
          style={{ accentColor: 'var(--accent-light)', cursor: 'pointer' }}
        />
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        {label}
        <select
          value={field.value as string}
          onChange={(e) => field.onChange(e.target.value)}
          style={{
            flex: 1,
            background: '#141420',
            border: '1px solid var(--border-light)',
            borderRadius: 4,
            color: 'var(--text)',
            fontSize: 11,
            padding: '3px 6px',
            outline: 'none',
          }}
        >
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === 'color') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        {label}
        <input
          type="color"
          value={field.value as string}
          onChange={(e) => field.onChange(e.target.value)}
          style={{
            width: 32,
            height: 24,
            padding: 0,
            border: '1px solid var(--border-light)',
            borderRadius: 3,
            cursor: 'pointer',
            background: 'transparent',
          }}
        />
        <span style={{ color: 'var(--text-muted)', fontSize: 10, fontFamily: 'monospace' }}>
          {field.value as string}
        </span>
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 4 }}>
        {label}
        <textarea
          value={field.value as string}
          onChange={(e) => field.onChange(e.target.value)}
          rows={3}
          style={{
            background: '#141420',
            border: '1px solid var(--border-light)',
            borderRadius: 4,
            color: 'var(--text)',
            fontSize: 11,
            padding: '4px 6px',
            outline: 'none',
            resize: 'vertical',
            fontFamily: 'inherit',
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      {label}
      <input
        type={field.type}
        min={field.min}
        max={field.max}
        step={field.step}
        value={field.value as string | number}
        readOnly={field.readonly}
        onChange={(e) => field.onChange(field.type === 'number' ? Number(e.target.value) : e.target.value)}
        style={{
          flex: 1,
          background: field.readonly ? 'var(--bg-canvas)' : '#141420',
          border: '1px solid var(--border-light)',
          borderRadius: 4,
          color: field.readonly ? 'var(--text-muted)' : 'var(--text)',
          fontSize: 11,
          padding: '3px 6px',
          outline: 'none',
          width: 0,
          cursor: field.readonly ? 'default' : 'text',
        }}
      />
    </div>
  );
}

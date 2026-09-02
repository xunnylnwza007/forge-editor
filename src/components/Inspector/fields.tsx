export function SliderField({
  label, value, min, max, step = 1, onChange, onCommit, suffix = '',
}: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; onCommit?: () => void; suffix?: string;
}) {
  return (
    <div className="field-row">
      <label>{label}</label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} onPointerUp={onCommit} />
      <span className="field-value">{Math.round(value * 100) / 100}{suffix}</span>
    </div>
  );
}

export function NumberField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div className="field-row">
      <label>{label}</label>
      <input type="number" value={Math.round(value * 100) / 100} step={step} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

export function SelectField({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="field-row">
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1 }}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="checkbox-row">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field-row">
      <label>{label}</label>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 40, padding: 2 }} />
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1 }} />
    </div>
  );
}

export function FieldGroup({ title, children, onReset }: { title: string; children: React.ReactNode; onReset?: () => void }) {
  return (
    <div className="field-group">
      <div className="field-group__title" style={{ display: 'flex', justifyContent: 'space-between' }}>
        {title}
        {onReset && <button className="reset-btn" onClick={onReset}>Reset</button>}
      </div>
      {children}
    </div>
  );
}

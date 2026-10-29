// Native controls shared by all panes. No icon pack, widget library or runtime CSS framework.
export function Button({ label, icon, action, disabled, pressed, ...props }) {
  return <button type="button" title={label} aria-label={label} disabled={disabled}
    aria-pressed={pressed} onclick={action} {...props}>{icon ? <span aria-hidden="true">{icon}</span> : null}{label}</button>;
}
export function Field({ label, children }) {
  return <label class="ve-field"><span>{label}</span>{children}</label>;
}
export function NumberField({ label, value, action, min, max, step = 1, disabled }) {
  return <Field label={label}><input type="number" value={value} min={min} max={max} step={step} disabled={disabled}
    onchange={e => {
      const v = e.target.valueAsNumber;
      if (Number.isFinite(v) && (min == null || v >= min) && (max == null || v <= max)) action(v);
      else e.target.value = typeof value === 'function' ? value() : value;
    }}/></Field>;
}
export function ColorField({ label, value, action }) {
  return <Field label={label}><input type="color" value={value} oninput={e => { e.target.title = e.target.value; }} onchange={e => action(e.target.value)}/></Field>;
}
export function SelectField({ label, value, options, action }) {
  return <Field label={label}><select value={value} onchange={e => action(e.target.value)}>
    {options.map(option => {
      const [v, text] = Array.isArray(option) ? option : [option, option];
      return <option value={v}>{text}</option>;
    })}</select></Field>;
}
export function Section({ title, children, open = true }) {
  return <details open={open}><summary>{title}</summary><div class="ve-section">{children}</div></details>;
}
export function Toolbar({ label, children }) { return <div class="ve-toolbar" role="group" aria-label={label}>{children}</div>; }
export function FileInput({ label, accept, action, multiple = false }) {
  const input = <input type="file" accept={accept} multiple={multiple} hidden onchange={async e => {
    const files = [...e.target.files]; e.target.value = ''; if (files.length) await action(files);
  }}/>;
  return <span>{input}<Button label={label} icon="↥" action={() => input.click()}/></span>;
}

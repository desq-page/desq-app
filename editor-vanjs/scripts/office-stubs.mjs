// Published ES modules use an export list; source fixtures can use declarations.
export function disabledOfficeModule(source) {
  const names = new Set([...source.matchAll(/export\s+(?:async\s+)?function\s+([\w$]+)/g)].map(match => match[1]));
  for (const match of source.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const entry of match[1].split(',')) {
      const name = entry.trim().split(/\s+as\s+/).at(-1);
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
    }
  }
  if (!names.size) throw Error('No Office archive exports found; update the standalone package integration.');
  return [...names].map(name => name === 'markPptxArchiveDirty'
    ? `export function ${name}() {}`
    : `export function ${name}() { throw Error('Office archive operations are unavailable in the standalone editor.'); }`).join('\n');
}

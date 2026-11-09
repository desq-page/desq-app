import JavaScriptObfuscator from 'javascript-obfuscator';

export function obfuscateProductionScript(code) {
  return JavaScriptObfuscator.obfuscate(code, {
    target: 'browser-no-eval',
    compact: true,
    seed: 42,
    renameGlobals: false,
    renameProperties: false,
    ignoreImports: true,
    // Serialized functions must remain self-contained when moved into an iframe or worker.
    stringArray: false,
    simplify: false,
  }).getObfuscatedCode();
}

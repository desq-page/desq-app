import { unref } from "vue";

/**
 * Recursively unrefs all nested ref objects in a value
 * @param {any} value - The value to deep unref
 * @returns {any} - The deeply unref'd value
 */
export function deepUnref(value, visited = new WeakSet()) {
  // Vue's unref (if available)
  const unrefValue = typeof unref === "function" ? unref(value) : value;

  if (unrefValue == null) return unrefValue;

  // Prevent infinite recursion on circular refs
  if (typeof unrefValue === "object") {
    if (visited.has(unrefValue)) return unrefValue;
    visited.add(unrefValue);
  }

  // Unwrap Proxy if possible
  const raw =
    typeof unrefValue === "object" && typeof unrefValue.__v_raw !== "undefined"
      ? unrefValue.__v_raw
      : unrefValue;

  // Handle arrays
  if (Array.isArray(raw)) {
    return raw.map((item) => deepUnref(item, visited));
  }

  // Handle Sets
  if (raw instanceof Set) {
    return new Set([...raw].map((item) => deepUnref(item, visited)));
  }

  // Handle Maps
  if (raw instanceof Map) {
    return new Map(
      [...raw.entries()].map(([k, v]) => [
        deepUnref(k, visited),
        deepUnref(v, visited),
      ])
    );
  }

  // Handle plain objects
  if (Object.prototype.toString.call(raw) === "[object Object]") {
    const result = {};
    for (const key of Object.keys(raw)) {
      result[key] = deepUnref(raw[key], visited);
    }
    return result;
  }

  // Return primitive or other non-plain object types as-is
  return raw;
}

// Qwen3.5 emits flat function/parameter tags, not arbitrary executable code.
export function parseQwenToolCall(body, tools) {
  const source = body.trim();
  if (source.startsWith('{')) return JSON.parse(source);
  const match = source.match(/^<function=([\w.-]+)>\s*([\s\S]*?)\s*<\/function>$/);
  if (!match) throw new Error('Invalid Qwen tool call.');
  const tool = tools.find(tool => tool.name === match[1]);
  if (!tool) throw new Error('Unknown Qwen tool.');
  const args = {};
  let remaining = match[2].trim();
  while (remaining) {
    const parameter = remaining.match(/^<parameter=([A-Za-z_]\w*)>\s*([\s\S]*?)\s*<\/parameter>/);
    if (!parameter) throw new Error('Invalid Qwen parameter.');
    const [, name, value] = parameter;
    const rule = tool.inputSchema.properties[name];
    if (!rule || ['__proto__', 'constructor', 'prototype'].includes(name) || Object.hasOwn(args, name))
      throw new Error('Unknown or duplicate Qwen parameter.');
    if (rule.type === 'string') args[name] = value.startsWith('"') && value.endsWith('"') ? JSON.parse(value) : value;
    else if (rule.type === 'boolean') {
      if (!/^(true|false)$/i.test(value)) throw new Error('Invalid boolean Qwen parameter.');
      args[name] = value.toLowerCase() === 'true';
    } else {
      if (!/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) throw new Error('Invalid numeric Qwen parameter.');
      args[name] = Number(value);
    }
    remaining = remaining.slice(parameter[0].length).trim();
  }
  return { name: match[1], arguments: args };
}

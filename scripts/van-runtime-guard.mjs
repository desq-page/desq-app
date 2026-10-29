// A stateful runtime must initialize before split editor modules execute their
// top-level state()/reactive() calls. Reject bundle layouts that reintroduce a
// dependency from VanJS into the application or duplicate its singleton.
export function vanRuntimeGuard() {
  return {
    name: 'van-runtime-guard',
    apply: 'build',
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter(chunk => chunk.type === 'chunk');
      const owns = (chunk, name) => Object.keys(chunk.modules).some(id =>
        id.replaceAll('\\', '/').includes(`/node_modules/${name}/`));
      const xmlChunks = chunks.filter(chunk => owns(chunk, 'fast-xml-parser') || owns(chunk, 'strnum'));
      if (xmlChunks.length !== 1 || !owns(xmlChunks[0], 'fast-xml-parser') || !owns(xmlChunks[0], 'strnum')) {
        this.error('XML parser and strnum must initialize in the same runtime chunk.');
      }
      const byFile = new Map(chunks.map(chunk => [chunk.fileName, chunk]));
      const visited = new Set();
      const checkXmlDependency = chunk => {
        if (visited.has(chunk.fileName)) return;
        visited.add(chunk.fileName);
        if (Object.keys(chunk.modules).some(id => id.replaceAll('\\', '/').includes('/shared-vuejs/'))) {
          this.error('XML runtime must not depend on shared editor modules.');
        }
        for (const dependency of chunk.imports) {
          if (byFile.has(dependency)) checkXmlDependency(byFile.get(dependency));
        }
      };
      checkXmlDependency(xmlChunks[0]);
      const cores = chunks.filter(chunk => owns(chunk, 'vanjs-core'));
      if (cores.length !== 1) this.error('VanJS must be emitted in exactly one runtime chunk.');
      const runtime = cores[0];
      if (runtime.imports.length) {
        this.error(`VanJS runtime must have no static chunk dependencies: ${runtime.imports.join(', ')}`);
      }
      const extensions = chunks.filter(chunk => owns(chunk, 'vanjs-ext'));
      if (extensions.some(chunk => chunk !== runtime)) {
        this.error('vanjs-ext must initialize in the same chunk as vanjs-core.');
      }
    },
  };
}

import { agentHostPlugin } from '../cloudflare-publisher/src/agent/node.mjs';
import path from "node:path";
import { join } from "node:path";
import { buildSync } from "esbuild";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
// import { optimizeCssModules } from "vite-plugin-optimize-css-modules";
import { visualizer } from "rollup-plugin-visualizer";
// import obfuscatorPlugin from "vite-plugin-javascript-obfuscator";
import vitePluginBundleObfuscator from 'vite-plugin-bundle-obfuscator';
import mkcert from "vite-plugin-mkcert";
import { staticHomePagePlugin } from "../scripts/render-homepage.mjs";
import { localCorePlugin } from "../scripts/local-core-vite.mjs";
import { vanEditorDevPlugin } from "../scripts/van-editor-dev.mjs";
import { vanRuntimeGuard } from "../scripts/van-runtime-guard.mjs";
/* note: for device to trust, install rootCA from ~/.vite-plugin-mkcert to device */

// All configurations
const allObfuscatorConfig = {
  // excludes: [/tiff2png/],
  // enable: true,
  // log: true,
  autoExcludeNodeModules: true,
  // autoExcludeNodeModules: { enable: true, manualChunks: ['vue'] }
  threadPool: true,
  // threadPool: { enable: true, size: 4 }
  options: {
    // compact: true,
    // controlFlowFlattening: true,
    // controlFlowFlatteningThreshold: 1,
    // deadCodeInjection: false,
    // debugProtection: false,
    // debugProtectionInterval: 0,
    // disableConsoleOutput: false,
    // identifierNamesGenerator: 'hexadecimal',
    // log: false,
    // numbersToExpressions: false,
    // renameGlobals: false,
    // selfDefending: true,
    // simplify: true,
    // splitStrings: false,
    // ignoreImports: true,
    // stringArray: true,
    // stringArrayCallsTransform: true,
    // stringArrayCallsTransformThreshold: 0.5,
    // stringArrayEncoding: [],
    // stringArrayIndexShift: true,
    // stringArrayRotate: true,
    // stringArrayShuffle: true,
    // stringArrayWrappersCount: 1,
    // stringArrayWrappersChainedCalls: true,
    // stringArrayWrappersParametersMaxCount: 2,
    // stringArrayWrappersType: 'variable',
    // stringArrayThreshold: 0.75,
    // unicodeEscapeSequence: false,
  }
};

// Vite 8 minifies with Rolldown/Oxc; esbuild.drop does not cover its
// dependency chunks or worker builds.
const productionMinify = process.env.PROD
  ? { compress: { dropConsole: true, dropDebugger: true } }
  : undefined;

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => ({
  assetsInclude: ["**/input.html"],
  // These imports are reached through the lazy agent panel and its workers.
  // Bundle them before serving the editor, so opening the panel does not
  // invalidate dependency URLs already loaded by the page.
  optimizeDeps: {
    include: ['idb', '@huggingface/transformers'],
    entries: [
      path.resolve(import.meta.dirname, 'index.html'),
      path.resolve(import.meta.dirname, 'src/lib/agent/*.worker.mjs'),
    ],
    holdUntilCrawlEnd: true,
  },
  plugins: [
    localCorePlugin(),
    agentHostPlugin(),
    vanEditorDevPlugin(),
    vanRuntimeGuard(),
    staticHomePagePlugin(),
    mkcert(),
    vue(),
    visualizer(),
    vitePluginBundleObfuscator(allObfuscatorConfig),
    {
      enforce: "post",
      transformIndexHtml() {
        buildSync({
          minify: !!process.env.PROD,
          drop: process.env.PROD ? ["console", "debugger"] : undefined,
          bundle: true,
          entryPoints: [join(process.cwd(), "service-worker.js")],
          outfile: join(process.cwd(), "dist", "service-worker.js"),
        });
      },
    },
  ],
  // appType: 'mpa',
  resolve: {
    alias: {
      "@": `${path.resolve(import.meta.dirname, "src")}/`,
    },
  },
  define: {
    "import.meta.env.VITE_PUBLISH_TARGET": JSON.stringify("cloudflare"),
    "process.env": {
      PROD: process.env.PROD,
    },
  },
  server: {
    port: 6173,
    host: "0.0.0.0",
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Cross-Origin-Embedder-Policy": "unsafe-none",
      "Cross-Origin-Opener-Policy": "unsafe-none",
    },

  },
  worker: {
    rolldownOptions: {
      output: {
        ...(productionMinify ? { minify: productionMinify } : {}),
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  build: {
    outDir: "./dist",
    rolldownOptions: {
      input: {
        main: path.resolve(import.meta.dirname, "index.html"),
        // sw: path.resolve(import.meta.dirname, "public", "sw.js"),
        // rembg: path.resolve(import.meta.dirname, "public/models/works/worker.js"),
      },
      output: {
        ...(productionMinify ? { minify: productionMinify } : {}),
        // experimentalMinChunkSize: 300_000,
        // manualChunks: (id) => {
        //     if (id.includes("naive-ui")) return "naiveui";
        //     if (id.includes("vue")) return "vue";
        //     if (id.includes("@zip.js/zip.js")) return "zipjs";
        //     if (id.includes("chart.ts")) return "chart";
        //     if ([
        //       "@vicons/carbon",
        //       "@vicons/fa",
        //       "@vicons/fluent",
        //       "@vicons/ionicons5",
        //       "@vicons/material",
        //       "@vicons/tabler",
        //     ].find(icon => id.includes(icon))) return "vicons";
        // },
        codeSplitting: {
          minSize: 100000,
          groups: [
            {
              // VanJS state is created at module initialization. Keep its
              // runtime out of cyclic editor chunks, even though it is small.
              name: 'van-runtime',
              test: /node_modules[\\/](?:vanjs-core|vanjs-ext)[\\/]/,
              priority: 100,
              minSize: 0,
            },
            {
              // Keep CommonJS XML initialization out of cyclic editor chunks.
              name: 'xml-runtime',
              test: /node_modules[\\/](?:fast-xml-parser|strnum)[\\/]/,
              priority: 90,
              minSize: 0,
            },
            {
              test: /node_modules[\\/][@]?vue/,
              name: 'vue',
            },
            {
              name: 'zipjs',
              test: /node_modules[\\/]@zip\.js/,
            },

            {
              name: 'naive-ui',
              test: /node_modules[\\/]naive-ui/,
            },
            {
              name: 'vicons',
              test: /node_modules[\\/]@vicons/,
            },
            {
              name: 'zrender',
              test: /node_modules[\\/]zrender/,
            },
            {
              name: 'chart',
              test: /node_modules[\\/]echarts/,
            },
            {
              name: 'shared',
              test: /shared-vuejs/,
              // Keep lazy features separate and bound each library chunk
              // before minification/obfuscation changes its final size.
              entriesAware: true,
              minSize: 50000,
              maxSize: 300000,
            },

          ]
        },
        entryFileNames: `assets/[hash].js`,
        chunkFileNames: (chunk) => chunk.name.startsWith('shared')
          ? `assets/[name]-[hash].js`
          : `assets/[hash].js`,
        assetFileNames: `assets/[hash].[ext]`,
      },
    },
    sourcemap: !process.env.PROD,
    cssCodeSplit: false,
    // minify: "terser",
    // terserOptions: {
    //   mangle: {
    //     properties: false,
    //   },
    //   drop_console: true,
    // },
  },
}));

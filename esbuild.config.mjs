import esbuild from "esbuild";

// Bundle the whole server (including @modelcontextprotocol/sdk and zod) into a
// single self-contained ESM file so the packaged .mcpb does not need
// node_modules at runtime.
await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  outfile: "build/index.js",
  banner: {
    // Shim require/__dirname for any CJS deps pulled into the ESM bundle.
    js: [
      "import { createRequire as __createRequire } from 'module';",
      "import { fileURLToPath as __fileURLToPath } from 'url';",
      "import { dirname as __pathDirname } from 'path';",
      "const require = __createRequire(import.meta.url);",
      "const __filename = __fileURLToPath(import.meta.url);",
      "const __dirname = __pathDirname(__filename);",
    ].join("\n"),
  },
});

console.log("bundled -> build/index.js");

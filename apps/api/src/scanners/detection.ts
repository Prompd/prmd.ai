import TOML from '@iarna/toml';
import type { PackageManager } from '@prmd/shared';

// ---- detection rule tables ----

type DepRule = { framework?: string; testRunner?: string };

const PACKAGE_JSON_DEPS: Record<string, DepRule> = {
  react: { framework: 'React' },
  vue: { framework: 'Vue' },
  svelte: { framework: 'Svelte' },
  '@angular/core': { framework: 'Angular' },
  'solid-js': { framework: 'Solid' },
  next: { framework: 'Next.js' },
  nuxt: { framework: 'Nuxt' },
  '@remix-run/react': { framework: 'Remix' },
  astro: { framework: 'Astro' },
  vite: { framework: 'Vite' },
  webpack: { framework: 'Webpack' },
  rollup: { framework: 'Rollup' },
  esbuild: { framework: 'esbuild' },
  express: { framework: 'Express' },
  fastify: { framework: 'Fastify' },
  '@nestjs/core': { framework: 'NestJS' },
  koa: { framework: 'Koa' },
  hono: { framework: 'Hono' },
  '@trpc/server': { framework: 'tRPC' },
  prisma: { framework: 'Prisma' },
  '@prisma/client': { framework: 'Prisma' },
  drizzle: { framework: 'Drizzle' },
  'drizzle-orm': { framework: 'Drizzle' },
  electron: { framework: 'Electron' },
  'react-native': { framework: 'React Native' },

  commander: { framework: 'Commander' },
  yargs: { framework: 'yargs' },
  oclif: { framework: 'oclif' },
  '@oclif/core': { framework: 'oclif' },
  cac: { framework: 'cac' },
  meow: { framework: 'meow' },
  ink: { framework: 'Ink' },

  vitest: { testRunner: 'vitest' },
  jest: { testRunner: 'jest' },
  mocha: { testRunner: 'mocha' },
  cypress: { testRunner: 'cypress' },
  playwright: { testRunner: 'playwright' },
  '@playwright/test': { testRunner: 'playwright' },
};

const PYTHON_DEPS: Record<string, DepRule> = {
  django: { framework: 'Django' },
  fastapi: { framework: 'FastAPI' },
  flask: { framework: 'Flask' },
  starlette: { framework: 'Starlette' },
  pyramid: { framework: 'Pyramid' },
  tornado: { framework: 'Tornado' },
  litestar: { framework: 'Litestar' },
  sqlalchemy: { framework: 'SQLAlchemy' },
  pandas: { framework: 'pandas' },
  numpy: { framework: 'NumPy' },
  pytorch: { framework: 'PyTorch' },
  torch: { framework: 'PyTorch' },
  tensorflow: { framework: 'TensorFlow' },

  click: { framework: 'Click' },
  typer: { framework: 'Typer' },
  fire: { framework: 'Fire' },
  docopt: { framework: 'docopt' },

  pytest: { testRunner: 'pytest' },
  unittest: { testRunner: 'unittest' },
  nose: { testRunner: 'nose' },
};

const GO_DEPS: Record<string, DepRule> = {
  'github.com/gin-gonic/gin': { framework: 'Gin' },
  'github.com/labstack/echo': { framework: 'Echo' },
  'github.com/gofiber/fiber': { framework: 'Fiber' },
  'github.com/go-chi/chi': { framework: 'Chi' },
  'github.com/gorilla/mux': { framework: 'Gorilla Mux' },
  'github.com/spf13/cobra': { framework: 'Cobra' },
  'github.com/urfave/cli': { framework: 'urfave/cli' },
};

const RUST_DEPS: Record<string, DepRule> = {
  axum: { framework: 'Axum' },
  'actix-web': { framework: 'Actix Web' },
  rocket: { framework: 'Rocket' },
  warp: { framework: 'Warp' },
  tokio: { framework: 'Tokio' },
  serde: { framework: 'Serde' },
  clap: { framework: 'Clap' },
};

const RUBY_DEPS: Record<string, DepRule> = {
  rails: { framework: 'Ruby on Rails' },
  sinatra: { framework: 'Sinatra' },
  hanami: { framework: 'Hanami' },
  thor: { framework: 'Thor' },
  rspec: { testRunner: 'rspec' },
  minitest: { testRunner: 'minitest' },
};

const PHP_DEPS: Record<string, DepRule> = {
  'laravel/framework': { framework: 'Laravel' },
  'symfony/framework-bundle': { framework: 'Symfony' },
  'cakephp/cakephp': { framework: 'CakePHP' },
  'slim/slim': { framework: 'Slim' },
  'phpunit/phpunit': { testRunner: 'phpunit' },
};

// .NET / C# package names — matched against <PackageReference Include="..." />
// values inside .csproj / .fsproj / .vbproj XML.
const DOTNET_DEPS: Record<string, DepRule> = {
  // ASP.NET Core (backend web)
  'Microsoft.AspNetCore.App': { framework: 'ASP.NET Core' },
  'Microsoft.AspNetCore.Mvc': { framework: 'ASP.NET Core' },
  'Microsoft.AspNetCore.OpenApi': { framework: 'ASP.NET Core' },
  // Blazor (frontend)
  'Microsoft.AspNetCore.Components': { framework: 'Blazor' },
  'Microsoft.AspNetCore.Components.WebAssembly': { framework: 'Blazor' },
  // ORMs
  'Microsoft.EntityFrameworkCore': { framework: 'Entity Framework' },
  'Microsoft.EntityFrameworkCore.SqlServer': { framework: 'Entity Framework' },
  'Microsoft.EntityFrameworkCore.Sqlite': { framework: 'Entity Framework' },
  Dapper: { framework: 'Dapper' },
  // Mobile / desktop
  'Microsoft.Maui.Controls': { framework: 'MAUI' },
  // CLI helpers
  'System.CommandLine': { framework: 'System.CommandLine' },
  CommandLineParser: { framework: 'CommandLineParser' },
  'Spectre.Console': { framework: 'Spectre.Console' },
  'Spectre.Console.Cli': { framework: 'Spectre.Console' },
  // Test runners
  xunit: { testRunner: 'xunit' },
  'xunit.runner.visualstudio': { testRunner: 'xunit' },
  NUnit: { testRunner: 'nunit' },
  'NUnit3TestAdapter': { testRunner: 'nunit' },
  'MSTest.TestFramework': { testRunner: 'mstest' },
  'MSTest.TestAdapter': { testRunner: 'mstest' },
  // Common libraries (no framework label, but mention worth detecting if we extend)
};

// ---- aggregator types ----

export interface Detections {
  frameworks: Set<string>;
  testRunners: Set<string>;
  packageManager?: PackageManager;
}

function applyDeps(detections: Detections, deps: Iterable<string>, table: Record<string, DepRule>): void {
  for (const name of deps) {
    const rule = table[name];
    if (!rule) continue;
    if (rule.framework) detections.frameworks.add(rule.framework);
    if (rule.testRunner) detections.testRunners.add(rule.testRunner);
  }
}

// ---- per-file parsers ----

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function safeTomlParse(text: string): Record<string, unknown> | null {
  try {
    const parsed = TOML.parse(text);
    return parsed;
  } catch {
    return null;
  }
}

function objectKeys(value: unknown): string[] {
  if (typeof value !== 'object' || value === null) return [];
  return Object.keys(value as Record<string, unknown>);
}

export function parsePackageJson(text: string, detections: Detections): void {
  const data = safeJsonParse(text);
  if (typeof data !== 'object' || data === null) return;
  const obj = data as Record<string, unknown>;

  const deps = [
    ...objectKeys(obj.dependencies),
    ...objectKeys(obj.devDependencies),
    ...objectKeys(obj.peerDependencies),
    ...objectKeys(obj.optionalDependencies),
  ];
  applyDeps(detections, deps, PACKAGE_JSON_DEPS);

  // packageManager: "pnpm@8.0.0" form
  const pm = obj.packageManager;
  if (typeof pm === 'string') {
    const name = pm.split('@')[0]?.toLowerCase();
    if (name === 'npm' || name === 'pnpm' || name === 'yarn' || name === 'bun') {
      detections.packageManager = name;
    }
  }
}

export function parsePyproject(text: string, detections: Detections): void {
  const data = safeTomlParse(text);
  if (!data) return;

  // PEP 621: [project] dependencies + optional-dependencies
  const project = data.project;
  if (typeof project === 'object' && project !== null) {
    const p = project as Record<string, unknown>;
    if (Array.isArray(p.dependencies)) {
      applyDeps(detections, extractDepNames(p.dependencies), PYTHON_DEPS);
    }
    const optional = p['optional-dependencies'];
    if (typeof optional === 'object' && optional !== null) {
      for (const list of Object.values(optional as Record<string, unknown>)) {
        if (Array.isArray(list)) {
          applyDeps(detections, extractDepNames(list), PYTHON_DEPS);
        }
      }
    }
  }

  // Poetry: [tool.poetry] dependencies / dev-dependencies / group.*.dependencies
  const tool = data.tool;
  if (typeof tool === 'object' && tool !== null) {
    const t = tool as Record<string, unknown>;
    const poetry = t.poetry;
    if (typeof poetry === 'object' && poetry !== null) {
      const pe = poetry as Record<string, unknown>;
      applyDeps(detections, objectKeys(pe.dependencies), PYTHON_DEPS);
      applyDeps(detections, objectKeys(pe['dev-dependencies']), PYTHON_DEPS);
      const group = pe.group;
      if (typeof group === 'object' && group !== null) {
        for (const grp of Object.values(group as Record<string, unknown>)) {
          if (typeof grp === 'object' && grp !== null) {
            applyDeps(
              detections,
              objectKeys((grp as Record<string, unknown>).dependencies),
              PYTHON_DEPS,
            );
          }
        }
      }
      detections.packageManager = 'poetry';
    }
  }
}

function extractDepNames(deps: unknown[]): string[] {
  const names: string[] = [];
  for (const d of deps) {
    if (typeof d !== 'string') continue;
    // "fastapi", "fastapi==0.95.0", "fastapi[all]>=0.95"
    const match = d.match(/^([a-zA-Z0-9_.-]+)/);
    if (match && match[1]) names.push(match[1].toLowerCase());
  }
  return names;
}

export function parseRequirementsTxt(text: string, detections: Detections): void {
  const names: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('-')) continue;
    const match = line.match(/^([a-zA-Z0-9_.-]+)/);
    if (match && match[1]) names.push(match[1].toLowerCase());
  }
  applyDeps(detections, names, PYTHON_DEPS);
}

export function parseGoMod(text: string, detections: Detections): void {
  const names: string[] = [];
  // Match both "require modulepath version" and indented modulepath inside require ()
  const requireBlockMatch = text.match(/require\s*\(([\s\S]*?)\)/);
  if (requireBlockMatch && requireBlockMatch[1]) {
    for (const rawLine of requireBlockMatch[1].split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      const m = line.match(/^([^\s]+)\s+v[\d.]/);
      if (m && m[1]) names.push(m[1]);
    }
  }
  for (const match of text.matchAll(/^require\s+([^\s(]+)\s+v[\d.]/gm)) {
    if (match[1]) names.push(match[1]);
  }
  applyDeps(detections, names, GO_DEPS);
}

export function parseCargoToml(text: string, detections: Detections): void {
  const data = safeTomlParse(text);
  if (!data) return;
  const sections = ['dependencies', 'dev-dependencies', 'build-dependencies'];
  for (const sec of sections) {
    applyDeps(detections, objectKeys(data[sec]), RUST_DEPS);
  }
}

export function parseGemfile(text: string, detections: Detections): void {
  const names: string[] = [];
  for (const match of text.matchAll(/^\s*gem\s+['"]([^'"]+)['"]/gm)) {
    if (match[1]) names.push(match[1].toLowerCase());
  }
  applyDeps(detections, names, RUBY_DEPS);
}

export function parseComposerJson(text: string, detections: Detections): void {
  const data = safeJsonParse(text);
  if (typeof data !== 'object' || data === null) return;
  const obj = data as Record<string, unknown>;
  applyDeps(detections, objectKeys(obj.require), PHP_DEPS);
  applyDeps(detections, objectKeys(obj['require-dev']), PHP_DEPS);
}

/**
 * Parse a .NET project file (.csproj / .fsproj / .vbproj). These are XML and
 * we extract PackageReference entries via regex — sufficient for the common
 * case without pulling in an XML parser. Also infers ASP.NET Core when the
 * file uses the Microsoft.NET.Sdk.Web SDK.
 */
export function parseDotNetProject(text: string, detections: Detections): void {
  // Detect Web SDK as a backend signal even when no PackageReference is listed
  // (some projects rely entirely on the implicit FrameworkReference).
  if (/Sdk\s*=\s*"Microsoft\.NET\.Sdk\.Web"/i.test(text)) {
    detections.frameworks.add('ASP.NET Core');
  }
  if (/Sdk\s*=\s*"Microsoft\.NET\.Sdk\.BlazorWebAssembly"/i.test(text)) {
    detections.frameworks.add('Blazor');
  }
  if (/Sdk\s*=\s*"Microsoft\.NET\.Sdk\.Razor"/i.test(text)) {
    detections.frameworks.add('Razor');
  }

  const names: string[] = [];
  for (const match of text.matchAll(/<PackageReference\s+[^>]*Include\s*=\s*"([^"]+)"/gi)) {
    if (match[1]) names.push(match[1]);
  }
  applyDeps(detections, names, DOTNET_DEPS);
}

// ---- package manager inference from lockfile presence ----

export function inferJsPackageManager(lockfileNames: Set<string>): PackageManager | undefined {
  if (lockfileNames.has('bun.lockb') || lockfileNames.has('bun.lock')) return 'bun';
  if (lockfileNames.has('pnpm-lock.yaml')) return 'pnpm';
  if (lockfileNames.has('yarn.lock')) return 'yarn';
  if (lockfileNames.has('package-lock.json')) return 'npm';
  return undefined;
}

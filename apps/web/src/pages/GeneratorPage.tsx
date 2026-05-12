import { useState } from 'react';
import type { GenerateResponse } from '@prmd/shared';
import type { ResolvedTheme } from '../theme';
import { InputPage } from './InputPage';
import { PreviewPage } from './PreviewPage';
import { useMetaDescription, useTitle } from '../lib/seo';

interface GeneratorPageProps {
  resolvedTheme: ResolvedTheme;
}

export function GeneratorPage({ resolvedTheme }: GeneratorPageProps): JSX.Element {
  const [result, setResult] = useState<GenerateResponse | null>(null);
  useTitle('Generator');
  useMetaDescription(
    'Build a downloadable AI agent pack — AGENTS.md, CLAUDE.md, Cursor rules, and Copilot instructions — from a repo URL or project details.',
  );

  if (result) {
    return <PreviewPage result={result} onBack={() => setResult(null)} resolvedTheme={resolvedTheme} />;
  }
  return <InputPage onGenerated={setResult} />;
}

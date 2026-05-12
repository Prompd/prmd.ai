import { useState } from 'react';
import Editor, { type Monaco, type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import type { GeneratedFile, GenerateResponse } from '@prmd/shared';
import type { ResolvedTheme } from '../theme';
import { downloadZip } from '../api';
import { Icon } from '../components/Icon';
import { FileTree } from '../components/FileTree';
import { FeedbackWidget } from '../components/FeedbackWidget';
import { useResizable } from '../hooks/useResizable';
import { trackEvent } from '../lib/analytics';

interface PreviewPageProps {
  result: GenerateResponse;
  onBack: () => void;
  resolvedTheme: ResolvedTheme;
}

// Background hex matches --surface-canvas at each theme. Keep these in sync
// with tokens.css if those values change.
const MONACO_THEME_BG_LIGHT = '#f7f8fb';
const MONACO_THEME_BG_DARK = '#0a0f1a';

function registerMonacoThemes(monaco: Monaco): void {
  monaco.editor.defineTheme('prmd-light', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': MONACO_THEME_BG_LIGHT,
      'editorGutter.background': MONACO_THEME_BG_LIGHT,
    },
  });
  monaco.editor.defineTheme('prmd-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': MONACO_THEME_BG_DARK,
      'editorGutter.background': MONACO_THEME_BG_DARK,
    },
  });
}

export function PreviewPage({ result, onBack, resolvedTheme }: PreviewPageProps): JSX.Element {
  const [files, setFiles] = useState<GeneratedFile[]>(result.files);
  const [selectedPath, setSelectedPath] = useState<string>(result.files[0]?.path ?? '');
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ line: number; column: number }>({ line: 1, column: 1 });

  const { width: fileListWidth, startDrag, dragging } = useResizable({
    storageKey: 'prmd-file-list-width',
    defaultWidth: 260,
    minWidth: 180,
    maxWidth: 480,
  });

  const selected = files.find((f) => f.path === selectedPath);
  const monacoTheme = resolvedTheme === 'dark' ? 'prmd-dark' : 'prmd-light';

  function updateSelectedContents(value: string | undefined): void {
    if (!selected) return;
    setFiles((prev) =>
      prev.map((f) => (f.path === selected.path ? { ...f, contents: value ?? '' } : f)),
    );
  }

  async function handleDownload(): Promise<void> {
    setError(null);
    setDownloading(true);
    try {
      await downloadZip(result.profile.name || 'agent-pack', files);
      trackEvent({ name: 'download_zip', file_count: files.length });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown error');
    } finally {
      setDownloading(false);
    }
  }

  function handleSelect(path: string): void {
    setSelectedPath(path);
    // Reset cursor for the newly selected file. Monaco fires
    // onDidChangeCursorPosition on mount, which will overwrite this — but
    // setting 1,1 prevents a brief flash of stale coordinates.
    setCursor({ line: 1, column: 1 });
    trackEvent({ name: 'preview_file_select', path });
  }

  const onEditorMount: OnMount = (editorInstance) => {
    editorInstance.onDidChangeCursorPosition((e: editor.ICursorPositionChangedEvent) => {
      setCursor({ line: e.position.lineNumber, column: e.position.column });
    });
  };

  return (
    <div className="preview">
      <div className="preview-toolbar">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          <Icon name="arrow-left" size={14} /> Back
        </button>
        <span className="preview-title">{result.profile.name}</span>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleDownload}
          disabled={downloading || files.length === 0}
        >
          {downloading ? (
            <>
              <Icon name="loader" size={14} className="spin" />
              Packaging…
            </>
          ) : (
            <>
              <Icon name="download" size={14} />
              Download zip
            </>
          )}
        </button>
      </div>
      {error && (
        <div style={{ padding: '12px 24px' }}>
          <div className="callout-error">{error}</div>
        </div>
      )}
      <div className="preview-edit-hint" role="note">
        Every file is editable here — your changes ship in the downloaded ZIP.
      </div>
      <FeedbackWidget generationKind={result.profile.kind} />
      <div
        className="preview-body"
        style={{ gridTemplateColumns: `${fileListWidth}px 6px 1fr` }}
      >
        <aside className="file-list" aria-label="Generated files">
          <FileTree files={files} selectedPath={selectedPath} onSelect={handleSelect} />
        </aside>
        <div
          className="preview-resize"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize file list"
          data-dragging={dragging}
          onMouseDown={startDrag}
        />
        <section className="editor-host">
          {selected ? (
            <Editor
              height="100%"
              path={selected.path}
              language={selected.language}
              value={selected.contents}
              theme={monacoTheme}
              beforeMount={registerMonacoThemes}
              onMount={onEditorMount}
              onChange={updateSelectedContents}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                wordWrap: 'on',
                scrollBeyondLastLine: false,
              }}
            />
          ) : (
            <div className="empty">No file selected</div>
          )}
        </section>
      </div>
      <div className="preview-statusbar" role="status">
        {selected ? (
          <>
            <span className="preview-statusbar-path">{selected.path}</span>
            <span className="preview-statusbar-divider" aria-hidden="true">·</span>
            <span>{selected.language}</span>
            <span className="preview-statusbar-divider" aria-hidden="true">·</span>
            <span>{selected.contents.length.toLocaleString()} chars</span>
            <span className="preview-statusbar-divider" aria-hidden="true">·</span>
            <span>
              Ln {cursor.line}, Col {cursor.column}
            </span>
          </>
        ) : (
          <span>No file selected</span>
        )}
        <span className="preview-statusbar-spacer" />
        <a
          href="https://github.com/prompd/prmd.ai"
          target="_blank"
          rel="noreferrer"
          onClick={() => trackEvent({ name: 'cta_click', cta: 'github_repo' })}
          aria-label="prmd.ai source on GitHub"
        >
          <Icon name="github" size={12} />
          <span>source</span>
        </a>
        <span className="preview-statusbar-divider" aria-hidden="true">·</span>
        <a href="https://prompdhub.ai" target="_blank" rel="noreferrer">
          prompdhub.ai
        </a>
        <span className="preview-statusbar-divider" aria-hidden="true">·</span>
        <a href="https://prompd.io" target="_blank" rel="noreferrer">
          prompd.io
        </a>
      </div>
    </div>
  );
}

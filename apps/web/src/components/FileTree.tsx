import type { GeneratedFile } from '@prmd/shared';
import { Icon } from './Icon';

interface FileTreeProps {
  files: GeneratedFile[];
  selectedPath: string;
  onSelect: (path: string) => void;
}

interface TreeFolder {
  type: 'folder';
  name: string;
  fullPath: string;
  children: TreeNode[];
}

interface TreeFile {
  type: 'file';
  name: string;
  path: string;
}

type TreeNode = TreeFolder | TreeFile;

function buildTree(files: GeneratedFile[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const parts = file.path.split('/');
    let current = root;
    let pathSoFar = '';

    for (let i = 0; i < parts.length - 1; i++) {
      const segment = parts[i];
      if (segment === undefined) continue;
      pathSoFar = pathSoFar ? `${pathSoFar}/${segment}` : segment;

      const existing = current.find(
        (n): n is TreeFolder => n.type === 'folder' && n.name === segment,
      );
      if (existing) {
        current = existing.children;
      } else {
        const folder: TreeFolder = {
          type: 'folder',
          name: segment,
          fullPath: pathSoFar,
          children: [],
        };
        current.push(folder);
        current = folder.children;
      }
    }

    current.push({
      type: 'file',
      name: parts[parts.length - 1] ?? file.path,
      path: file.path,
    });
  }

  function sortLevel(nodes: TreeNode[]): void {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.type === 'folder') sortLevel(node.children);
    }
  }
  sortLevel(root);

  return root;
}

type IconCategory = 'claude' | 'cursor' | 'github' | 'markdown' | 'default';

/**
 * Categorize a node so its icon picks up a tool-appropriate accent color.
 * Folders inherit from their path prefix; files inherit from where they live,
 * with a markdown fallback for top-level docs (AGENTS.md, CLAUDE.md).
 */
function categoryFor(path: string): IconCategory {
  if (path === '.claude' || path.startsWith('.claude/')) return 'claude';
  if (path === '.cursor' || path.startsWith('.cursor/')) return 'cursor';
  if (path === '.github' || path.startsWith('.github/')) return 'github';
  if (/\.mdc?$/.test(path)) return 'markdown';
  return 'default';
}

interface NodeViewProps {
  node: TreeNode;
  depth: number;
  selectedPath: string;
  onSelect: (path: string) => void;
}

function NodeView({ node, depth, selectedPath, onSelect }: NodeViewProps): JSX.Element {
  const paddingLeft = 8 + depth * 14;

  if (node.type === 'folder') {
    const category = categoryFor(node.fullPath);
    return (
      <>
        <div className="tree-folder" style={{ paddingLeft }} data-cat={category}>
          <Icon name="folder" size={14} />
          <span className="tree-folder-name">{node.name}</span>
        </div>
        {node.children.map((child) => (
          <NodeView
            key={child.type === 'folder' ? `f:${child.fullPath}` : `x:${child.path}`}
            node={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            onSelect={onSelect}
          />
        ))}
      </>
    );
  }

  const category = categoryFor(node.path);
  return (
    <button
      type="button"
      className="file-item"
      data-active={node.path === selectedPath}
      data-cat={category}
      onClick={() => onSelect(node.path)}
      style={{ paddingLeft }}
      title={node.path}
    >
      <Icon name="file" size={14} />
      <span className="file-item-name">{node.name}</span>
    </button>
  );
}

export function FileTree({ files, selectedPath, onSelect }: FileTreeProps): JSX.Element {
  const tree = buildTree(files);
  return (
    <div className="file-tree">
      {tree.map((node) => (
        <NodeView
          key={node.type === 'folder' ? `f:${node.fullPath}` : `x:${node.path}`}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

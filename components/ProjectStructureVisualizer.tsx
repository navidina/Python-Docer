import React, { useMemo, useState } from 'react';
import { ProcessedFile } from '../types';
import { ChevronDown, ChevronLeft, Folder, FolderOpen, FileCode2, FileText, FileJson, Braces, Layers3 } from 'lucide-react';

interface ProjectStructureVisualizerProps {
  fileMap: Record<string, ProcessedFile>;
}

type TreeNode = {
  name: string;
  path: string;
  type: 'folder' | 'file';
  children: Map<string, TreeNode>;
  fileCount: number;
  lineCount: number;
};

const createNode = (name: string, path: string, type: 'folder' | 'file'): TreeNode => ({
  name,
  path,
  type,
  children: new Map(),
  fileCount: type === 'file' ? 1 : 0,
  lineCount: 0,
});

const fileIcon = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.endsWith('.json')) return <FileJson className="w-3.5 h-3.5 text-amber-500" />;
  if (lower.endsWith('.md') || lower.endsWith('.txt')) return <FileText className="w-3.5 h-3.5 text-emerald-500" />;
  if (lower.endsWith('.ts') || lower.endsWith('.tsx') || lower.endsWith('.js') || lower.endsWith('.jsx')) return <FileCode2 className="w-3.5 h-3.5 text-sky-500" />;
  return <Braces className="w-3.5 h-3.5 text-slate-500" />;
};

const TreeItem: React.FC<{ node: TreeNode; depth: number; expanded: Record<string, boolean>; toggle: (path: string) => void }> = ({ node, depth, expanded, toggle }) => {
  const isFolder = node.type === 'folder';
  const hasChildren = node.children.size > 0;
  const isOpen = expanded[node.path] ?? depth < 2;
  const children = Array.from(node.children.values()).sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div>
      <button
        onClick={() => isFolder && hasChildren && toggle(node.path)}
        className={`w-full text-right flex items-center gap-2 rounded-xl px-2 py-1.5 ${isFolder ? 'hover:bg-slate-100/80' : ''}`}
        style={{ paddingRight: `${depth * 14 + 8}px` }}
      >
        {isFolder ? (
          <span className="text-slate-400 shrink-0">
            {hasChildren ? (isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />) : <span className="inline-block w-3.5" />}
          </span>
        ) : (
          <span className="inline-block w-3.5" />
        )}

        {isFolder ? (
          isOpen ? <FolderOpen className="w-4 h-4 text-violet-600 shrink-0" /> : <Folder className="w-4 h-4 text-slate-500 shrink-0" />
        ) : (
          fileIcon(node.name)
        )}

        <span className={`text-sm truncate ${isFolder ? 'font-bold text-slate-700' : 'font-medium text-slate-600'}`}>{node.name}</span>

        {isFolder && (
          <span className="mr-auto text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
            {node.fileCount} فایل
          </span>
        )}
      </button>

      {isFolder && hasChildren && isOpen && (
        <div className="relative">
          {children.map((child) => (
            <TreeItem key={child.path} node={child} depth={depth + 1} expanded={expanded} toggle={toggle} />
          ))}
        </div>
      )}
    </div>
  );
};

const ProjectStructureVisualizer: React.FC<ProjectStructureVisualizerProps> = ({ fileMap }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { root, folderCount, fileCount, totalLines, topFolders } = useMemo(() => {
    const root = createNode('Project Root', 'ROOT', 'folder');

    Object.values(fileMap).forEach((file) => {
      const parts = file.path.split('/').filter(Boolean);
      let current = root;
      let currentPath = '';

      parts.forEach((part, index) => {
        const isFile = index === parts.length - 1;
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (!current.children.has(part)) {
          current.children.set(part, createNode(part, currentPath, isFile ? 'file' : 'folder'));
        }

        const child = current.children.get(part)!;
        if (!isFile) {
          child.fileCount += 1;
        } else {
          child.lineCount = file.lines;
        }
        current.fileCount += 1;
        current = child;
      });
    });

    let folderCount = 0;
    let fileCount = 0;
    let totalLines = 0;
    const folderStats: Array<{ name: string; count: number }> = [];

    const walk = (node: TreeNode, depth = 0) => {
      if (node.type === 'folder') {
        folderCount += 1;
        if (depth === 1) folderStats.push({ name: node.name, count: node.fileCount });
      } else {
        fileCount += 1;
        totalLines += node.lineCount;
      }
      node.children.forEach((c) => walk(c, depth + 1));
    };
    walk(root);

    const topFolders = folderStats.sort((a, b) => b.count - a.count).slice(0, 4);
    return { root, folderCount: Math.max(folderCount - 1, 0), fileCount, totalLines, topFolders };
  }, [fileMap]);

  const toggle = (path: string) => setExpanded((prev) => ({ ...prev, [path]: !(prev[path] ?? true) }));

  if (Object.keys(fileMap).length === 0) return null;

  const rootChildren = Array.from(root.children.values()).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mt-6 rounded-[2rem] border border-slate-200 bg-gradient-to-b from-white to-slate-50/70 p-5">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Layers3 className="w-5 h-5 text-violet-600" />
            درخت ساختار مخزن
          </h3>
          <p className="text-xs text-slate-500 mt-1">نمای کامل همه پوشه‌ها و فایل‌های اسکن‌شده با ساختار درختی</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white border border-slate-200 px-3 py-2">
            <p className="text-[10px] text-slate-400">پوشه</p>
            <p className="text-sm font-black text-slate-700">{folderCount}</p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 px-3 py-2">
            <p className="text-[10px] text-slate-400">فایل</p>
            <p className="text-sm font-black text-slate-700">{fileCount}</p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 px-3 py-2">
            <p className="text-[10px] text-slate-400">LoC</p>
            <p className="text-sm font-black text-slate-700">{totalLines.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {!!topFolders.length && (
        <div className="mb-4 flex flex-wrap gap-2">
          {topFolders.map((f) => (
            <span key={f.name} className="text-xs px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-100">
              {f.name} • {f.count} فایل
            </span>
          ))}
        </div>
      )}

      <div className="max-h-[520px] overflow-auto rounded-2xl border border-slate-200 bg-white p-3">
        {rootChildren.map((node) => (
          <TreeItem key={node.path} node={node} depth={0} expanded={expanded} toggle={toggle} />
        ))}
      </div>
    </div>
  );
};

export default ProjectStructureVisualizer;

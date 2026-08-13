import { FileText, FileImage, FileSpreadsheet, File, FileCode } from "lucide-react";

export interface FileItem {
  id: string;
  name: string;
  type: string;
  size: number;
}

export interface NativeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  ext?: string;
  children?: NativeNode[];
}

export interface TreeNode {
  name: string;
  isDir: boolean;
  children: TreeNode[];
  file?: FileItem;
  nativePath?: string;
  size?: number;
}

export function buildTree(files: FileItem[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const parts = file.name.replace(/\\/g, "/").split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        current.push({ name: part, isDir: false, children: [], file });
      } else {
        let existing = current.find((n) => n.name === part && n.isDir);
        if (!existing) {
          existing = { name: part, isDir: true, children: [] };
          current.push(existing);
        }
        current = existing.children;
      }
    }
  }

  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => {
      if (n.isDir) sortNodes(n.children);
    });
  };
  sortNodes(root);

  return root;
}

export function nativeToTreeNodes(nodes: NativeNode[]): TreeNode[] {
  return nodes.map((n) => ({
    name: n.name,
    isDir: n.type === "directory",
    nativePath: n.path,
    size: n.size,
    children: n.children ? nativeToTreeNodes(n.children) : [],
  }));
}

export function getFileIcon(name: string) {
  const lowerName = name.toLowerCase();
  const ext = lowerName.split(".").pop() || "";

  if (["docx", "doc"].includes(ext)) {
    return <FileText className="w-3.5 h-3.5 text-[#E5E5E5] shrink-0 stroke-[1.8]" />;
  }
  if (["pdf"].includes(ext)) {
    return <FileText className="w-3.5 h-3.5 text-[#E5E5E5] shrink-0 stroke-[1.8]" />;
  }
  if (["jpg", "jpeg", "png", "gif", "svg", "webp", "ico"].includes(ext)) {
    return <FileImage className="w-3.5 h-3.5 text-[#A3A3A3] shrink-0 stroke-[1.8]" />;
  }
  if (["xlsx", "xls", "xlsm", "csv"].includes(ext)) {
    return <FileSpreadsheet className="w-3.5 h-3.5 text-[#FFFFFF] shrink-0 stroke-[1.8]" />;
  }
  if (
    ["json", "js", "jsx", "ts", "tsx", "html", "css", "py", "sh", "cmd", "ps1"].includes(ext) ||
    lowerName.startsWith(".env") ||
    lowerName === ".gitignore"
  ) {
    return <FileCode className="w-3.5 h-3.5 text-[#A3A3A3] shrink-0 stroke-[1.8]" />;
  }
  if (["md", "txt", "log"].includes(ext)) {
    return <FileText className="w-3.5 h-3.5 text-[#A3A3A3] shrink-0 stroke-[1.8]" />;
  }
  return <File className="w-3.5 h-3.5 text-[#737373] shrink-0 stroke-[1.8]" />;
}

export function formatSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

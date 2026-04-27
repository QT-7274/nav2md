import type { ExportTask } from "../shared/types";

interface CreateMarkdownFilenameOptions {
  reservedFilenames?: string[];
}

export function createMarkdownFilenames(
  tasks: ExportTask[],
  options: CreateMarkdownFilenameOptions = {}
): string[] {
  const used = new Set(options.reservedFilenames || []);

  return tasks.map((task) => {
    const selectedTitle = task.sourceTextPath.at(-1) || task.title;
    const base = toSafeMarkdownBasename(selectedTitle || task.url || task.id) || `doc-${task.order || 1}`;
    let suffix = 1;
    let filename = `${base}.md`;

    while (used.has(filename)) {
      suffix += 1;
      filename = `${base}-${suffix}.md`;
    }

    used.add(filename);
    return filename;
  });
}

function toSafeMarkdownBasename(value: string) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

import type { ExportTask } from "../shared/types";

export function createMarkdownFilenames(tasks: ExportTask[]): string[] {
  const used = new Map<string, number>();

  return tasks.map((task) => {
    const base = slugify(task.title || task.url || task.id) || `doc-${task.order || 1}`;
    const count = used.get(base) || 0;
    used.set(base, count + 1);
    return count === 0 ? `${base}.md` : `${base}-${count + 1}.md`;
  });
}

function slugify(value: string) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export interface ExportTask {
  id: string;
  title: string;
  url: string;
  order: number;
  sourceTextPath: string[];
  selectionMeta: Record<string, unknown>;
}

export interface ExtractionSuccess {
  ok: true;
  url: string;
  title: string;
  selector: string;
  markdown: string;
  htmlLength: number;
  markdownLength: number;
}

export interface ExtractionFailure {
  ok: false;
  reason: string;
  message: string;
  url: string;
  title?: string;
  selector?: string;
  markdownLength?: number;
}

export type ExtractionResult = ExtractionSuccess | ExtractionFailure;

export interface ExportSuccess {
  ok: true;
  taskId: string;
  url: string;
  title: string;
  markdown: string;
  diagnostics: Record<string, unknown>;
}

export interface ExportFailure {
  ok: false;
  reason: string;
  message: string;
  taskId: string;
  url: string;
  diagnostics?: unknown;
}

export type ExportResult = ExportSuccess | ExportFailure;

export interface ExportResultItem {
  task: ExportTask;
  result: ExportResult;
  filename?: string;
}

export interface ExportManifest {
  schemaVersion: 1;
  jobId: string;
  createdAt: string;
  sourceUrl: string;
  total: number;
  success: number;
  failed: number;
  items: Array<{
    id: string;
    order: number;
    title: string;
    sourceUrl: string;
    capturedUrl: string | null;
    ok: boolean;
    filename: string | null;
    sourceTextPath: string[];
    error: null | {
      reason: string;
      message: string;
    };
    diagnostics: unknown;
  }>;
}

export interface StartExportJobInput {
  tasks: unknown;
  sourceTabId: number | null;
  sourceTitle?: string;
  sourceUrl: string;
}

export type StartExportJobResponse =
  | {
      ok: true;
      jobId: string;
      taskCount: number;
    }
  | {
      ok: false;
      reason: string;
      jobId?: string;
      errors?: string[];
    };

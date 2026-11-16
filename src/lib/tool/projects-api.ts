import type { Draft } from "./model";

/**
 * The site's project store (`/api/projects`), for a signed-in user: their projects, each with
 * its earlier versions. A request the server refuses fails with a `ProjectsApiError`.
 */

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
}
export interface ProjectVersion {
  id: number;
  savedAt: string;
}

/** Why the store refused a request: not signed in, not the user's project, no such project, or anything else. */
export type ProjectsApiErrorCode = "unauthenticated" | "forbidden" | "not-found" | "failed";

const CODES: Partial<Record<number, ProjectsApiErrorCode>> = { 401: "unauthenticated", 403: "forbidden", 404: "not-found" };

/** A request the project store refused: its HTTP status, its code, and the server's reason when it gives one (the message shows it, or the status). */
export class ProjectsApiError extends Error {
  readonly status: number;
  readonly code: ProjectsApiErrorCode;
  readonly reason: string | null;

  constructor(status: number, reason: string | null) {
    super(reason ?? String(status));
    this.name = "ProjectsApiError";
    this.status = status;
    this.code = CODES[status] ?? "failed";
    this.reason = reason;
  }
}

/** The error for a refused request, with the server's reason from its body (`{ error }`). */
async function failure(r: Response): Promise<ProjectsApiError> {
  const body = (await r.json().catch(() => null)) as { error?: unknown } | null;
  const reason = body?.error;
  return new ProjectsApiError(r.status, typeof reason === "string" ? reason : null);
}

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw await failure(r);
  return (r.status === 204 ? null : await r.json()) as T;
}

export const listProjects = () => api<ProjectSummary[]>("GET", "/api/projects");
export const getProject = (id: string) => api<{ id: string; name: string; draft: Draft }>("GET", `/api/projects/${id}`);
export const deleteProject = (id: string) => api("DELETE", `/api/projects/${id}`);
export const listVersions = (id: string) => api<ProjectVersion[]>(`GET`, `/api/projects/${id}/versions`);
export const getVersion = (id: string, version: number) => api<{ draft: Draft }>("GET", `/api/projects/${id}/versions/${String(version)}`);

/** Saves the lab as a new project (POST), or as the next version of `id` (PUT). */
export function saveProject(id: string | null, body: { name?: string; draft: Draft; isoloomYml: string | null }): Promise<ProjectSummary> {
  if (id) return api<ProjectSummary>("PUT", `/api/projects/${id}`, body);
  return api<ProjectSummary>("POST", "/api/projects", body);
}

/** A project by the id in a link (#project=…), or null when it can't be read. */
export async function projectFromLink(id: string): Promise<{ id: string; name: string; draft: unknown } | null> {
  const r = await fetch(`/api/projects/${id}`);
  return r.ok ? ((await r.json()) as { id: string; name: string; draft: unknown }) : null;
}

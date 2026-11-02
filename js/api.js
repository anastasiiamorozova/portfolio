/**
 * Data layer — the ONLY place the frontend gets content from.
 *
 * Today it reads the static JSON files in /data.
 * When the backend exists, set `window.PORTFOLIO_API_BASE` (e.g. "/api")
 * before app.js loads, and these functions call the API instead.
 * The API must return the same shapes as the static files (see docs/SPEC.md).
 */

const API_BASE = window.PORTFOLIO_API_BASE || null;

let staticCache = null;

async function getJSON(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.json();
}

async function getText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.text();
}

async function loadStatic() {
  if (!staticCache) {
    const [site, content] = await Promise.all([
      getJSON('data/site.json'),
      getJSON('data/projects.json'),
    ]);
    staticCache = { site, ...content };
  }
  return staticCache;
}

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);

/** Profile: name, description, photo, links, display flags. */
export async function getSite() {
  if (API_BASE) return getJSON(`${API_BASE}/site`);
  return (await loadStatic()).site;
}

/** The three fields (handwritten phrases), in display order. */
export async function getCategories() {
  if (API_BASE) return getJSON(`${API_BASE}/categories`);
  return [...(await loadStatic()).categories].sort(byOrder);
}

/** Published project cards for one field, in display order. */
export async function getProjects(categorySlug) {
  if (API_BASE) return getJSON(`${API_BASE}/categories/${encodeURIComponent(categorySlug)}/projects`);
  return (await loadStatic()).projects
    .filter((p) => p.category === categorySlug && p.published)
    .sort(byOrder);
}

/**
 * One project (full page content). Returns null when not found.
 * `behind.body` is the path to an HTML fragment (the behind-the-story post);
 * it's loaded here and returned as `behind.html`. The API returns `behind.html` directly.
 */
export async function getProject(slug) {
  if (API_BASE) return getJSON(`${API_BASE}/projects/${encodeURIComponent(slug)}`);
  const project = (await loadStatic()).projects.find((p) => p.slug === slug && p.published) || null;
  if (!project?.behind?.body) return project;
  return { ...project, behind: { ...project.behind, html: await getText(project.behind.body) } };
}

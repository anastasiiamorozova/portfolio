/**
 * Portfolio — router + rendering (no framework, no build step).
 *
 * Routes (hash-based so it runs on any static server):
 *   #/                       home, no field open
 *   #/<category-slug>        home with that field's project grid open
 *   #/projects/<slug>        project page (empty for now)
 */

import { getSite, getCategories, getProjects, getProject } from './api.js';

const app = document.getElementById('app');

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// External links open in a new tab; links within the site stay in this one.
const linkAttrs = (href) =>
  /^https?:\/\//.test(href) ? ` href="${esc(href)}" target="_blank" rel="noopener"` : ` href="${esc(href)}"`;

const backIcon =
  '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 7H2M6 3L2 7l4 4"/></svg>';

function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'projects' && parts[1]) return { view: 'project', slug: parts[1] };
  if (parts[0]) return { view: 'home', category: parts[0] };
  return { view: 'home', category: null };
}

/* ---------- Templates ---------- */

function heroHTML(site) {
  const d = site.display || {};
  const photo = d.showPhoto
    ? site.photo
      ? `<img class="hero__photo" src="${esc(site.photo)}" alt="Portrait of ${esc(site.name)}">`
      : `<div class="hero__photo" role="img" aria-label="Portrait photo placeholder"></div>`
    : '';
  return `
    <section class="hero">
      ${photo}
      <div class="hero__text">
        <h1 class="hero__name">${esc(site.name)}</h1>
        <p class="hero__desc">${esc(site.description)}</p>
      </div>
    </section>`;
}

// Contact links sit at the side (top right), not under the name.
function contactHTML(site) {
  if (!site.display?.showContactLinks || !site.links?.length) return '';
  return `
    <nav class="contact contact--side" aria-label="Contact">
      ${site.links.map((l) => `<a${linkAttrs(l.href)}>${esc(l.label)}</a>`).join('')}
    </nav>`;
}

function fieldsHTML(categories, openSlug) {
  return `
    <section class="fields" aria-label="Fields">
      ${categories
        .map((c) => {
          const open = c.slug === openSlug;
          return `
          <button class="field" type="button" aria-pressed="${open}" aria-controls="projects" data-category="${esc(c.slug)}">
            <span class="field__box"><img src="${esc(c.handwritingImage)}" alt="${esc(c.label)}"></span>
            <span class="field__bar" aria-hidden="true"></span>
          </button>`;
        })
        .join('')}
    </section>`;
}

function tagsHTML(tags) {
  if (!tags?.length) return '';
  return `
        <span class="tags">
          ${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}
        </span>`;
}

// A card links to the published story when it has a `url`, otherwise to its project page
// (the behind-the-story post). A card with a `zoomImage` opens that picture in a pop-up instead.
// Stories with a post get a "Behind the story" button too.
function cardHTML(p) {
  const img = p.coverImage
    ? `<img src="${esc(p.coverImage)}" alt="${esc(p.coverAlt || '')}" loading="lazy">`
    : 'Image';
  const page = `#/projects/${encodeURIComponent(p.slug)}`;
  const href = p.url || page;
  const read = /^https?:\/\//.test(p.url ?? '') ? `<a class="card__more"${linkAttrs(p.url)}>Read the story</a>` : '';
  const behind = p.behind ? `<a class="card__more" href="${page}">Behind the story</a>` : '';
  const more = read || behind ? `<div class="card__links">${read}${behind}</div>` : '';
  const inner = `
        <span class="card__img">${img}</span>
        <span class="card__text">
          <span class="card__title">${esc(p.title)}</span>
          ${tagsHTML(p.tags)}
          <span class="card__desc">${esc(p.summary)}</span>
        </span>`;
  const main = p.zoomImage
    ? `<button class="card__link card__link--zoom" type="button" aria-haspopup="dialog"
         data-zoom="${esc(p.zoomImage)}" data-alt="${esc(p.coverAlt || p.title)}">${inner}</button>`
    : `<a class="card__link"${linkAttrs(href)}>${inner}</a>`;
  return `
    <article class="card">
      ${main}
      ${more}
    </article>`;
}

// One pop-up for enlarged pictures; clicking anywhere outside the picture (or Esc) closes it.
let lightbox = null;
function openLightbox(src, alt) {
  if (!lightbox) {
    lightbox = document.createElement('dialog');
    lightbox.className = 'lightbox';
    lightbox.innerHTML = '<img class="lightbox__img" alt="">';
    lightbox.addEventListener('click', (e) => {
      if (e.target !== lightbox.firstChild) lightbox.close();
    });
    document.body.append(lightbox);
  }
  const pic = lightbox.firstChild;
  pic.src = src;
  pic.alt = alt;
  lightbox.showModal();
}

function gridHTML(category, projects) {
  const content = projects.length
    ? `<div class="grid">${projects.map(cardHTML).join('')}</div>`
    : `<p class="projects__empty">Stories coming soon.</p>`;
  return `
    <section id="projects" class="projects anim" aria-label="${esc(category.label)} projects">
      ${content}
    </section>`;
}

/* ---------- Views ---------- */

async function renderHome(categorySlug) {
  const [site, categories] = await Promise.all([getSite(), getCategories()]);
  const category = categories.find((c) => c.slug === categorySlug) || null;
  const projects = category ? await getProjects(category.slug) : [];

  document.title = `${site.name} — Portfolio`;
  app.innerHTML =
    contactHTML(site) +
    heroHTML(site) +
    fieldsHTML(categories, category?.slug) +
    (category ? gridHTML(category, projects) : '');

  app.querySelectorAll('[data-zoom]').forEach((btn) => {
    btn.addEventListener('click', () => openLightbox(btn.dataset.zoom, btn.dataset.alt));
  });

  app.querySelectorAll('.field').forEach((btn) => {
    btn.addEventListener('click', () => {
      const slug = btn.dataset.category;
      // Clicking the open field again closes the grid.
      location.hash = slug === category?.slug ? '#/' : `#/${encodeURIComponent(slug)}`;
    });
  });
}

async function renderProject(slug) {
  const [site, categories, project] = await Promise.all([getSite(), getCategories(), getProject(slug)]);
  window.scrollTo(0, 0);

  if (!project) {
    document.title = `Not found — ${site.name}`;
    app.innerHTML = `
      <section class="notfound">
        <p>This project doesn’t exist.</p>
        <a class="back" href="#/">${backIcon}Back to the portfolio</a>
      </section>`;
    return;
  }

  const category = categories.find((c) => c.slug === project.category);
  const num = String(project.order ?? '').padStart(2, '0');
  const behind = project.behind;
  const title = behind?.title ?? project.title;
  // Back to the main page, with this story's field open.
  const back = `<a class="back" href="#/${encodeURIComponent(project.category)}">${backIcon}Back to the main page</a>`;
  const meta = behind ? 'Behind the story' : `${category?.label ?? ''} — ${num}`;
  document.title = `${title} — ${site.name}`;
  // behind.html is the owner's own post (a file in data/posts), so it's inserted as HTML.
  app.innerHTML = `
    <article class="project${behind ? ' project--post' : ''} anim" aria-label="Project">
      ${back}
      <span class="project__meta">${esc(meta)}</span>
      <h1 class="project__title">${esc(title)}</h1>
      <div class="project__body post">${behind?.html ?? ''}</div>
      ${behind ? back : ''}
    </article>`;
}

async function render() {
  const route = parseRoute();
  try {
    if (route.view === 'project') await renderProject(route.slug);
    else await renderHome(route.category);
  } catch (err) {
    console.error(err);
    app.innerHTML = `<section class="notfound"><p>Couldn’t load the portfolio. Please try again.</p></section>`;
  }
}

let lastView = null;
window.addEventListener('hashchange', () => {
  const view = parseRoute().view;
  render().then(() => {
    // Returning from a project page lands on the open grid.
    if (lastView === 'project' && view === 'home') {
      document.getElementById('projects')?.scrollIntoView({ block: 'start' });
    }
    lastView = view;
  });
});

lastView = parseRoute().view;
render();

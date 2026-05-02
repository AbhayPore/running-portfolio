(function(){
	const containerId = 'projects-list';
	const searchId = 'projects-search';

	function createCard(p) {
		const a = document.createElement('a');
		a.className = 'project-card';
		a.href = p.link || '#';
		a.setAttribute('aria-label', p.title || 'project');

		const img = document.createElement('img');
		img.className = 'project-image';
		img.alt = p.title || '';
		if (p.image) {
			img.src = p.image;
			img.loading = 'lazy';
		} else {
			img.style.display = 'none';
		}
		a.appendChild(img);

		const h = document.createElement('h3');
		h.textContent = p.title || 'Untitled';
		a.appendChild(h);

		const d = document.createElement('p');
		d.className = 'project-desc';
		d.textContent = p.description || '';
		a.appendChild(d);

		if (p.tags && p.tags.length) {
			const tagWrap = document.createElement('div');
			tagWrap.className = 'project-tags';
			p.tags.forEach(t => {
				const span = document.createElement('span');
				span.className = 'project-tag';
				span.textContent = t;
				tagWrap.appendChild(span);
			});
			a.appendChild(tagWrap);
		}

		return a;
	}

	function renderProjects(list) {
		const container = document.getElementById(containerId);
		if (!container) return;
		container.innerHTML = '';
		if (!list || !list.length) {
			const e = document.createElement('p');
			e.textContent = 'No projects found.';
			container.appendChild(e);
			return;
		}
		const frag = document.createDocumentFragment();
		list.forEach(p => frag.appendChild(createCard(p)));
		container.appendChild(frag);
	}

	function normalize(s){ return (s||'').toString().toLowerCase(); }

	function applyFilter() {
		const q = normalize(document.getElementById(searchId)?.value);
		const all = window.PROJECTS || [];
		if (!q) {
			renderProjects(all);
			return;
		}
		const filtered = all.filter(p => {
			return normalize(p.title).includes(q)
				|| normalize(p.description).includes(q)
				|| (p.tags||[]).some(t => normalize(t).includes(q));
		});
		renderProjects(filtered);
	}

	document.addEventListener('DOMContentLoaded', function(){
		if (!window.PROJECTS) {
			console.warn('window.PROJECTS not found — expecting data file to be included. Falling back to empty list.');
			window.PROJECTS = [];
		}
		renderProjects(window.PROJECTS);
		const s = document.getElementById(searchId);
		if (s) s.addEventListener('input', applyFilter);
	});
	
	// Register renderer so example-usage.html fallback can detect the real renderer
	// (expose only when present)
	window.renderProjects = renderProjects;
	window.applyFilter = applyFilter;
	window.__dynamicRendererLoaded = true;
})();

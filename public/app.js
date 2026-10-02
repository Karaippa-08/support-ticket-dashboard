(() => {
  const $ = (s) => document.querySelector(s);
  const state = { page: 1 };
  const fmt = (iso) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

  // Build DOM safely (textContent only) to avoid XSS from ticket content.
  function el(tag, props = {}, ...kids) {
    const n = Object.assign(document.createElement(tag), props);
    kids.flat().forEach((k) => n.append(k));
    return n;
  }
  const badge = (v) => el('span', { className: `badge ${v}`, textContent: v });

  async function api(path, opts = {}) {
    const res = await fetch('/api' + path, {
      headers: { 'Content-Type': 'application/json' }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error?.message || 'Request failed'), { details: data.error?.details });
    return data;
  }

  function toast(msg, isErr) {
    const t = $('#toast');
    t.textContent = msg; t.className = 'show' + (isErr ? ' err' : '');
    clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = ''), 2600);
  }

  async function loadStats() {
    try {
      const s = await api('/tickets/stats');
      for (const k of ['total', 'open', 'in_progress', 'resolved']) $('#s-' + k).textContent = s[k];
    } catch { /* stats are non-critical */ }
  }

  async function loadList() {
    const list = $('#list');
    list.replaceChildren(...Array.from({ length: 4 }, () => el('div', { className: 'skeleton' })));
    const params = new URLSearchParams({ page: state.page, sort: $('#sort').value });
    for (const k of ['q', 'status', 'priority']) if ($('#' + k).value.trim()) params.set(k, $('#' + k).value.trim());
    try {
      const data = await api('/tickets?' + params);
      if (!data.items.length) {
        list.replaceChildren(el('div', { className: 'state', textContent: 'No tickets match your search or filters.' }));
      } else {
        list.replaceChildren(...data.items.map(card));
      }
      renderPager(data);
    } catch (e) {
      list.replaceChildren(el('div', { className: 'state error' }, `Could not load tickets: ${e.message} `, el('button', { className: 'btn', textContent: 'Retry', onclick: loadList })));
      $('#pager').replaceChildren();
    }
  }

  function card(t) {
    return el('button', { className: 'ticket', onclick: () => openTicket(t.id) },
      el('h3', { textContent: `#${t.id} · ${t.title}` }),
      el('div', { className: 'meta' }, badge(t.status), badge(t.priority), t.customer_email, `Created ${fmt(t.created_at)}`));
  }

  function renderPager({ page, totalPages, total }) {
    $('#pager').replaceChildren(
      el('button', { className: 'btn', textContent: '← Prev', disabled: page <= 1, onclick: () => { state.page--; loadList(); } }),
      el('span', { textContent: `Page ${page} of ${totalPages} · ${total} ticket${total === 1 ? '' : 's'}` }),
      el('button', { className: 'btn', textContent: 'Next →', disabled: page >= totalPages, onclick: () => { state.page++; loadList(); } })
    );
  }

  async function openTicket(id) {
    const body = $('#viewBody');
    body.replaceChildren(el('div', { className: 'skeleton' }));
    $('#viewDlg').showModal();
    try { renderDetail(await api('/tickets/' + id)); }
    catch (e) { body.replaceChildren(el('p', { className: 'form-error', textContent: e.message }), el('button', { className: 'btn', textContent: 'Close', onclick: () => $('#viewDlg').close() })); }
  }

  function renderDetail(t) {
    const sel = (opts, val) => el('select', {}, opts.map((o) => el('option', { textContent: o, selected: o === val })));
    const status = sel(['Open', 'In Progress', 'Resolved'], t.status);
    const priority = sel(['Low', 'Medium', 'High'], t.priority);
    const err = el('p', { className: 'form-error' });
    const save = el('button', { className: 'btn primary', textContent: 'Save changes', onclick: async () => {
      save.disabled = true; err.textContent = '';
      try {
        const updated = await api('/tickets/' + t.id, { method: 'PATCH', body: { status: status.value, priority: priority.value } });
        renderDetail(updated); toast('Ticket updated'); loadList(); loadStats();
      } catch (e) { err.textContent = e.message; save.disabled = false; }
    } });
    $('#viewBody').replaceChildren(
      el('h2', { textContent: `#${t.id} · ${t.title}` }),
      el('p', { className: 'desc', textContent: t.description }),
      el('dl', { className: 'kv' },
        el('dt', { textContent: 'Customer' }), el('dd', { textContent: t.customer_email }),
        el('dt', { textContent: 'Created' }), el('dd', { textContent: fmt(t.created_at) }),
        el('dt', { textContent: 'Updated' }), el('dd', { textContent: fmt(t.updated_at) })),
      el('div', { className: 'row' }, el('label', {}, 'Status', status), el('label', {}, 'Priority', priority)),
      err,
      el('div', { className: 'actions' }, el('button', { className: 'btn', textContent: 'Close', onclick: () => $('#viewDlg').close() }), save)
    );
  }

  // ---- Create form (client-side validation mirrors the backend) ----
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function clientValidate(v) {
    const e = {};
    if (!v.title.trim()) e.title = 'Title is required.';
    else if (v.title.trim().length > 120) e.title = 'Title must be 120 characters or fewer.';
    if (!v.description.trim()) e.description = 'Description is required.';
    if (!v.customer_email.trim()) e.customer_email = 'Customer email is required.';
    else if (!EMAIL_RE.test(v.customer_email.trim())) e.customer_email = 'Enter a valid email address.';
    return e;
  }
  function showErrors(form, errors) {
    form.querySelectorAll('[data-err]').forEach((m) => { m.textContent = errors[m.dataset.err] || ''; });
    form.querySelectorAll('input,textarea,select').forEach((i) => i.classList.toggle('invalid', !!errors[i.name]));
  }

  $('#newBtn').onclick = () => { $('#createForm').reset(); showErrors($('#createForm'), {}); $('#createError').textContent = ''; $('#createDlg').showModal(); };
  document.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => b.closest('dialog').close()));

  $('#createForm').onsubmit = async (ev) => {
    ev.preventDefault();
    const form = ev.target;
    const values = Object.fromEntries(new FormData(form));
    const errors = clientValidate(values);
    showErrors(form, errors);
    if (Object.keys(errors).length) return;
    const btn = form.querySelector('.primary'); btn.disabled = true; $('#createError').textContent = '';
    try {
      await api('/tickets', { method: 'POST', body: values });
      $('#createDlg').close(); toast('Ticket created');
      state.page = 1; $('#sort').value = 'newest'; loadList(); loadStats();
    } catch (e) {
      if (e.details) showErrors(form, e.details); else $('#createError').textContent = e.message;
    } finally { btn.disabled = false; }
  };

  // ---- Filters ----
  const reload = () => { state.page = 1; loadList(); };
  let timer;
  $('#q').oninput = () => { clearTimeout(timer); timer = setTimeout(reload, 300); };
  ['status', 'priority', 'sort'].forEach((id) => ($('#' + id).onchange = reload));

  loadStats(); loadList();
})();

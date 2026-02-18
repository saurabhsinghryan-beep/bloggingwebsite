const storageKeys = {
  users: 'soulscript-users',
  blogs: 'soulscript-blogs',
  session: 'soulscript-session',
};

const authForm = document.getElementById('authForm');
const blogForm = document.getElementById('blogForm');
const blogList = document.getElementById('blogList');
const sessionStatus = document.getElementById('sessionStatus');
const editorCard = document.getElementById('editorCard');
const adminCard = document.getElementById('adminCard');
const logoutBtn = document.getElementById('logoutBtn');
const adminFilter = document.getElementById('adminFilter');
const resetEditorBtn = document.getElementById('resetEditor');

const defaultCover =
  'https://images.unsplash.com/photo-1447069387593-a5de0862481e?auto=format&fit=crop&w=1200&q=80';

let users = load(storageKeys.users, []);
let blogs = load(storageKeys.blogs, []);
let session = load(storageKeys.session, null);

init();

function init() {
  renderSession();
  renderBlogs();

  authForm.addEventListener('submit', handleAuth);
  blogForm.addEventListener('submit', handleBlogSave);
  logoutBtn.addEventListener('click', logout);
  adminFilter.addEventListener('change', renderBlogs);
  resetEditorBtn.addEventListener('click', clearEditor);
}

function handleAuth(event) {
  event.preventDefault();
  const mode = event.submitter?.dataset.mode;
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim().toLowerCase();
  const password = document.getElementById('password').value;
  const role = document.getElementById('role').value;

  if (mode === 'register') {
    if (users.some((item) => item.email === email)) {
      alert('User already exists, please login.');
      return;
    }
    const newUser = {
      id: crypto.randomUUID(),
      name,
      email,
      password,
      role,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    save(storageKeys.users, users);
    alert('Profile created. Please login now.');
    authForm.reset();
    return;
  }

  const found = users.find(
    (item) => item.email === email && item.password === password,
  );

  if (!found) {
    alert('Invalid login credentials.');
    return;
  }

  session = {
    id: found.id,
    name: found.name,
    role: found.role,
    email: found.email,
  };
  save(storageKeys.session, session);
  renderSession();
  authForm.reset();
}

function handleBlogSave(event) {
  event.preventDefault();

  if (!session) {
    alert('Please login first.');
    return;
  }

  const editingId = document.getElementById('editingId').value;
  const title = document.getElementById('title').value.trim();
  const theme = document.getElementById('theme').value;
  const imageUrl = document.getElementById('imageUrl').value.trim();
  const content = document.getElementById('content').value.trim();

  if (!title || !content) {
    alert('Title and content are required.');
    return;
  }

  if (editingId) {
    const blog = blogs.find((item) => item.id === editingId);
    if (!blog) {
      alert('Blog not found.');
      return;
    }
    if (!canEdit(blog)) {
      alert('You are not allowed to edit this blog.');
      return;
    }
    blog.title = title;
    blog.theme = theme;
    blog.cover = imageUrl || defaultCover;
    blog.content = content;
    blog.updatedAt = new Date().toISOString();
  } else {
    blogs.unshift({
      id: crypto.randomUUID(),
      title,
      theme,
      cover: imageUrl || defaultCover,
      content,
      authorId: session.id,
      authorName: session.name,
      featured: false,
      createdAt: new Date().toISOString(),
      updatedAt: null,
    });
  }

  save(storageKeys.blogs, blogs);
  clearEditor();
  renderBlogs();
}

function renderSession() {
  if (!session) {
    sessionStatus.textContent = 'No active user. Create profile or login to start posting.';
    editorCard.classList.add('hidden');
    adminCard.classList.add('hidden');
    logoutBtn.classList.add('hidden');
    return;
  }

  const roleLabel = session.role === 'admin' ? 'Admin' : 'Writer';
  sessionStatus.innerHTML = `<strong>${session.name}</strong><br>${session.email}<br>Role: ${roleLabel}`;
  editorCard.classList.remove('hidden');
  logoutBtn.classList.remove('hidden');

  if (session.role === 'admin') {
    adminCard.classList.remove('hidden');
  } else {
    adminCard.classList.add('hidden');
  }

  renderBlogs();
}

function renderBlogs() {
  blogList.innerHTML = '';
  const template = document.getElementById('blogTemplate');

  let filteredBlogs = [...blogs];

  if (session?.role === 'admin' && adminFilter.value !== 'all') {
    filteredBlogs = filteredBlogs.filter((blog) => blog.theme === adminFilter.value);
  }

  filteredBlogs.sort((a, b) => {
    if (a.featured === b.featured) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
    return a.featured ? -1 : 1;
  });

  if (!filteredBlogs.length) {
    blogList.innerHTML = '<p>No blogs yet. Be the first to post your thought.</p>';
    return;
  }

  for (const blog of filteredBlogs) {
    const node = template.content.cloneNode(true);
    const cover = node.querySelector('.blog-cover');
    const tag = node.querySelector('.tag');
    const title = node.querySelector('.blog-title');
    const meta = node.querySelector('.meta');
    const content = node.querySelector('.blog-content');
    const actions = node.querySelector('.blog-actions');

    cover.src = blog.cover || defaultCover;
    tag.textContent = blog.featured ? `⭐ Featured · ${blog.theme}` : blog.theme;
    title.textContent = blog.title;
    meta.textContent = `By ${blog.authorName} · ${formatDate(blog.createdAt)}${
      blog.updatedAt ? ` · Edited ${formatDate(blog.updatedAt)}` : ''
    }`;
    content.textContent = blog.content;

    if (session && canEdit(blog)) {
      const editBtn = makeButton('Edit', () => loadEditor(blog));
      actions.appendChild(editBtn);
    }

    if (session?.role === 'admin') {
      const featureBtn = makeButton(blog.featured ? 'Unfeature' : 'Feature', () => {
        blog.featured = !blog.featured;
        save(storageKeys.blogs, blogs);
        renderBlogs();
      });
      actions.appendChild(featureBtn);

      const deleteBtn = makeButton('Delete', () => {
        const ok = confirm('Delete this blog permanently?');
        if (!ok) return;
        blogs = blogs.filter((item) => item.id !== blog.id);
        save(storageKeys.blogs, blogs);
        renderBlogs();
      });
      deleteBtn.classList.add('danger');
      actions.appendChild(deleteBtn);
    }

    blogList.appendChild(node);
  }
}

function loadEditor(blog) {
  document.getElementById('editingId').value = blog.id;
  document.getElementById('title').value = blog.title;
  document.getElementById('theme').value = blog.theme;
  document.getElementById('imageUrl').value = blog.cover;
  document.getElementById('content').value = blog.content;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function clearEditor() {
  blogForm.reset();
  document.getElementById('editingId').value = '';
}

function logout() {
  session = null;
  localStorage.removeItem(storageKeys.session);
  renderSession();
}

function canEdit(blog) {
  if (!session) return false;
  if (session.role === 'admin') return true;
  return blog.authorId === session.id;
}

function makeButton(text, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.className = 'outline';
  button.addEventListener('click', onClick);
  return button;
}

function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function load(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function formatDate(value) {
  return new Date(value).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

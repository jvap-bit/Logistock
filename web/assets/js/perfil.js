/* ════════════════════════════════════════
   MODAL DE PERFIL — LogiStock
════════════════════════════════════════ */
const P_GUEST = {
  id: null, name: 'Visitante', role: 'Não autenticado', email: '—',
  matricula: '—', cargo: '—', setor: '—', photo: null, active: true
};
let pAccounts = [P_GUEST];

function pInitials(name) {
  const parts = (name || '').split(' ').filter(Boolean);
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase();
}
function pFromDB(uid, u) {
  return {
    id: uid, name: u.nome, role: u.role || 'Usuário LogiStock', email: u.email,
    matricula: u.matricula, cargo: u.cargo, setor: u.setor, photo: u.foto || null,
    active: uid === LogiDB.getSessaoId()
  };
}
function pGetActive() { return pAccounts.find(a => a.active) || pAccounts[0]; }
function pRequireLogin() {
  if (pGetActive().id) return true;
  logiToast('Faça login para alterar seus dados.', 'error');
  return false;
}

/* Carrega contas salvas neste dispositivo a partir do Firebase */
async function pLoadAccounts() {
  if (!window.LogiDB) return;
  const ids = LogiDB.getSavedIds();
  const list = [];
  for (const id of ids) {
    try { const u = await LogiDB.getUsuario(id); if (u) list.push(pFromDB(id, u)); else LogiDB.removerContaSalva(id); }
    catch (e) { console.error(e); }
  }
  if (list.length) {
    pAccounts = list.some(a => a.active) ? list : [P_GUEST, ...list];
  }
  pSyncHeader();
  await pSyncTheme();
}

/* Sincroniza o tema salvo no Firebase */
async function pSyncTheme() {
  const uid = LogiDB.getSessaoId();
  if (!uid) return;
  try {
    const u = await LogiDB.getUsuario(uid);
    const tema = u?.preferencias?.tema;
    if (tema && tema !== localStorage.getItem('logistockTema')) {
      localStorage.setItem('logistockTema', tema);
      if (typeof aplicarTema === 'function') aplicarTema(tema === 'dark');
    }
  } catch (e) { console.error(e); }
}

/* Sync header name */
function pSyncHeader() {
  const acc = pGetActive();
  if (!acc.id) return;
  document.querySelectorAll('.nome-perfil-header').forEach(el => el.textContent = acc.name);
  document.querySelectorAll('.nome-perfil-menu').forEach(el => el.textContent = acc.name);
}
document.addEventListener('DOMContentLoaded', pLoadAccounts);

/* ── Open / Close ── */
async function openProfileModal() {
  await pLoadAccounts();
  pLoadForm();
  pRenderAccounts();
  document.getElementById('overlay-profile').classList.add('open');
  document.querySelectorAll('.ptab-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  document.querySelectorAll('.ptab-panel').forEach((p, i) => p.classList.toggle('active', i === 0));
  pCloseChangePw();
}
function closeProfileModal() {
  document.getElementById('overlay-profile').classList.remove('open');
}
function pHandleOverlay(e) {
  if (e.target === document.getElementById('overlay-profile')) closeProfileModal();
}

/* ── Tabs ── */
function pSwitchTab(id, btn) {
  document.querySelectorAll('.ptab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.ptab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('ptab-' + id).classList.add('active');
}

/* ── Load form ── */
function pLoadForm() {
  const acc = pGetActive();
  document.getElementById('pedit-name').value     = acc.name;
  document.getElementById('pedit-email').value    = acc.email;
  document.getElementById('pedit-matricula').value = acc.matricula;
  document.getElementById('pedit-cargo').value    = acc.cargo;
  document.getElementById('pedit-setor').value    = acc.setor;
  document.getElementById('pheader-name').textContent  = acc.name;
  document.getElementById('pheader-role').textContent  = acc.role;
  document.getElementById('pheader-email').textContent = acc.email;
  pRenderAvLg(document.getElementById('pprofile-av'), acc);
}

function pRenderAvLg(el, acc) {
  el.className = 'pav-lg';
  if (acc.photo) { el.innerHTML = `<img src="${acc.photo}" alt="">`; }
  else { el.textContent = pInitials(acc.name); }
}
function pRenderAvSm(el, acc) {
  el.className = 'pav-sm';
  if (acc.photo) { el.innerHTML = `<img src="${acc.photo}" alt="">`; }
  else { el.textContent = pInitials(acc.name); }
}

/* ── Photo ── */
function pTriggerPhoto() { document.getElementById('pphoto-input').click(); }
function pResizeImage(file, max = 256) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = reject;
    img.src = url;
  });
}
async function pHandlePhoto(e) {
  const f = e.target.files[0]; if (!f) return;
  if (!pRequireLogin()) return;
  try {
    const acc = pGetActive();
    const data = await pResizeImage(f);
    await LogiDB.salvarFoto(acc.id, data);
    acc.photo = data;
    pLoadForm();
    pRenderAccounts();
    logiToast('Foto atualizada!', 'success');
  } catch (err) { console.error(err); logiToast('Não foi possível salvar a foto.', 'error'); }
}

/* ── Save profile ── */
async function pSaveProfile() {
  const name  = document.getElementById('pedit-name').value.trim();
  const email = document.getElementById('pedit-email').value.trim();
  if (!name) { logiToast('O nome não pode ficar vazio.', 'error'); return; }
  if (!email.includes('@')) { logiToast('E-mail inválido.', 'error'); return; }
  if (!pRequireLogin()) return;
  const acc = pGetActive();
  try {
    await LogiDB.atualizarPerfil(acc.id, { nome: name, email });
    acc.name = name;
    acc.email = email.toLowerCase();
    pLoadForm();
    pSyncHeader();
    pRenderAccounts();
    logiToast('Perfil salvo com sucesso!', 'success');
  } catch (err) { logiToast(err.message || 'Erro ao salvar perfil.', 'error'); }
}
function pCancelEdit() { pLoadForm(); }

/* ── Accounts ── */
function pRenderAccounts() {
  const list = document.getElementById('paccounts-list');
  list.innerHTML = '';
  pAccounts.forEach(acc => {
    const div = document.createElement('div');
    div.className = 'paccount-item' + (acc.active ? ' pcurrent' : '');
    const av = document.createElement('div');
    pRenderAvSm(av, acc);
    div.innerHTML = `
      <div class="pacc-info">
        <div class="pacc-name">${acc.name}</div>
        <div class="pacc-sub">${acc.email}</div>
      </div>
      ${acc.active ? '<span class="pacc-badge">Ativa</span>' : ''}
      ${!acc.active ? `<button class="pacc-remove" title="Remover" onclick="pRemoveAcc(event,${acc.id})"><i class="fa-solid fa-xmark"></i></button>` : ''}
    `;
    div.insertBefore(av, div.firstChild);
    if (!acc.active) div.addEventListener('click', () => pSwitchToAcc(acc.id));
    list.appendChild(div);
  });
}
function pSwitchToAcc(id) {
  const acc = pAccounts.find(a => a.id === id); if (!acc) return;
  LogiDB.definirSessao(id, acc.name);
  pAccounts.forEach(a => a.active = (a.id === id));
  pLoadForm(); pSyncHeader(); pRenderAccounts();
  pSyncTheme();
  logiToast('Conta alterada!', 'success');
}
function pRemoveAcc(e, id) {
  e.stopPropagation();
  LogiDB.removerContaSalva(id);
  pAccounts = pAccounts.filter(a => a.id !== id);
  if (!pAccounts.length) pAccounts = [P_GUEST];
  pRenderAccounts();
  logiToast('Conta removida deste dispositivo.');
}
function pGoToLogin() {
  logiToast('Redirecionando para o login…');
  setTimeout(() => { window.location.href = '../../index.html'; }, 800);
}

/* ── Logout ── */
function pConfirmLogout() {
  logiToast('Saindo da conta…');
  setTimeout(() => {
    LogiDB.encerrarSessao();
    closeProfileModal();
    window.location.href = '../../index.html';
  }, 1200);
}

/* ── Change password ── */
function pOpenChangePw() {
  document.getElementById('pconfig-main').style.display = 'none';
  document.getElementById('pconfig-password').classList.add('open');
  ['ppw-current','ppw-new','ppw-confirm'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('ppw-bar').style.width = '0%';
  document.getElementById('ppw-hint').textContent = 'Digite uma nova senha';
  document.getElementById('ppw-hint').style.color = '';
}
function pCloseChangePw() {
  document.getElementById('pconfig-main').style.display = '';
  document.getElementById('pconfig-password').classList.remove('open');
}
function pCheckPwStrength(v) {
  let s = 0;
  if (v.length >= 8) s++;
  if (/[A-Z]/.test(v)) s++;
  if (/[0-9]/.test(v)) s++;
  if (/[^A-Za-z0-9]/.test(v)) s++;
  const L = [
    {p:'0%',  c:'transparent',      t:'Digite uma nova senha'},
    {p:'25%', c:'#dc2626',          t:'Fraca — inclua números e letras'},
    {p:'50%', c:'#d97706',          t:'Razoável — adicione caracteres especiais'},
    {p:'75%', c:'#2563eb',          t:'Boa — quase lá!'},
    {p:'100%',c:'#16a34a',          t:'Forte — ótima senha!'},
  ];
  const lv = v.length === 0 ? 0 : s;
  const lvl = L[lv];
  const bar = document.getElementById('ppw-bar');
  const hint = document.getElementById('ppw-hint');
  bar.style.width = lvl.p; bar.style.background = lvl.c;
  hint.textContent = lvl.t; hint.style.color = lvl.c === 'transparent' ? '' : lvl.c;
}
async function pSavePw() {
  const cur   = document.getElementById('ppw-current').value;
  const nw    = document.getElementById('ppw-new').value;
  const conf  = document.getElementById('ppw-confirm').value;
  if (!cur) { logiToast('Informe a senha atual.', 'error'); return; }
  if (nw.length < 8) { logiToast('A nova senha deve ter pelo menos 8 caracteres.', 'error'); return; }
  if (nw !== conf) { logiToast('As senhas não conferem.', 'error'); return; }
  if (!pRequireLogin()) return;
  try {
    await LogiDB.alterarSenha(pGetActive().id, cur, nw);
    logiToast('Senha atualizada com sucesso!', 'success');
    pCloseChangePw();
  } catch (err) { logiToast(err.message || 'Erro ao alterar a senha.', 'error'); }
}

/* ── Toast ── */
function logiToast(msg, type = 'success') {
  let toast = document.getElementById('logi-toast-el');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'logi-toast-el';
    toast.className = 'logi-toast';
    document.body.appendChild(toast);
  }
  const icon = type === 'error' ? 'fa-circle-xmark' : 'fa-circle-check';
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> ${msg}`;
  toast.className = `logi-toast ${type}`;
  requestAnimationFrame(() => { requestAnimationFrame(() => toast.classList.add('show')); });
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 2800);
}

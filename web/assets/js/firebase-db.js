/* ════════════════════════════════════════════════════════════
   LogiDB — camada de acesso ao Firebase Realtime Database
   Estrutura do banco:
     usuarios/{uid}            → perfil (nome, email, matrícula, cargo, setor, foto, preferencias)
     credenciais/{uid}         → { salt, hash }  (senha nunca é salva em texto puro)
     emails/{emailKey}         → uid             (índice para login e e-mail único)
     meta/contadorMatricula    → número
     avaliacoes/{id}           → avaliações do site
     propostas/{id}            → formulário "Junte-se a nós"
     contatos/{id}             → formulário de contato (Sobre nós)
     consultasRastreio/{id}    → consultas de rastreamento
     cotacoesFrete/{id}        → cotações de frete
     chats/{uid|deviceId}/{id} → histórico do chatbot
     pedidos/{OP}              → pedidos (consultados pelo leitor de QR Code)
     leituras/{id}             → leituras de QR Code feitas pelo entregador
════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  if (typeof firebase === 'undefined') {
    console.error('[LogiDB] SDK do Firebase não carregou.');
    return;
  }
  const cfg = window.FIREBASE_CONFIG || {};
  const configurado = cfg.apiKey && cfg.apiKey !== 'COLE_AQUI';
  if (!configurado) console.warn('[LogiDB] Preencha web/assets/js/firebase-config.js com os dados do seu projeto.');

  if (!firebase.apps.length) firebase.initializeApp(cfg);
  const db = firebase.database();
  const TS = firebase.database.ServerValue.TIMESTAMP;

  /* ── Sessão (apenas ponteiros no navegador; os dados ficam no Firebase) ── */
  const K_ID = 'usuarioId', K_NOME = 'usuarioLogado', K_SAVED = 'logistock_saved_ids', K_DEV = 'logistock_device_id';

  function getSessaoId() { return localStorage.getItem(K_ID); }
  function getSavedIds() { try { return JSON.parse(localStorage.getItem(K_SAVED)) || []; } catch { return []; } }
  function setSavedIds(a) { localStorage.setItem(K_SAVED, JSON.stringify(a)); }
  function definirSessao(uid, nome) {
    localStorage.setItem(K_ID, uid);
    localStorage.setItem(K_NOME, nome);
    const ids = getSavedIds();
    if (!ids.includes(uid)) { ids.push(uid); setSavedIds(ids); }
  }
  function encerrarSessao() { localStorage.removeItem(K_ID); localStorage.removeItem(K_NOME); }
  function removerContaSalva(uid) { setSavedIds(getSavedIds().filter(i => i !== uid)); }
  function deviceId() {
    let d = localStorage.getItem(K_DEV);
    if (!d) { d = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(K_DEV, d); }
    return d;
  }

  /* ── Utilitários ── */
  const chave = s => encodeURIComponent(String(s).trim().toLowerCase()).replace(/\./g, '%2E');
  const chaveOP = s => encodeURIComponent(String(s).trim()).replace(/\./g, '%2E');
  const valor = async path => (await db.ref(path).once('value')).val();

  function salt() {
    const a = new Uint8Array(16); crypto.getRandomValues(a);
    return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
  }
  async function sha256(txt) {
    if (!(window.crypto && crypto.subtle)) throw new Error('Abra o site por HTTPS ou localhost para usar o login.');
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
    return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
  }
  async function proximaMatricula() {
    const r = await db.ref('meta/contadorMatricula').transaction(n => (n || 0) + 1);
    return 'LOG-' + String(r.snapshot.val()).padStart(6, '0');
  }
  function push(path, dados) {
    return db.ref(path).push({ ...dados, criadoEm: TS });
  }
  const limpa = o => JSON.parse(JSON.stringify(o)); // remove undefined

  /* ── Contas ── */
  async function cadastrar({ nome, email, senha }) {
    nome = nome.trim(); email = email.trim().toLowerCase();
    if (senha.length < 8) throw new Error('A senha deve ter no mínimo 8 caracteres.');
    const uid = db.ref('usuarios').push().key;
    const matricula = await proximaMatricula();
    const s = salt(), h = await sha256(s + senha);

    const claim = await db.ref('emails/' + chave(email)).transaction(cur => (cur === null ? uid : undefined));
    if (!claim.committed) throw new Error('Este e-mail já está cadastrado.');

    await db.ref('credenciais/' + uid).set({ salt: s, hash: h });
    await db.ref('usuarios/' + uid).set({
      nome, email, matricula, cargo: 'Usuário', setor: 'Logística', role: 'Usuário LogiStock',
      foto: null, preferencias: { tema: 'light' }, criadoEm: TS, ultimoLogin: TS
    });
    return uid;
  }

  async function login(email, senha) {
    const erro = new Error('E-mail ou senha incorretos.');
    const uid = await valor('emails/' + chave(email));
    if (!uid) throw erro;
    const [cred, user] = await Promise.all([valor('credenciais/' + uid), valor('usuarios/' + uid)]);
    if (!cred || !user) throw erro;
    if ((await sha256(cred.salt + senha)) !== cred.hash) throw erro;
    definirSessao(uid, user.nome);
    db.ref('usuarios/' + uid + '/ultimoLogin').set(TS);
    if (user.preferencias && user.preferencias.tema) localStorage.setItem('logistockTema', user.preferencias.tema);
    return uid;
  }

  const getUsuario = uid => valor('usuarios/' + uid);

  async function atualizarPerfil(uid, { nome, email }) {
    const atual = await getUsuario(uid);
    if (!atual) throw new Error('Usuário não encontrado.');
    email = email.trim().toLowerCase();
    if (email !== atual.email) {
      const claim = await db.ref('emails/' + chave(email)).transaction(c => (c === null ? uid : undefined));
      if (!claim.committed) throw new Error('Este e-mail já está em uso.');
      await db.ref('emails/' + chave(atual.email)).remove();
    }
    await db.ref('usuarios/' + uid).update({ nome: nome.trim(), email });
    if (getSessaoId() === uid) localStorage.setItem(K_NOME, nome.trim());
  }

  const salvarFoto = (uid, dataUrl) => db.ref('usuarios/' + uid + '/foto').set(dataUrl);

  async function alterarSenha(uid, atual, nova) {
    const cred = await valor('credenciais/' + uid);
    if (!cred || (await sha256(cred.salt + atual)) !== cred.hash) throw new Error('Senha atual incorreta.');
    const s = salt();
    await db.ref('credenciais/' + uid).set({ salt: s, hash: await sha256(s + nova) });
  }

  /* ── Tema ── */
  function salvarTema(tema) {
    const uid = getSessaoId();
    if (uid) db.ref('usuarios/' + uid + '/preferencias/tema').set(tema).catch(() => {});
  }

  /* ── Formulários do site ── */
  const autor = () => ({ uid: getSessaoId() || null, usuario: localStorage.getItem(K_NOME) || null });

  const salvarAvaliacao = (nota, feedback) => push('avaliacoes', limpa({ nota, feedback, ...autor() }));
  const salvarProposta = d => push('propostas', limpa({ ...d, ...autor(), status: 'novo' }));
  const salvarContato = d => push('contatos', limpa({ ...d, ...autor() }));
  const salvarConsultaRastreio = (codigo, resultado) => push('consultasRastreio', limpa({ codigo, resultado, ...autor() }));
  const salvarCotacaoFrete = d => push('cotacoesFrete', limpa({ ...d, ...autor() }));

  /* ── Chatbot ── */
  const chatPath = () => 'chats/' + (getSessaoId() || deviceId());
  const salvarMensagemChat = (papel, texto) => push(chatPath(), { papel, texto });
  async function carregarChat(limite) {
    const snap = await db.ref(chatPath()).orderByChild('criadoEm').limitToLast(limite || 30).once('value');
    const out = []; snap.forEach(c => { out.push(c.val()); });
    return out;
  }

  /* ── Pedidos / QR Code ── */
  async function buscarPedido(op) {
    const p = await valor('pedidos/' + chaveOP(op));
    return p ? { encontrado: true, numero: op, ...p } : { encontrado: false };
  }
  const registrarLeitura = (op, encontrado) => push('leituras', limpa({ op, encontrado, ...autor() }));

  window.LogiDB = {
    db, configurado,
    getSessaoId, getSavedIds, definirSessao, encerrarSessao, removerContaSalva,
    cadastrar, login, getUsuario, atualizarPerfil, salvarFoto, alterarSenha,
    salvarTema, salvarAvaliacao, salvarProposta, salvarContato,
    salvarConsultaRastreio, salvarCotacaoFrete,
    salvarMensagemChat, carregarChat, buscarPedido, registrarLeitura
  };
})();

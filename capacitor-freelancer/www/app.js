// ============================================================
// Agência Rodrigues Freelancer — App do Freelancer
// ============================================================
const API_BASE = (window.CONFIG && window.CONFIG.API_BASE) || 'http://localhost:3000/api';
let TOKEN = localStorage.getItem('ar_freela_token') || null;
let PERFIL = JSON.parse(localStorage.getItem('ar_freela_perfil') || 'null');
let ULTIMA_LOCALIZACAO = null;

function apiUrl(p){ return API_BASE + p; }
async function api(metodo, caminho, corpo, isFormData=false){
  const headers = {};
  if (TOKEN) headers['Authorization'] = 'Bearer ' + TOKEN;
  if (!isFormData && corpo) headers['Content-Type'] = 'application/json';
  const resp = await fetch(apiUrl(caminho), {
    method: metodo, headers,
    body: corpo ? (isFormData ? corpo : JSON.stringify(corpo)) : undefined
  });
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(dados.erro || 'Erro na requisição');
  return dados;
}
function urlFoto(caminho){
  if (!caminho) return '';
  return API_BASE.replace(/\/api$/, '') + caminho;
}

// ---------------- CHECKLIST DE ÁREAS (cadastro) ----------------
function popularChecklistAreas(){
  const container = document.getElementById('cad-areas-lista');
  if (!container || !window.AREAS_ATUACAO) return;
  container.innerHTML = window.AREAS_ATUACAO.map(a => `
    <label class="area-item">
      <input type="checkbox" class="chk-area" value="${a.id}"> ${a.label}
    </label>
  `).join('');
}

// ---------------- GEOLOCALIZAÇÃO — pedida desde a primeira abertura ----------------
function pedirLocalizacaoContinua(){
  if (!navigator.geolocation) return;
  navigator.geolocation.watchPosition(
    (pos) => {
      ULTIMA_LOCALIZACAO = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      if (TOKEN) enviarLocalizacao();
    },
    (err) => console.warn('Localização indisponível:', err.message),
    { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
  );
}
let ultimoEnvioLocalizacao = 0;
async function enviarLocalizacao(){
  const agora = Date.now();
  if (agora - ultimoEnvioLocalizacao < 20000) return; // no máx a cada 20s
  ultimoEnvioLocalizacao = agora;
  try{ await api('POST', '/freelancer/localizacao', ULTIMA_LOCALIZACAO); }catch(e){}
}
function pegarLocalizacaoUmaVez(){
  return new Promise((resolve, reject) => {
    if (ULTIMA_LOCALIZACAO) return resolve(ULTIMA_LOCALIZACAO);
    if (!navigator.geolocation) return reject(new Error('Este dispositivo não suporta localização.'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => reject(new Error('Não foi possível obter sua localização. Ative o GPS e conceda a permissão.')),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });
}

// ---------------- PUSH NOTIFICATIONS REAIS (quando rodando como app Android nativo) ----------------
// No navegador comum isso é ignorado sem erro; dentro do app gerado pelo
// Capacitor (window.Capacitor presente), registra o token do celular no
// Firebase e envia para o backend salvar.
async function configurarPushNativo(){
  if (!window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.PushNotifications) return;
  const { PushNotifications } = window.Capacitor.Plugins;
  try{
    let permissao = await PushNotifications.checkPermissions();
    if (permissao.receive !== 'granted') permissao = await PushNotifications.requestPermissions();
    if (permissao.receive !== 'granted') return;
    await PushNotifications.register();
    PushNotifications.addListener('registration', async (token) => {
      try{ await api('POST', '/freelancer/push-token', { token: token.value }); }catch(e){}
    });
    PushNotifications.addListener('pushNotificationReceived', () => carregarNotificacoes());
  }catch(e){ console.warn('Push nativo indisponível:', e.message); }
}

// ---------------- FLUXO INICIAL ----------------
window.addEventListener('load', () => {
  popularChecklistAreas();
  pedirLocalizacaoContinua(); // pede permissão logo na primeira abertura
  setTimeout(iniciar, 900);
});

async function iniciar(){
  document.getElementById('tela-splash').classList.add('escondido');
  if (TOKEN){
    try{
      PERFIL = await api('GET', '/freelancer/perfil');
      localStorage.setItem('ar_freela_perfil', JSON.stringify(PERFIL));
      mostrarApp();
      return;
    }catch(e){ localStorage.removeItem('ar_freela_token'); TOKEN = null; }
  }
  document.getElementById('tela-login').classList.remove('escondido');
}

// ---------------- LOGIN / CADASTRO ----------------
document.getElementById('link-cadastro').onclick = (e) => { e.preventDefault(); trocarTela('tela-login','tela-cadastro'); };
document.getElementById('link-login').onclick = (e) => { e.preventDefault(); trocarTela('tela-cadastro','tela-login'); };
function trocarTela(de, para){
  document.getElementById(de).classList.add('escondido');
  document.getElementById(para).classList.remove('escondido');
}

document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  try{
    const r = await api('POST', '/freelancer/login', {
      identificador: document.getElementById('login-identificador').value,
      senha: document.getElementById('login-senha').value
    });
    TOKEN = r.token;
    localStorage.setItem('ar_freela_token', TOKEN);
    document.getElementById('tela-login').classList.add('escondido');
    document.getElementById('tela-carregando-conta').classList.remove('escondido');
    PERFIL = await api('GET', '/freelancer/perfil');
    localStorage.setItem('ar_freela_perfil', JSON.stringify(PERFIL));
    setTimeout(() => {
      document.getElementById('tela-carregando-conta').classList.add('escondido');
      mostrarApp();
    }, 700);
  }catch(err){
    const el = document.getElementById('login-erro');
    el.textContent = err.message; el.classList.remove('escondido');
  }
});

document.getElementById('form-cadastro').addEventListener('submit', async (e) => {
  e.preventDefault();
  const areasSelecionadas = [...document.querySelectorAll('.chk-area:checked')].map(c => c.value);
  if (!areasSelecionadas.length){
    const el = document.getElementById('cadastro-erro');
    el.textContent = 'Selecione ao menos uma área de atuação.'; el.classList.remove('escondido');
    return;
  }
  try{
    const r = await api('POST', '/freelancer/registrar', {
      nome: document.getElementById('cad-nome').value,
      cpf: document.getElementById('cad-cpf').value,
      email: document.getElementById('cad-email').value,
      telefone: document.getElementById('cad-telefone').value,
      endereco: document.getElementById('cad-endereco').value,
      areas: areasSelecionadas,
      senha: document.getElementById('cad-senha').value
    });
    TOKEN = r.token;
    localStorage.setItem('ar_freela_token', TOKEN);
    PERFIL = await api('GET', '/freelancer/perfil');
    localStorage.setItem('ar_freela_perfil', JSON.stringify(PERFIL));
    document.getElementById('tela-cadastro').classList.add('escondido');
    mostrarTelaAvisoKit(areasSelecionadas);
  }catch(err){
    const el = document.getElementById('cadastro-erro');
    el.textContent = err.message; el.classList.remove('escondido');
  }
});

// ---------------- TELA ANIMADA — AVISO DE KIT OBRIGATÓRIO ----------------
function mostrarTelaAvisoKit(areasIds){
  const mapa = Object.fromEntries((window.AREAS_ATUACAO || []).map(a => [a.id, a]));
  const lista = document.getElementById('lista-kits');
  lista.innerHTML = areasIds.map((id, i) => {
    const a = mapa[id];
    if (!a) return '';
    return `<div class="kit-linha" style="animation-delay:${i * 0.08}s"><strong>${a.label}</strong><span>${a.kit}</span></div>`;
  }).join('');
  document.getElementById('chk-confirmo-kit').checked = false;
  document.getElementById('btn-confirmar-kit').disabled = true;
  document.getElementById('tela-aviso-kit').classList.remove('escondido');
}
document.getElementById('chk-confirmo-kit').onchange = (e) => {
  document.getElementById('btn-confirmar-kit').disabled = !e.target.checked;
};
document.getElementById('btn-confirmar-kit').onclick = () => {
  document.getElementById('tela-aviso-kit').classList.add('escondido');
  mostrarApp();
};

// ---------------- APP PRINCIPAL ----------------
async function mostrarApp(){
  document.getElementById('app').classList.remove('escondido');
  document.getElementById('topo-nome').textContent = 'Olá, ' + PERFIL.nome.split(' ')[0] + '!';
  const statusEl = document.getElementById('topo-status');
  statusEl.textContent = PERFIL.status;
  document.getElementById('aviso-pendente').classList.toggle('escondido', PERFIL.status !== 'pendente');
  carregarConvites();
  carregarNotificacoes();
  configurarPushNativo();
  if (ULTIMA_LOCALIZACAO) enviarLocalizacao();
  setInterval(carregarNotificacoes, 25000);
  setInterval(carregarConvites, 30000);
}

// TABS
document.querySelectorAll('.tab-item').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('ativo'));
    tab.classList.add('ativo');
    const secTitulo = document.querySelector('.secao-titulo');
    if (tab.dataset.tab === 'convites'){ carregarConvites(); }
    if (tab.dataset.tab === 'extrato'){ mostrarExtrato(); }
    if (tab.dataset.tab === 'perfil'){ mostrarPerfil(); }
  };
});

// ---------------- CONVITES / ESCALAS ----------------
async function carregarConvites(){
  if (document.querySelector('.tab-item.ativo').dataset.tab !== 'convites') return;
  const convites = await api('GET', '/freelancer/convites');

  // bloco ativo: próximo evento aceito e ainda não concluído
  const ativo = convites.find(c => c.status_convite === 'aceito' && c.status_ponto !== 'concluido');
  document.getElementById('bloco-ativo').innerHTML = ativo ? renderBlocoAtivo(ativo) : '';
  if (ativo) ligarBotaoAtivo(ativo);

  document.getElementById('lista-convites').innerHTML = convites.length ? convites.map(c => renderConviteCard(c)).join('') : '<p class="texto-suave">Você ainda não recebeu nenhuma escala.</p>';
  convites.forEach(c => {
    if (c.status_convite === 'pendente'){
      document.getElementById(`aceitar-${c.convite_id}`)?.addEventListener('click', () => responderConvite(c.convite_id, 'aceitar'));
      document.getElementById(`recusar-${c.convite_id}`)?.addEventListener('click', () => responderConvite(c.convite_id, 'recusar'));
    }
  });
}

function renderConviteCard(c){
  const statusClasse = { pendente:'sp-pendente', aceito:'sp-aceito', recusado:'sp-recusado' }[c.status_convite];
  return `
    <div class="convite-card">
      <h4>${c.titulo}</h4>
      <div class="convite-empresa">${c.nome_empresa}</div>
      <div class="convite-linha">📅 ${formatarData(c.data)} · ${c.hora_inicio}–${c.hora_fim}</div>
      <div class="convite-linha">📍 ${c.endereco}</div>
      ${c.uniforme ? `<div class="convite-linha">👔 ${c.uniforme}</div>` : ''}
      <div class="convite-tags">
        <span class="status-pill ${statusClasse}">${c.status_convite}</span>
        ${c.status_ponto === 'presente' ? '<span class="tag">✓ check-in feito</span>' : ''}
        ${c.status_ponto === 'concluido' ? '<span class="tag">✓ jornada concluída</span>' : ''}
      </div>
      ${c.status_convite === 'pendente' ? `
        <div class="convite-acoes">
          <button class="btn btn-fantasma" id="recusar-${c.convite_id}">Recusar</button>
          <button class="btn btn-ouro" id="aceitar-${c.convite_id}">Aceitar escala</button>
        </div>
      ` : ''}
    </div>
  `;
}

function renderBlocoAtivo(c){
  const jaCheckin = !!c.checkin_em;
  return `
    <div class="bloco-ativo-card">
      <h3>${c.titulo}</h3>
      <p>${c.nome_empresa} · ${formatarData(c.data)} · ${c.hora_inicio}–${c.hora_fim}</p>
      <p>📍 ${c.endereco}</p>
      <button class="btn btn-ouro" id="btn-acao-ponto">${jaCheckin ? '⏻ Fazer check-out' : '📸 Fazer check-in'}</button>
    </div>
  `;
}
function ligarBotaoAtivo(c){
  document.getElementById('btn-acao-ponto').onclick = () => abrirCamera(c);
}

async function responderConvite(id, acao){
  try{
    await api('POST', `/convites/${id}/${acao}`);
    carregarConvites();
  }catch(e){ alert(e.message); }
}
function formatarData(iso){
  const [a,m,d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

// ---------------- CHECK-IN / CHECK-OUT COM CÂMERA ----------------
let streamAtual = null;
let fotoBlobAtual = null;
let conviteAtualCamera = null;

async function abrirCamera(convite){
  conviteAtualCamera = convite;
  const jaCheckin = !!convite.checkin_em;
  document.getElementById('camera-titulo').textContent = jaCheckin ? 'Check-out' : 'Check-in';
  document.getElementById('camera-sub').textContent = jaCheckin
    ? 'Tire uma selfie para confirmar o fim da sua jornada.'
    : 'Tire uma selfie para confirmar sua presença no local. Você precisa estar a até ' + (convite.raio_checkin_m || 100) + 'm do evento.';
  document.getElementById('camera-status').textContent = '';
  document.getElementById('video-camera').classList.remove('escondido');
  document.getElementById('foto-preview').classList.add('escondido');
  document.getElementById('btn-tirar-foto').classList.remove('escondido');
  document.getElementById('btn-confirmar-foto').classList.add('escondido');
  fotoBlobAtual = null;
  document.getElementById('modal-camera').classList.remove('escondido');

  try{
    streamAtual = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    document.getElementById('video-camera').srcObject = streamAtual;
  }catch(err){
    document.getElementById('camera-status').textContent = 'Não foi possível acessar a câmera. Verifique as permissões do navegador/app.';
  }
}
function pararCamera(){
  if (streamAtual){ streamAtual.getTracks().forEach(t => t.stop()); streamAtual = null; }
}
document.getElementById('btn-cancelar-camera').onclick = () => {
  pararCamera();
  document.getElementById('modal-camera').classList.add('escondido');
};

document.getElementById('btn-tirar-foto').onclick = () => {
  const video = document.getElementById('video-camera');
  const canvas = document.getElementById('canvas-camera');
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  canvas.toBlob((blob) => {
    fotoBlobAtual = blob;
    document.getElementById('foto-preview').src = URL.createObjectURL(blob);
    document.getElementById('foto-preview').classList.remove('escondido');
    document.getElementById('video-camera').classList.add('escondido');
    document.getElementById('btn-tirar-foto').classList.add('escondido');
    document.getElementById('btn-confirmar-foto').classList.remove('escondido');
    pararCamera();
  }, 'image/jpeg', 0.85);
};

document.getElementById('btn-confirmar-foto').onclick = async () => {
  const statusEl = document.getElementById('camera-status');
  statusEl.textContent = '📍 Verificando sua localização...';
  document.getElementById('btn-confirmar-foto').disabled = true;
  try{
    const loc = await pegarLocalizacaoUmaVez();
    const jaCheckin = !!conviteAtualCamera.checkin_em;
    const formData = new FormData();
    formData.append('foto', fotoBlobAtual, 'foto.jpg');
    formData.append('latitude', loc.latitude);
    formData.append('longitude', loc.longitude);
    statusEl.textContent = jaCheckin ? 'Enviando check-out...' : 'Enviando check-in...';
    const rota = jaCheckin ? 'checkout' : 'checkin';
    const r = await api('POST', `/convites/${conviteAtualCamera.convite_id}/${rota}`, formData, true);
    document.getElementById('modal-camera').classList.add('escondido');
    if (!jaCheckin) alert(`Check-in confirmado! Você está a ${r.distancia_m}m do local. ✅`);
    else alert(`Check-out confirmado! Você trabalhou ${r.horas_trabalhadas}h nesta escala. ✅`);
    carregarConvites();
  }catch(err){
    statusEl.textContent = '❌ ' + err.message;
  }
  document.getElementById('btn-confirmar-foto').disabled = false;
};

// ---------------- NOTIFICAÇÕES ----------------
async function carregarNotificacoes(){
  if (!TOKEN) return;
  try{
    const notifs = await api('GET', '/freelancer/notificacoes');
    const naoLidas = notifs.filter(n => !n.lida).length;
    document.getElementById('bolinha-notif').classList.toggle('escondido', naoLidas === 0);
    document.getElementById('lista-notif').innerHTML = notifs.length ? notifs.map(n => `
      <div class="notif-item ${n.lida ? '' : 'nao-lida'}">
        <strong>${n.titulo}</strong>
        <p>${n.mensagem}</p>
        <span class="notif-hora">${horaRelativa(n.criado_em)}</span>
      </div>
    `).join('') : '<p class="texto-suave" style="padding:16px">Nenhuma notificação ainda.</p>';
  }catch(e){}
}
function horaRelativa(iso){
  const diffMin = Math.round((Date.now() - new Date(iso + 'Z')) / 60000);
  if (diffMin < 1) return 'agora mesmo';
  if (diffMin < 60) return `há ${diffMin} min`;
  if (diffMin < 1440) return `há ${Math.round(diffMin/60)}h`;
  return `há ${Math.round(diffMin/1440)}d`;
}
document.getElementById('btn-sino').onclick = async () => {
  document.getElementById('painel-notif').classList.remove('escondido');
  const notifs = await api('GET', '/freelancer/notificacoes');
  await Promise.all(notifs.filter(n => !n.lida).map(n => api('POST', `/freelancer/notificacoes/${n.id}/lida`)));
  document.getElementById('bolinha-notif').classList.add('escondido');
};
document.getElementById('fechar-notif').onclick = () => document.getElementById('painel-notif').classList.add('escondido');

// ---------------- EXTRATO ----------------
async function mostrarExtrato(){
  const convites = await api('GET', '/freelancer/convites');
  const concluidos = convites.filter(c => c.status_ponto === 'concluido');
  document.getElementById('bloco-ativo').innerHTML = '';
  document.getElementById('lista-convites').innerHTML = concluidos.length ? `
    <div class="convite-card" style="text-align:center">
      <div class="convite-empresa">Total de eventos concluídos</div>
      <h4 style="font-size:32px">${concluidos.length}</h4>
    </div>
  ` + concluidos.map(c => `
    <div class="convite-card">
      <h4>${c.titulo}</h4>
      <div class="convite-empresa">${c.nome_empresa} · ${formatarData(c.data)}</div>
      <div class="convite-linha">✓ Jornada concluída</div>
    </div>
  `).join('') : '<p class="texto-suave">Nenhum evento concluído ainda. Seu histórico aparece aqui após cada check-out.</p>';
}

// ---------------- PERFIL ----------------
async function mostrarPerfil(){
  document.getElementById('bloco-ativo').innerHTML = '';
  document.getElementById('lista-convites').innerHTML = `
    <div class="perfil-bloco">
      <div class="nota">${PERFIL.nota_media ? '⭐ ' + PERFIL.nota_media.toFixed(1) : 'Sem avaliações ainda'}</div>
      <div class="texto-suave" style="font-size:12.5px; margin-top:4px">${PERFIL.total_avaliacoes || 0} avaliação(ões)</div>
    </div>
    <div class="convite-card">
      <div class="linha-info"><span>Nome</span><strong>${PERFIL.nome}</strong></div>
      <div class="linha-info"><span>Áreas</span><strong style="text-align:right; max-width:60%">${(PERFIL.areas||[]).map(id => (window.AREAS_ATUACAO||[]).find(a=>a.id===id)?.label || id).join(', ') || PERFIL.funcao}</strong></div>
      <div class="linha-info"><span>Email</span><strong>${PERFIL.email}</strong></div>
      <div class="linha-info"><span>WhatsApp</span><strong>${PERFIL.telefone || '—'}</strong></div>
      <div class="linha-info"><span>Endereço</span><strong style="text-align:right; max-width:60%">${PERFIL.endereco || '—'}</strong></div>
      <div class="linha-info"><span>Status</span><strong style="text-transform:capitalize">${PERFIL.status}</strong></div>
    </div>
    <button class="btn btn-fantasma" style="width:100%; margin-top:8px" id="btn-sair-freela">Sair da conta</button>
  `;
  document.getElementById('btn-sair-freela').onclick = () => {
    localStorage.removeItem('ar_freela_token');
    localStorage.removeItem('ar_freela_perfil');
    location.reload();
  };
}

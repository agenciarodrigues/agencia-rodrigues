// ============================================================
// Agência Rodrigues Freelancer — Painel de Gestão
// ============================================================
const API_BASE = (window.CONFIG && window.CONFIG.API_BASE) || 'http://localhost:3000/api';

let TOKEN = localStorage.getItem('ar_gestor_token') || null;
let GESTOR = JSON.parse(localStorage.getItem('ar_gestor_dados') || 'null');

function apiUrl(p){ return API_BASE + p; }

// Mesma blindagem do app do freelancer: o servidor gratuito pode "dormir"
// e demorar a acordar — timeout generoso + retry automático antes de
// mostrar erro de verdade pro gestor.
async function api(metodo, caminho, corpo, isFormData=false, tentativa=1){
  const headers = {};
  if (TOKEN) headers['Authorization'] = 'Bearer ' + TOKEN;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const controlador = new AbortController();
  const timeoutId = setTimeout(() => controlador.abort(), 45000);

  try{
    const resp = await fetch(apiUrl(caminho), {
      method: metodo,
      headers,
      body: corpo ? (isFormData ? corpo : JSON.stringify(corpo)) : undefined,
      signal: controlador.signal
    });
    clearTimeout(timeoutId);
    const dados = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(dados.erro || 'Erro na requisição');
    return dados;
  }catch(err){
    clearTimeout(timeoutId);
    const eDeConexao = err.name === 'AbortError' || err.message === 'Failed to fetch' || err.message.includes('fetch');
    if (eDeConexao && tentativa < 3){
      await new Promise(r => setTimeout(r, 2000));
      return api(metodo, caminho, corpo, isFormData, tentativa + 1);
    }
    if (eDeConexao){
      throw new Error('Não foi possível conectar ao servidor. Tente novamente em alguns segundos.');
    }
    throw err;
  }
}
function acordarServidor(){ fetch(apiUrl('/health')).catch(() => {}); }
acordarServidor();

function urlFoto(caminho){
  if (!caminho) return '';
  const base = API_BASE.replace(/\/api$/, '');
  return base + caminho;
}

// ---------------- LOGIN / CADASTRO ----------------
const telaLogin = document.getElementById('tela-login');
const appEl = document.getElementById('app');

document.getElementById('link-mostrar-cadastro').onclick = (e) => {
  e.preventDefault();
  document.getElementById('form-login').classList.add('escondido');
  document.getElementById('form-cadastro-gestor').classList.remove('escondido');
};
document.getElementById('link-mostrar-login').onclick = (e) => {
  e.preventDefault();
  document.getElementById('form-cadastro-gestor').classList.add('escondido');
  document.getElementById('form-login').classList.remove('escondido');
};

function mostrarErroLogin(msg){
  const el = document.getElementById('login-erro');
  el.textContent = msg;
  el.classList.remove('escondido');
}

document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  try{
    const r = await api('POST', '/gestor/login', {
      email: document.getElementById('login-email').value,
      senha: document.getElementById('login-senha').value
    });
    TOKEN = r.token; GESTOR = r.gestor;
    localStorage.setItem('ar_gestor_token', TOKEN);
    localStorage.setItem('ar_gestor_dados', JSON.stringify(GESTOR));
    await mostrarLoadingEIniciar();
  }catch(err){ mostrarErroLogin(err.message); }
});

document.getElementById('form-cadastro-gestor').addEventListener('submit', async (e) => {
  e.preventDefault();
  try{
    const r = await api('POST', '/gestor/registrar', {
      nome: document.getElementById('cad-nome').value,
      email: document.getElementById('cad-email').value,
      senha: document.getElementById('cad-senha').value
    });
    TOKEN = r.token; GESTOR = r.gestor;
    localStorage.setItem('ar_gestor_token', TOKEN);
    localStorage.setItem('ar_gestor_dados', JSON.stringify(GESTOR));
    await mostrarLoadingEIniciar();
  }catch(err){ mostrarErroLogin(err.message); }
});

async function mostrarLoadingEIniciar(){
  telaLogin.classList.add('escondido');
  document.getElementById('tela-carregando-conta').classList.remove('escondido');
  await new Promise(r => setTimeout(r, 700));
  document.getElementById('tela-carregando-conta').classList.add('escondido');
  iniciarApp();
}

document.getElementById('btn-sair').onclick = () => {
  localStorage.removeItem('ar_gestor_token');
  localStorage.removeItem('ar_gestor_dados');
  TOKEN = null; GESTOR = null;
  appEl.classList.add('escondido');
  telaLogin.classList.remove('escondido');
};

// ---------------- NAVEGAÇÃO ----------------
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('ativo'));
    btn.classList.add('ativo');
    document.querySelectorAll('.tela').forEach(t => t.classList.add('escondido'));
    document.getElementById('tela-' + btn.dataset.tela).classList.remove('escondido');
    document.querySelector('.sidebar').classList.remove('aberta');
    carregarTela(btn.dataset.tela);
  };
});
document.getElementById('btn-menu-mobile').onclick = () => {
  document.querySelector('.sidebar').classList.toggle('aberta');
};

function carregarTela(nome){
  if (nome === 'dashboard') carregarDashboard();
  if (nome === 'restaurantes') carregarRestaurantes();
  if (nome === 'freelancers') carregarFreelancers();
  if (nome === 'escalas') carregarEscalas();
  if (nome === 'avisos') carregarAvisos();
  if (nome === 'mapa') carregarSelectMapa();
  if (nome === 'relatorios') carregarSelectRelatorio();
}

function iniciarApp(){
  telaLogin.classList.add('escondido');
  appEl.classList.remove('escondido');
  carregarDashboard();
}

// ---------------- MODAL genérico ----------------
const modalFundo = document.getElementById('modal-fundo');
const modalCaixa = document.getElementById('modal-caixa');
function abrirModal(html){
  modalCaixa.innerHTML = html;
  modalFundo.classList.remove('escondido');
}
function fecharModal(){ modalFundo.classList.add('escondido'); modalCaixa.innerHTML=''; }
modalFundo.addEventListener('click', (e) => { if (e.target === modalFundo) fecharModal(); });

// ---------------- DASHBOARD ----------------
async function carregarDashboard(){
  try{
    const r = await api('GET', '/dashboard/resumo');
    document.getElementById('cards-resumo').innerHTML = `
      <div class="card-resumo"><div class="num">${r.totalFreelancers}</div><div class="rotulo">Freelancers aprovados</div></div>
      <div class="card-resumo"><div class="num">${r.pendentesAprovacao}</div><div class="rotulo">Aguardando aprovação</div></div>
      <div class="card-resumo"><div class="num">${r.totalRestaurantes}</div><div class="rotulo">Restaurantes ativos</div></div>
      <div class="card-resumo"><div class="num">${r.eventosHoje}</div><div class="rotulo">Eventos hoje</div></div>
      <div class="card-resumo"><div class="num">${r.eventosFuturos}</div><div class="rotulo">Eventos futuros</div></div>
      <div class="card-resumo"><div class="num">${r.checkinsHoje}</div><div class="rotulo">Check-ins hoje</div></div>
    `;
    const eventos = await api('GET', '/eventos');
    const proximos = eventos.filter(e => e.status !== 'cancelado').slice(0,5);
    document.getElementById('proximos-eventos').innerHTML = proximos.length ? proximos.map(ev => `
      <div class="evento-card">
        <div class="evento-info">
          <h4>${ev.titulo}</h4>
          <p>${ev.nome_empresa} · ${formatarData(ev.data)} às ${ev.hora_inicio}</p>
          <div class="evento-tags">
            <span class="tag">${ev.total_aceitos}/${ev.total_convidados} confirmados</span>
            <span class="tag">${ev.total_checkins} check-ins</span>
          </div>
        </div>
      </div>
    `).join('') : '<p class="texto-suave">Nenhum evento cadastrado ainda.</p>';
  }catch(err){ console.error(err); }
}

function formatarData(iso){
  const [a,m,d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

// ---------------- RESTAURANTES / CLIENTES ----------------
async function carregarRestaurantes(){
  const lista = await api('GET', '/restaurantes');
  document.getElementById('grid-restaurantes').innerHTML = lista.length ? lista.map(r => `
    <div class="cliente-card ${r.ativo ? '' : 'cliente-inativo'}">
      <div class="cliente-card-topo">
        <div>
          <h4>${r.nome_empresa}</h4>
          ${r.tipo_local ? `<span class="cliente-tipo">${r.tipo_local}</span>` : ''}
        </div>
        ${!r.ativo ? '<span class="badge badge-bloqueado">Inativo</span>' : ''}
      </div>
      ${r.cnpj ? `<div class="cliente-linha">🧾 <strong>CNPJ:</strong> ${r.cnpj}</div>` : ''}
      ${r.responsavel ? `<div class="cliente-linha">👤 <strong>Responsável:</strong> ${r.responsavel}</div>` : ''}
      ${r.telefone ? `<div class="cliente-linha">📞 ${r.telefone}</div>` : ''}
      ${r.endereco ? `<div class="cliente-linha">📍 ${r.endereco}</div>` : ''}
      ${r.observacoes ? `<div class="cliente-obs">📝 ${r.observacoes}</div>` : ''}
      <div class="cliente-card-acoes">
        <button class="btn btn-fantasma" onclick="editarRestaurante(${r.id})">Editar</button>
        <button class="btn btn-fantasma" style="color:#e0584f" onclick="excluirRestaurante(${r.id})">Excluir</button>
      </div>
    </div>
  `).join('') : '<p class="texto-suave">Nenhum cliente cadastrado ainda. Clique em "Novo cliente" para começar — só o nome é obrigatório.</p>';
}

function formRestaurante(r = {}){
  return `
    <h3>${r.id ? 'Editar cliente' : 'Novo cliente'}</h3>
    <form id="form-restaurante" class="form-stack">
      <label>Nome da empresa / local *
        <input type="text" id="rest-nome" required value="${r.nome_empresa || ''}">
      </label>
      <label>Tipo de local
        <select id="rest-tipo">
          <option value="">Selecione (opcional)</option>
          ${['Restaurante','Hotel','Buffet','Casa de eventos','Clube','Corporativo','Casamento/Festa particular','Outro'].map(t => `<option ${r.tipo_local===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </label>
      <div class="grid-2">
        <label>CNPJ <span class="texto-suave" style="font-size:11px">(opcional)</span>
          <input type="text" id="rest-cnpj" value="${r.cnpj || ''}" placeholder="00.000.000/0000-00">
        </label>
        <label>Telefone
          <input type="text" id="rest-telefone" value="${r.telefone || ''}" placeholder="(00) 00000-0000">
        </label>
      </div>
      <label>Responsável / contratante <span class="texto-suave" style="font-size:11px">(opcional)</span>
        <input type="text" id="rest-responsavel" value="${r.responsavel || ''}">
      </label>
      <label>Endereço
        <input type="text" id="rest-endereco" value="${r.endereco || ''}">
      </label>
      <label>Observações sobre este cliente
        <textarea id="rest-observacoes" rows="3" placeholder="Ex: prefere garçons com experiência em casamento, sempre paga em dia, portaria pelos fundos...">${r.observacoes || ''}</textarea>
      </label>
      <div class="modal-acoes">
        <button type="button" class="btn btn-fantasma" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="btn btn-ouro">Salvar</button>
      </div>
    </form>
  `;
}

document.getElementById('btn-novo-restaurante').onclick = () => {
  abrirModal(formRestaurante());
  ligarFormRestaurante(null);
};
window.editarRestaurante = async (id) => {
  const lista = await api('GET', '/restaurantes');
  const r = lista.find(x => x.id === id);
  abrirModal(formRestaurante(r));
  ligarFormRestaurante(id);
};
function ligarFormRestaurante(id){
  document.getElementById('form-restaurante').addEventListener('submit', async (e) => {
    e.preventDefault();
    const corpo = {
      nome_empresa: document.getElementById('rest-nome').value,
      tipo_local: document.getElementById('rest-tipo').value,
      cnpj: document.getElementById('rest-cnpj').value,
      telefone: document.getElementById('rest-telefone').value,
      responsavel: document.getElementById('rest-responsavel').value,
      endereco: document.getElementById('rest-endereco').value,
      observacoes: document.getElementById('rest-observacoes').value,
      ativo: 1
    };
    if (id) await api('PUT', `/restaurantes/${id}`, corpo);
    else await api('POST', '/restaurantes', corpo);
    fecharModal();
    carregarRestaurantes();
  });
}
window.excluirRestaurante = async (id) => {
  if (!confirm('Excluir este cliente? Os eventos vinculados a ele não serão apagados.')) return;
  await api('DELETE', `/restaurantes/${id}`);
  carregarRestaurantes();
};

// ---------------- FREELANCERS ----------------
let filtroFreelancerAtual = '';
let filtroFavoritosAtivo = false;
let filtroAreaAtual = '';
let filtroZonaAtual = '';
const mapaAreas = Object.fromEntries((window.AREAS_ATUACAO || []).map(a => [a.id, a.label]));

document.querySelectorAll('#filtro-freelancers .chip[data-status]').forEach(chip => {
  chip.onclick = () => {
    document.querySelectorAll('#filtro-freelancers .chip[data-status]').forEach(c => c.classList.remove('ativo'));
    chip.classList.add('ativo');
    filtroFreelancerAtual = chip.dataset.status;
    carregarFreelancers();
  };
});
document.getElementById('chip-favoritos').onclick = (e) => {
  filtroFavoritosAtivo = !filtroFavoritosAtivo;
  e.target.classList.toggle('ativo', filtroFavoritosAtivo);
  carregarFreelancers();
};

function popularSelectArea(){
  const select = document.getElementById('select-area-freelancer');
  if (select.dataset.populado) return;
  select.dataset.populado = '1';
  select.innerHTML = '<option value="">Organizar por área — todas</option>' +
    (window.AREAS_ATUACAO || []).map(a => `<option value="${a.id}">${a.label}</option>`).join('');
  select.onchange = () => { filtroAreaAtual = select.value; carregarFreelancers(); };

  const selectZona = document.getElementById('select-zona-freelancer');
  selectZona.onchange = () => { filtroZonaAtual = selectZona.value; carregarFreelancers(); };
}

async function carregarFreelancers(){
  popularSelectArea();
  let query = [];
  if (filtroFreelancerAtual) query.push(`status=${filtroFreelancerAtual}`);
  if (filtroFavoritosAtivo) query.push('favoritos=1');
  if (filtroAreaAtual) query.push(`area=${filtroAreaAtual}`);
  if (filtroZonaAtual) query.push(`zona=${encodeURIComponent(filtroZonaAtual)}`);
  const lista = await api('GET', '/freelancers' + (query.length ? '?' + query.join('&') : ''));

  if (filtroAreaAtual || filtroFavoritosAtivo || filtroFreelancerAtual || filtroZonaAtual){
    // filtro ativo: mostra tudo numa lista só, sem agrupar
    document.getElementById('grupos-freelancers').innerHTML = renderTabelaFreelancers(lista, 'Resultado');
  } else {
    // organização automática por área
    const grupos = {};
    lista.forEach(f => {
      const areasDoFreela = f.areas && f.areas.length ? f.areas : ['sem_area'];
      areasDoFreela.forEach(a => { (grupos[a] = grupos[a] || []).push(f); });
    });
    const ordemAreas = Object.keys(grupos).sort((a,b) => grupos[b].length - grupos[a].length);
    document.getElementById('grupos-freelancers').innerHTML = ordemAreas.length
      ? ordemAreas.map(a => renderTabelaFreelancers(grupos[a], mapaAreas[a] || 'Sem área definida')).join('')
      : '<p class="texto-suave">Nenhum freelancer cadastrado ainda.</p>';
  }
  ligarAcoesFreelancers();
}

function renderTabelaFreelancers(lista, tituloGrupo){
  const badge = { aprovado: 'badge-aprovado', pendente: 'badge-pendente', bloqueado: 'badge-bloqueado' };
  return `
    <div class="grupo-area">
      <h4>${tituloGrupo} <span class="contagem">(${lista.length})</span></h4>
      <div class="tabela-wrap">
        <table class="tabela">
          <thead><tr><th></th><th></th><th>Nome</th><th>Áreas</th><th>CPF</th><th>Telefone</th><th>Nota</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${lista.length ? lista.map(f => `
              <tr>
                <td><button class="estrela-fav ${f.favorito ? 'ativa' : ''}" data-id="${f.id}" data-fav="${f.favorito ? 0 : 1}">★</button></td>
                <td>${f.foto_perfil ? `<img src="${urlFoto(f.foto_perfil)}" class="foto-mini" style="border-radius:50%;">` : `<span style="opacity:0.4" title="Sem foto de perfil ainda">📷</span>`}</td>
                <td><strong>${f.nome}</strong></td>
                <td><div class="areas-tags-freela">${(f.areas||[]).map(a => `<span class="tag">${mapaAreas[a]||a}</span>`).join('')}${f.zona ? `<span class="tag" style="border-color:var(--ouro-escuro); color:var(--ouro-claro)">📍 ${f.zona}</span>` : ''}</div></td>
                <td>${f.cpf}</td>
                <td>${f.telefone ? `<a href="https://wa.me/55${f.telefone.replace(/\D/g,'')}" target="_blank" style="color:var(--verde); text-decoration:none;">💬 ${f.telefone}</a>` : '—'}</td>
                <td>${f.nota_media ? '⭐ ' + f.nota_media.toFixed(1) : '—'}</td>
                <td><span class="badge ${badge[f.status]}">${f.status}</span></td>
                <td>
                  ${f.status !== 'aprovado' ? `<button class="acao-link" onclick="mudarStatusFreelancer(${f.id},'aprovado')">Aprovar</button>` : ''}
                  ${f.status !== 'bloqueado' ? `<button class="acao-link" style="color:#e0584f" onclick="mudarStatusFreelancer(${f.id},'bloqueado')">Bloquear</button>` : `<button class="acao-link" onclick="mudarStatusFreelancer(${f.id},'aprovado')">Desbloquear</button>`}
                </td>
              </tr>
            `).join('') : `<tr><td colspan="9" class="texto-suave" style="padding:16px">Nenhum freelancer aqui.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
function ligarAcoesFreelancers(){
  document.querySelectorAll('.estrela-fav').forEach(btn => {
    btn.onclick = async () => {
      await api('PUT', `/freelancers/${btn.dataset.id}/favorito`, { favorito: Number(btn.dataset.fav) });
      carregarFreelancers();
    };
  });
}
window.mudarStatusFreelancer = async (id, status) => {
  await api('PUT', `/freelancers/${id}/status`, { status });
  carregarFreelancers();
};

// ---------------- ESCALAS / EVENTOS ----------------
async function carregarEscalas(){
  const eventos = await api('GET', '/eventos');
  document.getElementById('lista-eventos').innerHTML = eventos.length ? eventos.map(ev => `
    <div class="evento-card">
      <div class="evento-info">
        <h4>${ev.titulo}</h4>
        <p>${ev.nome_empresa} · ${formatarData(ev.data)} · ${ev.hora_inicio}–${ev.hora_fim} · ${ev.endereco}</p>
        <div class="evento-tags">
          <span class="tag">${ev.total_aceitos}/${ev.total_convidados} confirmados</span>
          <span class="tag">${ev.total_checkins} check-ins</span>
          <span class="tag">raio ${ev.raio_checkin_m}m</span>
          <span class="tag">${ev.status}</span>
        </div>
      </div>
      <div class="evento-acoes">
        <button class="btn btn-ouro" onclick="notificarSobreEvento(${ev.id}, '${ev.titulo.replace(/'/g,"")}', '${ev.data}', '${ev.hora_inicio}', '${ev.nome_empresa.replace(/'/g,"")}')">🔔 Notificar agenciados</button>
        <button class="btn btn-fantasma" onclick="abrirConvidar(${ev.id})">Convidar freelancers</button>
        <button class="btn btn-fantasma" onclick="editarEvento(${ev.id})">Editar</button>
      </div>
    </div>
  `).join('') : '<p class="texto-suave">Nenhuma escala criada ainda.</p>';
}

function formEvento(ev = {}){
  return `
    <h3>${ev.id ? 'Editar escala' : 'Nova escala / evento'}</h3>
    <form id="form-evento" class="form-stack">
      <label>Restaurante contratante
        <select id="ev-restaurante" required>${window._restaurantesCache.map(r => `<option value="${r.id}" ${ev.restaurante_id===r.id?'selected':''}>${r.nome_empresa}</option>`).join('')}</select>
      </label>
      <label>Título do evento
        <input type="text" id="ev-titulo" required value="${ev.titulo || ''}" placeholder="Ex: Evento corporativo — recepção">
      </label>
      <div class="grid-2">
        <label>Data
          <input type="date" id="ev-data" required value="${ev.data || ''}">
        </label>
        <label>Função
          <input type="text" id="ev-funcao" value="${ev.funcao || 'Garçom'}">
        </label>
      </div>
      <div class="grid-2">
        <label>Horário início
          <input type="time" id="ev-inicio" required value="${ev.hora_inicio || ''}">
        </label>
        <label>Horário fim
          <input type="time" id="ev-fim" required value="${ev.hora_fim || ''}">
        </label>
      </div>
      <label>Endereço do evento
        <input type="text" id="ev-endereco" required value="${ev.endereco || ''}" placeholder="Rua, número, bairro, cidade">
      </label>
      <button type="button" class="btn btn-fantasma" id="btn-buscar-coords" style="align-self:flex-start">📍 Buscar coordenadas pelo endereço</button>
      <div class="grid-2">
        <label>Latitude
          <input type="text" id="ev-lat" required value="${ev.latitude || ''}">
        </label>
        <label>Longitude
          <input type="text" id="ev-lng" required value="${ev.longitude || ''}">
        </label>
      </div>
      <div class="grid-2">
        <label>Uniforme
          <input type="text" id="ev-uniforme" value="${ev.uniforme || ''}" placeholder="Camisa branca + calça preta">
        </label>
        <label>Raio de check-in (metros)
          <input type="number" id="ev-raio" value="${ev.raio_checkin_m || 100}">
        </label>
      </div>
      <label>Contato no local
        <input type="text" id="ev-contato" value="${ev.contato_local || ''}">
      </label>
      <label>Observações / briefing
        <textarea id="ev-obs" rows="3">${ev.observacoes || ''}</textarea>
      </label>
      <div class="modal-acoes">
        <button type="button" class="btn btn-fantasma" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="btn btn-ouro">Salvar escala</button>
      </div>
    </form>
  `;
}

document.getElementById('btn-novo-evento').onclick = async () => {
  window._restaurantesCache = await api('GET', '/restaurantes');
  if (!window._restaurantesCache.length){
    alert('Cadastre um restaurante antes de criar uma escala.');
    return;
  }
  abrirModal(formEvento());
  ligarFormEvento(null);
};
window.editarEvento = async (id) => {
  window._restaurantesCache = await api('GET', '/restaurantes');
  const eventos = await api('GET', '/eventos');
  const ev = eventos.find(e => e.id === id);
  abrirModal(formEvento(ev));
  ligarFormEvento(id);
};

function ligarFormEvento(id){
  document.getElementById('btn-buscar-coords').onclick = async () => {
    const endereco = document.getElementById('ev-endereco').value;
    if (!endereco) return alert('Digite o endereço primeiro.');
    const btn = document.getElementById('btn-buscar-coords');
    btn.textContent = 'Buscando...';
    try{
      const resp = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(endereco));
      const dados = await resp.json();
      if (dados[0]){
        document.getElementById('ev-lat').value = dados[0].lat;
        document.getElementById('ev-lng').value = dados[0].lon;
      } else {
        alert('Endereço não encontrado. Preencha a latitude/longitude manualmente (ex: usando o Google Maps).');
      }
    }catch(e){ alert('Não foi possível buscar. Preencha a latitude/longitude manualmente.'); }
    btn.textContent = '📍 Buscar coordenadas pelo endereço';
  };

  document.getElementById('form-evento').addEventListener('submit', async (e) => {
    e.preventDefault();
    const corpo = {
      restaurante_id: Number(document.getElementById('ev-restaurante').value),
      titulo: document.getElementById('ev-titulo').value,
      data: document.getElementById('ev-data').value,
      hora_inicio: document.getElementById('ev-inicio').value,
      hora_fim: document.getElementById('ev-fim').value,
      endereco: document.getElementById('ev-endereco').value,
      latitude: parseFloat(document.getElementById('ev-lat').value),
      longitude: parseFloat(document.getElementById('ev-lng').value),
      funcao: document.getElementById('ev-funcao').value,
      uniforme: document.getElementById('ev-uniforme').value,
      raio_checkin_m: Number(document.getElementById('ev-raio').value) || 100,
      contato_local: document.getElementById('ev-contato').value,
      observacoes: document.getElementById('ev-obs').value
    };
    if (id) await api('PUT', `/eventos/${id}`, corpo);
    else await api('POST', '/eventos', corpo);
    fecharModal();
    carregarEscalas();
  });
}

window.notificarSobreEvento = (eventoId, titulo, data, horaInicio, nomeEmpresa) => {
  abrirModalAviso({
    titulo: `Nova escala: ${titulo}`,
    texto: `${nomeEmpresa} · ${formatarData(data)} às ${horaInicio}. Abra o app e confira os detalhes na aba de escalas!`
  });
};

window.abrirConvidar = async (eventoId) => {
  const freelancers = await api('GET', '/freelancers?status=aprovado');
  abrirModal(`
    <h3>Convidar freelancers</h3>
    <p class="texto-suave" style="margin-bottom:14px">Selecione quem vai receber o convite de escala (notificação instantânea no app).</p>
    <form id="form-convidar" class="form-stack">
      <div style="max-height:320px; overflow:auto; display:flex; flex-direction:column; gap:8px;">
        ${freelancers.length ? freelancers.map(f => `
          <label style="flex-direction:row; align-items:center; gap:10px; background:#0e0e10; padding:10px 12px; border-radius:10px;">
            <input type="checkbox" value="${f.id}" class="chk-freelancer" style="width:auto;">
            <span>${f.nome} — <span class="texto-suave">${f.funcao}</span></span>
          </label>
        `).join('') : '<p class="texto-suave">Nenhum freelancer aprovado ainda.</p>'}
      </div>
      <div class="modal-acoes">
        <button type="button" class="btn btn-fantasma" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="btn btn-ouro">Enviar convites</button>
      </div>
    </form>
  `);
  document.getElementById('form-convidar').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ids = [...document.querySelectorAll('.chk-freelancer:checked')].map(c => Number(c.value));
    if (!ids.length) return alert('Selecione ao menos um freelancer.');
    const r = await api('POST', `/eventos/${eventoId}/convidar`, { freelancer_ids: ids });
    fecharModal();
    alert(`${r.convidados} convite(s) enviado(s) com sucesso!`);
    carregarEscalas();
  });
};

// ---------------- AVISOS / NOTIFICAÇÕES EM MASSA ----------------
async function carregarAvisos(){
  const modelos = await api('GET', '/mensagens-modelo');
  document.getElementById('lista-mensagens-modelo').innerHTML = modelos.length ? modelos.map(m => `
    <div class="modelo-card">
      <strong>${m.titulo}</strong>
      <p>${m.texto}</p>
      <div class="modelo-card-acoes">
        <button class="btn btn-fantasma" onclick="usarModeloDireto(${m.id})">Usar em novo aviso</button>
        <button class="btn btn-fantasma" style="color:#e0584f" onclick="excluirModelo(${m.id})">Excluir</button>
      </div>
    </div>
  `).join('') : '<p class="texto-suave">Você ainda não salvou nenhuma mensagem favorita. Elas aparecem aqui depois que você marcar "salvar como favorita" ao enviar um aviso.</p>';
}

window.excluirModelo = async (id) => {
  await api('DELETE', `/mensagens-modelo/${id}`);
  carregarAvisos();
};
window.usarModeloDireto = async (id) => {
  const modelos = await api('GET', '/mensagens-modelo');
  const m = modelos.find(x => x.id === id);
  abrirModalAviso(m);
};

document.getElementById('btn-novo-aviso').onclick = () => abrirModalAviso();

function abrirModalAviso(modeloPreenchido = null){
  const areas = window.AREAS_ATUACAO || [];
  abrirModal(`
    <h3>Enviar novo aviso</h3>
    <p class="texto-suave" style="margin-bottom:14px">Escolha quem recebe e escreva a mensagem. Ela chega como notificação no app do freelancer (e como push, se configurado).</p>
    <form id="form-aviso" class="form-stack">
      <label>Quem recebe
        <div class="grid-areas-aviso" id="grid-areas-aviso">
          <span class="aviso-area-chip selecionada" data-area="todos">Todos</span>
          ${areas.map(a => `<span class="aviso-area-chip" data-area="${a.id}">${a.label}</span>`).join('')}
        </div>
      </label>
      <label>Título do aviso
        <input type="text" id="aviso-titulo" required value="${modeloPreenchido ? modeloPreenchido.titulo : ''}" placeholder="Ex: Nova escala disponível">
      </label>
      <label>Mensagem
        <textarea id="aviso-mensagem" rows="4" required placeholder="Escreva aqui a mensagem que os freelancers vão receber...">${modeloPreenchido ? modeloPreenchido.texto : ''}</textarea>
      </label>
      <label style="flex-direction:row; align-items:center; gap:8px;">
        <input type="checkbox" id="aviso-salvar-modelo" style="width:auto;"> Salvar esta mensagem como favorita para reusar depois
      </label>
      <div class="modal-acoes">
        <button type="button" class="btn btn-fantasma" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="btn btn-ouro">Enviar aviso</button>
      </div>
    </form>
  `);

  const chipTodos = document.querySelector('.aviso-area-chip[data-area="todos"]');
  document.querySelectorAll('.aviso-area-chip').forEach(chip => {
    chip.onclick = () => {
      if (chip.dataset.area === 'todos'){
        document.querySelectorAll('.aviso-area-chip').forEach(c => c.classList.remove('selecionada'));
        chip.classList.add('selecionada');
      } else {
        chipTodos.classList.remove('selecionada');
        chip.classList.toggle('selecionada');
        const nenhumaMarcada = ![...document.querySelectorAll('.aviso-area-chip')].some(c => c.classList.contains('selecionada'));
        if (nenhumaMarcada) chipTodos.classList.add('selecionada');
      }
    };
  });

  document.getElementById('form-aviso').addEventListener('submit', async (e) => {
    e.preventDefault();
    const selecionadas = [...document.querySelectorAll('.aviso-area-chip.selecionada')].map(c => c.dataset.area);
    const titulo = document.getElementById('aviso-titulo').value;
    const mensagem = document.getElementById('aviso-mensagem').value;
    if (document.getElementById('aviso-salvar-modelo').checked){
      await api('POST', '/mensagens-modelo', { titulo, texto: mensagem });
    }
    const r = await api('POST', '/notificacoes/broadcast', { areas: selecionadas, titulo, mensagem });
    fecharModal();
    alert(`Aviso enviado para ${r.enviados} freelancer(es)!`);
    carregarAvisos();
  });
}

// ---------------- MAPA AO VIVO ----------------
let intervaloMapa = null;
async function carregarSelectMapa(){
  const eventos = await api('GET', '/eventos');
  const select = document.getElementById('select-evento-mapa');
  select.innerHTML = '<option value="">Selecione um evento…</option>' + eventos.map(e => `<option value="${e.id}">${e.titulo} — ${formatarData(e.data)}</option>`).join('');
  select.onchange = () => {
    if (intervaloMapa) clearInterval(intervaloMapa);
    if (select.value){
      atualizarMapa(select.value);
      intervaloMapa = setInterval(() => atualizarMapa(select.value), 15000);
    } else {
      document.getElementById('lista-mapa').innerHTML = '';
    }
  };
}
async function atualizarMapa(eventoId){
  const dados = await api('GET', `/eventos/${eventoId}/mapa-ao-vivo`);
  const statusClasse = { aguardando: 'sp-aguardando', presente: 'sp-presente', concluido: 'sp-concluido' };
  document.getElementById('lista-mapa').innerHTML = dados.length ? dados.map(p => `
    <div class="pessoa-mapa">
      <div>
        <strong>${p.nome}</strong>
        <div class="pm-info">${p.ultima_lat ? `📍 ${p.ultima_lat.toFixed(5)}, ${p.ultima_lng.toFixed(5)} · atualizado ${tempoRelativo(p.ultima_localizacao_em)}` : 'Localização ainda não disponível'}</div>
      </div>
      <span class="status-ponto ${statusClasse[p.status_ponto] || 'sp-aguardando'}">${p.status_ponto || 'aguardando'}</span>
    </div>
  `).join('') : '<p class="texto-suave">Nenhum freelancer confirmado para este evento ainda.</p>';
}
function tempoRelativo(iso){
  if (!iso) return '—';
  const diffMin = Math.round((Date.now() - new Date(iso + 'Z')) / 60000);
  if (diffMin < 1) return 'agora mesmo';
  if (diffMin < 60) return `há ${diffMin} min`;
  return `há ${Math.round(diffMin/60)}h`;
}

// ---------------- RELATÓRIOS ----------------
async function carregarSelectRelatorio(){
  const eventos = await api('GET', '/eventos');
  const select = document.getElementById('select-evento-relatorio');
  select.innerHTML = '<option value="">Selecione um evento…</option>' + eventos.map(e => `<option value="${e.id}">${e.titulo} — ${formatarData(e.data)}</option>`).join('');
  select.onchange = () => { if (select.value) carregarRelatorio(select.value); else document.getElementById('relatorio-conteudo').innerHTML=''; };
}
async function carregarRelatorio(eventoId){
  const { evento, linhas } = await api('GET', `/eventos/${eventoId}/relatorio`);
  const presentes = linhas.filter(l => l.checkin_em).length;
  const faltas = linhas.filter(l => l.status_convite==='aceito' && !l.checkin_em).length;
  document.getElementById('relatorio-conteudo').innerHTML = `
    <div class="relatorio-resumo">
      <div class="mini"><b>${linhas.length}</b><span>Convidados</span></div>
      <div class="mini"><b>${presentes}</b><span>Presenças</span></div>
      <div class="mini"><b>${faltas}</b><span>Faltas</span></div>
    </div>
    <div class="tabela-wrap">
      <table class="tabela">
        <thead><tr><th>Nome</th><th>Convite</th><th>Entrada</th><th>Saída</th><th>Horas</th><th>Foto</th><th></th></tr></thead>
        <tbody>
          ${linhas.map(l => `
            <tr>
              <td><strong>${l.nome}</strong><br><span class="texto-suave" style="font-size:12px">${l.funcao||''}</span></td>
              <td>${badgeConvite(l.status_convite)}</td>
              <td>${l.checkin_em ? horaLocal(l.checkin_em) : '—'}</td>
              <td>${l.checkout_em ? horaLocal(l.checkout_em) : '—'}</td>
              <td>${l.horas_trabalhadas ? l.horas_trabalhadas + 'h' : '—'}</td>
              <td>${l.checkin_foto ? `<img class="foto-mini" src="${urlFoto(l.checkin_foto)}" onclick="window.open('${urlFoto(l.checkin_foto)}','_blank')">` : '—'}</td>
              <td>${l.checkout_em ? `<button class="acao-link" onclick="abrirAvaliar(${l.convite_id}, '${l.nome.replace(/'/g,"")}')">Avaliar</button>` : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}
function badgeConvite(s){
  const map = { pendente: 'badge-pendente', aceito: 'badge-aprovado', recusado: 'badge-bloqueado' };
  return `<span class="badge ${map[s]||''}">${s}</span>`;
}
function horaLocal(iso){
  return new Date(iso + 'Z').toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
}

window.abrirAvaliar = (conviteId, nome) => {
  let notas = { pontualidade: 0, apresentacao: 0, postura: 0 };
  abrirModal(`
    <h3>Avaliar ${nome}</h3>
    <form id="form-avaliar" class="form-stack">
      ${['pontualidade','apresentacao','postura'].map(campo => `
        <label style="text-transform:capitalize">${campo}
          <div class="estrelas" data-campo="${campo}">
            ${[1,2,3,4,5].map(n => `<span class="estrela" data-valor="${n}">★</span>`).join('')}
          </div>
        </label>
      `).join('')}
      <label>Observações
        <textarea id="av-obs" rows="3" placeholder="Comentário sobre a atuação..."></textarea>
      </label>
      <div class="modal-acoes">
        <button type="button" class="btn btn-fantasma" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="btn btn-ouro">Salvar avaliação</button>
      </div>
    </form>
  `);
  document.querySelectorAll('.estrelas').forEach(grupo => {
    grupo.querySelectorAll('.estrela').forEach(estrela => {
      estrela.onclick = () => {
        const valor = Number(estrela.dataset.valor);
        notas[grupo.dataset.campo] = valor;
        grupo.querySelectorAll('.estrela').forEach(e2 => e2.classList.toggle('ativa', Number(e2.dataset.valor) <= valor));
      };
    });
  });
  document.getElementById('form-avaliar').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!notas.pontualidade || !notas.apresentacao || !notas.postura) return alert('Dê uma nota em todos os critérios.');
    await api('POST', `/convites/${conviteId}/avaliar`, {
      ...notas, observacoes: document.getElementById('av-obs').value
    });
    fecharModal();
    const eventoId = document.getElementById('select-evento-relatorio').value;
    carregarRelatorio(eventoId);
  });
};

// ---------------- INÍCIO ----------------
(async function start(){
  if (TOKEN){
    try{ await api('GET', '/dashboard/resumo'); iniciarApp(); }
    catch(e){ localStorage.removeItem('ar_gestor_token'); }
  }
})();

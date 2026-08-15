require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const { enviarPush } = require('./push');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'troque-esta-chave-em-producao-agencia-rodrigues';

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

// ---------- upload de fotos (check-in / check-out / perfil) ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname) || '.jpg'}`)
});
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } });

// ---------- utilidades ----------
function haversineMetros(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function criarNotificacao(freelancerId, tipo, titulo, mensagem, referenciaId = null) {
  db.prepare(
    `INSERT INTO notificacoes (freelancer_id, tipo, titulo, mensagem, referencia_id) VALUES (?,?,?,?,?)`
  ).run(freelancerId, tipo, titulo, mensagem, referenciaId);
  const freela = db.prepare('SELECT push_token FROM freelancers WHERE id=?').get(freelancerId);
  if (freela && freela.push_token) {
    enviarPush(freela.push_token, titulo, mensagem, { tipo, referenciaId: referenciaId || '' });
  }
}

function assinarToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

function autenticar(papelEsperado) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ erro: 'Token ausente' });
    try {
      const dados = jwt.verify(token, JWT_SECRET);
      if (papelEsperado && dados.papel !== papelEsperado) {
        return res.status(403).json({ erro: 'Acesso não permitido para este perfil' });
      }
      req.usuario = dados;
      next();
    } catch (e) {
      return res.status(401).json({ erro: 'Token inválido ou expirado' });
    }
  };
}

// =====================================================================
// AUTENTICAÇÃO — GESTOR
// =====================================================================
app.post('/api/gestor/registrar', (req, res) => {
  const { nome, email, senha } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: 'Preencha nome, email e senha' });
  const existe = db.prepare('SELECT id FROM gestores WHERE email = ?').get(email);
  if (existe) return res.status(400).json({ erro: 'Já existe um gestor com este email' });
  const hash = bcrypt.hashSync(senha, 10);
  const info = db.prepare('INSERT INTO gestores (nome, email, senha_hash) VALUES (?,?,?)').run(nome, email, hash);
  const token = assinarToken({ id: info.lastInsertRowid, papel: 'gestor', nome });
  res.json({ token, gestor: { id: info.lastInsertRowid, nome, email } });
});

app.post('/api/gestor/login', (req, res) => {
  const { email, senha } = req.body;
  const gestor = db.prepare('SELECT * FROM gestores WHERE email = ?').get(email);
  if (!gestor || !bcrypt.compareSync(senha, gestor.senha_hash)) {
    return res.status(401).json({ erro: 'Email ou senha incorretos' });
  }
  const token = assinarToken({ id: gestor.id, papel: 'gestor', nome: gestor.nome });
  res.json({ token, gestor: { id: gestor.id, nome: gestor.nome, email: gestor.email } });
});

// =====================================================================
// AUTENTICAÇÃO — FREELANCER
// =====================================================================
app.post('/api/freelancer/registrar', (req, res) => {
  const { nome, cpf, email, telefone, endereco, senha, areas } = req.body;
  if (!nome || !cpf || !email || !telefone || !senha) return res.status(400).json({ erro: 'Preencha nome, CPF, email, WhatsApp e senha' });
  const listaAreas = Array.isArray(areas) ? areas.filter(Boolean) : [];
  if (listaAreas.length === 0) return res.status(400).json({ erro: 'Selecione ao menos uma área de atuação' });
  const existe = db.prepare('SELECT id FROM freelancers WHERE cpf = ? OR email = ? OR telefone = ?').get(cpf, email, telefone);
  if (existe) return res.status(400).json({ erro: 'Já existe um cadastro com este CPF, email ou WhatsApp' });
  const hash = bcrypt.hashSync(senha, 10);
  const info = db
    .prepare(
      `INSERT INTO freelancers (nome, cpf, email, telefone, endereco, senha_hash, funcao, areas) VALUES (?,?,?,?,?,?,?,?)`
    )
    .run(nome, cpf, email, telefone, endereco || '', hash, listaAreas[0], JSON.stringify(listaAreas));
  const token = assinarToken({ id: info.lastInsertRowid, papel: 'freelancer', nome });
  res.json({
    token,
    freelancer: { id: info.lastInsertRowid, nome, email, telefone, status: 'pendente', areas: listaAreas }
  });
});

app.post('/api/freelancer/login', (req, res) => {
  const { identificador, senha } = req.body;
  if (!identificador || !senha) return res.status(400).json({ erro: 'Informe seu email ou WhatsApp e a senha' });
  const chave = identificador.trim();
  const f = db.prepare('SELECT * FROM freelancers WHERE email = ? OR telefone = ?').get(chave, chave);
  if (!f || !bcrypt.compareSync(senha, f.senha_hash)) {
    return res.status(401).json({ erro: 'Dados incorretos. Confira o email/WhatsApp e a senha.' });
  }
  const token = assinarToken({ id: f.id, papel: 'freelancer', nome: f.nome });
  res.json({
    token,
    freelancer: { id: f.id, nome: f.nome, email: f.email, telefone: f.telefone, status: f.status, funcao: f.funcao, areas: JSON.parse(f.areas || '[]'), nota_media: f.nota_media }
  });
});

// Envia a localização ao vivo do freelancer (chamado periodicamente pelo app,
// e assim que o app é aberto pela primeira vez).
app.post('/api/freelancer/localizacao', autenticar('freelancer'), (req, res) => {
  const { latitude, longitude } = req.body;
  if (latitude === undefined || longitude === undefined) return res.status(400).json({ erro: 'Localização inválida' });
  db.prepare(
    `UPDATE freelancers SET ultima_lat=?, ultima_lng=?, ultima_localizacao_em=CURRENT_TIMESTAMP WHERE id=?`
  ).run(latitude, longitude, req.usuario.id);
  res.json({ ok: true });
});

// Salva o token de push (Firebase) do celular do freelancer — chamado pelo
// app assim que ele faz login e concede permissão de notificações.
app.post('/api/freelancer/push-token', autenticar('freelancer'), (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ erro: 'Token ausente' });
  db.prepare('UPDATE freelancers SET push_token=? WHERE id=?').run(token, req.usuario.id);
  res.json({ ok: true });
});

app.get('/api/freelancer/perfil', autenticar('freelancer'), (req, res) => {
  const f = db.prepare('SELECT id,nome,cpf,email,telefone,endereco,funcao,areas,foto_perfil,status,nota_media,total_avaliacoes FROM freelancers WHERE id=?').get(req.usuario.id);
  if (f) f.areas = JSON.parse(f.areas || '[]');
  res.json(f);
});

// =====================================================================
// RESTAURANTES (gestor)
// =====================================================================
app.get('/api/restaurantes', autenticar('gestor'), (req, res) => {
  res.json(db.prepare('SELECT * FROM restaurantes ORDER BY nome_empresa').all());
});

app.post('/api/restaurantes', autenticar('gestor'), (req, res) => {
  const { cnpj, nome_empresa, responsavel, telefone, endereco, latitude, longitude, observacoes, tipo_local } = req.body;
  if (!nome_empresa) return res.status(400).json({ erro: 'O nome da empresa é obrigatório' });
  const info = db
    .prepare(
      `INSERT INTO restaurantes (cnpj, nome_empresa, responsavel, telefone, endereco, latitude, longitude, observacoes, tipo_local) VALUES (?,?,?,?,?,?,?,?,?)`
    )
    .run(cnpj || '', nome_empresa, responsavel || '', telefone || '', endereco || '', latitude || null, longitude || null, observacoes || '', tipo_local || '');
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/restaurantes/:id', autenticar('gestor'), (req, res) => {
  const { cnpj, nome_empresa, responsavel, telefone, endereco, latitude, longitude, ativo, observacoes, tipo_local } = req.body;
  if (!nome_empresa) return res.status(400).json({ erro: 'O nome da empresa é obrigatório' });
  db.prepare(
    `UPDATE restaurantes SET cnpj=?, nome_empresa=?, responsavel=?, telefone=?, endereco=?, latitude=?, longitude=?, ativo=?, observacoes=?, tipo_local=? WHERE id=?`
  ).run(cnpj || '', nome_empresa, responsavel || '', telefone || '', endereco || '', latitude || null, longitude || null, ativo === undefined ? 1 : ativo, observacoes || '', tipo_local || '', req.params.id);
  res.json({ ok: true });
});

app.delete('/api/restaurantes/:id', autenticar('gestor'), (req, res) => {
  db.prepare('DELETE FROM restaurantes WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// =====================================================================
// FREELANCERS (visão do gestor)
// =====================================================================
app.get('/api/freelancers', autenticar('gestor'), (req, res) => {
  const { status, area, favoritos } = req.query;
  let sql = 'SELECT id,nome,cpf,email,telefone,funcao,areas,foto_perfil,status,favorito,nota_media,total_avaliacoes,ultima_lat,ultima_lng,ultima_localizacao_em,criado_em FROM freelancers';
  const cond = []; const params = [];
  if (status) { cond.push('status=?'); params.push(status); }
  if (favoritos === '1') { cond.push('favorito=1'); }
  if (cond.length) sql += ' WHERE ' + cond.join(' AND ');
  sql += ' ORDER BY favorito DESC, nome';
  let lista = db.prepare(sql).all(...params);
  lista = lista.map(f => ({ ...f, areas: JSON.parse(f.areas || '[]') }));
  if (area) lista = lista.filter(f => f.areas.includes(area));
  res.json(lista);
});

// Lista todas as áreas em uso, com a contagem de freelancers aprovados em cada uma —
// usada para organizar automaticamente o painel por área e para os filtros de notificação.
app.get('/api/freelancers/areas-resumo', autenticar('gestor'), (req, res) => {
  const lista = db.prepare("SELECT areas FROM freelancers WHERE status='aprovado'").all();
  const contagem = {};
  lista.forEach(f => {
    JSON.parse(f.areas || '[]').forEach(a => { contagem[a] = (contagem[a] || 0) + 1; });
  });
  res.json(contagem);
});

app.put('/api/freelancers/:id/favorito', autenticar('gestor'), (req, res) => {
  const { favorito } = req.body;
  db.prepare('UPDATE freelancers SET favorito=? WHERE id=?').run(favorito ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

app.put('/api/freelancers/:id/status', autenticar('gestor'), (req, res) => {
  const { status } = req.body; // pendente, aprovado, bloqueado
  if (!['pendente', 'aprovado', 'bloqueado'].includes(status)) return res.status(400).json({ erro: 'Status inválido' });
  db.prepare('UPDATE freelancers SET status=? WHERE id=?').run(status, req.params.id);
  if (status === 'aprovado') {
    criarNotificacao(req.params.id, 'aprovacao', 'Cadastro aprovado! 🎉', 'Seu cadastro na Agência Rodrigues foi aprovado. Você já pode receber convites de escala.');
  }
  res.json({ ok: true });
});

// =====================================================================
// EVENTOS / ESCALAS (gestor)
// =====================================================================
app.get('/api/eventos', autenticar('gestor'), (req, res) => {
  const eventos = db.prepare(`
    SELECT e.*, r.nome_empresa, r.responsavel,
      (SELECT COUNT(*) FROM convites c WHERE c.evento_id = e.id) as total_convidados,
      (SELECT COUNT(*) FROM convites c WHERE c.evento_id = e.id AND c.status='aceito') as total_aceitos,
      (SELECT COUNT(*) FROM registros_ponto rp JOIN convites c ON c.id = rp.convite_id WHERE c.evento_id = e.id AND rp.checkin_em IS NOT NULL) as total_checkins
    FROM eventos e JOIN restaurantes r ON r.id = e.restaurante_id
    ORDER BY e.data DESC, e.hora_inicio DESC
  `).all();
  res.json(eventos);
});

app.post('/api/eventos', autenticar('gestor'), (req, res) => {
  const { restaurante_id, titulo, data, hora_inicio, hora_fim, endereco, latitude, longitude, funcao, uniforme, observacoes, contato_local, raio_checkin_m } = req.body;
  if (!restaurante_id || !titulo || !data || !hora_inicio || !hora_fim || !endereco || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios do evento, incluindo a localização' });
  }
  const info = db.prepare(`
    INSERT INTO eventos (restaurante_id, titulo, data, hora_inicio, hora_fim, endereco, latitude, longitude, funcao, uniforme, observacoes, contato_local, raio_checkin_m)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(restaurante_id, titulo, data, hora_inicio, hora_fim, endereco, latitude, longitude, funcao || '', uniforme || '', observacoes || '', contato_local || '', raio_checkin_m || 100);
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/eventos/:id', autenticar('gestor'), (req, res) => {
  const campos = ['titulo','data','hora_inicio','hora_fim','endereco','latitude','longitude','funcao','uniforme','observacoes','contato_local','raio_checkin_m','status'];
  const atual = db.prepare('SELECT * FROM eventos WHERE id=?').get(req.params.id);
  if (!atual) return res.status(404).json({ erro: 'Evento não encontrado' });
  const novo = { ...atual, ...req.body };
  db.prepare(`
    UPDATE eventos SET titulo=?, data=?, hora_inicio=?, hora_fim=?, endereco=?, latitude=?, longitude=?, funcao=?, uniforme=?, observacoes=?, contato_local=?, raio_checkin_m=?, status=?
    WHERE id=?
  `).run(novo.titulo, novo.data, novo.hora_inicio, novo.hora_fim, novo.endereco, novo.latitude, novo.longitude, novo.funcao, novo.uniforme, novo.observacoes, novo.contato_local, novo.raio_checkin_m, novo.status, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/eventos/:id', autenticar('gestor'), (req, res) => {
  db.prepare('DELETE FROM convites WHERE evento_id=?').run(req.params.id);
  db.prepare('DELETE FROM eventos WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// Convidar freelancers para um evento (gera convite + notificação "escala publicada")
app.post('/api/eventos/:id/convidar', autenticar('gestor'), (req, res) => {
  const { freelancer_ids } = req.body;
  const evento = db.prepare('SELECT e.*, r.nome_empresa FROM eventos e JOIN restaurantes r ON r.id=e.restaurante_id WHERE e.id=?').get(req.params.id);
  if (!evento) return res.status(404).json({ erro: 'Evento não encontrado' });
  if (!Array.isArray(freelancer_ids) || freelancer_ids.length === 0) return res.status(400).json({ erro: 'Selecione ao menos um freelancer' });

  const inserir = db.prepare('INSERT OR IGNORE INTO convites (evento_id, freelancer_id) VALUES (?,?)');
  const criados = [];
  for (const fid of freelancer_ids) {
    const info = inserir.run(evento.id, fid);
    if (info.changes > 0) {
      criados.push(fid);
      criarNotificacao(
        fid,
        'convite',
        'Nova escala disponível 📋',
        `Você foi convidado para "${evento.titulo}" em ${evento.nome_empresa}, dia ${evento.data} às ${evento.hora_inicio}. Toque para aceitar.`,
        evento.id
      );
    }
  }
  res.json({ ok: true, convidados: criados.length });
});

// Relatório completo de um evento
app.get('/api/eventos/:id/relatorio', autenticar('gestor'), (req, res) => {
  const evento = db.prepare('SELECT e.*, r.nome_empresa, r.responsavel FROM eventos e JOIN restaurantes r ON r.id=e.restaurante_id WHERE e.id=?').get(req.params.id);
  if (!evento) return res.status(404).json({ erro: 'Evento não encontrado' });
  const linhas = db.prepare(`
    SELECT c.id as convite_id, c.status as status_convite, f.id as freelancer_id, f.nome, f.telefone, f.funcao,
      rp.checkin_em, rp.checkin_foto, rp.checkin_lat, rp.checkin_lng, rp.checkin_dist_m,
      rp.checkout_em, rp.checkout_foto, rp.horas_trabalhadas, rp.status as status_ponto
    FROM convites c
    JOIN freelancers f ON f.id = c.freelancer_id
    LEFT JOIN registros_ponto rp ON rp.convite_id = c.id
    WHERE c.evento_id = ?
    ORDER BY f.nome
  `).all(req.params.id);
  res.json({ evento, linhas });
});

// Localização ao vivo dos freelancers escalados num evento (para o mapa do painel)
app.get('/api/eventos/:id/mapa-ao-vivo', autenticar('gestor'), (req, res) => {
  const dados = db.prepare(`
    SELECT f.id, f.nome, f.foto_perfil, f.ultima_lat, f.ultima_lng, f.ultima_localizacao_em,
      rp.status as status_ponto, rp.checkin_em, rp.checkout_em
    FROM convites c
    JOIN freelancers f ON f.id = c.freelancer_id
    LEFT JOIN registros_ponto rp ON rp.convite_id = c.id
    WHERE c.evento_id = ? AND c.status='aceito'
  `).all(req.params.id);
  res.json(dados);
});

// =====================================================================
// CONVITES (freelancer)
// =====================================================================
app.get('/api/freelancer/convites', autenticar('freelancer'), (req, res) => {
  const convites = db.prepare(`
    SELECT c.id as convite_id, c.status as status_convite, c.criado_em,
      e.id as evento_id, e.titulo, e.data, e.hora_inicio, e.hora_fim, e.endereco, e.latitude, e.longitude,
      e.funcao, e.uniforme, e.observacoes, e.contato_local, e.raio_checkin_m, e.status as status_evento,
      r.nome_empresa,
      rp.checkin_em, rp.checkout_em, rp.status as status_ponto
    FROM convites c
    JOIN eventos e ON e.id = c.evento_id
    JOIN restaurantes r ON r.id = e.restaurante_id
    LEFT JOIN registros_ponto rp ON rp.convite_id = c.id
    WHERE c.freelancer_id = ?
    ORDER BY e.data DESC, e.hora_inicio DESC
  `).all(req.usuario.id);
  res.json(convites);
});

app.post('/api/convites/:id/aceitar', autenticar('freelancer'), (req, res) => {
  const convite = db.prepare('SELECT * FROM convites WHERE id=? AND freelancer_id=?').get(req.params.id, req.usuario.id);
  if (!convite) return res.status(404).json({ erro: 'Convite não encontrado' });
  db.prepare(`UPDATE convites SET status='aceito', respondido_em=CURRENT_TIMESTAMP WHERE id=?`).run(convite.id);
  db.prepare(`INSERT OR IGNORE INTO registros_ponto (convite_id, status) VALUES (?, 'aguardando')`).run(convite.id);
  res.json({ ok: true });
});

app.post('/api/convites/:id/recusar', autenticar('freelancer'), (req, res) => {
  const convite = db.prepare('SELECT * FROM convites WHERE id=? AND freelancer_id=?').get(req.params.id, req.usuario.id);
  if (!convite) return res.status(404).json({ erro: 'Convite não encontrado' });
  db.prepare(`UPDATE convites SET status='recusado', respondido_em=CURRENT_TIMESTAMP WHERE id=?`).run(convite.id);
  res.json({ ok: true });
});

// =====================================================================
// PONTO — CHECK-IN / CHECK-OUT (com foto + geolocalização + raio de 100m)
// =====================================================================
app.post('/api/convites/:id/checkin', autenticar('freelancer'), upload.single('foto'), (req, res) => {
  const convite = db.prepare('SELECT c.*, e.latitude as evt_lat, e.longitude as evt_lng, e.raio_checkin_m FROM convites c JOIN eventos e ON e.id=c.evento_id WHERE c.id=? AND c.freelancer_id=?').get(req.params.id, req.usuario.id);
  if (!convite) return res.status(404).json({ erro: 'Convite não encontrado' });
  if (convite.status !== 'aceito') return res.status(400).json({ erro: 'Você precisa aceitar a escala antes de fazer check-in' });
  if (!req.file) return res.status(400).json({ erro: 'A foto do check-in é obrigatória' });

  const lat = parseFloat(req.body.latitude);
  const lng = parseFloat(req.body.longitude);
  if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ erro: 'Localização inválida — ative o GPS e tente novamente' });

  const distancia = haversineMetros(lat, lng, convite.evt_lat, convite.evt_lng);
  const raio = convite.raio_checkin_m || 100;
  if (distancia > raio) {
    fs.unlink(path.join(UPLOAD_DIR, req.file.filename), () => {});
    return res.status(400).json({
      erro: `Você está a ${Math.round(distancia)}m do local do evento. O check-in só é permitido a até ${raio}m de distância.`,
      distancia_m: Math.round(distancia)
    });
  }

  db.prepare(`
    INSERT INTO registros_ponto (convite_id, checkin_em, checkin_foto, checkin_lat, checkin_lng, checkin_dist_m, status)
    VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, ?, 'presente')
    ON CONFLICT(convite_id) DO UPDATE SET checkin_em=CURRENT_TIMESTAMP, checkin_foto=excluded.checkin_foto, checkin_lat=excluded.checkin_lat, checkin_lng=excluded.checkin_lng, checkin_dist_m=excluded.checkin_dist_m, status='presente'
  `).run(convite.id, `/uploads/${req.file.filename}`, lat, lng, distancia);

  res.json({ ok: true, distancia_m: Math.round(distancia) });
});

app.post('/api/convites/:id/checkout', autenticar('freelancer'), upload.single('foto'), (req, res) => {
  const convite = db.prepare('SELECT * FROM convites WHERE id=? AND freelancer_id=?').get(req.params.id, req.usuario.id);
  if (!convite) return res.status(404).json({ erro: 'Convite não encontrado' });
  const registro = db.prepare('SELECT * FROM registros_ponto WHERE convite_id=?').get(convite.id);
  if (!registro || !registro.checkin_em) return res.status(400).json({ erro: 'Faça o check-in antes do check-out' });
  if (!req.file) return res.status(400).json({ erro: 'A foto do check-out é obrigatória' });

  const lat = parseFloat(req.body.latitude);
  const lng = parseFloat(req.body.longitude);
  const checkinData = new Date(registro.checkin_em + 'Z');
  const agora = new Date();
  const horas = Math.max(0, (agora - checkinData) / 1000 / 3600);

  db.prepare(`
    UPDATE registros_ponto SET checkout_em=CURRENT_TIMESTAMP, checkout_foto=?, checkout_lat=?, checkout_lng=?, horas_trabalhadas=?, status='concluido'
    WHERE convite_id=?
  `).run(`/uploads/${req.file.filename}`, lat || null, lng || null, Math.round(horas * 100) / 100, convite.id);

  res.json({ ok: true, horas_trabalhadas: Math.round(horas * 100) / 100 });
});

// =====================================================================
// AVALIAÇÕES (gestor avalia freelancer após o evento)
// =====================================================================
app.post('/api/convites/:id/avaliar', autenticar('gestor'), (req, res) => {
  const { pontualidade, apresentacao, postura, observacoes } = req.body;
  const convite = db.prepare('SELECT * FROM convites WHERE id=?').get(req.params.id);
  if (!convite) return res.status(404).json({ erro: 'Convite não encontrado' });
  const media = (Number(pontualidade) + Number(apresentacao) + Number(postura)) / 3;

  db.prepare(`
    INSERT INTO avaliacoes (convite_id, freelancer_id, evento_id, pontualidade, apresentacao, postura, nota_media, observacoes)
    VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(convite_id) DO UPDATE SET pontualidade=excluded.pontualidade, apresentacao=excluded.apresentacao, postura=excluded.postura, nota_media=excluded.nota_media, observacoes=excluded.observacoes
  `).run(convite.id, convite.freelancer_id, convite.evento_id, pontualidade, apresentacao, postura, media, observacoes || '');

  const stats = db.prepare('SELECT AVG(nota_media) as media, COUNT(*) as total FROM avaliacoes WHERE freelancer_id=?').get(convite.freelancer_id);
  db.prepare('UPDATE freelancers SET nota_media=?, total_avaliacoes=? WHERE id=?').run(
    Math.round((stats.media || 0) * 100) / 100, stats.total, convite.freelancer_id
  );
  res.json({ ok: true });
});

// =====================================================================
// AVISOS EM MASSA (gestor manda notificação manual para uma ou mais áreas, ou "todos")
// =====================================================================
app.post('/api/notificacoes/broadcast', autenticar('gestor'), (req, res) => {
  const { areas, titulo, mensagem } = req.body;
  if (!titulo || !mensagem) return res.status(400).json({ erro: 'Preencha o título e a mensagem' });
  const paraTodos = !areas || areas.length === 0 || areas.includes('todos');

  const aprovados = db.prepare("SELECT id, areas FROM freelancers WHERE status='aprovado'").all();
  const destinatarios = aprovados.filter(f => {
    if (paraTodos) return true;
    const minhasAreas = JSON.parse(f.areas || '[]');
    return minhasAreas.some(a => areas.includes(a));
  });

  destinatarios.forEach(f => criarNotificacao(f.id, 'aviso', titulo, mensagem));
  res.json({ ok: true, enviados: destinatarios.length });
});

// ---- mensagens favoritas (modelos reutilizáveis do gestor) ----
app.get('/api/mensagens-modelo', autenticar('gestor'), (req, res) => {
  res.json(db.prepare('SELECT * FROM mensagens_modelo WHERE gestor_id=? ORDER BY criado_em DESC').all(req.usuario.id));
});
app.post('/api/mensagens-modelo', autenticar('gestor'), (req, res) => {
  const { titulo, texto } = req.body;
  if (!titulo || !texto) return res.status(400).json({ erro: 'Preencha título e texto' });
  const info = db.prepare('INSERT INTO mensagens_modelo (gestor_id, titulo, texto) VALUES (?,?,?)').run(req.usuario.id, titulo, texto);
  res.json({ id: info.lastInsertRowid });
});
app.delete('/api/mensagens-modelo/:id', autenticar('gestor'), (req, res) => {
  db.prepare('DELETE FROM mensagens_modelo WHERE id=? AND gestor_id=?').run(req.params.id, req.usuario.id);
  res.json({ ok: true });
});

// =====================================================================
// NOTIFICAÇÕES (freelancer)
// =====================================================================
app.get('/api/freelancer/notificacoes', autenticar('freelancer'), (req, res) => {
  const notifs = db.prepare('SELECT * FROM notificacoes WHERE freelancer_id=? ORDER BY criado_em DESC LIMIT 50').all(req.usuario.id);
  res.json(notifs);
});

app.post('/api/freelancer/notificacoes/:id/lida', autenticar('freelancer'), (req, res) => {
  db.prepare('UPDATE notificacoes SET lida=1 WHERE id=? AND freelancer_id=?').run(req.params.id, req.usuario.id);
  res.json({ ok: true });
});

// =====================================================================
// DASHBOARD (gestor) — números gerais
// =====================================================================
app.get('/api/dashboard/resumo', autenticar('gestor'), (req, res) => {
  const totalFreelancers = db.prepare("SELECT COUNT(*) as n FROM freelancers WHERE status='aprovado'").get().n;
  const pendentesAprovacao = db.prepare("SELECT COUNT(*) as n FROM freelancers WHERE status='pendente'").get().n;
  const totalRestaurantes = db.prepare('SELECT COUNT(*) as n FROM restaurantes WHERE ativo=1').get().n;
  const eventosHoje = db.prepare("SELECT COUNT(*) as n FROM eventos WHERE data = date('now')").get().n;
  const eventosFuturos = db.prepare("SELECT COUNT(*) as n FROM eventos WHERE data >= date('now')").get().n;
  const checkinsHoje = db.prepare(`
    SELECT COUNT(*) as n FROM registros_ponto rp JOIN convites c ON c.id=rp.convite_id JOIN eventos e ON e.id=c.evento_id
    WHERE date(rp.checkin_em) = date('now')
  `).get().n;
  res.json({ totalFreelancers, pendentesAprovacao, totalRestaurantes, eventosHoje, eventosFuturos, checkinsHoje });
});

app.get('/api/health', (req, res) => res.json({ ok: true, servico: 'Agência Rodrigues Freelancer API' }));

// =====================================================================
// ALERTA AUTOMÁTICO — 2h antes do evento (roda a cada 5 minutos)
// Avisa cada freelancer com convite aceito, uma única vez por evento.
// =====================================================================
db.exec(`
CREATE TABLE IF NOT EXISTS alertas_enviados (
  convite_id INTEGER PRIMARY KEY REFERENCES convites(id)
);
`);

function verificarAlertas2h() {
  const proximos = db.prepare(`
    SELECT c.id as convite_id, c.freelancer_id, e.titulo, e.data, e.hora_inicio, r.nome_empresa
    FROM convites c
    JOIN eventos e ON e.id = c.evento_id
    JOIN restaurantes r ON r.id = e.restaurante_id
    WHERE c.status='aceito'
      AND datetime(e.data || ' ' || e.hora_inicio) BETWEEN datetime('now') AND datetime('now', '+2 hours')
      AND c.id NOT IN (SELECT convite_id FROM alertas_enviados)
  `).all();

  for (const item of proximos) {
    criarNotificacao(
      item.freelancer_id,
      'sistema',
      'Evento em breve ⏰',
      `Faltam menos de 2h para "${item.titulo}" em ${item.nome_empresa}, às ${item.hora_inicio}. Confira o uniforme e o trajeto!`,
      item.convite_id
    );
    db.prepare('INSERT OR IGNORE INTO alertas_enviados (convite_id) VALUES (?)').run(item.convite_id);
  }
}
setInterval(verificarAlertas2h, 5 * 60 * 1000);
verificarAlertas2h();

app.listen(PORT, () => {
  console.log(`Agência Rodrigues Freelancer — API rodando na porta ${PORT}`);
});

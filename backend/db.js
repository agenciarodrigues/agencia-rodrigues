// db.js — banco de dados SQLite persistente (arquivo em disco).
// Os dados ficam salvos em data/agencia.db e NUNCA são apagados
// quando o app é atualizado — só se o arquivo for apagado manualmente.
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'agencia.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS gestores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS restaurantes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cnpj TEXT NOT NULL,
  nome_empresa TEXT NOT NULL,
  responsavel TEXT NOT NULL,
  telefone TEXT,
  endereco TEXT,
  latitude REAL,
  longitude REAL,
  ativo INTEGER DEFAULT 1,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS freelancers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  cpf TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  telefone TEXT,
  senha_hash TEXT NOT NULL,
  funcao TEXT DEFAULT 'Garçom',
  foto_perfil TEXT,
  status TEXT DEFAULT 'pendente', -- pendente, aprovado, bloqueado
  nota_media REAL DEFAULT 0,
  total_avaliacoes INTEGER DEFAULT 0,
  ultima_lat REAL,
  ultima_lng REAL,
  ultima_localizacao_em TEXT,
  push_token TEXT,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurante_id INTEGER NOT NULL REFERENCES restaurantes(id),
  titulo TEXT NOT NULL,
  data TEXT NOT NULL,
  hora_inicio TEXT NOT NULL,
  hora_fim TEXT NOT NULL,
  endereco TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  funcao TEXT,
  uniforme TEXT,
  observacoes TEXT,
  contato_local TEXT,
  raio_checkin_m INTEGER DEFAULT 100,
  status TEXT DEFAULT 'aberto', -- aberto, em_andamento, concluido, cancelado
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS convites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evento_id INTEGER NOT NULL REFERENCES eventos(id),
  freelancer_id INTEGER NOT NULL REFERENCES freelancers(id),
  status TEXT DEFAULT 'pendente', -- pendente, aceito, recusado
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
  respondido_em TEXT,
  UNIQUE(evento_id, freelancer_id)
);

CREATE TABLE IF NOT EXISTS registros_ponto (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  convite_id INTEGER NOT NULL UNIQUE REFERENCES convites(id),
  checkin_em TEXT,
  checkin_foto TEXT,
  checkin_lat REAL,
  checkin_lng REAL,
  checkin_dist_m REAL,
  checkout_em TEXT,
  checkout_foto TEXT,
  checkout_lat REAL,
  checkout_lng REAL,
  horas_trabalhadas REAL,
  status TEXT DEFAULT 'aguardando' -- aguardando, presente, concluido, falta
);

CREATE TABLE IF NOT EXISTS avaliacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  convite_id INTEGER NOT NULL UNIQUE REFERENCES convites(id),
  freelancer_id INTEGER NOT NULL REFERENCES freelancers(id),
  evento_id INTEGER NOT NULL REFERENCES eventos(id),
  pontualidade INTEGER,
  apresentacao INTEGER,
  postura INTEGER,
  nota_media REAL,
  observacoes TEXT,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notificacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  freelancer_id INTEGER NOT NULL REFERENCES freelancers(id),
  tipo TEXT NOT NULL, -- convite, escala_publicada, aprovacao, sistema, aviso
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  referencia_id INTEGER,
  lida INTEGER DEFAULT 0,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mensagens_modelo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gestor_id INTEGER NOT NULL REFERENCES gestores(id),
  titulo TEXT NOT NULL,
  texto TEXT NOT NULL,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

// ---- migrações leves (adicionam colunas novas sem apagar dados existentes) ----
function tentarAdicionarColuna(tabela, definicao) {
  try { db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${definicao}`); } catch (e) { /* coluna já existe */ }
}
tentarAdicionarColuna('freelancers', "areas TEXT DEFAULT '[]'");
tentarAdicionarColuna('freelancers', 'favorito INTEGER DEFAULT 0');
tentarAdicionarColuna('restaurantes', 'observacoes TEXT');
tentarAdicionarColuna('restaurantes', 'tipo_local TEXT');
tentarAdicionarColuna('freelancers', 'endereco TEXT');

module.exports = db;

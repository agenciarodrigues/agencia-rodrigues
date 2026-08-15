// push.js — envia notificações push reais (aparecem na tela do celular,
// mesmo com o app fechado) via Firebase Cloud Messaging.
//
// Funciona de forma 100% opcional: se as credenciais do Firebase não
// estiverem configuradas, o app continua funcionando normalmente — só as
// notificações "de tela" ficam desativadas, e as notificações continuam
// aparecendo normalmente dentro do app (aba do sininho).
//
// Como ativar (gratuito):
//   1) Crie um projeto em https://console.firebase.google.com (gratuito)
//   2) Adicione um app Android a esse projeto (mesmo appId do capacitor.config.json:
//      com.agenciarodrigues.freelancer) e baixe o google-services.json
//        -> coloque esse arquivo em capacitor-freelancer/android/app/
//   3) No console do Firebase: Configurações do projeto > Contas de serviço >
//      "Gerar nova chave privada" — isso baixa um JSON.
//   4) Copie esse JSON para backend/firebase-service-account.json
//   5) Reinicie o backend. Pronto — os pushes passam a ser enviados de verdade.

const fs = require('fs');
const path = require('path');

const CHAVE_PATH = path.join(__dirname, 'firebase-service-account.json');
let firebaseApp = null;

function tentarInicializar() {
  if (firebaseApp) return firebaseApp;
  if (!fs.existsSync(CHAVE_PATH)) return null;
  try {
    const admin = require('firebase-admin');
    const serviceAccount = require(CHAVE_PATH);
    firebaseApp = admin.apps.length ? admin.app() : admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('✔ Firebase configurado — push notifications reais ativadas.');
    return firebaseApp;
  } catch (e) {
    console.warn('⚠ Não foi possível inicializar o Firebase:', e.message);
    return null;
  }
}

// Chame isso sempre que quiser mandar um push para um freelancer específico.
// Se o Firebase não estiver configurado, ou o freelancer não tiver token salvo,
// a função simplesmente não faz nada (sem quebrar o resto do app).
async function enviarPush(pushToken, titulo, mensagem, dados = {}) {
  if (!pushToken) return;
  const app = tentarInicializar();
  if (!app) return;
  try {
    const admin = require('firebase-admin');
    await admin.messaging().send({
      token: pushToken,
      notification: { title: titulo, body: mensagem },
      data: Object.fromEntries(Object.entries(dados).map(([k, v]) => [k, String(v)])),
      android: { priority: 'high' }
    });
  } catch (e) {
    console.warn('⚠ Falha ao enviar push:', e.message);
  }
}

module.exports = { enviarPush, firebaseConfigurado: () => !!tentarInicializar() };

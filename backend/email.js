// email.js — envia o código de recuperação de senha por email de verdade,
// usando as credenciais SMTP que você configurar nas variáveis de ambiente
// do servidor (no Render: aba "Environment").
//
// Como ativar gratuitamente com o Gmail (2 minutos):
//   1) Ative a verificação em duas etapas na conta Google usada para enviar
//      (myaccount.google.com/security)
//   2) Crie uma "Senha de app" em myaccount.google.com/apppasswords
//   3) No Render, adicione estas variáveis de ambiente:
//      SMTP_HOST = smtp.gmail.com
//      SMTP_PORT = 465
//      SMTP_USER = seuemail@gmail.com
//      SMTP_PASS = a senha de app gerada (16 letras, sem espaço)
//      SMTP_FROM = Agência Rodrigues <seuemail@gmail.com>
//   4) Reinicie o serviço no Render — pronto, os emails passam a sair de verdade.
//
// Sem essas variáveis configuradas, o sistema continua funcionando: o código
// de recuperação é gerado normalmente, só não sai por email (a pessoa pode
// usar a opção "recuperar pelo WhatsApp" nesse caso).

const nodemailer = require('nodemailer');

function transportadorConfigurado() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function criarTransportador() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

async function enviarCodigoRecuperacao(paraEmail, nome, codigo) {
  if (!transportadorConfigurado()) return { enviado: false, motivo: 'email_nao_configurado' };
  try {
    const transportador = criarTransportador();
    await transportador.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: paraEmail,
      subject: 'Código para redefinir sua senha — Agência Rodrigues',
      text: `Olá, ${nome}!\n\nSeu código para redefinir a senha é: ${codigo}\n\nEle é válido por 15 minutos. Se você não pediu isso, ignore este email.`,
      html: `
        <div style="font-family:Arial,sans-serif; background:#0b0b0c; color:#f1ede3; padding:32px; border-radius:12px;">
          <h2 style="color:#d4af37;">Agência Rodrigues</h2>
          <p>Olá, <strong>${nome}</strong>!</p>
          <p>Seu código para redefinir a senha é:</p>
          <p style="font-size:32px; letter-spacing:6px; font-weight:bold; color:#f0d675;">${codigo}</p>
          <p style="color:#a6a3a0; font-size:13px;">Válido por 15 minutos. Se você não pediu isso, pode ignorar este email.</p>
        </div>
      `
    });
    return { enviado: true };
  } catch (e) {
    console.warn('⚠ Falha ao enviar email de recuperação:', e.message);
    return { enviado: false, motivo: 'erro_envio' };
  }
}

module.exports = { enviarCodigoRecuperacao, transportadorConfigurado };

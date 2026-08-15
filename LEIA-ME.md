# Agência Rodrigues Freelancer — Sistema completo

## O que foi construído

1. **`/backend`** — servidor (API) que guarda tudo: restaurantes, freelancers, escalas,
   convites, check-in/check-out com foto + GPS, avaliações e notificações.
   Banco de dados **SQLite** — um arquivo (`backend/data/agencia.db`) que **nunca é apagado**
   quando você atualiza o app. Faça backup desse arquivo de vez em quando.

2. **`/gestao`** — painel de gestão (site, funciona em qualquer navegador, computador ou celular):
   cadastro de restaurantes, aprovação e gestão de freelancers, criação de escalas, envio de
   convites, mapa ao vivo, relatórios por evento e avaliação pós-evento com estrelas.

3. **`/freelancer`** — app do freelancer (o garçom/garçonete): cadastro, aceitar/recusar escala,
   check-in e check-out com selfie + localização, extrato de eventos concluídos, notificações.

4. **`/capacitor-freelancer`** — o mesmo app do freelancer já preparado para virar um **APK Android**
   de verdade (câmera e GPS nativos), usando o framework Capacitor.

## Novidades desta entrega

- **Freelancer com múltiplas áreas de atuação**: no cadastro ele marca todas as áreas em
  que trabalha (lista completa de A&B — garçom, garçonete, bartender, barback, barista,
  cumim, copeiro, recepcionista, hostess, maître, sommelier, cozinheiro, chapeiro,
  pizzaiolo, confeiteiro, steward/louça — além de segurança, bombeiro civil, manobrista e
  apoio geral).
- **Tela animada de aviso do kit obrigatório**: logo após o cadastro, antes de entrar no
  app, aparece uma tela com uma animação avisando o uniforme/kit necessário de cada área
  marcada (ex: garçom → kit social preto completo). O freelancer precisa marcar "confirmo"
  para seguir em frente.
- **Painel de gestão organizado automaticamente por área**: a tela de freelancers agrupa
  sozinha por função (Garçom, Bartender, Segurança etc.) conforme os cadastros vão entrando.
  Também dá pra filtrar por uma área específica.
- **Freelancers favoritos com estrela**: clique na estrela ao lado do nome para marcar quem
  você mais confia — dá pra filtrar só os favoritos com um clique.
- **Aviso em massa por área** (tela nova "Avisos / Notificações"): você escreve a mensagem
  na hora e escolhe quem recebe — uma área específica, várias áreas, ou "Todos". A
  mensagem é escrita manualmente por você a cada envio.
- **Mensagens favoritas**: ao enviar um aviso, marque "salvar como favorita" e ela fica
  disponível pra copiar/reusar depois, sem precisar redigitar.
- **Loading animado** na abertura inicial do app (splash) e também logo depois de fazer
  login/criar conta, nos dois apps (gestão e freelancer), na paleta preto/dourado da logo.

## Como distribuir o APK pelo Google Drive (sem loja de aplicativos)

Depois de gerar o `.apk` no Android Studio (passo a passo abaixo):
1. Suba o arquivo `.apk` para uma pasta no seu Google Drive.
2. Clique com o botão direito → Compartilhar → "Qualquer pessoa com o link" → Leitor.
3. Copie o link e mande pelo WhatsApp para os freelancers.
4. No celular deles, ao abrir o link e tocar em baixar, o Android vai avisar que é de
   "fonte desconhecida" — eles precisam tocar em "Instalar assim mesmo" (ou ativar essa
   opção nas configurações de segurança do aparelho). É assim mesmo, pois o app não está
   na Google Play — é 100% normal para apps distribuídos fora da loja.

## O que eu NÃO consegui fazer por aqui

Este ambiente de chat não tem o Android SDK/Gradle instalado (e não tem acesso à internet
liberado para baixá-los), então **eu não consigo gerar o arquivo .apk final aqui**. O que eu
fiz foi deixar o projeto 100% pronto — falta só um comando rodando no computador de vocês
(ou de um freelancer/dev) com o Android Studio instalado. É rápido, o passo a passo está
abaixo.

## Como testar agora mesmo (no computador)

```bash
# 1) Ligar o backend
cd backend
npm install
npm start
# a API sobe em http://localhost:3000

# 2) Abrir o painel de gestão
# Abra gestao/index.html no navegador (ou sirva com um servidor local)
# Crie sua conta de gestor na primeira tela

# 3) Abrir o app do freelancer
# Abra freelancer/index.html em outra aba/navegador
# Crie um cadastro de freelancer para testar o fluxo completo
```

Para testar em **outro celular na mesma rede Wi-Fi**, troque `localhost` pelo IP do seu
computador nos arquivos `gestao/config.js` e `freelancer/config.js`
(ex: `http://192.168.0.10:3000/api`).

## Como gerar o APK Android (passo a passo)

Pré-requisitos: instalar o **Android Studio** (gratuito, da Google) em um computador Windows,
Mac ou Linux.

```bash
cd capacitor-freelancer
npm install
npx cap add android        # cria o projeto Android nativo dentro de /android
npx cap sync                # copia o app web para dentro do projeto Android
npx cap open android        # abre o Android Studio
```

Dentro do Android Studio: menu **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
Em poucos minutos ele gera o arquivo `.apk` pronto para instalar em qualquer Android
(a partir do Android 7, que cobre praticamente todos os celulares de 2019 em diante).

Esse APK pode ser enviado diretamente por WhatsApp/Drive para os freelancers instalarem
("fontes desconhecidas" precisa estar habilitado no Android deles) — **sem precisar da
Play Store, 100% gratuito**.

### Antes de gerar o APK, ajuste:
- `capacitor-freelancer/www/config.js` → troque `API_BASE` para o endereço do seu servidor
  já publicado na internet (veja seção "Colocar no ar" abaixo) — sem isso o app não vai
  conseguir se conectar de fora da sua rede.
- Ícone do app: troque `capacitor-freelancer/www/assets/logo.png` pela logo, e gere os
  ícones nativos com `npx capacitor-assets generate` (opcional, o Android Studio também
  tem um assistente de ícones em Image Asset Studio).

## Colocar o backend no ar (para funcionar fora da sua rede) — passo a passo gratuito

Já deixei tudo pronto (`Dockerfile` + `render.yaml`) para publicar de graça no Render:

1. Suba a pasta `backend/` para um repositório no GitHub (pode ser privado)
2. Crie conta grátis em https://render.com (sem cartão de crédito)
3. "New +" → "Blueprint" → conecte o repositório → o Render lê o `render.yaml` sozinho
   e já cria o serviço com disco persistente (seus dados não se perdem entre deploys)
4. Ao terminar, copie a URL gerada (ex: `https://agencia-rodrigues-api.onrender.com`)
5. Cole essa URL + `/api` em `gestao/config.js` e `freelancer/config.js`, no campo `API_BASE`
6. Gere o APK novamente (seção acima) com essa URL definitiva

O plano gratuito do Render "dorme" depois de alguns minutos sem uso e demora ~30s para
acordar na primeira requisição do dia — funciona bem para começar a testar com a equipe;
se o uso crescer, um plano pago (ou uma VPS) resolve isso.

## Sobre as notificações — AGORA COM PUSH REAL

O que já está pronto: **notificação dentro do app** (sininho, atualiza sozinho) **e**
**push notification real** (aparece na tela do celular mesmo com o app fechado, como o
WhatsApp) — o código já está todo implementado dos dois lados (backend + app). Só falta
você mesmo criar um projeto gratuito no Firebase e colar as credenciais, porque isso exige
uma conta Google seguindo os termos da própria Google — é o único passo que precisa ser
feito por vocês:

1. Crie um projeto em https://console.firebase.google.com (gratuito, leva 2 minutos)
2. Adicione um app Android com o pacote `com.agenciarodrigues.freelancer`
3. Baixe o `google-services.json` e coloque em `capacitor-freelancer/android/app/`
4. Em Configurações do projeto → Contas de serviço → "Gerar nova chave privada"
5. Salve esse arquivo como `backend/firebase-service-account.json`
6. Reinicie o backend — pronto, os pushes passam a ser enviados de verdade

Enquanto isso não for feito, as notificações continuam funcionando perfeitamente dentro
do app (sininho) — nada quebra, é só um extra que liga sozinho quando configurado.

Já está automatizado: alerta de "faltam 2h para o evento" (verificado a cada 5 minutos
pelo servidor, dispara sozinho, uma vez por escala).

## Sobre a localização ao vivo

O app pede permissão de localização já na primeira tela (antes até do login), como você
pediu, e manda a posição para o servidor a cada ~20 segundos enquanto o app estiver aberto.
Isso alimenta o "Mapa ao vivo" do painel de gestão. Importante: em navegador/PWA, a
localização só é enviada com o app aberto — localização em segundo plano (com o app fechado,
como no Uber) só é possível na versão nativa Android gerada pelo Capacitor, e exige uma
configuração adicional de permissão "sempre permitir localização" que também posso te ajudar
a implementar depois.

## Regra dos 100 metros

Já está implementada no servidor (não dá para burlar pelo app): o check-in só é aceito se a
distância entre o GPS do freelancer e a coordenada cadastrada do evento for de até 100
metros (ajustável por evento, campo "Raio de check-in" na tela de nova escala).

## O que já foi testado de ponta a ponta (funcionando 100%)

Rodei o fluxo completo neste ambiente antes de te entregar: cadastro de gestor, cadastro
de restaurante, cadastro e aprovação de freelancer, criação de evento, envio de convite,
aceite do convite, **check-in fora do raio de 100m sendo corretamente bloqueado**,
check-in dentro do raio sendo aceito, check-out com cálculo de horas, e relatório final
com as fotos. Tudo respondeu exatamente como esperado.

## Próximos passos sugeridos

1. Publicar o backend no Render (passo a passo acima) — 10 minutos.
2. Configurar o Firebase para push notification real — 5 minutos (passo a passo acima).
3. Gerar o primeiro APK e testar em 2-3 celulares reais (Android novo e Android antigo).
4. Versão iPhone (precisa de conta Apple Developer, paga, e Mac para compilar) — posso
   te ajudar a planejar isso quando quiser seguir para essa etapa.

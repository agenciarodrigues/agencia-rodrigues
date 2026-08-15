// areas.js — lista única de áreas de atuação (A&B completo + apoio a eventos)
// e o kit/uniforme obrigatório de cada uma. Usado no cadastro do freelancer
// (tela animada de aviso) e no painel de gestão (agrupamento automático e
// filtro de notificações por área).
const AREAS_ATUACAO = [
  { id: 'garcom', label: 'Garçom', kit: 'Kit social preto: calça social preta, camisa social branca ou preta (conforme o evento), sapato social fechado preto.' },
  { id: 'garconete', label: 'Garçonete', kit: 'Kit social preto: calça ou saia social preta, blusa social branca ou preta, sapato fechado preto.' },
  { id: 'bartender', label: 'Bartender', kit: 'Camisa social preta ou colete, avental (se solicitado pela casa), sapato fechado antiderrapante.' },
  { id: 'barback', label: 'Barback', kit: 'Kit social preto + avental, sapato fechado antiderrapante.' },
  { id: 'barista', label: 'Barista', kit: 'Avental próprio, camisa social, sapato fechado confortável.' },
  { id: 'cumim', label: 'Cumim', kit: 'Kit social preto: calça preta, camisa branca ou preta, sapato fechado preto.' },
  { id: 'copeiro', label: 'Copeiro(a)', kit: 'Kit social preto + avental quando solicitado.' },
  { id: 'recepcionista', label: 'Recepcionista', kit: 'Traje social completo (vestido ou terno social preto), sapato social.' },
  { id: 'hostess', label: 'Hostess', kit: 'Traje social completo, sapato social fechado.' },
  { id: 'maitre', label: 'Maître', kit: 'Terno social preto, gravata, sapato social.' },
  { id: 'sommelier', label: 'Sommelier', kit: 'Traje social completo + saca-rolhas (sommelier knife) próprio.' },
  { id: 'cozinheiro', label: 'Cozinheiro(a)', kit: 'Dólmã branca, calça xadrez, avental, tênis fechado antiderrapante, touca.' },
  { id: 'chapeiro', label: 'Chapeiro(a)', kit: 'Dólmã branca, calça xadrez, avental, tênis fechado antiderrapante, touca.' },
  { id: 'pizzaiolo', label: 'Pizzaiolo(a)', kit: 'Dólmã branca ou camisa da casa, avental, tênis fechado antiderrapante, touca.' },
  { id: 'confeiteiro', label: 'Confeiteiro(a)', kit: 'Dólmã branca, avental, touca, tênis fechado antiderrapante.' },
  { id: 'steward', label: 'Steward / Louça', kit: 'Uniforme de apoio de cozinha, avental impermeável, luvas, bota antiderrapante.' },
  { id: 'seguranca', label: 'Segurança', kit: 'Traje social preto ou uniforme de segurança conforme o contratante; rádio comunicador se solicitado.' },
  { id: 'bombeiro_civil', label: 'Bombeiro civil / Brigadista', kit: 'Uniforme de brigadista certificado, conforme norma vigente.' },
  { id: 'manobrista', label: 'Manobrista', kit: 'Uniforme social + CNH válida em mãos.' },
  { id: 'apoio_geral', label: 'Apoio geral / Estoquista', kit: 'Roupa social preta básica, sapato fechado.' }
];
if (typeof window !== 'undefined') window.AREAS_ATUACAO = AREAS_ATUACAO;

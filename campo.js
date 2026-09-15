/* ============================================================
   Campo de 11 — motor de animação de jogadas
   ============================================================ */

const pitch   = document.getElementById('pitch');
const actors  = document.getElementById('actors');
const rightNet= document.getElementById('rightNet');
const flashEl = document.getElementById('goalFlash');
const statusEl= document.getElementById('status');
const runBtn  = document.getElementById('runBtn');
const resetBtn= document.getElementById('resetBtn');
const scoreHomeEl = document.getElementById('scoreHome');
const scoreAwayEl = document.getElementById('scoreAway');
const playButtons = document.querySelectorAll('.play-btn');

let scoreHome = 0;
let scoreAway = 0;
let running = false;

/* ---------------- base formations (x,y in % of pitch, 0-100) ---
   x: 0 = linha do golo esquerdo, 100 = linha do golo direito
   y: 0 = linha lateral de cima, 100 = linha lateral de baixo
   Equipa A (vermelho) ataca para a direita.
   Equipa B (azul) ataca para a esquerda.                        */

const BASE_ATTACK = {
  A1:[6,50],  A2:[22,18], A3:[22,38], A4:[22,62], A5:[22,82],
  A6:[45,22], A7:[45,40], A8:[45,60], A9:[45,78],
  A10:[65,38], A11:[65,62]
};

const BASE_DEFEND = {
  D1:[94,50], D2:[78,18], D3:[78,38], D4:[78,62], D5:[78,82],
  D6:[58,22], D7:[58,40], D8:[58,60], D9:[58,78],
  D10:[38,38], D11:[38,62]
};

const GK_IDS = new Set(['A1','D1']);

// todos os jogadores de campo da equipa que ataca (sem o guarda-redes),
// usados para o festejo em massa junto à bandeirola de canto
const ALL_ATTACK = ['A2','A3','A4','A5','A6','A7','A8','A9','A10','A11'];

// todos os jogadores de campo da equipa que defende (sem o guarda-redes)
const ALL_DEFEND = ['D2','D3','D4','D5','D6','D7','D8','D9','D10','D11'];

// posições das duas bandeirolas de canto do golo da direita
const CORNER_TOP    = [97, 4];
const CORNER_BOTTOM = [97, 96];

/* ---------------- per-play starting setups (overrides) -------- */

const SETUPS = {

  /* ---- Golo de canto — 4 variações ---- */
  /* Em todas: ~6 de 11 atacantes (>=50%) e ~9 de 11 defesas (>=80%)
     começam dentro da grande área.                                */

  corner_1: { // cruzamento direto, cabeceamento ao primeiro poste
    ball:[98.5, 4],
    attack:{
      A7:[98,4],
      A9:[90,40], A8:[86,55], A10:[85,50], A2:[88,62], A4:[84,45], A11:[90,60],
      A3:[45,40], A5:[45,60], A6:[55,50]
    },
    defend:{
      D1:[97,50],
      D2:[89,25], D3:[85,35], D4:[87,45], D5:[85,55], D6:[88,65], D7:[84,75],
      D8:[90,72], D9:[86,60],
      D10:[55,45], D11:[55,55]
    }
  },

  corner_2: { // canto curto, mini-triangulação, cruzamento, cabeceamento ao segundo poste
    ball:[98.5, 4],
    attack:{
      A7:[98,4], A6:[90,12],
      A9:[88,45], A10:[85,55], A8:[84,42], A2:[87,65], A11:[90,60], A4:[85,48],
      A3:[45,40], A5:[45,60]
    },
    defend:{
      D1:[97,50], D6:[92,12],
      D2:[90,25], D3:[85,38], D4:[87,50], D5:[85,62], D7:[88,72], D8:[84,45],
      D9:[86,58], D11:[90,68],
      D10:[55,50]
    }
  },

  corner_3: { // canto batido, defesa afasta, remate de primeira ao ângulo
    ball:[98.5, 4],
    attack:{
      A7:[98,4], A8:[78,50],
      A9:[88,25], A10:[85,45], A11:[88,62], A2:[90,50], A4:[86,70], A6:[84,35],
      A3:[45,40], A5:[45,60]
    },
    defend:{
      D1:[97,50],
      D2:[90,25], D3:[85,38], D4:[87,58], D5:[85,68], D6:[85,50], D7:[88,30],
      D8:[90,45], D9:[86,62],
      D10:[55,50], D11:[55,60]
    }
  },

  corner_4: { // canto curto trabalhado até à entrada da área, remate cruzado de fora
    ball:[98.5, 4],
    attack:{
      A7:[98,4], A6:[90,12],
      A9:[88,40], A10:[85,55], A8:[84,45], A2:[87,65], A11:[90,60], A4:[85,50],
      A3:[45,40], A5:[45,60]
    },
    defend:{
      D1:[97,50],
      D2:[90,25], D3:[85,38], D4:[87,50], D5:[85,62], D6:[88,70], D7:[84,45],
      D8:[90,58], D9:[86,72],
      D10:[55,50], D11:[55,60]
    }
  },

  /* ---- Contra-ataque — 3 variações ---- */

  contra_1: { // saída curta do guarda-redes, lançamento em profundidade
    ball:[6,50],
    attack:{
      A1:[6,50], A3:[18,45], A10:[45,42], A11:[45,58], A6:[38,50]
    },
    defend:{
      D6:[55,45], D7:[55,55], D10:[65,40], D11:[65,60],
      D2:[75,25], D3:[75,50], D1:[94,50]
    }
  },

  contra_2: { // jogada individual, dribla toda a gente
    ball:[35,50],
    attack:{
      A10:[35,50], A9:[70,35], A11:[70,65], A6:[45,50]
    },
    defend:{
      D10:[50,50], D6:[60,48], D7:[68,52], D3:[80,45], D1:[94,50]
    }
  },

  contra_3: { // contra-ataque pela ala, corrida e cruzamento rasteiro
    ball:[30,15],
    attack:{
      A11:[30,15], A9:[55,50], A10:[70,60], A6:[40,45]
    },
    defend:{
      D2:[55,15], D6:[60,45], D7:[65,55], D10:[75,40], D11:[75,60],
      D3:[80,50], D1:[94,50]
    }
  },

  /* ---- Triangulação — 4 variações distintas ---- */

  triangulacao_1: { // um-dois clássico
    ball:[65,50],
    attack:{ A8:[65,50], A10:[78,45], A9:[70,66] },
    defend:{ D7:[75,48], D6:[70,55], D1:[97,50], D3:[85,45] }
  },

  triangulacao_2: { // triângulo rotativo com três apoios
    ball:[68,40],
    attack:{ A7:[68,40], A8:[76,55], A9:[65,60], A10:[40,50] },
    defend:{ D6:[72,48], D7:[78,50], D1:[97,50], D2:[85,30] }
  },

  triangulacao_3: { // tabela de calcanhar e assistência em profundidade
    ball:[70,55],
    attack:{ A6:[70,55], A7:[75,48], A11:[55,66] },
    defend:{ D6:[74,52], D3:[82,50], D4:[85,65], D1:[97,50] }
  },

  triangulacao_4: { // mudança de ala e remate cruzado
    ball:[55,30],
    attack:{ A7:[55,30], A8:[60,55], A6:[65,45], A10:[80,60] },
    defend:{ D6:[62,35], D9:[65,55], D7:[70,48], D1:[97,50], D4:[85,55] }
  },

  /* ---- Livre ensaiado — 2 variações ---- */

  ensaiada_1: { // variante curta, dois toques extra
    ball:[70,50],
    attack:{ A8:[65,50], A9:[80,38], A10:[80,62], A11:[73,58] },
    defend:{
      D6:[78,46], D7:[78,50], D8:[78,54],
      D2:[85,25], D3:[85,75], D1:[97,50]
    }
  },

  ensaiada_2: { // remate direto por cima da barreira, sem toques extra
    ball:[70,50],
    attack:{ A8:[70,50], A9:[82,40], A11:[82,60] },
    defend:{
      D6:[74,47], D7:[74,50], D8:[74,53],
      D2:[85,25], D3:[85,75], D1:[97,50]
    }
  },

  /* ---- Cruzamento — 2 variações ---- */

  cruzamento_1: { // passe interior, sobreposição e cruzamento tenso
    ball:[70,90],
    attack:{ A11:[70,90], A9:[78,50], A10:[83,58], A8:[65,70] },
    defend:{
      D5:[75,85], D4:[85,52], D3:[83,60], D1:[97,50]
    }
  },

  cruzamento_2: { // cruzamento direto e rápido, sem sobreposição, voleio ao primeiro poste
    ball:[75,85],
    attack:{ A11:[75,85], A9:[85,45], A10:[80,55], A8:[60,70] },
    defend:{
      D5:[78,80], D4:[85,50], D3:[83,58], D1:[97,50]
    }
  }
};

SETUPS.base = { ball:[50,50], attack:{}, defend:{} };

// setup usado apenas para pré-visualizar a jogada na lista, antes de
// se saber qual das variações vai calhar quando o utilizador carregar
// em «Reproduzir jogada»
const PREVIEW_SETUP = {
  corner:'corner_1',
  contra:'contra_1',
  ensaiada:'ensaiada_1',
  triangulacao:'triangulacao_1',
  cruzamento:'cruzamento_1'
};

const DESCRIPTIONS = {
  corner:      'Golo de canto com 4 variações possíveis, escolhida ao acaso sempre que jogas: cruzamento direto ao primeiro poste, canto curto com mini-triangulação ao segundo poste, canto batido com sobra e remate ao ângulo, ou canto trabalhado até à entrada da área com remate cruzado.',
  contra:      'Contra-ataque com 3 variações possíveis: saída curta do guarda-redes com bola em profundidade, jogada individual a driblar toda a defesa, ou corrida pela ala com cruzamento rasteiro.',
  ensaiada:    'Livre direto com 2 variações possíveis: variante curta com dois toques extra antes do remate no ângulo, ou remate direto por cima da barreira.',
  triangulacao:'Triangulação com 4 variações distintas: um-dois clássico, triângulo rotativo com três apoios, tabela de calcanhar com assistência em profundidade, ou mudança de ala com remate cruzado.',
  cruzamento:  'Jogada pelo corredor direito com 2 variações possíveis: passe interior com sobreposição e cruzamento tenso, ou cruzamento direto e rápido para voleio ao primeiro poste.'
};

let currentPlay = 'corner';

/* ---------------- build DOM for players + ball ----------------- */

const playerEls = {};

function buildActors(){
  actors.innerHTML = '';
  Object.keys(BASE_ATTACK).forEach(id=>createPlayer(id,'attack'));
  Object.keys(BASE_DEFEND).forEach(id=>createPlayer(id,'defend'));

  const ball = document.createElement('div');
  ball.className = 'ball';
  ball.id = 'ball';
  actors.appendChild(ball);
}

function createPlayer(id, team){
  const el = document.createElement('div');
  const num = id.replace(/[AD]/,'');
  el.className = 'player ' + team + (GK_IDS.has(id) ? ' gk' : '');
  el.textContent = num;
  el.dataset.id = id;
  actors.appendChild(el);
  playerEls[id] = el;
}

/* ---------------- placement helpers ---------------------------- */

function setPos(el, x, y, instant){
  if(instant){
    const prev = el.style.transition;
    el.style.transition = 'none';
    el.style.left = x + '%';
    el.style.top  = y + '%';
    // force reflow so the "none" transition actually applies
    // before we restore it
    void el.offsetWidth;
    el.style.transition = prev || '';
  } else {
    el.style.left = x + '%';
    el.style.top  = y + '%';
  }
}

function applySetup(name, instant){
  const setup = SETUPS[name] || {};
  const attackPos = Object.assign({}, BASE_ATTACK, setup.attack);
  const defendPos = Object.assign({}, BASE_DEFEND, setup.defend);

  Object.entries(attackPos).forEach(([id,[x,y]])=>{
    setPos(playerEls[id], x, y, instant);
  });
  Object.entries(defendPos).forEach(([id,[x,y]])=>{
    setPos(playerEls[id], x, y, instant);
  });

  const ball = document.getElementById('ball');
  const b = setup.ball || [50,50];
  setPos(ball, b[0], b[1], instant);

  // clear any leftover states
  Object.values(playerEls).forEach(el=>{
    el.classList.remove('jump','celebrate','slump');
    el.style.opacity = 1;
  });
  rightNet.classList.remove('ripple');
  flashEl.classList.remove('show');
}

function resetAll(){
  applySetup('base', true);
}

/* ---------------- movement / animation primitives --------------- */

function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }

function movePlayer(id, x, y, duration){
  const el = playerEls[id];
  el.style.transitionDuration = (duration || 900) + 'ms';
  requestAnimationFrame(()=>{ el.style.left = x+'%'; el.style.top = y+'%'; });
  return wait(duration || 900);
}

function moveBallLinear(x, y, duration){
  const ball = document.getElementById('ball');
  ball.style.transition = `left ${duration}ms linear, top ${duration}ms linear`;
  requestAnimationFrame(()=>{ ball.style.left = x+'%'; ball.style.top = y+'%'; });
  return wait(duration);
}

// quadratic bezier flight for crosses / corners / curling shots
function moveBallCurve(p0, p1, p2, duration){
  const ball = document.getElementById('ball');
  ball.style.transition = 'none';
  const start = performance.now();
  return new Promise(resolve=>{
    function frame(now){
      let t = Math.min(1, (now-start)/duration);
      const x = (1-t)*(1-t)*p0[0] + 2*(1-t)*t*p1[0] + t*t*p2[0];
      const y = (1-t)*(1-t)*p0[1] + 2*(1-t)*t*p1[1] + t*t*p2[1];
      ball.style.left = x+'%';
      ball.style.top  = y+'%';
      if(t<1){ requestAnimationFrame(frame); } else { resolve(); }
    }
    requestAnimationFrame(frame);
  });
}

function setStatus(txt){ statusEl.textContent = txt; }

// desloca um grupo de defesas parcialmente na direção de um ponto
// (a bola, um jogador em corrida, etc.), simulando uma marcação
// mais inteligente: cada defesa "encurta" uma fração da distância
// que o separa do alvo, em vez de ficar estático.
function trackDefenders(ids, target, duration, pull){
  pull = (pull === undefined) ? 0.35 : pull;
  ids.forEach(id=>{
    const el = playerEls[id];
    if(!el) return;
    const curLeft = parseFloat(el.style.left) || 0;
    const curTop  = parseFloat(el.style.top)  || 0;
    const nx = curLeft + (target[0]-curLeft) * pull;
    const ny = curTop  + (target[1]-curTop)  * pull;
    movePlayer(id, nx, ny, duration);
  });
}

// corrida em massa até à bandeirola de canto mais próxima e festejo
function runToCornerAndCelebrate(ids, corner){
  const [fx, fy] = corner || CORNER_TOP;
  const intoY = fy < 50 ? 1 : -1; // aproxima-se do centro do campo no eixo Y
  const offsets = [
    [-1,0*intoY],  [-3,2*intoY],  [-5,1*intoY],  [-2,4*intoY],  [-6,3*intoY],
    [-4,6*intoY],  [-8,5*intoY],  [-1,7*intoY],  [-6,8*intoY],  [-3,9*intoY]
  ];
  const promises = ids.map((id,i)=>{
    const off = offsets[i % offsets.length];
    const x = Math.min(99, Math.max(2, fx + off[0]));
    const y = Math.min(98, Math.max(2, fy + off[1]));
    return movePlayer(id, x, y, 650 + (i % 5) * 90);
  });
  return Promise.all(promises).then(()=>{
    ids.forEach(id=>{
      const el = playerEls[id];
      el.classList.remove('jump');
      el.classList.add('celebrate');
    });
  });
}

async function finishGoal(celebrators, slumpers, message, corner){
  rightNet.classList.add('ripple');
  flashEl.classList.remove('show');
  void flashEl.offsetWidth;
  flashEl.classList.add('show');
  scoreHome += 1;
  scoreHomeEl.textContent = scoreHome;
  slumpers.forEach(id=>{
    playerEls[id].classList.add('slump');
  });
  setStatus(message);
  await wait(300);
  setStatus(message + ' Toda a equipa corre para a bandeirola a festejar!');
  await runToCornerAndCelebrate(celebrators, corner);
}

/* ================================================================
   JOGADA 1 — GOLO DE CANTO  (4 variações)
   ================================================================ */

// Variação 1: cruzamento direto, sem tocar no chão, cabeceamento ao
// primeiro poste.
async function playCorner1(){
  applySetup('corner_1', true);
  setStatus('Variação: cruzamento direto ao primeiro poste. O batedor prepara-se…');
  await wait(500);

  setStatus('A defesa aperta as marcações antes do cruzamento…');
  movePlayer('D2', 92, 30, 400);
  movePlayer('D4', 90, 42, 400);
  movePlayer('D1', 97, 46, 400);
  trackDefenders(['D8','D9'], [90,45], 400, 0.25);
  await wait(150);

  setStatus('Cruzamento direto, sem tocar no chão, para o primeiro poste…');
  const cross = moveBallCurve([98.5,4], [95,18], [92,38], 700);
  movePlayer('A9', 92, 38, 700);
  movePlayer('D2', 93, 40, 700); // tenta acompanhar a corrida de A9
  movePlayer('D6', 90, 35, 700); // fecha o espaço interior
  trackDefenders(['D5','D7'], [92,38], 700, 0.2);
  await cross;

  playerEls['A9'].classList.add('jump');
  setStatus('Cabeceamento de primeira de A9, ao primeiro poste!');
  await wait(220);
  playerEls['A9'].classList.remove('jump');

  const shot = moveBallCurve([92,38], [96,40], [99.4,41], 300);
  movePlayer('D1', 97, 43, 300); // guarda-redes tenta reagir, tarde
  await shot;

  await finishGoal(ALL_ATTACK, ['D2','D4','D6'],
    'GOLO! Cruzamento direto ao primeiro poste, cabeceamento certeiro de A9.', CORNER_TOP);
}

// Variação 2: canto curto, mini-triangulação (um-dois), cruzamento e
// cabeceamento ao segundo poste.
async function playCorner2(){
  applySetup('corner_2', true);
  setStatus('Variação: canto curto com mini-triangulação. O batedor prepara um toque curto…');
  await wait(500);

  setStatus('A defesa reorganiza-se, pressionando o canto curto…');
  movePlayer('D6', 91, 15, 450);
  movePlayer('D2', 91, 30, 450);
  trackDefenders(['D8','D3'], [90,20], 450, 0.2);
  await wait(150);

  setStatus('Toque curto para o companheiro que desceu à linha…');
  const shortPass = moveBallLinear(90, 12, 480);
  await shortPass;

  setStatus('Mini-triangulação: devolve de primeira para o batedor, que avançou…');
  movePlayer('A7', 94, 8, 400);
  movePlayer('D6', 93, 10, 400); // continua a acompanhar de perto
  const oneTwo = moveBallLinear(94, 8, 420);
  await oneTwo;

  setStatus('Cruzamento em curva para o segundo poste…');
  const cross = moveBallCurve([94,8], [90,35], [89,62], 720);
  movePlayer('A11', 89, 62, 720);
  movePlayer('D4', 89, 60, 720); // tenta acompanhar a corrida de A11
  movePlayer('D9', 87, 58, 700); // fecha também o segundo poste
  trackDefenders(['D5','D7'], [89,62], 700, 0.2);
  await cross;

  playerEls['A11'].classList.add('jump');
  setStatus('Cabeceamento de A11, ao segundo poste!');
  await wait(220);
  playerEls['A11'].classList.remove('jump');

  const shot = moveBallCurve([89,62], [94,58], [99.4,52], 340);
  await shot;

  await finishGoal(ALL_ATTACK, ['D2','D4','D6','D9'],
    'GOLO! Canto curto, mini-triangulação e cabeceamento de A11 ao segundo poste.', CORNER_BOTTOM);
}

// Variação 3: canto batido com força, a defesa afasta mas a bola
// sobra à entrada da área para um remate de primeira no ângulo.
async function playCorner3(){
  applySetup('corner_3', true);
  setStatus('Variação: canto batido com força para a área…');
  await wait(500);

  setStatus('A defesa aperta as marcações dentro da área…');
  movePlayer('D2', 89, 27, 400);
  movePlayer('D7', 89, 32, 400);
  trackDefenders(['D5','D9'], [86,50], 400, 0.2);
  await wait(150);

  setStatus('Canto batido, disputado dentro da área…');
  const cross = moveBallCurve([98.5,4], [90,20], [85,50], 700);
  movePlayer('D6', 85, 50, 700);
  await cross;

  setStatus('A defesa afasta o perigo, mas só até à entrada da área…');
  const clearance = moveBallCurve([85,50], [80,50], [76,50], 460);
  playerEls['D6'].classList.add('jump');
  movePlayer('D8', 82, 48, 460); // tenta antecipar-se à sobra
  await clearance;
  playerEls['D6'].classList.remove('jump');

  setStatus('A bola sobra para A8, à entrada da área…');
  movePlayer('D8', 78, 50, 250); // fecha o espaço, mas chega tarde
  await wait(120);

  playerEls['A8'].classList.add('jump');
  setStatus('Remate de primeira de A8, ao ângulo!');
  await wait(200);
  playerEls['A8'].classList.remove('jump');

  const shot = moveBallCurve([76,50], [88,44], [99.4,42], 440);
  movePlayer('D1', 97, 46, 440); // guarda-redes estica-se, sem sucesso
  await shot;

  await finishGoal(ALL_ATTACK, ['D3','D4','D6','D8'],
    'GOLO! A defesa só afasta a meio, e A8 acerta de primeira no ângulo!', CORNER_TOP);
}

// Variação 4: canto curto trabalhado com vários passes até à entrada
// da área, resolvido com um remate cruzado de fora da área.
async function playCorner4(){
  applySetup('corner_4', true);
  setStatus('Variação: canto curto trabalhado. Equipa mantém a posse, sem pressa…');
  await wait(500);

  setStatus('A defesa acompanha a bola, sem se comprometer…');
  movePlayer('D6', 91, 15, 450);
  trackDefenders(['D2','D7'], [90,20], 450, 0.2);
  await wait(150);

  setStatus('Toque curto para o companheiro que desceu à linha…');
  const shortPass = moveBallLinear(90, 12, 460);
  movePlayer('D6', 92, 14, 460);
  await shortPass;

  setStatus('Bola recuada para reorganizar o ataque…');
  const back = moveBallLinear(85, 25, 420);
  movePlayer('A9', 85, 25, 420);
  trackDefenders(['D2','D3'], [85,25], 420, 0.3);
  await back;

  setStatus('Passe interior até à entrada da área…');
  const inCut = moveBallLinear(78, 45, 420);
  movePlayer('A8', 78, 45, 420);
  trackDefenders(['D4','D8'], [78,45], 420, 0.3);
  await inCut;

  setStatus('A8 remata de fora da área, cruzado, ao ângulo mais afastado!');
  const shot = moveBallCurve([78,45], [90,52], [99.4,58], 500);
  movePlayer('D1', 97, 55, 500); // guarda-redes estica-se, tarde
  await shot;

  await finishGoal(ALL_ATTACK, ['D2','D4','D6','D8'],
    'GOLO! Canto trabalhado com vários passes, resolvido com um remate cruzado de fora da área.', CORNER_BOTTOM);
}

/* ================================================================
   JOGADA 2 — CONTRA-ATAQUE  (3 variações)
   ================================================================ */

// Variação 1: saída curta do guarda-redes para o central, que lança
// de imediato a bola em profundidade, nas costas da defesa.
async function playContra1(){
  applySetup('contra_1', true);
  setStatus('Variação: saída curta do guarda-redes. Bola seca, sem risco…');
  await wait(450);

  setStatus('Passe curto e seguro do guarda-redes para o central…');
  const gkPass = moveBallLinear(18, 45, 450);
  trackDefenders(['D6','D7'], [18,45], 450, 0.15);
  await gkPass;

  setStatus('Lançamento imediato, em profundidade, nas costas da defesa!');
  const throughBall = moveBallCurve([18,45], [55,32], [80,32], 950);
  movePlayer('A10', 82, 33, 1000);
  movePlayer('D2', 78, 28, 900); // tenta reagir, mas tarde
  trackDefenders(['D3','D10','D11'], [80,32], 900, 0.3);
  await throughBall;

  setStatus('A10 isolado, controla e avança para a baliza…');
  const control = moveBallLinear(88, 40, 380);
  movePlayer('A10', 88, 40, 380);
  movePlayer('D1', 96, 44, 380); // guarda-redes adianta-se, tenta fechar o ângulo
  await control;

  const shot = moveBallCurve([88,40], [95,46], [99.4,49], 360);
  await shot;

  await finishGoal(ALL_ATTACK, ['D2','D3','D6','D7'],
    'GOLO! Saída curta do guarda-redes e lançamento em profundidade, isolando A10.', CORNER_TOP);
}

// Variação 2: jogada individual — um jogador dribla sozinho todos os
// adversários até marcar.
async function playContra2(){
  applySetup('contra_2', true);
  setStatus('Variação: jogada individual. A10 recebe a bola e arranca sozinho…');
  await wait(450);

  setStatus('Primeiro adversário deixado para trás com um corte de perna…');
  const d1 = moveBallLinear(50, 44, 420);
  movePlayer('A10', 50, 44, 420);
  movePlayer('D10', 52, 46, 380); // tenta o desarme, mas é enganado
  await d1;

  setStatus('Segundo adversário driblado, sem perder o ritmo…');
  const d2 = moveBallLinear(62, 54, 420);
  movePlayer('A10', 62, 54, 420);
  movePlayer('D6', 63, 52, 400); // fecha a linha de passe, mas é ultrapassado
  await d2;

  setStatus('Terceiro adversário também fica para trás…');
  const d3 = moveBallLinear(72, 44, 420);
  movePlayer('A10', 72, 44, 420);
  movePlayer('D7', 71, 47, 400); // salta para o desarme, sem sucesso
  await d3;

  setStatus('Já só falta o último defesa, à entrada da área…');
  const d4 = moveBallLinear(83, 50, 420);
  movePlayer('A10', 83, 50, 420);
  movePlayer('D3', 86, 48, 500); // tenta o desarme, tarde demais
  await d4;

  setStatus('A10 encara também o guarda-redes e resolve sozinho!');
  const shot = moveBallCurve([83,50], [92,46], [99.4,45], 420);
  movePlayer('D1', 97, 47, 420); // guarda-redes tenta reduzir o ângulo
  await shot;

  await finishGoal(ALL_ATTACK, ['D10','D6','D7','D3'],
    'GOLO! Jogada individual fantástica — A10 dribla toda a defesa e marca!', CORNER_TOP);
}

// Variação 3: contra-ataque pela ala, corrida em velocidade e
// cruzamento rasteiro para o companheiro que chega da segunda linha.
async function playContra3(){
  applySetup('contra_3', true);
  setStatus('Variação: contra-ataque pela ala. A11 arranca pela linha…');
  await wait(450);

  setStatus('Corrida em velocidade pela ala, com o defesa a tentar acompanhar…');
  const run = moveBallLinear(85, 10, 900);
  movePlayer('A11', 85, 10, 900);
  movePlayer('D2', 80, 14, 950); // tenta acompanhar, mas fica para trás
  trackDefenders(['D10','D11'], [70,20], 900, 0.2);
  await run;

  setStatus('Já perto da linha de fundo, prepara o cruzamento…');
  movePlayer('A9', 88, 48, 600);
  trackDefenders(['D3','D1'], [88,48], 600, 0.3);
  await wait(150);

  setStatus('Cruzamento rasteiro, tenso, para a área…');
  const cross = moveBallCurve([85,10], [86,30], [88,48], 520);
  movePlayer('D3', 86, 47, 520); // tenta cortar, sem sucesso
  await cross;

  playerEls['A9'].classList.add('jump');
  setStatus('A9 chega da segunda linha e finaliza de primeira!');
  await wait(180);
  playerEls['A9'].classList.remove('jump');

  const shot = moveBallCurve([88,48], [94,49], [99.4,50], 320);
  await shot;

  await finishGoal(ALL_ATTACK, ['D2','D3','D10'],
    'GOLO! Contra-ataque pela ala, corrida e cruzamento rasteiro, resolvido por A9.', CORNER_TOP);
}

/* ================================================================
   JOGADA 3 — LIVRE ENSAIADO  (2 variações)
   ================================================================ */

// Variação 1: variante curta com dois toques extra antes do remate.
async function playEnsaiada1(){
  applySetup('ensaiada_1', true);
  setStatus('Variação: livre ensaiado, variante curta. Dois jogadores prontos…');
  await wait(500);

  movePlayer('A9', 84, 40, 500);
  movePlayer('A11', 84, 60, 500);
  trackDefenders(['D2','D3'], [80,50], 500, 0.2);
  await wait(200);

  setStatus('Toque curto em vez do remate direto…');
  const tap = moveBallLinear(74, 46, 400);
  movePlayer('A6', 74, 46, 400);
  trackDefenders(['D6','D7'], [74,46], 400, 0.25);
  await tap;

  setStatus('A6 devolve de primeira para o marcador da bola parada…');
  const layback = moveBallLinear(68, 52, 350);
  movePlayer('A8', 68, 52, 350);
  trackDefenders(['D8'], [68,52], 350, 0.25);
  await layback;

  setStatus('A8 pica a bola por cima da barreira…');
  const shot = moveBallCurve([68,52], [85,25], [99.3,40], 850);
  movePlayer('A9', 90, 30, 500);
  movePlayer('D1', 97, 42, 500); // guarda-redes tenta acompanhar a trajetória
  await shot;

  await finishGoal(ALL_ATTACK, ['D6','D7','D8','D2','D3'],
    'GOLO! Variante do livre ensaiado engana a barreira, remate no ângulo.', CORNER_TOP);
}

// Variação 2: remate direto e forte por cima da barreira, sem toques
// extra, direto ao ângulo superior.
async function playEnsaiada2(){
  applySetup('ensaiada_2', true);
  setStatus('Variação: livre direto, sem variante. O batedor encara a barreira…');
  await wait(600);

  setStatus('A barreira salta, mas a bola já vai por cima…');
  playerEls['D6'].classList.add('jump');
  playerEls['D7'].classList.add('jump');
  playerEls['D8'].classList.add('jump');
  const shot = moveBallCurve([70,50], [80,18], [99.3,40], 900);
  movePlayer('D1', 97, 40, 900); // guarda-redes tenta alcançar, sem sucesso
  await shot;
  playerEls['D6'].classList.remove('jump');
  playerEls['D7'].classList.remove('jump');
  playerEls['D8'].classList.remove('jump');

  await finishGoal(ALL_ATTACK, ['D6','D7','D8'],
    'GOLO! Remate direto e colocado, por cima da barreira, no ângulo superior!', CORNER_TOP);
}

/* ================================================================
   JOGADA 4 — TRIANGULAÇÃO  (4 variações distintas)
   ================================================================ */

// Variação 1: um-dois clássico (parede) à entrada da área.
async function playTriangulacao1(){
  applySetup('triangulacao_1', true);
  setStatus('Variação: um-dois clássico. A8 procura a parede…');
  await wait(400);

  setStatus('Passe para o apoio de parede…');
  const wallIn = moveBallLinear(78, 45, 400);
  trackDefenders(['D1'], [78,45], 400, 0.1);
  await wallIn;

  setStatus('Devolução de primeira, para o espaço nas costas do defesa!');
  const wallOut = moveBallLinear(85, 52, 480);
  movePlayer('A8', 85, 52, 700);
  movePlayer('D7', 82, 50, 550); // tenta cortar a linha de passe, tarde
  await wallOut;

  setStatus('A8 fica isolado frente à baliza!');
  const shot = moveBallCurve([85,52], [94,50], [99.4,49], 340);
  await shot;

  await finishGoal(ALL_ATTACK, ['D7','D6','D3'],
    'GOLO! Um-dois clássico rasga a defesa e A8 não perdoa.', CORNER_BOTTOM);
}

// Variação 2: triângulo rotativo — três apoios trocam a bola várias
// vezes em torno da área antes de lançar o avançado.
async function playTriangulacao2(){
  applySetup('triangulacao_2', true);
  setStatus('Variação: triângulo rotativo. Três jogadores trocam posições e bola…');
  await wait(400);

  setStatus('Primeiro lado do triângulo…');
  const p1 = moveBallLinear(76, 55, 380);
  trackDefenders(['D1'], [76,55], 380, 0.1);
  await p1;

  setStatus('Segundo lado do triângulo…');
  const p2 = moveBallLinear(65, 60, 380);
  movePlayer('D6', 70, 55, 450);
  await p2;

  setStatus('Terceiro lado do triângulo, a bola continua a rodar…');
  movePlayer('A7', 80, 45, 500); // A7 continua o movimento rotativo
  const p3 = moveBallLinear(80, 45, 420);
  await p3;

  setStatus('Depois de tanta rotação, o passe final rasga a defesa!');
  const p4 = moveBallCurve([80,45], [86,48], [90,50], 480);
  movePlayer('A10', 90, 50, 700); // chega de trás para finalizar
  movePlayer('D7', 87, 49, 550);
  await p4;

  setStatus('A10 aparece a finalizar de primeira!');
  const shot = moveBallCurve([90,50], [96,49], [99.4,49], 320);
  await shot;

  await finishGoal(ALL_ATTACK, ['D6','D7','D2'],
    'GOLO! Depois de um triângulo rotativo com três apoios, A10 finaliza sem hipótese para o guarda-redes.', CORNER_BOTTOM);
}

// Variação 3: tabela de calcanhar e assistência final em profundidade.
async function playTriangulacao3(){
  applySetup('triangulacao_3', true);
  setStatus('Variação: tabela de calcanhar. A6 combina com A7 à entrada da área…');
  await wait(400);

  setStatus('Passe para A7, de costas para a baliza…');
  const pass1 = moveBallLinear(75, 48, 380);
  trackDefenders(['D1'], [75,48], 380, 0.1);
  await pass1;

  setStatus('Calcanhar de primeira, sem olhar, para o espaço!');
  const backheel = moveBallLinear(70, 58, 380);
  movePlayer('A6', 72, 60, 420);
  await backheel;

  setStatus('A6 recebe e serve de primeira, em profundidade, para A11!');
  const through = moveBallCurve([70,58], [82,64], [92,60], 650);
  movePlayer('A11', 92, 60, 650);
  movePlayer('D4', 88, 63, 600); // tenta acompanhar a corrida, tarde
  await through;

  setStatus('A11 isolado, sozinho perante o guarda-redes!');
  const shot = moveBallCurve([92,60], [97,54], [99.4,51], 340);
  await shot;

  await finishGoal(ALL_ATTACK, ['D3','D4','D6'],
    'GOLO! Tabela de calcanhar e assistência em profundidade — A11 resolve isolado.', CORNER_BOTTOM);
}

// Variação 4: mudança de ala rápida, terminando em remate cruzado.
async function playTriangulacao4(){
  applySetup('triangulacao_4', true);
  setStatus('Variação: mudança de ala. A7 procura o lado mais fraco da defesa…');
  await wait(400);

  setStatus('Passe diagonal, a mudar o jogo para o outro corredor…');
  const switchPass = moveBallLinear(60, 55, 480);
  movePlayer('D9', 63, 53, 480); // tenta fechar o novo corredor
  trackDefenders(['D1'], [60,55], 480, 0.1);
  await switchPass;

  setStatus('Triangulação rápida à entrada da área…');
  const combo = moveBallLinear(65, 45, 380);
  movePlayer('A6', 65, 45, 380);
  movePlayer('D7', 68, 48, 420); // acompanha o movimento
  await combo;

  setStatus('Passe final para a corrida de A10!');
  const through = moveBallCurve([65,45], [75,55], [85,60], 500);
  movePlayer('A10', 85, 60, 650);
  movePlayer('D6', 82, 58, 600); // tenta cortar a corrida, tarde
  await through;

  setStatus('A10 remata cruzado, sem hipótese para o guarda-redes!');
  const shot = moveBallCurve([85,60], [93,54], [99.4,58], 380);
  await shot;

  await finishGoal(ALL_ATTACK, ['D9','D7','D6'],
    'GOLO! Mudança de ala rápida e remate cruzado de A10.', CORNER_BOTTOM);
}

/* ================================================================
   JOGADA 5 — CRUZAMENTO  (2 variações)
   ================================================================ */

// Variação 1: passe interior, sobreposição e cruzamento tenso.
async function playCruzamento1(){
  applySetup('cruzamento_1', true);
  setStatus('Variação: sobreposição pela direita. Jogada pelo corredor direito…');
  await wait(400);

  setStatus('Passe interior a preparar a sobreposição…');
  const inside = moveBallLinear(70,75,420);
  movePlayer('A8', 70,75,420);
  trackDefenders(['D1'], [70,75], 420, 0.1);
  await inside;

  setStatus('Passe para a sobreposição na linha…');
  const overlap = moveBallLinear(80,88,450);
  movePlayer('A11', 80,88, 450);
  movePlayer('A9', 84, 46, 900); // já se posiciona na área
  movePlayer('D5', 78, 84, 450); // tenta acompanhar a sobreposição
  await overlap;

  const run = moveBallLinear(88,86,400);
  movePlayer('A11', 88,86, 400);
  movePlayer('D5', 85, 84, 400);
  await run;

  setStatus('Cruzamento tenso para a área…');
  const cross = moveBallCurve([88,86],[87,66],[86,52],650);
  movePlayer('D4', 87, 50, 650);
  movePlayer('A10', 82, 58, 650);
  trackDefenders(['D3'], [86,52], 650, 0.25);
  await cross;

  playerEls['A9'].classList.add('jump');
  await wait(220);
  playerEls['A9'].classList.remove('jump');

  const shot = moveBallCurve([86,52],[93,50],[99.4,50], 340);
  await shot;

  await finishGoal(ALL_ATTACK, ['D3','D4','D5'],
    'GOLO! Jogada trabalhada pela direita, com sobreposição, e cabeceamento certeiro de A9.', CORNER_TOP);
}

// Variação 2: cruzamento direto e rápido, sem sobreposição, com
// voleio ao primeiro poste.
async function playCruzamento2(){
  applySetup('cruzamento_2', true);
  setStatus('Variação: cruzamento direto. A11 recebe fundo, sem esperar por apoio…');
  await wait(400);

  setStatus('Avanço rápido pela linha, já a preparar o cruzamento…');
  const run = moveBallLinear(82, 78, 400);
  movePlayer('A11', 82, 78, 400);
  movePlayer('D5', 80, 78, 420); // tenta fechar o corredor
  await run;

  setStatus('Cruzamento rápido e direto, primeiro toque, sem cortar para dentro…');
  const cross = moveBallCurve([82,78], [86,62], [88,48], 550);
  movePlayer('A9', 88, 46, 650);
  movePlayer('D4', 88, 50, 550); // tenta antecipar-se ao cruzamento
  trackDefenders(['D3'], [88,48], 550, 0.25);
  await cross;

  setStatus('A9 atira-se para o voleio de primeira, ao primeiro poste!');
  const shot = moveBallCurve([88,46], [94,44], [99.4,43], 320);
  movePlayer('D1', 97, 45, 320); // guarda-redes tenta reagir
  await shot;

  await finishGoal(ALL_ATTACK, ['D4','D5','D3'],
    'GOLO! Cruzamento direto e rápido, resolvido de voleio por A9 ao primeiro poste.', CORNER_TOP);
}

/* ---------------- grupos de variações ---------------------------- */

const VARIANT_GROUPS = {
  corner:       [playCorner1, playCorner2, playCorner3, playCorner4],
  contra:       [playContra1, playContra2, playContra3],
  ensaiada:     [playEnsaiada1, playEnsaiada2],
  triangulacao: [playTriangulacao1, playTriangulacao2, playTriangulacao3, playTriangulacao4],
  cruzamento:   [playCruzamento1, playCruzamento2]
};

// evita repetir a mesma variação duas vezes seguidas
const lastVariantIndex = {};

function pickVariant(groupName){
  const variants = VARIANT_GROUPS[groupName];
  let idx = Math.floor(Math.random() * variants.length);
  if(variants.length > 1 && lastVariantIndex[groupName] === idx){
    idx = (idx + 1) % variants.length;
  }
  lastVariantIndex[groupName] = idx;
  return variants[idx];
}

const PLAYS = {
  corner:       ()=>pickVariant('corner')(),
  contra:       ()=>pickVariant('contra')(),
  ensaiada:     ()=>pickVariant('ensaiada')(),
  triangulacao: ()=>pickVariant('triangulacao')(),
  cruzamento:   ()=>pickVariant('cruzamento')()
};

/* ---------------- UI wiring ------------------------------------- */

function selectPlay(name){
  currentPlay = name;
  playButtons.forEach(b=>b.classList.toggle('active', b.dataset.play === name));
  applySetup(PREVIEW_SETUP[name] || name, true);
  setStatus(DESCRIPTIONS[name] + ' Carrega em «Reproduzir jogada».');
}

playButtons.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    if(running) return;
    selectPlay(btn.dataset.play);
  });
});

runBtn.addEventListener('click', async ()=>{
  if(running) return;
  running = true;
  runBtn.disabled = true;
  try{
    await PLAYS[currentPlay]();
  } finally {
    running = false;
    runBtn.disabled = false;
  }
});

resetBtn.addEventListener('click', ()=>{
  if(running) return;
  scoreHome = 0; scoreAway = 0;
  scoreHomeEl.textContent = 0;
  scoreAwayEl.textContent = 0;
  selectPlay(currentPlay);
});

/* ---------------- init -------------------------------------------- */

buildActors();
applySetup(PREVIEW_SETUP.corner, true);
setStatus(DESCRIPTIONS.corner + ' Carrega em «Reproduzir jogada».');

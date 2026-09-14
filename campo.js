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

// posições das duas bandeirolas de canto do golo da direita
const CORNER_TOP    = [97, 4];
const CORNER_BOTTOM = [97, 96];

/* ---------------- per-play starting setups (overrides) -------- */

const SETUPS = {

  corner: {
    ball:[98.5, 4],
    attack:{
      A7:[98,4], A9:[90,34], A10:[84,52], A11:[88,66], A8:[76,50],
      A6:[58,50]
    },
    defend:{
      D1:[97,50], D2:[89,33], D3:[85,50], D4:[87,65], D5:[80,50],
      D6:[62,30], D7:[62,50], D8:[62,70]
    }
  },

  contra:{
    ball:[35,50],
    attack:{ A6:[35,50], A7:[38,60], A10:[55,45], A11:[55,55] },
    defend:{
      D2:[55,20], D3:[52,45], D4:[52,55], D5:[55,80],
      D10:[70,45], D11:[70,55], D1:[94,50]
    }
  },

  ensaiada:{
    ball:[70,50],
    attack:{ A8:[65,50], A9:[80,38], A10:[80,62], A11:[73,58] },
    defend:{
      D6:[78,46], D7:[78,50], D8:[78,54],
      D2:[85,25], D3:[85,75], D1:[97,50]
    }
  },

  triangulacao:{
    ball:[72,45],
    attack:{ A7:[72,45], A8:[78,58], A10:[83,48], A9:[70,62] },
    defend:{ D6:[76,50], D7:[82,55], D1:[97,50], D3:[85,42] }
  },

  cruzamento:{
    ball:[70,90],
    attack:{ A11:[70,90], A9:[78,50], A10:[83,58], A8:[65,70] },
    defend:{
      D5:[75,85], D4:[85,52], D3:[83,60], D1:[97,50]
    }
  }
};

const DESCRIPTIONS = {
  corner:      'Canto ensaiado em curto: toque lateral, cruzamento, desvio de cabeça e assistência final antes do remate.',
  contra:      'Recuperação de bola e troca de vários passes em velocidade, com assistência final para o golo.',
  ensaiada:    'Livre direto à entrada da área com variante curta: dois toques extra antes do remate no ângulo.',
  triangulacao:'Sequência de várias triangulações à entrada da área, com muitos apoios até furar a defesa.',
  cruzamento:  'Jogada pelo corredor direito com passe interior, sobreposição e cruzamento para o desvio na área.'
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
SETUPS.base = { ball:[50,50], attack:{}, defend:{} };

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
   JOGADA 1 — GOLO DE CANTO
   Canto curto ensaiado: toque lateral, cruzamento em curva, desvio
   de cabeça ao primeiro poste, assistência para trás e finalização.
   ================================================================ */

async function playCorner(){
  applySetup('corner', true);
  setStatus('O batedor prepara um canto ensaiado em curto…');
  await wait(500);

  setStatus('Toque curto para o companheiro que desceu à linha…');
  const shortPass = moveBallLinear(90, 12, 500);
  movePlayer('A6', 90, 12, 500);
  movePlayer('D6', 92, 16, 550);
  await shortPass;

  setStatus('Devolve de primeira — cruzamento em curva para a área…');
  const ballFlight = moveBallCurve([90,12], [90,24], [90,35], 700);
  movePlayer('A9', 92, 29, 700);
  movePlayer('D2', 90, 30, 700);
  movePlayer('A11', 90, 70, 700);
  movePlayer('D4', 89, 68, 700);
  movePlayer('A7', 80, 50, 700); // o batedor entra na área depois do passe
  await ballFlight;

  setStatus('Desvio de cabeça para trás, à entrada da pequena área…');
  const flick = moveBallCurve([90,35], [86,42], [82,46], 500);
  movePlayer('A8', 82, 46, 500);
  movePlayer('D3', 84, 47, 550);
  await flick;

  setStatus('A8 assiste de primeira para A10…');
  const layoff = moveBallLinear(86, 49, 400);
  movePlayer('A10', 86, 49, 400);
  await layoff;

  playerEls['A10'].classList.add('jump');
  setStatus('Remate colocado de A10!');
  await wait(260);
  playerEls['A10'].classList.remove('jump');

  const shot = moveBallCurve([86,49], [94,50], [99.4,50], 380);
  await shot;

  await finishGoal(ALL_ATTACK, ['D2','D3','D4','D6'],
    'GOLO! Canto ensaiado em curto, com desvio e assistência, resolvido por A10.', CORNER_TOP);
}

/* ================================================================
   JOGADA 2 — CONTRA-ATAQUE
   Vários toques em velocidade até à assistência final.
   ================================================================ */

async function playContra(){
  applySetup('contra', true);
  setStatus('Bola recuperada no meio-campo… transição rápida.');
  await wait(450);

  setStatus('Primeiro passe para o lado, a explorar o espaço.');
  const p1 = moveBallLinear(45, 55, 550);
  movePlayer('A7', 45, 55, 550);
  movePlayer('D10', 52, 52, 700);
  await p1;

  setStatus('Passe em profundidade para o avançado.');
  const p2 = moveBallLinear(70, 45, 650);
  movePlayer('A10', 70, 45, 650);
  movePlayer('D3', 74, 47, 850);
  await p2;

  setStatus('Condução até perto da área…');
  const dribble = moveBallLinear(85, 47, 500);
  movePlayer('A10', 85, 47, 500);
  movePlayer('A11', 90, 60, 900); // chega atrasado ao segundo poste
  await dribble;

  setStatus('Assistência para trás, para o companheiro isolado!');
  const cutback = moveBallLinear(90, 58, 380);
  await cutback;

  playerEls['A11'].classList.add('jump');
  await wait(150);
  playerEls['A11'].classList.remove('jump');

  const shot = moveBallCurve([90,58], [96,52], [99.4,49], 350);
  await shot;

  await finishGoal(ALL_ATTACK, ['D2','D3','D4','D5','D10','D11'],
    'GOLO! Contra-ataque com vários passes rápidos, resolvido por A11.', CORNER_BOTTOM);
}

/* ================================================================
   JOGADA 3 — LIVRE ENSAIADO
   Variante curta com dois toques extra antes do remate.
   ================================================================ */

async function playEnsaiada(){
  applySetup('ensaiada', true);
  setStatus('Livre à entrada da área. Dois jogadores prontos para a variante curta.');
  await wait(500);

  movePlayer('A9', 84, 40, 500);
  movePlayer('A11', 84, 60, 500);
  await wait(200);

  setStatus('Toque curto em vez do remate direto…');
  const tap = moveBallLinear(74, 46, 400);
  movePlayer('A6', 74, 46, 400);
  await tap;

  setStatus('A6 devolve de primeira para o marcador da bola parada…');
  const layback = moveBallLinear(68, 52, 350);
  movePlayer('A8', 68, 52, 350);
  await layback;

  setStatus('A8 pica a bola por cima da barreira…');
  const shot = moveBallCurve([68,52], [85,25], [99.3,40], 850);
  movePlayer('A9', 90, 30, 500);
  await shot;

  await finishGoal(ALL_ATTACK, ['D6','D7','D8','D2','D3'],
    'GOLO! Variante do livre ensaiado engana a barreira, remate no ângulo.', CORNER_TOP);
}

/* ================================================================
   JOGADA 4 — TRIANGULAÇÃO
   Sequência alargada de triangulações com mais apoios.
   ================================================================ */

async function playTriangulacao(){
  applySetup('triangulacao', true);
  setStatus('Troca de posições à entrada da área…');
  await wait(400);

  const p0 = moveBallLinear(70, 60, 380);
  movePlayer('A9', 70, 60, 380);
  await p0;

  setStatus('Primeiro triângulo de passes…');
  const p1 = moveBallLinear(78,58,420);
  await p1;

  const p2 = moveBallLinear(83,48,420);
  movePlayer('A10', 83,48, 420);
  movePlayer('D7', 80,52, 500);
  await p2;

  setStatus('Um-dois rápido com mais um apoio…');
  const p3 = moveBallLinear(76,44,380);
  movePlayer('A7', 76,44,380);
  await p3;

  const p4 = moveBallLinear(90,49,420);
  movePlayer('A10', 90,49, 420);
  movePlayer('D3', 88,49, 500);
  await p4;

  setStatus('A10 fica isolado frente à baliza…');
  const shot = moveBallCurve([90,49], [96,49], [99.4,49], 320);
  await shot;

  await finishGoal(ALL_ATTACK, ['D6','D7','D3'],
    'GOLO! Longa sequência de triangulações desfaz a defesa e A10 não perdoa.', CORNER_BOTTOM);
}

/* ================================================================
   JOGADA 5 — CRUZAMENTO
   Passe interior, sobreposição e cruzamento tenso.
   ================================================================ */

async function playCruzamento(){
  applySetup('cruzamento', true);
  setStatus('Jogada pelo corredor direito…');
  await wait(400);

  setStatus('Passe interior a preparar a sobreposição…');
  const inside = moveBallLinear(70,75,420);
  movePlayer('A8', 70,75,420);
  await inside;

  setStatus('Passe para a sobreposição na linha…');
  const overlap = moveBallLinear(80,88,450);
  movePlayer('A11', 80,88, 450);
  movePlayer('A9', 84, 46, 900); // já se posiciona na área
  await overlap;

  const run = moveBallLinear(88,86,400);
  movePlayer('A11', 88,86, 400);
  await run;

  setStatus('Cruzamento tenso para a área…');
  const cross = moveBallCurve([88,86],[87,66],[86,52],650);
  movePlayer('D4', 87, 50, 650);
  movePlayer('A10', 82, 58, 650);
  await cross;

  playerEls['A9'].classList.add('jump');
  await wait(220);
  playerEls['A9'].classList.remove('jump');

  const shot = moveBallCurve([86,52],[93,50],[99.4,50], 340);
  await shot;

  await finishGoal(ALL_ATTACK, ['D3','D4','D5'],
    'GOLO! Jogada trabalhada pela direita, com sobreposição, e cabeceamento certeiro de A9.', CORNER_TOP);
}

const PLAYS = {
  corner: playCorner,
  contra: playContra,
  ensaiada: playEnsaiada,
  triangulacao: playTriangulacao,
  cruzamento: playCruzamento
};

/* ---------------- UI wiring ------------------------------------- */

function selectPlay(name){
  currentPlay = name;
  playButtons.forEach(b=>b.classList.toggle('active', b.dataset.play === name));
  applySetup(name, true);
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
applySetup('corner', true);
setStatus(DESCRIPTIONS.corner + ' Carrega em «Reproduzir jogada».');
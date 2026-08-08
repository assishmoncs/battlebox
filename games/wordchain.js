'use strict';

const { buildScores, endGame } = require('./utils');

// Minimal English word list – enough for fair play without a heavy dict dependency.
// In production, replace with a full word-list npm package (e.g. `word-list`).
const VALID_WORDS = new Set([
  'apple','ample','elder','erode','eagle','angle','enter','elite','eight','elect',
  'about','above','abuse','actor','acute','admit','adopt','adult','after','again',
  'agent','agree','ahead','alarm','album','alert','alien','align','alive','alley',
  'allow','alone','along','alter','angel','anger','angle','angry','ankle','annex',
  'apart','apply','arena','argue','arise','armor','army','aroma','arose','array',
  'arrow','asset','atlas','attic','audio','audit','aunty','avail','avoid','award',
  'aware','awful','badly','baker','basic','basis','batch','beach','began','begin',
  'being','below','bench','bible','birth','black','blade','blame','bland','blank',
  'blast','blaze','bleed','blend','bless','blind','block','blood','bloom','blown',
  'board','boast','bonus','boost','booth','bound','boxer','brain','brand','brave',
  'bread','break','breed','brick','bride','brief','bring','broad','broke','brook',
  'brown','brush','built','bunch','burst','buyer','cabin','cable','camel','candy',
  'carry','catch','cause','chain','chair','chalk','chaos','charm','chart','chase',
  'cheap','check','cheek','chest','chief','child','china','choir','civic','civil',
  'claim','class','clean','clear','clerk','click','cliff','climb','cling','clock',
  'clone','close','cloth','cloud','coach','coast','color','comet','comic','comma',
  'coral','could','count','court','cover','craft','crash','crazy','cream','creek',
  'crime','cross','crowd','crown','cruel','crush','curve','cycle','daily','dance',
  'death','delay','delta','depth','devil','digit','dirty','disco','doubt','dough',
  'draft','drain','drama','drank','drawn','dream','dress','dried','drive','drone',
  'drove','drink','drove','drugs','drums','drunk','dryer','dying','eager','early',
  'earth','empty','enemy','enjoy','enter','entry','equal','error','essay','event',
  'every','exact','exist','extra','fable','faced','faith','false','fancy','fatal',
  'fault','feast','fence','fever','field','fifty','fight','final','first','fixed',
  'flame','flash','fleet','flesh','flick','fling','float','flood','floor','flour',
  'fluid','flute','focus','force','forge','forth','forum','found','frame','frank',
  'fraud','fresh','front','frost','fruit','funny','ghost','giant','given','glass',
  'globe','gloom','glory','glove','going','grace','grade','grain','grand','grant',
  'grasp','grass','grave','great','green','greet','grief','grind','groan','groin',
  'group','guard','guess','guide','guild','guile','guilt','guitar','habit','harsh',
  'heard','heart','heavy','hedge','hello','hence','hertz','honey','honor','horse',
  'hotel','house','human','humor','hurry','hyena','ideal','image','imply','inbox',
  'index','indie','inner','input','inter','intro','issue','ivory','label','lance',
  'large','laser','later','laugh','layer','learn','lease','least','legal','level',
  'light','limit','linen','liver','local','loose','lower','lucky','lunar','magic',
  'major','maker','manor','maple','march','match','mayor','media','mercy','merge',
  'metal','meter','minor','model','money','month','moral','motor','mount','mouse',
  'mouth','moved','movie','music','naval','nerve','never','night','noble','north',
  'noted','novel','nurse','oasis','occur','ocean','offer','often','olive','omega',
  'onset','opera','orbit','order','organ','other','ought','outer','oxide','ozone',
  'paint','panel','panic','paper','patch','pause','peace','pearl','penny','phase',
  'phone','photo','piano','piece','pilot','pitch','pixel','pizza','place','plain',
  'plane','plant','plaza','plead','pluck','plumb','plume','point','poker','polar',
  'poppy','pound','power','press','price','pride','prime','print','prior','prize',
  'probe','prone','proof','proud','prove','psalm','pulse','punch','pupil','purse',
  'queen','query','queue','quick','quiet','quota','quote','radar','radio','raise',
  'rally','ranch','range','rapid','ratio','reach','ready','realm','rebel','rebus',
  'recap','relay','reply','repay','rerun','reset','ridge','rifle','right','risky',
  'rival','river','robot','rocky','roman','rouge','rough','round','route','royal',
  'rugby','ruler','rural','saint','salad','sauce','scale','scene','scent','scope',
  'score','scout','seize','sense','serve','setup','seven','shade','shall','shame',
  'shape','share','shark','sharp','sheep','sheer','shelf','shell','shift','shirt',
  'shock','shoot','short','shout','sight','sigma','silly','since','sixth','sixty',
  'skill','skull','slate','sleep','slide','slope','small','smart','smell','smile',
  'smoke','solar','solid','solve','sorry','south','space','spare','spark','speak',
  'spear','speed','spend','spice','spike','spine','spite','split','spoke','spoon',
  'sport','spray','squad','stack','staff','stage','stain','stake','stand','stark',
  'start','state','stays','steam','steel','steep','steer','stern','stick','still',
  'stock','stone','stood','store','storm','story','strap','straw','strip','study',
  'stuff','style','sugar','super','surge','swamp','swear','sweep','sweet','swift',
  'swing','swipe','sword','sworn','table','taken','talon','taste','teach','tense',
  'thank','theme','thick','thing','think','third','thorn','those','three','threw',
  'throw','tiger','tight','timer','tired','title','today','token','total','touch',
  'tough','tower','toxic','trace','track','trade','trail','train','trait','trash',
  'treat','trend','trial','tribe','trick','tried','troop','truck','truly','trunk',
  'trust','truth','tumor','tuner','twice','twist','ultra','under','union','unity',
  'until','upper','upset','urban','usage','using','usual','utter','valid','value',
  'valve','vapor','vault','video','vigor','viola','viral','virus','visit','vista',
  'vital','vivid','vocal','voice','voter','vague','valid','waste','watch','water',
  'weary','wedge','weird','whale','wheat','wheel','where','which','while','white',
  'whole','wider','woman','women','world','worry','worth','would','wound','wrath',
  'write','yacht','yield','young','youth','zebra','zonal'
]);

function isValidWord(word) {
  return VALID_WORDS.has(word);
}

module.exports = function wordchain(roomCode, word, io, rooms, playerId) {
  const room = rooms[roomCode];
  if (!room || room.state !== 'playing') return;

  const currentPlayerIndex = room.gameState.currentPlayer || 0;
  const currentPlayer = room.players[currentPlayerIndex];
  const targetSocketId = playerId || (currentPlayer ? currentPlayer.id : roomCode);

  if (typeof word !== 'string') {
    return io.to(targetSocketId).emit('error', 'Invalid word');
  }

  const cleanWord = word.trim().toLowerCase();

  if (cleanWord.length < 2) {
    return io.to(targetSocketId).emit('error', 'Word must be at least 2 letters');
  }
  if (!/^[a-z]+$/.test(cleanWord)) {
    return io.to(targetSocketId).emit('error', 'Word must contain only letters');
  }

  if (!room.gameState.chain) room.gameState.chain = [];
  if (!room.gameState.lastLetter) room.gameState.lastLetter = 'a';
  if (!room.gameState.usedWords) room.gameState.usedWords = [];

  const nextIdx = (currentPlayerIndex + 1) % room.players.length;
  const nextPlayer = room.players[nextIdx];

  // Check starting letter
  if (cleanWord[0] !== room.gameState.lastLetter) {
    room.gameState.currentPlayer = nextIdx;
    return io.to(roomCode).emit('updateGameState', {
      gameState: room.gameState,
      scores: buildScores(room),
      status: `❌ "${cleanWord}" must start with "${room.gameState.lastLetter.toUpperCase()}". ${currentPlayer.name}'s turn skipped. ${nextPlayer.name}'s turn.`,
      currentPlayerId: nextPlayer.id
    });
  }

  // Check for duplicate
  if (room.gameState.usedWords.includes(cleanWord)) {
    room.gameState.currentPlayer = nextIdx;
    return io.to(roomCode).emit('updateGameState', {
      gameState: room.gameState,
      scores: buildScores(room),
      status: `❌ "${cleanWord}" was already used! ${currentPlayer.name}'s turn skipped. ${nextPlayer.name}'s turn.`,
      currentPlayerId: nextPlayer.id
    });
  }

  // Dictionary check (BUG-05)
  if (!isValidWord(cleanWord)) {
    room.gameState.currentPlayer = nextIdx;
    return io.to(roomCode).emit('updateGameState', {
      gameState: room.gameState,
      scores: buildScores(room),
      status: `❌ "${cleanWord}" is not a valid word! ${currentPlayer.name}'s turn skipped. ${nextPlayer.name}'s turn.`,
      currentPlayerId: nextPlayer.id
    });
  }

  // Valid word — update state
  room.gameState.chain.push(cleanWord);
  room.gameState.usedWords.push(cleanWord);
  room.gameState.lastLetter = cleanWord.slice(-1);
  currentPlayer.score += cleanWord.length;
  room.gameState.currentPlayer = nextIdx;

  // Check game over (each player has had 5 turns)
  if (room.gameState.chain.length >= room.players.length * 5) {
    endGame(roomCode, io, rooms, 'Word Chain');
    return;
  }

  io.to(roomCode).emit('updateGameState', {
    gameState: room.gameState,
    scores: buildScores(room),
    status: `✅ "${cleanWord}" accepted! (+${cleanWord.length} pts) ${nextPlayer.name}'s turn — word starting with "${room.gameState.lastLetter.toUpperCase()}"`,
    currentPlayerId: nextPlayer.id
  });
};

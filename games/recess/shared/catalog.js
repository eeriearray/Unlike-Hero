// The RECESS game catalog. Shared by the server (matchmaking rules) and the browser (lobby cards, How to Play).
// Adding a game: add an entry here, an engine in server/engines/, register it in server/registry.mjs,
// and a client module in js/games/<id>.js.
//
// min / max      players per match
// auto           start automatically as soon as `max` players are waiting
// manual         a waiting player may press Start once `min` players are waiting
// bots           "Practice with bots" fills empty seats with schoolyard bots
// solo           a one-player desk toy: starts immediately, no queue

export const CATEGORIES = [
  { id: 'all', name: 'All games' },
  { id: 'paper', name: 'Paper Games' },
  { id: 'party', name: 'Party Games' },
  { id: 'playground', name: 'Playground' },
  { id: 'board', name: 'Board Games' }
];

export const CATALOG = [
  {
    id: 'ttt', name: 'Tic-Tac-Toe', category: 'paper', min: 2, max: 2, auto: true, manual: false, bots: true,
    blurb: 'Three in a row on the back page of your rough notebook.',
    color: '#2f6fde',
    rules: [
      'Take turns drawing your mark (X or O) in an empty square.',
      'Three of your marks in a row — across, down or diagonal — wins the round.',
      'All nine squares full and no line? It\'s a draw. Rematch swaps who goes first.'
    ]
  },
  {
    id: 'sps', name: 'Stone Paper Scissors', category: 'paper', min: 2, max: 2, auto: true, manual: false, bots: true,
    blurb: 'The desk-dispute settler. Best of three or five.',
    color: '#e0563b',
    rules: [
      'Both players lock a hand in secret. Nobody sees a choice until both are locked.',
      'Stone blunts Scissors, Scissors cut Paper, Paper wraps Stone.',
      'First to win the majority of the rounds (best of 3 or 5) takes the match.'
    ]
  },
  {
    id: 'dots', name: 'Dots & Boxes', category: 'paper', min: 2, max: 2, auto: true, manual: false, bots: true,
    blurb: 'Join the dots, steal the boxes, never give away a third side.',
    color: '#16a085',
    rules: [
      'On your turn draw one line between two neighbouring dots.',
      'Close the fourth side of a box and it is yours — and you draw again.',
      'When every box is taken, the player with the most boxes wins.'
    ]
  },
  {
    id: 'rmcs', name: 'Raja Mantri Chor Sipahi', category: 'party', min: 4, max: 4, auto: true, manual: false, bots: true,
    blurb: 'Four folded chits. One thief. Can the Mantri catch the Chor?',
    color: '#c0392b',
    rules: [
      'Four secret chits are dealt: Raja, Mantri, Chor and Sipahi. Only you see yours.',
      'The Raja and Mantri reveal themselves. The Mantri must point at the Chor.',
      'Right guess: Mantri keeps 800 points and the Chor gets 0. Wrong guess: the Chor steals the Mantri\'s 800.',
      'Raja always earns 1000 and Sipahi 500. Play as many rounds as you like; highest total wins.'
    ]
  },
  {
    id: 'flames', name: 'FLAMES', category: 'paper', min: 1, max: 1, solo: true, auto: true, manual: false, bots: false,
    blurb: 'Two names, one crossed-out word. Purely scientific. (It isn\'t.)',
    color: '#e84393',
    rules: [
      'Write two names. Letters the names share are crossed out, one for one.',
      'Count the letters left over. Count around F-L-A-M-E-S that many times and strike the letter you land on.',
      'Keep counting from the next letter until one is left: Friends, Love, Affection, Marriage, Enemies or Siblings.',
      'Keep the result to yourself or pin it to the room\'s notice board. It is a playground game, not a prophecy.'
    ]
  },
  {
    id: 'npat', name: 'Name Place Animal Thing', category: 'party', min: 2, max: 8, auto: false, manual: true, bots: false,
    blurb: 'One letter, one minute, six columns. Pens down when the bell rings!',
    color: '#8e44ad',
    rules: [
      'Everyone gets the same letter. Fill each column with a word starting with it before time runs out.',
      'Press "Pens down" early if you finish — the round ends when everyone has, or when the timer hits zero.',
      'Review: tap ✗ on any answer you think is fake. If most of the other players reject it, it scores 0.',
      'Unique answers score 10, shared answers 5, blank or wrong-letter answers 0. Five rounds, highest total wins.'
    ]
  },
  {
    id: 'bluff', name: 'Bluff', category: 'party', min: 3, max: 6, auto: false, manual: true, bots: true,
    blurb: 'Cards face down, poker face up. Call "Bluff!" if you dare.',
    color: '#2c3e50',
    rules: [
      'The whole deck is dealt. Get rid of every card to win.',
      'Starting a pile, pick a rank and play 1–4 cards face down, claiming they are all that rank.',
      'Next players must claim the same rank (truthfully or not!) or pass.',
      'Anyone can call "Bluff!" on the latest play before the next player moves. Caught lying? You pick up the whole pile. Called it wrong? You pick it up.',
      'If everyone passes, the pile is thrown away and the last player to play starts a fresh one.',
      'Play your last card and survive the Bluff call to win.'
    ]
  },
  {
    id: 'colour', name: 'Colour Colour', category: 'playground', min: 2, max: 8, auto: false, manual: true, bots: true,
    blurb: '"Colour colour, which colour?" Find it before the caller catches you!',
    color: '#f39c12',
    rules: [
      'Each round one player is the caller and shouts a colour (or picks one at random).',
      'Everyone else races to tap an object of that colour on the desk.',
      'First correct tap scores 3, second 2, anyone else in time 1. A wrong tap locks you out for the round.',
      'The caller scores 1 for every player who misses. Rounds get faster and the desk gets messier.'
    ]
  },
  {
    id: 'snakes', name: 'Snakes & Ladders', category: 'board', min: 2, max: 4, auto: true, manual: true, bots: true,
    blurb: 'Climb the ladders, dodge the snakes, land exactly on 100.',
    color: '#27ae60',
    rules: [
      'Roll the die on your turn and move your token that many squares.',
      'Land at the foot of a ladder to climb it; land on a snake\'s head and slide down its tail.',
      'You need the exact number to land on 100. Too high and you stay put.',
      'Rolling a 6 gives you another roll. First to 100 wins.'
    ]
  },
  {
    id: 'ludo', name: 'Ludo', category: 'board', min: 2, max: 4, auto: true, manual: true, bots: true,
    blurb: 'Roll a six to get out, then race your four tokens home.',
    color: '#d35400',
    rules: [
      'You need a 6 to bring a token out onto your start square.',
      'Move one token by the number rolled. A 6 gives another roll — but three 6s in a row ends your turn.',
      'Land on an opponent\'s token to send it back to base and earn a bonus roll. Starred squares and start squares are safe.',
      'Tokens walk once around the board, then up their own colour lane. You need the exact roll to reach home.',
      'First player with all four tokens home wins.'
    ]
  },
  {
    id: 'penfight', name: 'Pen Fight', category: 'playground', min: 2, max: 2, auto: true, manual: false, bots: true,
    blurb: 'Flick your pen. Knock theirs off the desk. Classic last-bench sport.',
    color: '#34495e',
    rules: [
      'Drag back from your pen and let go to flick it. Longer drag, harder flick.',
      'Where you grab the pen matters: flick near an end to make it spin.',
      'Knock the other pen off the desk while yours stays on to win the round.',
      'If your own pen falls off, you lose the round. First to 3 rounds wins.'
    ]
  },
  {
    id: 'marbles', name: 'Marble Knockout', category: 'playground', min: 2, max: 4, auto: true, manual: true, bots: true,
    blurb: 'Kancha in the chalk ring. Shoot to knock the others out.',
    color: '#2980b9',
    rules: [
      'Everyone has a shooter marble inside the chalk ring, with target marbles scattered in the middle.',
      'On your turn drag back from your shooter and release to shoot.',
      'Knock a target marble out of the ring for 1 point and shoot again (up to 3 shots a turn). Knock out another player\'s shooter for 2 points (no extra shot).',
      'If your shooter leaves the ring, you lose 1 point and it is put back at the edge.',
      'When all targets are gone, the highest score wins.'
    ]
  },
  {
    id: 'carrom', name: 'Carrom', category: 'board', min: 2, max: 2, auto: true, manual: false, bots: true,
    blurb: 'Powder on the board, flick the striker, pocket the queen and cover it.',
    color: '#b9770e',
    rules: [
      'Player 1 owns the white coins, player 2 the black. Place your striker anywhere on your baseline and flick it.',
      'Pocket one of your own coins to shoot again. Pocketing the striker is a foul: you lose a turn and one pocketed coin returns to the centre.',
      'The red queen is worth 3 points but must be "covered": pocket one of your own coins on the same or the next shot, or the queen goes back.',
      'Pocketing an opponent\'s coin gives them the point. Clear all your coins to finish the board.',
      'Score: 1 per coin, 3 for a covered queen. The player who clears their coins first wins the board.'
    ]
  }
];

export const CATALOG_BY_ID = Object.fromEntries(CATALOG.map(g => [g.id, g]));

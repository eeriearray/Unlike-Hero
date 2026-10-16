/* Party Pack content. Every prompt, fact and voice line lives here so writers can edit
   without touching game logic. Custom packs (UGC, 7-character share codes) are merged in by
   js/ugc.js under the same keys. */
window.PP = window.PP || {};
PP.CONTENT = {
  // 1. The Comedy Writer — head-to-head prompts
  quip: [
    'The worst thing to hear from your Uber driver',
    'A rejected flavour of sports drink',
    'What your houseplant says about you behind your back',
    'The real reason the dinosaurs went extinct',
    'A terrible name for a retirement home',
    'The worst thing to find in a fortune cookie',
    'A new Olympic sport for people who hate exercise',
    'What the Mona Lisa is actually smirking about',
    'The worst possible wedding vow',
    'A bad thing to whisper to a horse',
    'The title of a self-help book written by a raccoon',
    'What aliens find most confusing about Earth',
    'A rejected subject at wizard school',
    'The worst superpower to get on a Tuesday',
    'What the "check engine" light actually means',
    'A slogan for a funeral home with a sense of humour',
    'The worst thing to say in a job interview',
    'A terrible name for a boat',
    'What is actually at the bottom of the Bermuda Triangle',
    'The worst ice cream topping',
    'Something you should never yell in a library',
    'The least comforting thing a pilot can say over the intercom',
    'A new holiday nobody asked for',
    'The worst thing to bring to a potluck',
    'What your dog thinks your job is',
    'A rejected answer from a Magic 8 Ball',
    'The worst thing to engrave on a trophy',
    'A sign you are in a low-budget horror movie',
    'The worst name for a perfume',
    'What really happens at the DMV after closing time',
    'A text you never want to get from your landlord',
    'The worst theme for a child\'s birthday party'
  ],
  // The Gauntlet: rapid fill-in-the-blank, 10 seconds each
  gauntlet: [
    'My therapist says I need to stop ____.',
    'Breaking news: local man arrested for ____ at the zoo.',
    'Nothing ruins a first date like ____.',
    'The secret ingredient in Grandma\'s cookies is ____.',
    'I\'m not saying it\'s aliens, but ____.',
    'Scientists are baffled by ____.',
    'My LinkedIn headline: Professional ____.',
    'The ancient prophecy foretold ____.',
    'It\'s not a party until someone ____.',
    'Warning: do not ____ while operating heavy machinery.',
    'Tonight\'s special at the haunted restaurant: ____.',
    'The last thing you want to hear at the dentist: "____."'
  ],
  safetyQuips: ['My ex', 'A haunted Roomba', 'Three raccoons in a trench coat', 'Soup, but angrier', 'Tax fraud', 'A very confident pigeon', 'Your search history', 'Mild disappointment', 'A sentient spreadsheet', 'The Wi-Fi password'],

  // 2. The Bluffing Game — every answer here is true. alts are other accepted spellings.
  fib: [
    { q: 'Wombats are the only animals known to produce ____-shaped poop.', a: 'cube', alts: ['cubes', 'cubic', 'square', 'a cube'], house: ['heart', 'star', 'spiral'] },
    { q: 'In 1932 the Australian military went to war against ____ — and lost.', a: 'emus', alts: ['emu', 'the emus'], house: ['kangaroos', 'rabbits', 'cane toads'] },
    { q: 'A group of flamingos is called a ____.', a: 'flamboyance', alts: ['a flamboyance'], house: ['pinkening', 'sashay', 'blush'] },
    { q: 'Fredric Baur, who designed the Pringles can, had some of his ashes buried in ____.', a: 'a Pringles can', alts: ['pringles can', 'pringles', 'a pringles tube', 'pringles tube'], house: ['a bowling ball', 'a crisp packet', 'a cereal box'] },
    { q: 'The national animal of Scotland is the ____.', a: 'unicorn', alts: ['unicorns', 'a unicorn'], house: ['haggis', 'stag', 'loch ness monster'] },
    { q: 'Bananas are slightly ____.', a: 'radioactive', alts: [], house: ['magnetic', 'carnivorous', 'alcoholic'] },
    { q: 'Cleopatra lived closer in time to the Moon landing than to the building of the ____.', a: 'Great Pyramid', alts: ['great pyramid of giza', 'pyramids', 'pyramid', 'the pyramids', 'the great pyramid'], house: ['Colosseum', 'Parthenon', 'Great Wall'] },
    { q: 'A single day on Venus is longer than a Venus ____.', a: 'year', alts: ['a year'], house: ['decade', 'lunar month', 'season'] },
    { q: 'In Switzerland it is illegal to own just one ____.', a: 'guinea pig', alts: ['guinea pigs'], house: ['goldfish', 'cow', 'cuckoo clock'] },
    { q: 'The first item ever sold on eBay was a broken ____.', a: 'laser pointer', alts: ['laserpointer', 'laser'], house: ['toaster', 'Furby', 'calculator'] },
    { q: 'The dot above a lowercase "i" is called a ____.', a: 'tittle', alts: ['a tittle'], house: ['jot', 'pip', 'speck'] },
    { q: 'Before video games, Nintendo was founded in 1889 to make ____.', a: 'playing cards', alts: ['cards', 'card games', 'hanafuda cards', 'hanafuda'], house: ['umbrellas', 'rice cookers', 'kites'] },
    { q: 'Oxford University is older than the ____ Empire.', a: 'Aztec', alts: ['aztecs', 'the aztec'], house: ['Roman', 'Persian', 'Egyptian'] },
    { q: 'In the 1830s, ketchup was sold in America as a ____.', a: 'medicine', alts: ['medicine', 'cure', 'remedy', 'medication', 'pill', 'pills'], house: ['hair dye', 'love potion', 'paint'] },
    { q: 'Hawaiian pizza was invented in ____.', a: 'Canada', alts: ['ontario'], house: ['Sweden', 'Ohio', 'New Zealand'] },
    { q: 'Pigeons have been trained to tell the difference between paintings by Monet and ____.', a: 'Picasso', alts: [], house: ['Van Gogh', 'Bob Ross', 'Rembrandt'] },
    { q: 'Sea otters hold ____ while they sleep so they don\'t drift apart.', a: 'hands', alts: ['paws', 'hand'], house: ['seaweed', 'rocks', 'tails'] },
    { q: 'An octopus has ____ hearts.', a: 'three', alts: ['3'], house: ['two', 'five', 'eight'] }
  ],

  // 3. The Terrible Artist — drawing prompts (also used as decoy filler)
  draw: [
    'a sad cowboy', 'a vampire at the dentist', 'the moon\'s day off', 'a confident potato', 'a cat\'s job interview',
    'grandma\'s secret tattoo', 'a haunted toaster', 'a shark at a job fair', 'the last slice of pizza', 'a spider learning to ice skate',
    'a snowman in a sauna', 'a dog\'s dream', 'a ghost doing taxes', 'the world\'s tiniest bodybuilder', 'a nervous volcano',
    'a cactus that wants a hug', 'a pirate\'s day off', 'a robot falling in love', 'a giraffe in a tiny car', 'a wizard stuck in traffic',
    'a banana\'s midlife crisis', 'the internet\'s grandpa', 'an angry cloud', 'a worm\'s wedding', 'a penguin\'s first day at the beach',
    'a hot dog in witness protection', 'a lazy superhero', 'an octopus doing laundry', 'a frog king\'s selfie', 'a toddler running a bank'
  ],

  // 4. The Cutthroat Quiz — a is the index of the right option
  quiz: [
    { q: 'What is the only mammal capable of true flight?', o: ['Flying squirrel', 'Bat', 'Sugar glider', 'Colugo'], a: 1 },
    { q: 'What is the largest organ of the human body?', o: ['Liver', 'Brain', 'Skin', 'Lungs'], a: 2 },
    { q: 'Which element has the chemical symbol "Au"?', o: ['Silver', 'Gold', 'Argon', 'Aluminium'], a: 1 },
    { q: 'In which year did the Titanic sink?', o: ['1905', '1912', '1918', '1923'], a: 1 },
    { q: 'Which blood type is the universal red-cell donor?', o: ['AB positive', 'A negative', 'O negative', 'B positive'], a: 2 },
    { q: 'What is a baby kangaroo called?', o: ['Kit', 'Joey', 'Cub', 'Pup'], a: 1 },
    { q: 'How many bones are in the adult human body?', o: ['186', '206', '226', '256'], a: 1 },
    { q: 'Which animal has fingerprints almost identical to a human\'s?', o: ['Koala', 'Chimpanzee', 'Raccoon', 'Sloth'], a: 0 },
    { q: 'What is the smallest prime number?', o: ['0', '1', '2', '3'], a: 2 },
    { q: 'Which is the largest ocean on Earth?', o: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], a: 3 },
    { q: 'What is the capital of Australia?', o: ['Sydney', 'Melbourne', 'Canberra', 'Perth'], a: 2 },
    { q: 'How many keys does a standard piano have?', o: ['76', '88', '96', '104'], a: 1 },
    { q: 'Which fruit is banned on Singapore\'s trains because of its smell?', o: ['Jackfruit', 'Durian', 'Mangosteen', 'Rambutan'], a: 1 },
    { q: 'The Mohs scale measures a mineral\'s…', o: ['Weight', 'Hardness', 'Shine', 'Age'], a: 1 },
    { q: 'What is the longest bone in the human body?', o: ['Femur', 'Tibia', 'Humerus', 'Spine'], a: 0 },
    { q: 'Which country gave the Statue of Liberty to the United States?', o: ['England', 'Spain', 'France', 'Italy'], a: 2 },
    { q: 'Which is the only letter that appears in no U.S. state name?', o: ['J', 'Q', 'X', 'Z'], a: 1 },
    { q: 'What colour is a polar bear\'s skin?', o: ['White', 'Pink', 'Black', 'Grey'], a: 2 },
    { q: 'Which planet spins on its side?', o: ['Neptune', 'Uranus', 'Saturn', 'Mars'], a: 1 },
    { q: 'What gas do plants take in for photosynthesis?', o: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Helium'], a: 2 },
    { q: 'Who painted the Mona Lisa?', o: ['Michelangelo', 'Raphael', 'Leonardo da Vinci', 'Caravaggio'], a: 2 },
    { q: 'In Morse code, "··· −−− ···" spells…', o: ['SOS', 'OSO', 'HELP', 'SMS'], a: 0 },
    { q: 'Which is the hardest natural substance?', o: ['Quartz', 'Titanium', 'Diamond', 'Granite'], a: 2 },
    { q: 'Roughly how fast does light travel?', o: ['300 km/s', '3,000 km/s', '300,000 km/s', '3 million km/s'], a: 2 }
  ],
  // The Exit — the final race, quick three-option questions
  exit: [
    { q: 'Spiders have how many legs?', o: ['6', '8', '10'], a: 1 },
    { q: '7 × 8 = ?', o: ['54', '56', '64'], a: 1 },
    { q: 'Heavier: 1 kg of feathers or 1 kg of steel?', o: ['Feathers', 'Steel', 'Same'], a: 2 },
    { q: 'Minutes in two hours?', o: ['100', '120', '140'], a: 1 },
    { q: 'Closest planet to the Sun?', o: ['Venus', 'Mercury', 'Mars'], a: 1 },
    { q: 'Angles of a triangle add up to…', o: ['90°', '180°', '360°'], a: 1 },
    { q: 'Fastest land animal?', o: ['Cheetah', 'Horse', 'Lion'], a: 0 },
    { q: 'Which is prime?', o: ['6', '7', '9'], a: 1 },
    { q: 'Capital of Japan?', o: ['Kyoto', 'Osaka', 'Tokyo'], a: 2 },
    { q: '12 squared?', o: ['124', '144', '164'], a: 1 },
    { q: 'Months with 31 days?', o: ['6', '7', '8'], a: 1 },
    { q: 'Water boils at sea level at…', o: ['90 °C', '100 °C', '110 °C'], a: 1 },
    { q: 'Which is a mammal?', o: ['Shark', 'Dolphin', 'Trout'], a: 1 },
    { q: 'How many sides on a hexagon?', o: ['5', '6', '8'], a: 1 },
    { q: 'Opposite of "nocturnal"?', o: ['Diurnal', 'Lunar', 'Eternal'], a: 0 },
    { q: 'Half of 250?', o: ['115', '125', '135'], a: 1 }
  ],

  // 5. The Chaos Mashup
  teeInspo: ['anything you would wear', 'a majestic animal', 'a food with feelings', 'a logo for a fake band', 'a creature from your nightmares', 'your spirit vegetable', 'a very proud bug', 'something that belongs on a mug', 'a tiny king', 'the best day ever'],
  teeSlogan: ['a slogan', 'something your aunt would say', 'a bumper sticker', 'a fake band name', 'a motivational quote gone wrong', 'a warning label', 'a terrible pickup line', 'a lie you tell yourself'],
  shirtColors: ['#f4f1ea', '#1d1d24', '#e8403a', '#2f6fdf', '#f2c230', '#3bb273', '#b06ad9', '#ff8fb1'],

  // 6. The Imposter's Pitch — hints are what the main screen is allowed to show
  pitch: [
    { name: 'Ghost Writer™', line: 'A robot vacuum haunted by your ancestors. It only cleans when it is disappointed in you.', hints: ['🤖', '👻', '🧹'], words: ['haunted', 'judgement', 'dust'] },
    { name: 'SoupPhone', line: 'A smartphone made entirely of soup. Waterproof? No. Delicious? Extremely.', hints: ['🍲', '📱', '🥄'], words: ['broth', 'battery', 'spoon'] },
    { name: 'RockBnB', line: 'A holiday-rental marketplace where pet rocks book beach houses.', hints: ['🪨', '🏡', '🏖️'], words: ['pebble', 'booking', 'beach'] },
    { name: 'Snooze Insurance', line: 'A policy that pays you every time you oversleep, funded by morning people.', hints: ['😴', '💸', '⏰'], words: ['premium', 'alarm', 'claim'] },
    { name: 'The Emotional Support Brick', line: 'A brick that texts you encouragement. Non-refundable. Do not throw.', hints: ['🧱', '💬', '❤️'], words: ['feelings', 'masonry', 'texts'] },
    { name: 'BreakUpGram', line: 'A barbershop quartet that ends your relationship for you, in four-part harmony.', hints: ['🎤', '💔', '🎩'], words: ['harmony', 'heartbreak', 'quartet'] },
    { name: 'Spicy Air', line: 'Premium bottled air in Jalapeño, Ghost Pepper and Regret.', hints: ['🌶️', '🫙', '🔥'], words: ['inhale', 'heat', 'bottled'] },
    { name: 'Drayber', line: 'On-demand dragon rides across town. Fire damage not covered.', hints: ['🐉', '🚕', '🔥'], words: ['ride', 'wings', 'insurance'] },
    { name: 'Tinder for Toasters', line: 'A dating app that matches toasters with compatible bread.', hints: ['🍞', '❤️', '🔌'], words: ['crumbs', 'match', 'warm'] },
    { name: 'Lefty', line: 'A monthly subscription box of only left socks.', hints: ['🧦', '📦', '🔁'], words: ['laundry', 'subscription', 'pairs'] },
    { name: 'CropCam', line: 'A scarecrow influencer with a ring light that livestreams the corn.', hints: ['🌾', '🤳', '🐦'], words: ['followers', 'harvest', 'livestream'] },
    { name: 'MoonShare', line: 'Holiday timeshares on the Moon. Oxygen sold separately.', hints: ['🌕', '🏖️', '🚀'], words: ['gravity', 'resort', 'craters'] },
    { name: 'Monk Ice', line: 'Artisanal ice cubes, hand-frozen by monks in silent meditation.', hints: ['🧊', '🙏', '🥃'], words: ['artisanal', 'silence', 'frozen'] },
    { name: 'Nap Pods for Pigeons', line: 'Tiny luxury sleep capsules on every city lamppost.', hints: ['🐦', '🛏️', '🏙️'], words: ['feathers', 'luxury', 'rest'] }
  ],
  slideKinds: ['chart', 'quote', 'roadmap', 'stat', 'team'],
  buzz: ['AI-powered', 'blockchain', 'farm-to-table', 'gluten-free', 'quantum', 'artisanal', 'cloud-native', 'disruptive', 'carbon-neutral', 'military-grade', 'organic', 'Web 4.0', 'patented', 'synergy'],

  // Bots: what they write when there is nobody else to play with
  botWords: ['a haunted Roomba', 'my landlord', 'three raccoons in a trench coat', 'soup, but angrier', 'a very confident pigeon', 'unpaid interns', 'aggressive jazz', 'a lukewarm hot tub', 'the moon, probably', 'one (1) weird sock', 'an emotional baguette', 'competitive napping', 'grandma\'s browser history', 'a refund', 'mild tax fraud', 'legally distinct Mickey'],
  botHeadlines: ['Now with 40% more synergy', 'Our customers cry happy tears', 'Scaling to the moon', 'Patent pending (probably)', 'Disrupting the disruptors', 'Trusted by 3 grandmas', 'Q4: total world domination'],
  botNames: ['Botimus', 'Clanky', 'RoboDave', 'Unit 7', 'Beepa', 'Sprocket', 'Gizmo', 'Toastr'],
  sillyNames: ['Sir Swearsalot', 'Potty Mouth Pete', 'Mx. Soap-In-Mouth', 'Little Miss Bleep', 'Captain Censored', 'Beep McBleep'],

  avatars: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],   // character ids for PP.Art.face
  reactions: ['😂', '🔥', '😱', '👏', '💀', '🤡', '❤️', '🍅'],
  sounds: [{ id: 'airhorn', label: '📯 Airhorn' }, { id: 'laugh', label: '🤣 Laugh' }, { id: 'boo', label: '👎 Boo' }, { id: 'rimshot', label: '🥁 Rimshot' }]
};

/* The host script. Every line is written without player names or answers (those stay on screen), so
   one recording session in the Voice Booth (#booth) covers every game. Line ids are host.key.n
   and never change meaning; add new lines at the end of a list. Lines are read by a real recorded
   voice when one exists, otherwise by the device's best text-to-speech voice. */
PP.HOSTS = {
  lobby: { name: 'The Announcer', pitch: 1, rate: 1, lines: {
    intro: ['Welcome to the Party Pack! Grab your phones. Dignity optional.', 'Phones out, everybody. Let\'s make some bad decisions.'],
    join: ['Oh good, another one.', 'Welcome! Lower your expectations accordingly.', 'Look who showed up. Nobody panic.', 'A new challenger appears.'],
    audience: ['We have an audience! Finally, witnesses.'],
    pick: ['Pick a game. Any game. I get paid either way.'] } },
  quip: { name: 'Margo Quill', pitch: 0.97, rate: 1, lines: {
    intro: ['Hi. I\'m Margo. I wrote for late-night television for eleven years, and now I\'m here. With you. Write something funny so I can feel something again.'],
    write: ['Your prompts are on your phones. Be funny. Or don\'t, I\'m not your mother.', 'Write! The clock is not on your side. And neither am I.'],
    vote: ['Vote for the funnier one. If neither is funny, vote for the shorter one.', 'Choose wisely. Or quickly. Ideally both.', 'Okay. Which one made you exhale through your nose?'],
    sweep: ['A clean sweep! Everybody voted the same way. It\'s all downhill from here.', 'Unanimous! Somebody frame that joke.'],
    gauntlet: ['Welcome to the Gauntlet. Ten seconds per joke. Your first instinct is your only instinct.'],
    nobody: ['Nobody answered. Inspiring.'],
    end: ['That\'s the show! Please tip your writers. Please.'] } },
  fib: { name: 'Dex Fibbington', pitch: 1.05, rate: 1.04, lines: {
    intro: ['Hi there! I\'m Dex Fibbington, and everything I say is true. Including that.'],
    lie: ['Type a lie so convincing your own mother would believe it.', 'Lie to your friends! It\'s healthy. Trust me.'],
    pick: ['Now find the truth. It\'s in there somewhere. Probably.'],
    truth: ['And the actual, real, verified truth is…', 'The truth! Finally!'],
    fooled: ['Look at that. People fell for it.', 'Oh, you got them. You got them good.'],
    doubleBluff: ['Ooh, a Double Bluff! Somebody is betting everything on this lie.'],
    dbWin: ['The Double Bluff worked! Points stolen straight out of their pockets!'],
    dbFail: ['The Double Bluff failed. Everything, gone. Gambling is fun!'],
    end: ['And that\'s our winner. Honesty is overrated, and this proves it.'] } },
  draw: { name: 'Professor Pallette', pitch: 0.95, rate: 0.95, lines: {
    intro: ['I am Professor Pallette. I have judged art in Paris, in Milan, and in one very sad shopping mall. Draw what your phone tells you. No eraser. No mercy.'],
    draw: ['Draw. Commit to every line. There is no undo, as in life.'],
    blind: ['The blind contour round. Your drawing will vanish as you draw it. Like my will to live.'],
    decoy: ['Write a fake title for this… piece. Make it believable.'],
    pick: ['Which title is real? Trust your gut. Your gut has terrible taste, but trust it.'],
    reveal: ['Obviously. It was obvious.', 'Of course. I saw it immediately.'],
    end: ['We have our winner. The Louvre has not called. It will not.'] } },
  quiz: { name: 'The Proprietor', pitch: 0.92, rate: 0.93, lines: {
    intro: ['Welcome to my hotel. Answer my questions correctly, and you may check out. Answer wrong… and you check out permanently.'],
    question: ['Next question. Choose carefully.', 'Question time. Your life depends on it. Mostly.'],
    floor: ['Welcome… to the Killing Floor.', 'Wrong answers. How delightful. To the Killing Floor.'],
    allRight: ['Everyone got it right. How… disappointing.'],
    died: ['Oh dear. We have new ghosts. Ghosts can haunt the living, you know. Have fun.'],
    survived: ['Everyone survived. I\'ll get you next time.'],
    haunt: ['Something is haunting a phone. Wipe the fog, quickly!'],
    allDead: ['Everyone is dead. Wonderful. To the Exit, all of you.'],
    exit: ['The Exit. Race for the door. The dead may rise again, if they\'re fast enough.'],
    escaped: ['Someone has escaped. Good for them. Everyone else… stay. Forever.'],
    end: ['Our winner walks out the front door alive. The rest of you can keep the towels.'] } },
  tee: { name: 'Ripley Thread', pitch: 1.03, rate: 1.06, lines: {
    intro: ['What\'s up! It\'s Ripley Thread, and we are about to make some drip. Draw anything, write anything, and we\'ll mash it into shirts.'],
    draw: ['Draw two things. Any two things. This is fashion, there are no rules.'],
    slogan: ['Now write slogans. Bumper stickers. Life advice. Threats. Whatever.'],
    build: ['Build your shirt from your friends\' work. Steal their genius.'],
    battle: ['Shirt battle! Vote for the one you\'d actually wear in public.'],
    champ: ['This is the champion shirt. Your mum is going to love it.'],
    end: ['And that\'s our design legend! Fashion week is shaking.'] } },
  pitch: { name: 'Chad Venture', pitch: 1, rate: 1.03, lines: {
    intro: ['I\'m Chad Venture, partner at Venture Venture Capital. I\'ve invested in nine hundred startups and understood none of them. Today, you pitch me.'],
    roles: ['Check your phones. One of you is an Imposter with no idea what this product is.'],
    slides: ['Write a headline for a slide. Imposter, keep it vague. Like a real CEO.'],
    present: ['You\'re up. Sell it.', 'The floor is yours. The board is watching. I\'m the board.', 'Next! Wow me.'],
    vote: ['Who is the Imposter? Vote now. Trust nobody. That\'s my business model.'],
    caught: ['Caught! But wait. The Imposter gets one guess at the product.'],
    free: ['The Imposter walked away with the funding. Incredible. Fraud wins again.'],
    guessRight: ['They guessed the product! Pivot successful!'],
    guessWrong: ['Wrong guess. Bankrupt.'],
    end: ['That\'s the meeting. Our winner leaves with the most equity. This is not financial advice.'] } }
};

// Edge cases every host can hit. Recorded once (id edge.key.n); the current host's voice character is applied.
PP.EDGE = {
  tie2: ['A tie! Fascinating. Truly, nobody wins.', 'A two-way tie. Share the glory. Or fight for it.'],
  tie3: ['A three-way tie. Statistically impressive. Comedically tragic.'],
  tie4: ['A four-way tie?! I\'ve been doing this for years, and I have never been this bored.', 'Four-way tie. I\'m calling it a group project.'],
  tieMany: ['Everyone tied. You\'re all equally mediocre. Congratulations, I guess.'],
  profaneName: ['Someone tried to name themselves something rude. You\'ve been renamed. Live with it.', 'Nice try. Enjoy your new name.'],
  afk: ['Is everybody still with us? Somebody\'s phone has gone very quiet.', 'Someone has gone suspiciously quiet. Probably getting snacks. Unforgivable.'],
  back: ['Oh, you\'re back. We noticed you were gone. We didn\'t miss you.'],
  hype: ['The audience has spoken, unanimously! Double points!', 'The crowd is going wild! Points doubled!'],
  moderated: ['Our moderator removed an answer. You know who you are.'],
  nobody: ['Nobody answered. Wonderful. I\'ll just stand here.'],
  oneAnswer: ['Only one person answered. Everyone else, I hope it was worth it.'],
  vipLeft: ['Our VIP left. Someone new is in charge now. Don\'t let it go to your head.']
};

/** Every recordable line: [{ id, host, key, text }], in a stable order (used by the Voice Booth). */
PP.scriptLines = () => {
  const out = [];
  Object.entries(PP.HOSTS).forEach(([host, h]) => {
    Object.entries(h.lines).forEach(([key, list]) => list.forEach((text, i) => out.push({ id: `${host}.${key}.${i}`, host, key, text })));
  });
  // Edge-case lines are recorded once and played in whichever host's voice character is on stage.
  Object.entries(PP.EDGE).forEach(([key, list]) => list.forEach((text, i) => out.push({ id: `edge.${key}.${i}`, host: 'edge', key, text, edge: true })));
  return out;
};

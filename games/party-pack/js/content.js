/* Party Pack shared content: bot answers, names, palettes and the hosts' script. Each game's questions
   live in js/content/<game>.js; custom packs (UGC, 7-digit share codes) are merged in by js/ugc.js. */
window.PP = window.PP || {};
PP.CONTENT = Object.assign(PP.CONTENT || {}, {
  // Questions and prompts for each game live in js/content/<game>.js.
  shirtColors: ["#f4f1ea", "#1d1d24", "#e8403a", "#2f6fdf", "#f2c230", "#3bb273", "#b06ad9", "#ff8fb1"],
  slideKinds: ["chart", "quote", "roadmap", "stat", "team"],
  buzz: ["AI-powered", "blockchain", "farm-to-table", "gluten-free", "quantum", "artisanal", "cloud-native", "disruptive", "carbon-neutral", "military-grade", "organic", "Web 4.0", "patented", "synergy"],
  botWords: ["a haunted Roomba", "my landlord", "three raccoons in a trench coat", "soup, but angrier", "a very confident pigeon", "unpaid interns", "aggressive jazz", "a lukewarm hot tub", "the moon, probably", "one (1) weird sock", "an emotional baguette", "competitive napping", "grandma's browser history", "a refund", "mild tax fraud", "legally distinct Mickey"],
  botHeadlines: ["Now with 40% more synergy", "Our customers cry happy tears", "Scaling to the moon", "Patent pending (probably)", "Disrupting the disruptors", "Trusted by 3 grandmas", "Q4: total world domination"],
  botNames: ["Botimus", "Clanky", "RoboDave", "Unit 7", "Beepa", "Sprocket", "Gizmo", "Toastr"],
  sillyNames: ["Sir Swearsalot", "Potty Mouth Pete", "Mx. Soap-In-Mouth", "Little Miss Bleep", "Captain Censored", "Beep McBleep"],
  avatars: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"],
  reactions: ["😂", "🔥", "😱", "👏", "💀", "🤡", "❤️", "🍅"],
  sounds: [{"id":"airhorn", "label":"📯 Airhorn"},{"id":"laugh", "label":"🤣 Laugh"},{"id":"boo", "label":"👎 Boo"},{"id":"rimshot", "label":"🥁 Rimshot"}]
});

/* The host script. Every line is written without player names or answers (those stay on screen), so
   one recording session in the Voice Booth (#booth) covers every game. Line ids are host.key.n
   and never change meaning; add new lines at the end of a list. Lines are read by a real recorded
   voice when one exists, otherwise by the device's best text-to-speech voice. */
PP.HOSTS = {
  lobby: { name: 'The Announcer', cast: "Big, warm, excitable game-show announcer. Also reads every shared line (ties, AFK, hype), so give it range.", pitch: 1, rate: 1, lines: {
    intro: ['Welcome to the Party Pack! Grab your phones. Dignity optional.', 'Phones out, everybody. Let\'s make some bad decisions.'],
    join: ['Oh good, another one.', 'Welcome! Lower your expectations accordingly.', 'Look who showed up. Nobody panic.', 'A new challenger appears.'],
    audience: ['We have an audience! Finally, witnesses.'],
    pick: ['Pick a game. Any game. I get paid either way.'] } },
  quip: { name: 'Margo Quill', cast: "Dry, weary, deadpan woman in her 40s. A burned-out late-night TV comedy writer. Sighs a lot.", pitch: 0.97, rate: 1, lines: {
    intro: ['Hi. I\'m Margo. I wrote for late-night television for eleven years, and now I\'m here. With you. Write something funny so I can feel something again.'],
    write: ['Your prompts are on your phones. Be funny. Or don\'t, I\'m not your mother.', 'Write! The clock is not on your side. And neither am I.'],
    vote: ['Vote for the funnier one. If neither is funny, vote for the shorter one.', 'Choose wisely. Or quickly. Ideally both.', 'Okay. Which one made you exhale through your nose?'],
    sweep: ['A clean sweep! Everybody voted the same way. It\'s all downhill from here.', 'Unanimous! Somebody frame that joke.'],
    gauntlet: ['Welcome to the Gauntlet. Ten seconds per joke. Your first instinct is your only instinct.'],
    nobody: ['Nobody answered. Inspiring.'],
    end: ['That\'s the show! Please tip your writers. Please.'] } },
  fib: { name: 'Dex Fibbington', cast: "Smarmy, upbeat 1970s game-show host. Big grin you can hear. Slightly too fast.", pitch: 1.05, rate: 1.04, lines: {
    intro: ['Hi there! I\'m Dex Fibbington, and everything I say is true. Including that.'],
    lie: ['Type a lie so convincing your own mother would believe it.', 'Lie to your friends! It\'s healthy. Trust me.'],
    pick: ['Now find the truth. It\'s in there somewhere. Probably.'],
    truth: ['And the actual, real, verified truth is…', 'The truth! Finally!'],
    fooled: ['Look at that. People fell for it.', 'Oh, you got them. You got them good.'],
    doubleBluff: ['Ooh, a Double Bluff! Somebody is betting everything on this lie.'],
    dbWin: ['The Double Bluff worked! Points stolen straight out of their pockets!'],
    dbFail: ['The Double Bluff failed. Everything, gone. Gambling is fun!'],
    end: ['And that\'s our winner. Honesty is overrated, and this proves it.'] } },
  draw: { name: 'Professor Pallette', cast: "Snooty, theatrical art critic. Posh, slow, disappointed in everything.", pitch: 0.95, rate: 0.95, lines: {
    intro: ['I am Professor Pallette. I have judged art in Paris, in Milan, and in one very sad shopping mall. Draw what your phone tells you. No eraser. No mercy.'],
    draw: ['Draw. Commit to every line. There is no undo, as in life.'],
    blind: ['The blind contour round. Your drawing will vanish as you draw it. Like my will to live.'],
    decoy: ['Write a fake title for this… piece. Make it believable.'],
    pick: ['Which title is real? Trust your gut. Your gut has terrible taste, but trust it.'],
    reveal: ['Obviously. It was obvious.', 'Of course. I saw it immediately.'],
    end: ['We have our winner. The Louvre has not called. It will not.'] } },
  quiz: { name: 'The Proprietor', cast: "Deep, slow, creepy-polite hotel owner. Old-horror-movie host energy, not gory.", pitch: 0.92, rate: 0.93, lines: {
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
  tee: { name: 'Ripley Thread', cast: "Hyped-up young fashion streamer. Fast, bright, says 'drip' like it matters.", pitch: 1.03, rate: 1.06, lines: {
    intro: ['What\'s up! It\'s Ripley Thread, and we are about to make some drip. Draw anything, write anything, and we\'ll mash it into shirts.'],
    draw: ['Draw two things. Any two things. This is fashion, there are no rules.'],
    slogan: ['Now write slogans. Bumper stickers. Life advice. Threats. Whatever.'],
    build: ['Build your shirt from your friends\' work. Steal their genius.'],
    battle: ['Shirt battle! Vote for the one you\'d actually wear in public.'],
    champ: ['This is the champion shirt. Your mum is going to love it.'],
    end: ['And that\'s our design legend! Fashion week is shaking.'] } },
  pitch: { name: 'Chad Venture', cast: "Overconfident tech-bro venture capitalist. Loud, smug, talks in buzzwords.", pitch: 1, rate: 1.03, lines: {
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
,
  meld: { name: 'Madame Meld', cast: "Dreamy, mystical fortune-teller who is a little too into it. Slow, breathy, dramatic pauses.", pitch: 1.04, rate: 0.95, lines: {
    intro: ['Welcome, beautiful minds. I am Madame Meld. Tonight, you will think as one. Or you will be alone. Forever.'],
    ask: ['Do not be clever. Clever is lonely. Say what everyone else would say.', 'Clear your mind. Now fill it with the most obvious answer possible.'],
    reveal: ['The spirits have counted your answers.', 'Let us see whose minds are connected.'],
    meld: ['A perfect mind meld! You are one brain now. It is beautiful. And slightly terrifying.'],
    lone: ['Everyone answered something different. Chaos. Pure chaos.'],
    end: ['Our winner has the most average brain in the room. It is a gift.'] } },
  whosaid: { name: 'Gossip Gerry', cast: "Nosy, delighted gossip columnist. Fast, conspiratorial, loves a scandal.", pitch: 1.08, rate: 1.08, lines: {
    intro: ['Darlings! Gossip Gerry here. I want your secrets, and then I want your friends to guess whose secrets they are.'],
    write: ['Answer honestly. Or lie beautifully. I don\'t judge. I just tell everyone.', 'Write it down. Nobody will know it was you. Probably.'],
    guess: ['Now, who said it? Look at their faces. Someone is sweating.'],
    caught: ['Caught! You are an open book, sweetie.', 'Oh, everyone knew that was you. Everyone.'],
    fooled: ['Nobody saw that coming! A true mystery.', 'Ooh, sneaky. I love sneaky.'],
    end: ['And our winner knows their friends a little too well. Watch out for that one.'] } },
  likely: { name: 'Principal Prom', cast: "Over-enthusiastic school principal hosting the yearbook awards. Big, proud, slightly embarrassing.", pitch: 0.98, rate: 1.04, lines: {
    intro: ['Good evening, students! It\'s yearbook season, and you are voting on each other. What could go wrong?'],
    vote: ['Vote for a friend. You may vote for yourself. Bold, but allowed.', 'Cast your votes! Be honest. Be brutal. Be kind. Mostly honest.'],
    crowned: ['And the title goes to… them! Congratulations. I think.', 'The people have spoken. Wear that title with pride.'],
    tie: ['A tie! You can share the title. Or fight for it. Please share it.'],
    end: ['That\'s yearbook! Our winner agreed with the room the most. A true people person.'] } },
  guess: { name: 'Professor Approx', cast: "Excitable, nerdy maths professor who gets way too emotional about numbers.", pitch: 0.94, rate: 1.06, lines: {
    intro: ['Hello! I\'m Professor Approximately. Nobody knows these answers. That\'s the point. Just guess with confidence!'],
    ask: ['Type a number. Any number. Trust your gut. Your gut is bad at maths, but trust it.'],
    exact: ['Exactly right! Exactly! I need to sit down.'],
    close: ['So close! Mathematically beautiful.'],
    wild: ['Some of you were not even in the same universe. I love that for you.'],
    nobody: ['Nobody guessed. The numbers are disappointed.'],
    end: ['And our winner is the human calculator. Please, never do my taxes.'] } },
  emoji: { name: 'Emo Gee', cast: "Hyper, bubbly influencer who speaks in exclamation marks. Fast and bright.", pitch: 1.12, rate: 1.12, lines: {
    intro: ['Hiii! It\'s Emo Gee! No words, only emoji! Describe it, guess it, love it!'],
    describe: ['Shh! Only emoji! Make it obvious. Or make it art.'],
    guess: ['Guess, guess, guess! Wrong guesses are fine, just keep going!'],
    gotit: ['Yes! Somebody got it! Big emoji energy!'],
    allgot: ['Everyone got it! That was a perfect clue!'],
    nobody: ['Nobody got it. That clue was… a choice.'],
    end: ['Our winner speaks fluent emoji! Fire, fire, crown!'] } }
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

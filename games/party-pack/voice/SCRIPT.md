# Party Pack: the hosts' script

126 lines across six hosts and the Announcer. Generate each line with any text-to-speech service (or record it),
and save it with the **exact filename** shown: the line id plus `.mp3` (`.m4a`, `.wav`, `.ogg` and `.webm` also work).

**Upload:** run `npm start`, open **http://localhost:8080/games/party-pack/#booth** on this computer and press
**Upload files**. Select all your files at once: each one lands on its line by its filename and is saved into this
folder. Then commit the folder:

```bash
git add games/party-pack/voice
git commit -m "Voice the Party Pack hosts"
git push
```

Lines never contain player names or answers (those stay on screen), so one set of files covers every game.
Keep each file under 4 MB. Leave a little silence at the start and end; the game trims it.
Any line you skip falls back to the computer's built-in voice.

**Starter cast:** the game ships with every line voiced by macOS's built-in voices (Samantha as the Announcer, Karen as
Margo, Rishi as Dex, Daniel as Pallette and, pitched down, the Proprietor, Moira as Ripley, Aman as Chad), made by
`node games/party-pack/tools/mac-voices.mjs`. Uploading a file for a line replaces its starter version.

A CSV of the same lines (`script.csv`) is next to this file for bulk tools.

## The Announcer — The lobby, between games

**Voice:** Big, warm, excitable game-show announcer. Also reads every shared line (ties, AFK, hype), so give it range.

| File | Line |
| --- | --- |
| `lobby.intro.0.mp3` | Welcome to the Party Pack! Grab your phones. Dignity optional. |
| `lobby.intro.1.mp3` | Phones out, everybody. Let's make some bad decisions. |
| `lobby.join.0.mp3` | Oh good, another one. |
| `lobby.join.1.mp3` | Welcome! Lower your expectations accordingly. |
| `lobby.join.2.mp3` | Look who showed up. Nobody panic. |
| `lobby.join.3.mp3` | A new challenger appears. |
| `lobby.audience.0.mp3` | We have an audience! Finally, witnesses. |
| `lobby.pick.0.mp3` | Pick a game. Any game. I get paid either way. |

## Margo Quill — The Comedy Writer

**Voice:** Dry, weary, deadpan woman in her 40s. A burned-out late-night TV comedy writer. Sighs a lot.

| File | Line |
| --- | --- |
| `quip.intro.0.mp3` | Hi. I'm Margo. I wrote for late-night television for eleven years, and now I'm here. With you. Write something funny so I can feel something again. |
| `quip.write.0.mp3` | Your prompts are on your phones. Be funny. Or don't, I'm not your mother. |
| `quip.write.1.mp3` | Write! The clock is not on your side. And neither am I. |
| `quip.vote.0.mp3` | Vote for the funnier one. If neither is funny, vote for the shorter one. |
| `quip.vote.1.mp3` | Choose wisely. Or quickly. Ideally both. |
| `quip.vote.2.mp3` | Okay. Which one made you exhale through your nose? |
| `quip.sweep.0.mp3` | A clean sweep! Everybody voted the same way. It's all downhill from here. |
| `quip.sweep.1.mp3` | Unanimous! Somebody frame that joke. |
| `quip.gauntlet.0.mp3` | Welcome to the Gauntlet. Ten seconds per joke. Your first instinct is your only instinct. |
| `quip.nobody.0.mp3` | Nobody answered. Inspiring. |
| `quip.end.0.mp3` | That's the show! Please tip your writers. Please. |

## Dex Fibbington — The Bluffing Game

**Voice:** Smarmy, upbeat 1970s game-show host. Big grin you can hear. Slightly too fast.

| File | Line |
| --- | --- |
| `fib.intro.0.mp3` | Hi there! I'm Dex Fibbington, and everything I say is true. Including that. |
| `fib.lie.0.mp3` | Type a lie so convincing your own mother would believe it. |
| `fib.lie.1.mp3` | Lie to your friends! It's healthy. Trust me. |
| `fib.pick.0.mp3` | Now find the truth. It's in there somewhere. Probably. |
| `fib.truth.0.mp3` | And the actual, real, verified truth is… |
| `fib.truth.1.mp3` | The truth! Finally! |
| `fib.fooled.0.mp3` | Look at that. People fell for it. |
| `fib.fooled.1.mp3` | Oh, you got them. You got them good. |
| `fib.doubleBluff.0.mp3` | Ooh, a Double Bluff! Somebody is betting everything on this lie. |
| `fib.dbWin.0.mp3` | The Double Bluff worked! Points stolen straight out of their pockets! |
| `fib.dbFail.0.mp3` | The Double Bluff failed. Everything, gone. Gambling is fun! |
| `fib.end.0.mp3` | And that's our winner. Honesty is overrated, and this proves it. |

## Professor Pallette — The Terrible Artist

**Voice:** Snooty, theatrical art critic. Posh, slow, disappointed in everything.

| File | Line |
| --- | --- |
| `draw.intro.0.mp3` | I am Professor Pallette. I have judged art in Paris, in Milan, and in one very sad shopping mall. Draw what your phone tells you. No eraser. No mercy. |
| `draw.draw.0.mp3` | Draw. Commit to every line. There is no undo, as in life. |
| `draw.blind.0.mp3` | The blind contour round. Your drawing will vanish as you draw it. Like my will to live. |
| `draw.decoy.0.mp3` | Write a fake title for this… piece. Make it believable. |
| `draw.pick.0.mp3` | Which title is real? Trust your gut. Your gut has terrible taste, but trust it. |
| `draw.reveal.0.mp3` | Obviously. It was obvious. |
| `draw.reveal.1.mp3` | Of course. I saw it immediately. |
| `draw.end.0.mp3` | We have our winner. The Louvre has not called. It will not. |

## The Proprietor — The Cutthroat Quiz

**Voice:** Deep, slow, creepy-polite hotel owner. Old-horror-movie host energy, not gory.

| File | Line |
| --- | --- |
| `quiz.intro.0.mp3` | Welcome to my hotel. Answer my questions correctly, and you may check out. Answer wrong… and you check out permanently. |
| `quiz.question.0.mp3` | Next question. Choose carefully. |
| `quiz.question.1.mp3` | Question time. Your life depends on it. Mostly. |
| `quiz.floor.0.mp3` | Welcome… to the Killing Floor. |
| `quiz.floor.1.mp3` | Wrong answers. How delightful. To the Killing Floor. |
| `quiz.allRight.0.mp3` | Everyone got it right. How… disappointing. |
| `quiz.died.0.mp3` | Oh dear. We have new ghosts. Ghosts can haunt the living, you know. Have fun. |
| `quiz.survived.0.mp3` | Everyone survived. I'll get you next time. |
| `quiz.haunt.0.mp3` | Something is haunting a phone. Wipe the fog, quickly! |
| `quiz.allDead.0.mp3` | Everyone is dead. Wonderful. To the Exit, all of you. |
| `quiz.exit.0.mp3` | The Exit. Race for the door. The dead may rise again, if they're fast enough. |
| `quiz.escaped.0.mp3` | Someone has escaped. Good for them. Everyone else… stay. Forever. |
| `quiz.end.0.mp3` | Our winner walks out the front door alive. The rest of you can keep the towels. |

## Ripley Thread — The Chaos Mashup

**Voice:** Hyped-up young fashion streamer. Fast, bright, says 'drip' like it matters.

| File | Line |
| --- | --- |
| `tee.intro.0.mp3` | What's up! It's Ripley Thread, and we are about to make some drip. Draw anything, write anything, and we'll mash it into shirts. |
| `tee.draw.0.mp3` | Draw two things. Any two things. This is fashion, there are no rules. |
| `tee.slogan.0.mp3` | Now write slogans. Bumper stickers. Life advice. Threats. Whatever. |
| `tee.build.0.mp3` | Build your shirt from your friends' work. Steal their genius. |
| `tee.battle.0.mp3` | Shirt battle! Vote for the one you'd actually wear in public. |
| `tee.champ.0.mp3` | This is the champion shirt. Your mum is going to love it. |
| `tee.end.0.mp3` | And that's our design legend! Fashion week is shaking. |

## Chad Venture — The Imposter's Pitch

**Voice:** Overconfident tech-bro venture capitalist. Loud, smug, talks in buzzwords.

| File | Line |
| --- | --- |
| `pitch.intro.0.mp3` | I'm Chad Venture, partner at Venture Venture Capital. I've invested in nine hundred startups and understood none of them. Today, you pitch me. |
| `pitch.roles.0.mp3` | Check your phones. One of you is an Imposter with no idea what this product is. |
| `pitch.slides.0.mp3` | Write a headline for a slide. Imposter, keep it vague. Like a real CEO. |
| `pitch.present.0.mp3` | You're up. Sell it. |
| `pitch.present.1.mp3` | The floor is yours. The board is watching. I'm the board. |
| `pitch.present.2.mp3` | Next! Wow me. |
| `pitch.vote.0.mp3` | Who is the Imposter? Vote now. Trust nobody. That's my business model. |
| `pitch.caught.0.mp3` | Caught! But wait. The Imposter gets one guess at the product. |
| `pitch.free.0.mp3` | The Imposter walked away with the funding. Incredible. Fraud wins again. |
| `pitch.guessRight.0.mp3` | They guessed the product! Pivot successful! |
| `pitch.guessWrong.0.mp3` | Wrong guess. Bankrupt. |
| `pitch.end.0.mp3` | That's the meeting. Our winner leaves with the most equity. This is not financial advice. |

## Madame Meld — Mind Meld

**Voice:** Dreamy, mystical fortune-teller who is a little too into it. Slow, breathy, dramatic pauses.

| File | Line |
| --- | --- |
| `meld.intro.0.mp3` | Welcome, beautiful minds. I am Madame Meld. Tonight, you will think as one. Or you will be alone. Forever. |
| `meld.ask.0.mp3` | Do not be clever. Clever is lonely. Say what everyone else would say. |
| `meld.ask.1.mp3` | Clear your mind. Now fill it with the most obvious answer possible. |
| `meld.reveal.0.mp3` | The spirits have counted your answers. |
| `meld.reveal.1.mp3` | Let us see whose minds are connected. |
| `meld.meld.0.mp3` | A perfect mind meld! You are one brain now. It is beautiful. And slightly terrifying. |
| `meld.lone.0.mp3` | Everyone answered something different. Chaos. Pure chaos. |
| `meld.end.0.mp3` | Our winner has the most average brain in the room. It is a gift. |

## Gossip Gerry — Who Said That?

**Voice:** Nosy, delighted gossip columnist. Fast, conspiratorial, loves a scandal.

| File | Line |
| --- | --- |
| `whosaid.intro.0.mp3` | Darlings! Gossip Gerry here. I want your secrets, and then I want your friends to guess whose secrets they are. |
| `whosaid.write.0.mp3` | Answer honestly. Or lie beautifully. I don't judge. I just tell everyone. |
| `whosaid.write.1.mp3` | Write it down. Nobody will know it was you. Probably. |
| `whosaid.guess.0.mp3` | Now, who said it? Look at their faces. Someone is sweating. |
| `whosaid.caught.0.mp3` | Caught! You are an open book, sweetie. |
| `whosaid.caught.1.mp3` | Oh, everyone knew that was you. Everyone. |
| `whosaid.fooled.0.mp3` | Nobody saw that coming! A true mystery. |
| `whosaid.fooled.1.mp3` | Ooh, sneaky. I love sneaky. |
| `whosaid.end.0.mp3` | And our winner knows their friends a little too well. Watch out for that one. |

## Principal Prom — Most Likely To

**Voice:** Over-enthusiastic school principal hosting the yearbook awards. Big, proud, slightly embarrassing.

| File | Line |
| --- | --- |
| `likely.intro.0.mp3` | Good evening, students! It's yearbook season, and you are voting on each other. What could go wrong? |
| `likely.vote.0.mp3` | Vote for a friend. You may vote for yourself. Bold, but allowed. |
| `likely.vote.1.mp3` | Cast your votes! Be honest. Be brutal. Be kind. Mostly honest. |
| `likely.crowned.0.mp3` | And the title goes to… them! Congratulations. I think. |
| `likely.crowned.1.mp3` | The people have spoken. Wear that title with pride. |
| `likely.tie.0.mp3` | A tie! You can share the title. Or fight for it. Please share it. |
| `likely.end.0.mp3` | That's yearbook! Our winner agreed with the room the most. A true people person. |

## Professor Approx — Guesstimate

**Voice:** Excitable, nerdy maths professor who gets way too emotional about numbers.

| File | Line |
| --- | --- |
| `guess.intro.0.mp3` | Hello! I'm Professor Approximately. Nobody knows these answers. That's the point. Just guess with confidence! |
| `guess.ask.0.mp3` | Type a number. Any number. Trust your gut. Your gut is bad at maths, but trust it. |
| `guess.exact.0.mp3` | Exactly right! Exactly! I need to sit down. |
| `guess.close.0.mp3` | So close! Mathematically beautiful. |
| `guess.wild.0.mp3` | Some of you were not even in the same universe. I love that for you. |
| `guess.nobody.0.mp3` | Nobody guessed. The numbers are disappointed. |
| `guess.end.0.mp3` | And our winner is the human calculator. Please, never do my taxes. |

## Emo Gee — Emoji Charades

**Voice:** Hyper, bubbly influencer who speaks in exclamation marks. Fast and bright.

| File | Line |
| --- | --- |
| `emoji.intro.0.mp3` | Hiii! It's Emo Gee! No words, only emoji! Describe it, guess it, love it! |
| `emoji.describe.0.mp3` | Shh! Only emoji! Make it obvious. Or make it art. |
| `emoji.guess.0.mp3` | Guess, guess, guess! Wrong guesses are fine, just keep going! |
| `emoji.gotit.0.mp3` | Yes! Somebody got it! Big emoji energy! |
| `emoji.allgot.0.mp3` | Everyone got it! That was a perfect clue! |
| `emoji.nobody.0.mp3` | Nobody got it. That clue was… a choice. |
| `emoji.end.0.mp3` | Our winner speaks fluent emoji! Fire, fire, crown! |

## The Announcer: shared lines — Shared lines: ties, AFK, hype and other surprises (played in the Announcer's voice in every game)

**Voice:** Big, warm, excitable game-show announcer. Also reads every shared line (ties, AFK, hype), so give it range.

| File | Line |
| --- | --- |
| `edge.tie2.0.mp3` | A tie! Fascinating. Truly, nobody wins. |
| `edge.tie2.1.mp3` | A two-way tie. Share the glory. Or fight for it. |
| `edge.tie3.0.mp3` | A three-way tie. Statistically impressive. Comedically tragic. |
| `edge.tie4.0.mp3` | A four-way tie?! I've been doing this for years, and I have never been this bored. |
| `edge.tie4.1.mp3` | Four-way tie. I'm calling it a group project. |
| `edge.tieMany.0.mp3` | Everyone tied. You're all equally mediocre. Congratulations, I guess. |
| `edge.profaneName.0.mp3` | Someone tried to name themselves something rude. You've been renamed. Live with it. |
| `edge.profaneName.1.mp3` | Nice try. Enjoy your new name. |
| `edge.afk.0.mp3` | Is everybody still with us? Somebody's phone has gone very quiet. |
| `edge.afk.1.mp3` | Someone has gone suspiciously quiet. Probably getting snacks. Unforgivable. |
| `edge.back.0.mp3` | Oh, you're back. We noticed you were gone. We didn't miss you. |
| `edge.hype.0.mp3` | The audience has spoken, unanimously! Double points! |
| `edge.hype.1.mp3` | The crowd is going wild! Points doubled! |
| `edge.moderated.0.mp3` | Our moderator removed an answer. You know who you are. |
| `edge.nobody.0.mp3` | Nobody answered. Wonderful. I'll just stand here. |
| `edge.oneAnswer.0.mp3` | Only one person answered. Everyone else, I hope it was worth it. |
| `edge.vipLeft.0.mp3` | Our VIP left. Someone new is in charge now. Don't let it go to your head. |

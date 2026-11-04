/* The jobs. People call you with something they need gone, bought or smashed, and a deadline. In story order.
 * {site}, {district} and {item} are filled in from the run. Times are in seconds. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rules.js'));
  else (root.TRD = root.TRD || {}).missions = factory(root.TRD.rules);
})(typeof self !== 'undefined' ? self : this, function (R) {
  'use strict';
  var B = R.B;
  var CONTACTS = {
    vinnie: { name: 'Vinnie Pell', role: 'Your accountant', shirt: 0x6b6f76, hair: 0x8d8d8d, skin: 0xe2b48c, wear: { glasses: 'glasses_round' } },
    krumb: { name: 'Senator Krumb', role: 'Public servant', shirt: 0x15161d, hair: 0xd8d4c8, skin: 0xe8bfa0, wear: { neck: 'neck_medal' } },
    dolores: { name: 'Aunt Dolores', role: 'Family money', shirt: 0x6a2bb8, hair: 0xf1efe6, skin: 0xf0c8a8, wear: { neck: 'neck_pearls', hair: 'hair_afro' } },
    chip: { name: 'Chip Hadley', role: 'Heir to something', shirt: 0xff4fa3, hair: 0xe7c35a, skin: 0xf0c49a, wear: { glasses: 'glasses_shades', hat: 'hat_cap' } },
    dale: { name: 'Agent Dale', role: 'The Refund Office', shirt: 0xff6a13, hair: 0x2a1d16, skin: 0xd8a884, wear: {} }
  };
  var JOBS = [
    { id: 'vinnie_1', from: 'vinnie', type: 'clear', secs: 100, goal: 'Clean out {site}',
      text: 'Boss, Vinnie. We have to lose a trillion dollars by midnight or the auditors ask what it was for. Start small. Clean out {site}.',
      won: 'Good. That is about a rounding error. Keep going.', lost: 'You could not even empty one shop?', reward: { combo: 5 } },
    { id: 'dolores_1', from: 'dolores', type: 'style', secs: 180, worth: 1 * B, goal: 'Wear $1B of clothes',
      text: 'Dear, it is your Aunt Dolores. I saw you on the news dressed like a person who works. Any shop has a Style Counter. Put on a billion dollars of clothes before I have a stroke.',
      won: 'Much better. Here, these were your great aunt\'s. She had them removed from a duchess.', lost: 'I have told the family you are adopted.', reward: { gift: 'gift_pearls' } },
    { id: 'krumb_1', from: 'krumb', type: 'big', secs: 200, item: 'zoo_biz', goal: 'Buy {item}',
      text: 'Senator Krumb. That zoo is losing money and my name is on it. Buy {item}. You never got this call.',
      won: 'What zoo? Anyway, the Refund Office will be looking elsewhere for a while.', lost: 'I will be disappointed in you, in writing, off the record.', reward: { heatOff: 90 } },
    { id: 'chip_1', from: 'chip', type: 'combo', secs: 90, need: 5, goal: 'Reach a x{need} combo',
      text: 'It\'s Chip. Chip Hadley. Daddy says you can\'t hit a x5 combo. I hit x5 in my sleep. I was actually asleep. Ninety seconds, loser.',
      won: 'Whatever. Keep the hat. I have a house for hats.', lost: 'Ha. I am telling Daddy.', reward: { gift: 'gift_chip_hat' } },
    { id: 'dale_1', from: 'dale', type: 'survive', secs: 60, minSpent: 30 * B, goal: 'Do not get caught',
      text: 'Sir, this is Agent Dale at the Refund Office. We have located your money and would like to return it. Please stand still for sixty seconds.',
      won: 'Sir. Sir, please. It is your money. You can take this vest, I have more.', lost: 'Thank you for your cooperation. Enjoy your refund.', reward: { gift: 'gift_vest' } },
    { id: 'vinnie_2', from: 'vinnie', type: 'spend', secs: 150, amount: 10 * B, district: 'pick', goal: 'Spend $10B in {district}',
      text: 'Boss. I have told the auditors you have interests in {district}. Please have some. Ten billion, fast.',
      won: 'Beautiful. I almost feel something.', lost: 'I told them what? Forget it. I will think of something else.', reward: { combo: 5 } },
    { id: 'krumb_2', from: 'krumb', type: 'goto', secs: 80, goal: 'Get to {site}', dash: 'harbour',
      text: 'Krumb again. There is an envelope in your coat. There is now. Take it to {site}. Do not look in it. Do not stop.',
      won: 'I never met you. There is a sports car outside. I never met that either.', lost: 'What envelope? There was never an envelope. Burn it.', reward: { vehicle: 'sports_car' } },
    { id: 'dolores_2', from: 'dolores', type: 'rain', secs: 180, need: 20, district: 'oldtown', goal: 'Throw cash in {district}',
      text: 'Dear, the Old Town Charity Ball was cancelled for lack of charity. Go down there and throw a billion dollars at the poor dears. Hold G. Aim for the ones who look grateful.',
      won: 'Lovely. They cried. I watched from the car.', lost: 'They are still poor. I blame you.', reward: { combo: 8 } },
    { id: 'chip_2', from: 'chip', type: 'wreck', secs: 100, need: 3, goal: 'Wreck {need} cars',
      text: 'Bet you won\'t wreck three cars. I did five last night and I am not even sorry. Daddy pays the fines. You pay yours. Go.',
      won: 'Okay that was kind of sick. Do not tell anyone I said that.', lost: 'Too scared? Too poor? Wait. You are trying to be poor. Ha.', reward: { heatOff: 60 } },
    { id: 'vinnie_3', from: 'vinnie', type: 'big', secs: 180, item: 'biggest', goal: 'Buy {item}',
      text: 'Boss, there is nothing left to hide behind. I need one big ugly number on the books. Buy {item}. I have read the numbers and it is worse than you think.',
      won: 'I wept. Those were good tears, I think.', lost: 'It is still for sale. So, in a way, are we.', reward: { heatOff: 90 } },
    { id: 'dale_2', from: 'dale', type: 'survive', secs: 90, minSpent: 150 * B, goal: 'Do not get caught',
      text: 'Sir, Dale again. My supervisor has authorised more of us. We are concerned for your balance. Ninety seconds, sir. We know where you shop.',
      won: 'Sir, I have a family. They think I work in finance.', lost: 'Refund processed. Have a compliant day.', reward: { combo: 10 } },
    { id: 'krumb_3', from: 'krumb', type: 'clear', secs: 120, goal: 'Clean out {site}',
      text: 'My nephew owns {site}. He cannot sell a thing and he keeps asking me for money. Buy every last item in there. Consider it a campaign donation to me.',
      won: 'He called me crying. Happy tears. Then I told him about the tax.', lost: 'He is asking again. I am giving him your number.', reward: { heatOff: 120 } },
    { id: 'dolores_3', from: 'dolores', type: 'style', secs: 240, worth: 10 * B, goal: 'Wear $10B of clothes',
      text: 'The family portrait is at sundown. You will wear ten billion dollars or you will stand behind the dog. I mean it. The dog is wearing twelve.',
      won: 'You may stand in front of the dog. Take this tiara. It has seen things.', lost: 'You are behind the dog.', reward: { gift: 'gift_tiara' } },
    { id: 'vinnie_4', from: 'vinnie', type: 'spend', secs: 240, amount: 50 * B, goal: 'Spend $50B, anywhere',
      text: 'Last job, boss. The auditors are in the lobby. I am in the bathroom. Fifty billion, anywhere, four minutes. I will hold the door. It opens outward. This was a mistake.',
      won: 'They have gone. I think they were crying too. Whatever is left, it is yours to burn.', lost: 'Tell my wife the money is in the money.', reward: { combo: 10 } }
  ];
  return { CONTACTS: CONTACTS, JOBS: JOBS, FIRST_MS: 15000, GAP_MS: 35000, RING_MS: 25000 };
});

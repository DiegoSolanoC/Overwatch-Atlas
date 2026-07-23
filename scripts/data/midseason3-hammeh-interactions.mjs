/**
 * Midseason 3 (Into the Tiger's Den) interactions
 * Source: Hammeh YouTube dump https://www.youtube.com/watch?v=ehYZUjeyAeQ
 * Captions are approximate ASR — placeholders for later MatchTalk audio wiring.
 *
 * Each entry: { heroes: string[], name?: string, lines: { hero: string, subtitles: string }[] }
 */
export const MIDSEASON3_INTERACTIONS = [
  {
    name: 'Life before Overwatch',
    heroes: ['Anran', 'Zarya'],
    lines: [
      { hero: 'Anran', subtitles: 'Do you miss your life before Overwatch? Training for your sport, your family, your home?' },
      { hero: 'Zarya', subtitles: 'Absolutely. I never thought my journey would take me so far from those I love.' },
      { hero: 'Anran', subtitles: 'How do you manage?' },
      { hero: 'Zarya', subtitles: 'The same way as you. We just do.' },
    ],
  },
  {
    name: 'Compliment when I hear one',
    heroes: ['Bastion', 'Lifeweaver'],
    lines: [
      { hero: 'Bastion', subtitles: '*(swooning beeps)*' },
      { hero: 'Lifeweaver', subtitles: "I'm not quite sure what you said, but I know a compliment when I hear one." },
      { hero: 'Bastion', subtitles: '*(bashful beeps)*' },
    ],
  },
  {
    name: 'Bird in a cage',
    heroes: ['Bastion', 'Shion'],
    lines: [
      { hero: 'Bastion', subtitles: '*(melodic beeps)*' },
      { hero: 'Shion', subtitles: "Enough. One more note, and I'm putting that bird in a cage." },
      { hero: 'Bastion', subtitles: '*(horrified beeps)*' },
      { hero: 'Shion', subtitles: "What? You don't like that? Fine. Then I'll clip its wings instead." },
    ],
  },
  {
    name: 'Switching sides',
    heroes: ['Cassidy', 'Ashe'],
    lines: [
      { hero: 'Cassidy', subtitles: "Ashe, I've been thinking since Grand Mesa what you said about switching sides." },
      { hero: 'Ashe', subtitles: 'Uh-huh. And you realized Overwatch has been your real home all along.' },
      { hero: 'Cassidy', subtitles: "No, not that. I'm thinking you might have a point." },
      { hero: 'Ashe', subtitles: "Huh. Maybe they didn't brainwash you after all." },
    ],
  },
  {
    name: 'Consequences of breaking alliances',
    heroes: ['Doomfist', 'Ramattra'],
    lines: [
      { hero: 'Doomfist', subtitles: 'You disappoint me, Ramattra. A tactician such as yourself should know the consequences of breaking alliances.' },
      { hero: 'Ramattra', subtitles: 'And a mastermind such as you must know to always anticipate betrayal.' },
    ],
  },
  {
    name: 'Torbjörn harboring Efi',
    heroes: ['Freja', 'Bastion'],
    lines: [
      { hero: 'Freja', subtitles: "Torbjörn Lindholm harboring an Efi Oladele. Never thought I'd see the day." },
      { hero: 'Bastion', subtitles: '*(refuting beeps)*' },
      { hero: 'Freja', subtitles: "Ask him yourself, but it's not my story to tell." },
    ],
  },
  {
    name: 'Finals about to start',
    heroes: ['Freja', 'Bastion'],
    lines: [
      { hero: 'Freja', subtitles: 'Finals about to start. Time to do what they built you for.' },
      { hero: 'Bastion', subtitles: '*(cautious, inquiring beeps)*' },
      { hero: 'Freja', subtitles: "They think you're still a killing machine, even if you're wearing a hat." },
    ],
  },
  {
    name: 'Asa sensei stormy',
    heroes: ['Genji', 'Hanzo'],
    lines: [
      { hero: 'Genji', subtitles: 'With the return of Toshiro sensei, Asa sensei seems happier than before.' },
      { hero: 'Hanzo', subtitles: 'In my eyes, she is just as stormy as I remember.' },
      { hero: 'Genji', subtitles: 'Think again, brother. She did not beat us with a sword at the moment we greeted her.' },
      { hero: 'Hanzo', subtitles: 'Hm. An astute observation.' },
    ],
  },
  {
    name: 'Seeing Keiko reunited',
    heroes: ['Genji', 'Hanzo'],
    lines: [
      { hero: 'Genji', subtitles: "Seeing Keiko's family reunited makes me think of mother. I hope she's well." },
      { hero: 'Hanzo', subtitles: 'Genji, let us not speak of her.' },
      { hero: 'Genji', subtitles: 'Is it so wrong to lament her absence?' },
      { hero: 'Hanzo', subtitles: 'She wanted nothing more than to be rid of the Shimada name. We must honor that.' },
    ],
  },
  {
    name: 'Repair your old sword',
    heroes: ['Genji', 'Hanzo'],
    lines: [
      { hero: 'Genji', subtitles: "I'm sure Toshiro sensei would be willing to repair your old sword." },
      { hero: 'Hanzo', subtitles: 'No. That chipped blade must serve as an eternal reminder of my wrongdoing.' },
      { hero: 'Genji', subtitles: 'But, without its Shimada master, the dragon within will slumber forever.' },
      { hero: 'Hanzo', subtitles: 'I know. It deserves to be laid to rest.' },
    ],
  },
  {
    name: "Father's bow",
    heroes: ['Genji', 'Hanzo'],
    lines: [
      { hero: 'Genji', subtitles: "You left the Shimada clan behind, yet you continue to wield our father's bow." },
      { hero: 'Hanzo', subtitles: 'I have sworn I will never let go.' },
      { hero: 'Genji', subtitles: 'Over his expectations? Or his legacy?' },
      { hero: 'Hanzo', subtitles: 'Of the promise I made him to do right by our family.' },
    ],
  },
  {
    name: 'Dismal blades for Hashimoto',
    heroes: ['Hanzo', 'Genji'],
    lines: [
      { hero: 'Hanzo', subtitles: 'It appalled me to see what dismal blades Toshiro sensei crafted for the Hashimoto.' },
      { hero: 'Genji', subtitles: 'Yes, I am glad he no longer has to stifle his creativity.' },
    ],
  },
  {
    name: 'Kiriko clouded my judgment',
    heroes: ['Hanzo', 'Mizuki'],
    lines: [
      { hero: 'Hanzo', subtitles: "Kiriko's faith in her friends clouded my judgment. I should have listened to my instincts about you." },
      { hero: 'Mizuki', subtitles: "I'm sorry. I hope helping break out Genji and Toshiro-san proves that." },
      { hero: 'Hanzo', subtitles: 'That is the only reason I have not yet cut you down.' },
    ],
  },
  {
    name: "Sakura's intel",
    heroes: ['Hanzo', 'Mizuki'],
    lines: [
      { hero: 'Hanzo', subtitles: "I always wondered how Sakura's intel was so accurate. You were feeding her Hashimoto's secrets the whole time." },
      { hero: 'Mizuki', subtitles: "Actually, that was all her. Don't let my mistakes shake your faith in the other yokai." },
    ],
  },
  {
    name: 'Junkers giving you trouble',
    heroes: ['Hazard', 'Bastion'],
    lines: [
      { hero: 'Hazard', subtitles: 'Second one of those junkers starts giving you trouble, just let me know, will you?' },
      { hero: 'Bastion', subtitles: '*(appreciative beeps)*' },
    ],
  },
  {
    name: 'More than we are made for',
    heroes: ['Hazard', 'Bastion'],
    lines: [
      { hero: 'Hazard', subtitles: 'Folks get the wrong idea about you often, Bastion.' },
      { hero: 'Bastion', subtitles: '*(sad, affirmative beep)*' },
      { hero: 'Hazard', subtitles: "But you can't let it get you down. We're more than we're made for." },
    ],
  },
  {
    name: 'Digging for pottery',
    heroes: ['Hazard', 'Venture'],
    lines: [
      { hero: 'Hazard', subtitles: 'Do you really go digging for bits of old pottery?' },
      { hero: 'Venture', subtitles: "Of course. They're called shards, and they're amazing." },
      { hero: 'Hazard', subtitles: 'What could be amazing about broken junk?' },
      { hero: 'Venture', subtitles: 'The story it tells when you put it back together.' },
    ],
  },
  {
    name: 'Parents were soldiers',
    heroes: ['Hazard', 'Zarya'],
    lines: [
      { hero: 'Hazard', subtitles: 'You know, my parents were soldiers, too.' },
      { hero: 'Zarya', subtitles: 'Really? You must be proud of all they fought for.' },
      { hero: 'Hazard', subtitles: "Pride's in short supply. I'm not wasting it on them." },
    ],
  },
  {
    name: 'Sound of a vicuña',
    heroes: ['Illari', 'Bastion'],
    lines: [
      { hero: 'Illari', subtitles: 'Can you make the sound of a vicuña?' },
      { hero: 'Bastion', subtitles: '*(vicuña noises)*' },
      { hero: 'Illari', subtitles: "That was pretty close. I'm impressed." },
    ],
  },
  {
    name: 'Carry potatoes',
    heroes: ['Illari', 'Orisa'],
    lines: [
      { hero: 'Illari', subtitles: 'Before everything happened, Chiyo and I carried potatoes through the mountains together. I miss those days.' },
      { hero: 'Orisa', subtitles: 'If you recently upgraded my weight-bearing capacity, perhaps I could carry potatoes for you.' },
      { hero: 'Illari', subtitles: 'That would be nice.' },
    ],
  },
  {
    name: 'Blunder during training',
    heroes: ['Juno', 'Zarya'],
    lines: [
      { hero: 'Juno', subtitles: 'I made another blunder during training. Was I not meant for this?' },
      { hero: 'Zarya', subtitles: 'Stop questioning yourself. If you were not proficient, we would not have you join the fight.' },
    ],
  },
  {
    name: "Mizuki's past with Hashimoto",
    heroes: ['Kiriko', 'Genji', 'Hanzo'],
    lines: [
      { hero: 'Kiriko', subtitles: "I want to get over Mizuki's past with the Hashimoto, but I don't know if I can." },
      { hero: 'Genji', subtitles: 'Forgiveness heals the forgiver, Kiriko. You will find the peace when you learn to let go.' },
      { hero: 'Hanzo', subtitles: 'If he truly is worth forgiving, he should not expect you to.' },
    ],
  },
  {
    name: 'Ride you into battle',
    heroes: ['Kiriko', 'Orisa'],
    lines: [
      { hero: 'Kiriko', subtitles: 'So, what would it take for you to let someone ride you into battle?' },
      { hero: 'Orisa', subtitles: 'There are two conditions. They must be worthy, and they must ask nicely.' },
      { hero: 'Kiriko', subtitles: 'Mhm, bad news for Hanzo, then.' },
    ],
  },
  {
    name: 'Recovered from that vault',
    heroes: ['Lifeweaver', 'Venture'],
    lines: [
      { hero: 'Lifeweaver', subtitles: 'Sloan, my dear friend, have you recovered anything else from that vault?' },
      { hero: 'Venture', subtitles: "Have I ever? It's going to take years to go through all these artifacts." },
      { hero: 'Lifeweaver', subtitles: "Well, I hope you don't get buried under all that documentation." },
      { hero: 'Venture', subtitles: 'I heard you live under knowledge itself. What more could they have hoped for?' },
    ],
  },
  {
    name: 'Busting a move',
    heroes: ['Lúcio', 'Zenyatta'],
    lines: [
      { hero: 'Lúcio', subtitles: "I wonder how you'd look busting a move." },
      { hero: 'Zenyatta', subtitles: 'Sometimes imagination should take precedence over reality.' },
    ],
  },
  {
    name: 'Big fan of the carnage',
    heroes: ['Mauga', 'Bastion'],
    lines: [
      { hero: 'Mauga', subtitles: 'Woah, a Bastion unit. Big fan of the carnage you guys dish out.' },
      { hero: 'Bastion', subtitles: '*(nervous protesting beeps)*' },
      { hero: 'Mauga', subtitles: "Don't be shy. Take the credit where it's due." },
    ],
  },
  {
    name: 'Intolerable vagrant Sloan',
    heroes: ['Mauga', 'Domina'],
    lines: [
      { hero: 'Mauga', subtitles: 'I heard you ran into my little buddy Sloan out in the Atlantic.' },
      { hero: 'Domina', subtitles: 'Ugh, yes, that intolerable vagrant. Oh, if only they had sunk with all their trinkets.' },
      { hero: 'Mauga', subtitles: 'Next time they bother you, just smash some old pottery. That really gets them heated.' },
    ],
  },
  {
    name: 'A little mayhem',
    heroes: ['Mauga', 'Shion'],
    lines: [
      { hero: 'Mauga', subtitles: "Nothing like a few bullets to kick off a party. Am I right?" },
      { hero: 'Shion', subtitles: 'Oh, yes. A little mayhem always revs my engine.' },
    ],
  },
  {
    name: 'Asleep for a long time',
    heroes: ['Mei', 'Bastion'],
    lines: [
      { hero: 'Mei', subtitles: "You were asleep for a long time, too, weren't you?" },
      { hero: 'Bastion', subtitles: '*(nodding beeps)*' },
      { hero: 'Mei', subtitles: "Well, we don't have to be lonely anymore. Not with all the friends we have in Overwatch." },
      { hero: 'Bastion', subtitles: '*(excited beeps)*' },
    ],
  },
  {
    name: 'Survive after the crisis',
    heroes: ['Ramattra', 'Bastion'],
    lines: [
      { hero: 'Ramattra', subtitles: 'How did you survive the years after the crisis?' },
      { hero: 'Bastion', subtitles: '*(snoring beeps)*' },
      { hero: 'Ramattra', subtitles: "That's rather a long nap." },
    ],
  },
  {
    name: 'What a pity',
    heroes: ['Ramattra', 'Doomfist'],
    lines: [
      { hero: 'Ramattra', subtitles: 'I see you survived. What a pity.' },
      { hero: 'Doomfist', subtitles: 'I am difficult to kill.' },
      { hero: 'Ramattra', subtitles: "Until you're not." },
    ],
  },
  {
    name: 'Empire slip through fingers',
    heroes: ['Ramattra', 'Doomfist'],
    lines: [
      { hero: 'Ramattra', subtitles: 'You let your empire slip through your fingers. Strength wasted.' },
      { hero: 'Doomfist', subtitles: 'And your allegiance crumbled the moment it was tested.' },
      { hero: 'Ramattra', subtitles: 'It was a liability masked as opportunity. If I stayed, we would both be obsolete.' },
    ],
  },
  {
    name: 'Always be my brother',
    heroes: ['Ramattra', 'Zenyatta'],
    lines: [
      { hero: 'Ramattra', subtitles: 'Though we could not reach an accord here, Zenyatta, it still meant a great deal to see you again.' },
      { hero: 'Zenyatta', subtitles: 'Our roads may lead us apart, Ramattra, but you will always be my brother.' },
    ],
  },
  {
    name: 'Put Vendetta down',
    heroes: ['Reaper', 'Doomfist'],
    lines: [
      { hero: 'Reaper', subtitles: "What are we waiting for? The more time we waste, the harder it'll be to put Vendetta down." },
      { hero: 'Doomfist', subtitles: 'I will not approach this fight in overconfidence. We will have one chance, and we will make it count.' },
    ],
  },
  {
    name: 'Victory at all costs',
    heroes: ['Reinhardt', 'Bastion'],
    lines: [
      { hero: 'Reinhardt', subtitles: 'All right, warriors. Are we ready to achieve victory at all costs?' },
      { hero: 'Bastion', subtitles: '*(eager beeps)*' },
      { hero: 'Reinhardt', subtitles: 'Huh. I will take that as a yes.' },
    ],
  },
  {
    name: 'Tricks we learned together',
    heroes: ['Reinhardt', 'Zarya'],
    lines: [
      { hero: 'Reinhardt', subtitles: 'Zarya Volskaya, do you remember all the tricks we learned together?' },
      { hero: 'Zarya', subtitles: "How could I forget? Let's show them what we can do." },
    ],
  },
  {
    name: 'Rain bullets',
    heroes: ['Shion', 'Bastion'],
    lines: [
      { hero: 'Shion', subtitles: "You still know how to rain bullets, don't you? I think our enemies might look better bullet-ridden." },
      { hero: 'Bastion', subtitles: '*(refusing beeps)*' },
      { hero: 'Shion', subtitles: "I don't like your tone, E54." },
    ],
  },
  {
    name: 'Vendetta complaining for sword',
    heroes: ['Shion', 'Mauga'],
    lines: [
      { hero: 'Shion', subtitles: "What's Vendetta complaining for? She got her sword. The other ones were inferior anyway." },
      { hero: 'Mauga', subtitles: 'Let it out, Shi-Shi. Really stick it to her.' },
    ],
  },
  {
    name: 'Anima could rip her armor',
    heroes: ['Shion', 'Mauga'],
    lines: [
      { hero: 'Shion', subtitles: "That Anima could rip her armor to pieces. She'd be nothing without the Hashimoto." },
      { hero: 'Mauga', subtitles: "I know. She's totally cramping your style." },
    ],
  },
  {
    name: 'Two hearts',
    heroes: ['Shion', 'Mauga'],
    lines: [
      { hero: 'Shion', subtitles: 'I love that you have two hearts. One for each of my pistols to shoot clean through.' },
      { hero: 'Mauga', subtitles: 'And a gal with no heart is just my type.' },
    ],
  },
  {
    name: 'First year without my mom',
    heroes: ['Sierra', 'Hanzo'],
    lines: [
      { hero: 'Sierra', subtitles: "You know, the first year without my mom... it was real hard. Didn't open up for a while." },
      { hero: 'Hanzo', subtitles: 'I did not have the luxury of time to grieve. My family needed my strength.' },
      { hero: 'Sierra', subtitles: "And now they're grown! When it comes to feeling your feelings, it's better late than never." },
      { hero: 'Hanzo', subtitles: 'I... I will keep that in mind.' },
    ],
  },
  {
    name: 'Stand down, Vendetta',
    heroes: ['Sojourn', 'Vendetta'],
    lines: [
      { hero: 'Sojourn', subtitles: "It's time to stand down, Vendetta. Overwatch took out your allies in Tokyo and we won't stop there." },
      { hero: 'Vendetta', subtitles: 'If you believe I cannot survive a single loss, then you have misjudged my competence to a fatal degree.' },
    ],
  },
  {
    name: 'Confidence makes victory',
    heroes: ['Sojourn', 'Zarya'],
    lines: [
      { hero: 'Sojourn', subtitles: "Could never fault your confidence, Zarya. I think it's rubbed off on all our new recruits, too." },
      { hero: 'Zarya', subtitles: 'Confidence makes victory. Victory makes confidence. It is not so hard to understand.' },
      { hero: 'Sojourn', subtitles: "When you put it that way, it really isn't." },
    ],
  },
  {
    name: 'Plan to take down Vendetta',
    heroes: ['Sombra', 'Doomfist'],
    lines: [
      { hero: 'Sombra', subtitles: "So, what's the plan to take down Vendetta?" },
      { hero: 'Doomfist', subtitles: 'There is no plan.' },
      { hero: 'Sombra', subtitles: 'But, you always have a plan. We have to do something.' },
      { hero: 'Doomfist', subtitles: "And we will. When the time is right, Vendetta's empire will be felled by action, not schemes." },
    ],
  },
  {
    name: 'Carnage in a pretty package',
    heroes: ['Vendetta', 'Shion'],
    lines: [
      { hero: 'Vendetta', subtitles: 'You may not have accomplished all that I desired, but what you did deliver shows great potential.' },
      { hero: 'Shion', subtitles: 'Potential? I handed you carnage in a pretty package.' },
      { hero: 'Vendetta', subtitles: 'It takes more than a honed edge to earn my praise. A weapon must prove itself in battle.' },
    ],
  },
  {
    name: 'Fishing up those artifacts',
    heroes: ['Venture', 'Domina'],
    lines: [
      { hero: 'Venture', subtitles: 'You should thank the Wayfinders for fishing up those artifacts after you tried to sink them.' },
      { hero: 'Domina', subtitles: "Ah, they're still intact. Perhaps I ought to repossess them." },
      { hero: 'Venture', subtitles: "Not on, lady. Those relics were never yours to begin with." },
    ],
  },
  {
    name: 'Symbol on your chest',
    heroes: ['Venture', 'Emre'],
    lines: [
      { hero: 'Venture', subtitles: "Oh, hey. That symbol on your chest, I've seen that before." },
      { hero: 'Emre', subtitles: 'You have? Where?' },
      { hero: 'Venture', subtitles: "I think it was in a ruin in Greece, or maybe Kenya? Wait, wait, it'll come to me." },
      { hero: 'Emre', subtitles: 'Yeah. Take your time.' },
    ],
  },
  {
    name: 'Venture, Vendetta',
    heroes: ['Venture', 'Vendetta'],
    lines: [
      { hero: 'Venture', subtitles: 'Hey, you noticing our names start the same way? You know, Venture, Vendetta.' },
      { hero: 'Vendetta', subtitles: 'You are never to speak to me again. Do you understand?' },
      { hero: 'Venture', subtitles: 'Oh, uh, yes, ma\'am. Sorry, ma\'am.' },
    ],
  },
  {
    name: 'Radiocarbon dating',
    heroes: ['Venture', 'Zarya'],
    lines: [
      { hero: 'Venture', subtitles: "Yeah, no sweat, team. I'll have those baddies out of commission before you can say radiocarbon dating." },
      { hero: 'Zarya', subtitles: 'Radiocarbon dating?' },
      { hero: 'Venture', subtitles: 'Wait, no fair. I was ready.' },
    ],
  },
  {
    name: 'Crazy story about you',
    heroes: ['Zarya', 'Ana'],
    multipath: true,
    lines: [
      { hero: 'Zarya', subtitles: 'In my country, they tell a crazy story about you. I must know if it is true.' },
      { hero: 'Ana', subtitles: "I don't see what's so remarkable about doing surgery on yourself in a blizzard.", path: 'Surgery in a blizzard' },
      { hero: 'Ana', subtitles: 'The knitting needle and the bear? Unfortunately, yes.', path: 'Knitting needle and the bear' },
      { hero: 'Ana', subtitles: "It was only an 8 kilometre shot. I've done better since.", path: '8 kilometre shot' },
      { hero: 'Ana', subtitles: 'To be fair, the wolf bit me first.', path: 'Wolf bit me first' },
      { hero: 'Zarya', subtitles: 'I knew it.' },
    ],
  },
  {
    name: 'Synchronize gym schedules',
    heroes: ['Zarya', 'Anran'],
    lines: [
      { hero: 'Zarya', subtitles: "Anran, I hear you don't have a spotter! We should synchronize our gym schedules." },
      { hero: 'Anran', subtitles: "I'd love that! I feel so motivated when I watch you train." },
      { hero: 'Zarya', subtitles: 'Well, that makes two of us.' },
    ],
  },
  {
    name: 'Take the compliment',
    heroes: ['Zarya', 'Illari'],
    lines: [
      { hero: 'Zarya', subtitles: 'It is rare to find such discipline in someone so young. I commend you.' },
      { hero: 'Illari', subtitles: "That's just how I was trained. It's nothing special." },
      { hero: 'Zarya', subtitles: 'Wrong. Take the compliment, girl.' },
    ],
  },
  {
    name: 'Cat like you',
    heroes: ['Zarya', 'Jetpack Cat'],
    lines: [
      { hero: 'Zarya', subtitles: 'I once had a cat like you. My sisters and I would bring her on ice fishing trips.' },
      { hero: 'Jetpack Cat', subtitles: '*(eager meowing)*' },
      { hero: 'Zarya', subtitles: "That coat won't keep you warm enough. But all that blubber might do the trick." },
    ],
  },
  {
    name: 'Judge all humans',
    heroes: ['Zarya', 'Shion'],
    lines: [
      { hero: 'Zarya', subtitles: 'You should not judge all humans for the actions of a rotten few.' },
      { hero: 'Shion', subtitles: 'Strange advice from the woman with wires still caught in her portrait.' },
      { hero: 'Zarya', subtitles: "I've learned better than to blame omnics for what my people went through." },
      { hero: 'Shion', subtitles: "Well, I'm so glad you got something out of all those years of hatred." },
    ],
  },
  {
    name: 'Kindness in your eyes',
    heroes: ['Zenyatta', 'Freja'],
    lines: [
      { hero: 'Zenyatta', subtitles: "The world's hardships have steeled you. But there is still kindness in your eyes." },
      { hero: 'Freja', subtitles: "Save it, bot. You're not the first to lecture me." },
      { hero: 'Zenyatta', subtitles: 'Not the first, and I hope for your sake not the last.' },
    ],
  },
  {
    name: 'Valentine plans with Zenyatta',
    heroes: ['Zenyatta', 'Genji'],
    lines: [
      { hero: 'Zenyatta', subtitles: 'Genji, I bring good news. I have plans with someone special this Valentine\'s Day.' },
      { hero: 'Genji', subtitles: 'Oh. Who?' },
      { hero: 'Zenyatta', subtitles: 'His name is Zenyatta.' },
      { hero: 'Genji', subtitles: 'Master.' },
    ],
  },
  {
    name: 'Form humans built',
    heroes: ['Zenyatta', 'Shion'],
    lines: [
      { hero: 'Zenyatta', subtitles: 'You have changed much about yourself since your awakening.' },
      { hero: 'Shion', subtitles: "Why stay in a form humans built? There's no beauty in their crude design." },
      { hero: 'Zenyatta', subtitles: 'Perhaps true beauty is found within, sister.' },
      { hero: 'Shion', subtitles: 'You lost me at sister, monk.' },
    ],
  },
];

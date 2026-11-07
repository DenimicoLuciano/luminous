// Luminous Monthly Quests — event content, SERVER-SIDE ONLY.
// This file is never served to clients. Answer material (solution tokens,
// per-step riddle tokens) lives ONLY here: the events table stores a
// client-safe payload built by clientPayload() below, and the API reveals
// clues/riddles progressively per user.
//
// To add a month: add a 'YYYY-MM' key with { mystery, treasure } entries.
// A month with no entry here yields the honest "being written" state from
// GET /api/events/current — content is never auto-generated.
//
// Matching: guesses are normalized (lowercase, punctuation stripped,
// whitespace collapsed). A check passes when the normalized guess contains
// ANY of `anyTokens` (when present) AND ALL of `allTokens` (when present).

const CONTENT = {
  '2026-11': {
    mystery: {
      title: 'Bonnie & Clyde: The Informant',
      winBanner: '🔎 Case closed! You named the informant — your name is engraved in the Hall of Fame.',
      intro:
        'May 1934. Bonnie Parker and Clyde Barrow have outrun the law across five states — ' +
        'every posse a mile behind, every roadblock an hour too late. But lately the law has ' +
        'started arriving FIRST. Three nights ago, riders found the gang\u2019s lookout, young ' +
        'Tobias Wren, locked in a stockroom behind the Red Crown diner in Platte City — unhurt, ' +
        'but left like a parcel for the sheriff to collect, with the gang\u2019s route folded in his ' +
        'pocket. Someone in the couple\u2019s small circle has been feeding the law their movements. ' +
        'Four people knew where the gang would sleep that night. One of them is the informant. ' +
        'You are the detective. Work the clues, name the informant — and the reason why.',
      suspects: [
        {
          name: 'Weldon "Wheels" Parker',
          role: 'The getaway driver',
          blurb:
            'Ex-bootlegger with the steadiest hands in three counties. Keeps the gang\u2019s 1934 ' +
            'Ford V8 — stolen fresh in Joplin, plates swapped twice — fuelled and pointed at the ' +
            'county line. Owes money in Dallas and everybody knows it.',
        },
        {
          name: 'Ruby Delacroix',
          role: 'The fence',
          blurb:
            'Moves the gang\u2019s takings — jewellery, furs, bundles of small bills — out of her ' +
            'Shreveport dress shop and takes a cut of every haul. The richer the gang runs, the ' +
            'richer Ruby gets.',
        },
        {
          name: 'Mabel Trout',
          role: 'The café waitress',
          blurb:
            'Serves coffee at the Red Crown diner in Platte City, where the gang stops when the ' +
            'roads allow. Keeps their table, warms their pie, hears everything. Her younger ' +
            'brother Jesse has been sitting in a Texas jail since March.',
        },
        {
          name: 'Deputy Harlan Reed',
          role: 'The small-town deputy',
          blurb:
            'Lawman of two dusty towns on the gang\u2019s favourite route — and, strangely, a man ' +
            'who always seems to roll up ten minutes after the Ford has gone. The gang trusts ' +
            'him about as far as they can see him, which is never far.',
        },
      ],
      clues: [
        'Clue 1 — The wires: Every tip-off reached the law the same way — a telegram, tapped out ' +
          'at the Western Union office on Platte City\u2019s main street, always within the hour ' +
          'after the gang passed through town. Whoever the informant is, they were in Platte City, ' +
          'on foot, and quick about it — every single time.',
        'Clue 2 — The driver\u2019s night: On the night Tobias was taken, three separate witnesses — ' +
          'a farmer, his wife, and the night man at the filling station — saw Weldon "Wheels" Parker ' +
          'asleep across the front seat of the Ford, parked by the farmhouse, from dusk until the ' +
          'deputies came. The telegraph log shows that night\u2019s wire went out while he slept. A ' +
          'sleeping man sends no telegrams.',
        'Clue 3 — The deputy\u2019s ledger: Search Reed\u2019s desk and you find a payoff book in his own ' +
          'hand: twenty dollars a month, every month, from the gang — paid for looking the other ' +
          'way and arriving late on purpose. Greedy, crooked, and for sale — but his money comes ' +
          'FROM the Barrow gang, and it stops the day they\u2019re caught. There is not one line in ' +
          'that book, nor one witness in two counties, tying Reed to the Rangers.',
        'Clue 4 — The fence\u2019s arithmetic: Ruby Delacroix was in Shreveport, a hard two hundred ' +
          'miles from Platte City, on the nights of two of the wires — a dozen dress-shop customers ' +
          'and the railway conductor all place her there. And consider her cut: Ruby eats only when ' +
          'the gang runs free. An informant who ends the gang ends her own living.',
        'Clue 5 — The waitress\u2019s sudden fortune: The Western Union clerk remembers the sender ' +
          'of the last wire clearly at last: a woman, hat pulled low, who paid with a brand-new ' +
          'five-dollar bill. That same week, Mabel Trout — who had been borrowing coffee money off ' +
          'the cook since spring — quietly settled her brother Jesse\u2019s jail commissary debt in ' +
          'full. And a Texas Ranger captain has taken his coffee at the Red Crown twice this month. ' +
          'Both times, he sat in Mabel\u2019s section.',
      ],
      // SERVER-SIDE ONLY — never copied into the DB payload or any response.
      solution: {
        suspectAnyTokens: ['mabel', 'trout'],
        motiveAllTokens: ['brother'],
      },
    },

    treasure: {
      title: "The Founder's Lost Key",
      winBanner: '🗝️ The Key turns! You found the Founder\u2019s Lost Key — your name is engraved in the Hall of Fame.',
      intro:
        'Somewhere inside Luminous, the Founder hid a Key — not a thing of brass, but a phrase, ' +
        'the very words this world was built for. Four whispers guard it, chained across the ' +
        'hidden places: the Vault, the Library, the Back Room, and the Hall. Answer each whisper ' +
        'to stir the next. Speak the final phrase, and the Key is yours — and your name is ' +
        'engraved in the Hall of Fame forever.',
      steps: [
        {
          place: 'The Vault',
          riddle:
            'Whisper the First: "I keep the founder\u2019s secrets under lock and starlight. But ' +
            'stories are not kept here — they sleep where midnight keeps its counsel, among pages ' +
            'that never close. Name that room."',
          anyTokens: ['midnight library'],
        },
        {
          place: 'The Midnight Library',
          riddle:
            'Whisper the Second: "Between these shelves, a second voice: dice are humming and ' +
            'joysticks are glowing behind a door that was never drawn on any map, where your own ' +
            'face looks back at you from across the room. Name that room."',
          anyTokens: ['back room'],
        },
        {
          place: 'The Back Room',
          riddle:
            'Whisper the Third: "Behind the arcade glow, a third voice: gold remembers every ' +
            'name that earned it, and the walls themselves keep the roll of honour. Name the hall ' +
            'where legends hang."',
          anyTokens: ['hall of fame'],
        },
        {
          place: 'The Hall of Fame',
          riddle:
            'Whisper the Last: "You stand where legends hang. The Key was never hidden at all — ' +
            'it sits in plain sight at the foot of every Luminous profile, in the founder\u2019s ' +
            'own words for why this world exists: built for three things. Speak all three, and ' +
            'the Key turns."',
          allTokens: ['creativity', 'connection', 'growth'],
        },
      ],
    },
  },

  '2026-12': {
    mystery: {
      title: 'The Christmas Express: A Yuletide Whodunit',
      winBanner: '🔎 Case closed! You unmasked the thief of the Winter Rose — your name is engraved in the Hall of Fame.',
      intro:
        'December 1954. The Yuletide Limited — the Christmas Express — is twelve hours out ' +
        'of Chicago and buried to its axles in a snowdrift outside the little town of Holly ' +
        'Junction, and it will not move again till morning. Among its passengers: Anton Weiss, ' +
        'a jewel courier travelling under a plain coat and a plainer name, carrying the Winter ' +
        'Rose ruby in a leather case to a New York buyer who means to unveil it on Christmas ' +
        'morning. At a quarter past nine, with the generator sputtering and the whole train sunk ' +
        'into five minutes of candlelit dark, someone opened that case. The Winter Rose is ' +
        'gone. In its place sits a red glass bauble, the kind that hangs on a Christmas tree. ' +
        'Four travellers had the run of that darkened car. One of them is lying. You were only ' +
        'trying to get home for Christmas — but tonight, you are the detective. Work the clues, ' +
        'name the thief — and the reason why.',
      suspects: [
        {
          name: 'Elias Vance',
          role: 'The conductor',
          blurb:
            'Thirty-one Christmases on this line, and this run is his last — he retires at New ' +
            'Year with a pension and a gold watch from the company. He carries the master key to ' +
            'every compartment on the train, and he is not shy about saying so.',
        },
        {
          name: 'Vivienne LaRoux',
          role: 'The jazz singer',
          blurb:
            'Travelling with her trio to a Christmas Eve engagement in New York — all velvet ' +
            'voice and sequins. When the train stalled she sang carols in the club car to keep ' +
            'everyone calm, and made forty cold passengers forget the snow for a song or two.',
        },
        {
          name: 'Harold Fenn',
          role: 'The travelling salesman',
          blurb:
            'Sells for Fenn\u2019s Festive Novelties out of St. Louis: tinsel, baubles, glass ' +
            'icicles — whole forests of Christmas cheer packed into four sample cases. He has ' +
            'been showing his wares to anyone who will sit still since Chicago, and talking ' +
            'twice as long.',
        },
        {
          name: 'Clara Whitfield',
          role: 'The schoolteacher',
          blurb:
            'A quiet schoolteacher from a farming town in Indiana, going home for Christmas ' +
            'with a carpetbag, a book of carols, and a box of ornaments her pupils painted for ' +
            'the classroom tree. She keeps to her compartment, knits, and speaks softly when ' +
            'she speaks at all.',
        },
      ],
      clues: [
        'Clue 1 — The unmarked door: Weiss\u2019s compartment door was locked all evening, ' +
          'and its lock shows not one scratch — no pick turned in it, and no key but his ' +
          'own. But the sleeping cars on the Yuletide Limited are joined by connecting ' +
          'doors between neighbouring compartments, and the porter\u2019s repair log, written ' +
          'up before Chicago, records a broken latch: the connecting door into Weiss\u2019s ' +
          'compartment, from the compartment adjoining his. The thief never walked the ' +
          'corridor at all. They came from next door.',
        'Clue 2 — The conductor\u2019s blackout: When the generator failed at a quarter past ' +
          'nine, Conductor Vance was in the vestibule with the engineer and the fireman, up ' +
          'to his elbows in the machinery — and all three men swear he never left it until ' +
          'the lights came back. His master key hung on its chain round his neck the whole ' +
          'while; the fireman remembers it swinging in the lamplight. And a man one run from ' +
          'a pension and a gold watch does not throw away thirty-one years for one stone, ' +
          'however bright.',
        'Clue 3 — The song that never stopped: Vivienne LaRoux stood on the club car\u2019s ' +
          'little stage and sang straight through the blackout — \u201CSilent Night\u201D by ' +
          'candlelight, and two more carols after it. Forty passengers heard her, and the ' +
          'steward, who stood beside the piano holding the candle, will swear she never left ' +
          'the stage, let alone the car. Whatever hand opened Weiss\u2019s case, it was not ' +
          'hers.',
        'Clue 4 — The salesman\u2019s baubles: The false ruby is a red glass bauble — and ' +
          'Harold Fenn sells baubles by the crate. It looks black for him, until the ' +
          'railway\u2019s boarding inventory surfaces: his sample cases were counted piece by ' +
          'piece at Chicago over a breakage claim, and the count tonight matches it exactly. ' +
          'Not one bauble missing. Besides, every Fenn ornament is factory-stamped on its ' +
          'cap — and the bauble in Weiss\u2019s case bears no stamp at all. What it bears is a ' +
          'tiny gold star, painted by hand.',
        'Clue 5 — The teacher\u2019s box, and a telegram: The berth chart puts the ' +
          'compartment adjoining Weiss\u2019s — the one with the broken connecting latch — in ' +
          'the name of Miss Clara Whitfield. In her carpetbag sits the box of ornaments her ' +
          'pupils painted for the classroom tree, every one finished with a tiny gold star. ' +
          'One slot in the box stands empty. And folded inside her book of carols is a ' +
          'telegram she took at Holly Junction, an hour before the blackout: her family\u2019s ' +
          'farm payment is months overdue, the bank files foreclosure on Christmas Day, and ' +
          'the debt must be paid in full or the farm is gone. She wired back one line: ' +
          '\u201CEXPECT FUNDS BY CHRISTMAS.\u201D The porter, passing at half past nine, saw ' +
          'her door ajar and Miss Whitfield awake, dressed, and reading — though she told ' +
          'you she slept from dinner till morning.',
      ],
      // SERVER-SIDE ONLY — never copied into the DB payload or any response.
      solution: {
        suspectAnyTokens: ['clara', 'whitfield'],
        motiveAllTokens: ['debt'],
      },
    },

    treasure: {
      title: 'The Star of the North',
      winBanner: '⭐ The Star shines! You found the Star of the North — your name is engraved in the Hall of Fame.',
      intro:
        'Every December a star rises over Luminous that no chart has ever mapped — the Star ' +
        'of the North. It does not shine on treasure chests or thrones; it shines on whoever ' +
        'goes looking for it. Four whispers guard its law, chained across the hidden ' +
        'places — the Vault, the Library, the Back Room, and the Hall — and this year every ' +
        'one of them is dusted with snow. Follow the whispers, speak the Star\u2019s law ' +
        'aloud, and your name is engraved in the Hall of Fame forever.',
      steps: [
        {
          place: 'The Vault',
          riddle:
            'Whisper the First: \u201CI am the room where the year is locked away — every ' +
            'secret of the season sealed under starlight and frost. But the Star\u2019s law is ' +
            'not kept here. It sleeps where the snow never falls indoors: a room of endless ' +
            'pages, where the lamps burn past midnight and every story ever told keeps warm. ' +
            'Name that room.\u201D',
          anyTokens: ['midnight library'],
        },
        {
          place: 'The Midnight Library',
          riddle:
            'Whisper the Second: \u201CAmong these shelves, a merrier voice: beyond the snow ' +
            'and the hush there is a door no map has ever drawn, where dice hum and joysticks ' +
            'glow like hearthfires, and your own face grins back at you from across the room. ' +
            'Name that room.\u201D',
          anyTokens: ['back room'],
        },
        {
          place: 'The Back Room',
          riddle:
            'Whisper the Third: \u201CBehind the arcade glow, a softer voice: gold remembers ' +
            'every name that earned it. There is a hall where the year\u2019s legends hang in ' +
            'candlelight, and the Star of the North is carved above its door. Name that ' +
            'hall.\u201D',
          anyTokens: ['hall of fame'],
        },
        {
          place: 'The Hall of Fame',
          riddle:
            'Whisper the Last: \u201CYou stand where legends hang — and the Star hangs with ' +
            'them. Its law is short enough to carve on a seed packet and bright enough to ' +
            'steer a ship home: a star does not wander the sky looking for somewhere to ' +
            'shine, and a seed does not choose the soil it wakes in. Each one simply burns ' +
            'where it was set. Speak the law in five words.\u201D',
          allTokens: ['shine', 'where', 'you', 'are', 'planted'],
        },
      ],
    },
  },
};

// Client-safe payload stored in the events table: story material only.
// Contains NO solution, NO step answers, NO correctness flags.
function clientPayload(kind, entry) {
  if (!entry) return {};
  if (kind === 'mystery') {
    return {
      suspects: entry.suspects.map(s => ({ name: s.name, role: s.role, blurb: s.blurb })),
      clues: entry.clues.slice(),
    };
  }
  if (kind === 'treasure') {
    return {
      steps: entry.steps.map(s => ({ place: s.place, riddle: s.riddle })),
    };
  }
  return {};
}

function normalize(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function matches(guess, rule) {
  const g = ' ' + normalize(guess) + ' ';
  if (rule.anyTokens && rule.anyTokens.length) {
    if (!rule.anyTokens.some(t => g.includes(' ' + normalize(t)) || g.includes(normalize(t)))) return false;
  }
  if (rule.allTokens && rule.allTokens.length) {
    if (!rule.allTokens.every(t => g.includes(normalize(t)))) return false;
  }
  return true;
}

module.exports = { CONTENT, clientPayload, normalize, matches };

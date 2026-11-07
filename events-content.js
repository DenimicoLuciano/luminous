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

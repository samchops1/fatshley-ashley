/* Patron spawn, lines, interaction for Fatshley Ashley */
(function (global) {
  'use strict';

  // Line IDs: patron_bark_01 … patron_bark_24 (order = array index)
  const PICKUP_LINES = [
    "Stool lonely, or you just mean?",
    "Round's on me… if alimony allows.",
    "You drink like my ex. Meaner though.",
    "Vodka breath and those eyes. Lethal.",
    "Candlelight Tavern neon… and you. Damn.",
    "Bad back. Worse lines. Wanna hear?",
    "Scoot. My beer needs a date.",
    "You slam shots. I slam doors. Match made.",
    "One looker in this Wash Park dump. Congrats.",
    "Bartender's glacial. You're not. Hi.",
    "Divorce lawyer said \"meet people.\" So… hi.",
    "Bottle heavy? Got a shoulder. Free.",
    "Ain't much — vertical and breathing.",
    "Last call's coming. Your number isn't.",
    "Booth. You. Me. Zero good decisions.",
    // patron_bark_16+
    "Kid left for college. Guess I'm free.",
    "These kneepads? Bad back. Not a lifestyle.",
    "Name's… unimportant. Yours isn't.",
    "I tip big and talk worse. Fair warning.",
    "Saw you from the parking lot. Worth it.",
    "Ex took the house. I kept the thirst.",
    "You need a ride home or a worse idea?",
    "I'm someone's dad. Don't let that stop you.",
    "Buy you a shot? Or six. I'm flexible.",
  ];

  // Ashley reactions — IDs ash_ignore_*, ash_flirt_up_*, ash_flirt_down_*, ash_yell_*
  const ASHLEY_IGNORE = [
    "Not today, grandpa vibes.",
    "Talk to the vodka.",
    "…wow. Silence is mercy.",
    "I'm on a liquid date.",
    "Save it for the Uber.",
    "Hard pass. Soft vodka.",
  ];
  const ASHLEY_FLIRT_UP = [
    "Ugh. Fine. You're weird cute.",
    "Don't make me regret this.",
    "Buy me nothing. Stay interesting.",
    "Okay that one landed. Barely.",
  ];
  const ASHLEY_FLIRT_DOWN = [
    "Ew. Absolute basement energy.",
    "I flirted. I hate myself.",
    "That was a mistake with legs.",
    "Never speak again. Ever.",
  ];
  const ASHLEY_YELL = [
    "GET LOST!",
    "OUT. Now.",
    "Touch the door, not me!",
    "Security's imaginary. Still leave!",
    "Wrong woman, wrong night!",
    "Bye forever, champ.",
    // ash_yell_coke_* — wired, manic
    "I SAID LEAVE BEFORE I SNORT THE BAR!",
    "WHO TOUCHED MY LINE?!",
  ];

  // Sameer lock: rails coke, yells, crashes out — IDs ash_rail_*, ash_crash_*
  const ASHLEY_RAIL = [
    "One more line. For science.",
    "Nose goes. Brain follows. Maybe.",
    "Rails before Last Call. Non-negotiable.",
    "Powdered courage. Instant regret pending.",
  ];


  // Crash-out — IDs ash_crash_01–06 (Narrative lock)
  const ASHLEY_CRASH = [
    "Vision's a slideshow. Bad playlist.",
    "Floor's hugging me. Rude.",
    "I peaked. Then I cratered.",
    "Tell the bartender I died funny.",
    "Crash-out speedrun. Any %.",
    "Lights out at Candlelight. Classic.",
    "EVERYBODY OUT OF MY FACE!",
    "I SAID I'M FINE — CLEARLY A LIE!",
    "ONE MORE WORD AND THIS STOOL FLIES!",
    "CRASHING OUT! DEAL WITH IT!",
    "THIS BAR OWES ME AN APOLOGY!",
  ];

  let lineIdx = 0;

  function nextLine() {
    const line = PICKUP_LINES[lineIdx % PICKUP_LINES.length];
    lineIdx++;
    return line;
  }

  function shuffleLines() {
    for (let i = PICKUP_LINES.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = PICKUP_LINES[i];
      PICKUP_LINES[i] = PICKUP_LINES[j];
      PICKUP_LINES[j] = t;
    }
    lineIdx = 0;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function ashleyIgnore() { return pick(ASHLEY_IGNORE); }
  function ashleyFlirt(up) { return pick(up ? ASHLEY_FLIRT_UP : ASHLEY_FLIRT_DOWN); }
  function ashleyYell() { return pick(ASHLEY_YELL); }
  function ashleyRail() { return pick(ASHLEY_RAIL); }
  function ashleyCrash() { return pick(ASHLEY_CRASH); }

  // Mid-round ambient chaos — IDs bar_event_01 …
  const BAR_EVENTS = [
    "Jukebox stuck on Wonderwall. Again.",
    "Greasy burger just hit the island bar.",
    "Marquee flicker: Cocktails… Fine Food… chaos.",
    "Lions regular arguing with the TV.",
    "Bathroom: OUT OF ORDER. Wash Park classic.",
    "Fight over the last lime wedge.",
    "Bartender pretends not to see anything.",
    "Shuffleboard puck nearly took a shin.",
    "Someone tipped in coins. Loudly.",
    "Pool table ate another quarter.",
    "Amber lights make bad ideas look warm.",
    "Island bar traffic jam. Zero patience.",
  ];
  let barEventIdx = 0;

  function nextBarEvent() {
    if (barEventIdx === 0) {
      for (let i = BAR_EVENTS.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = BAR_EVENTS[i];
        BAR_EVENTS[i] = BAR_EVENTS[j];
        BAR_EVENTS[j] = tmp;
      }
    }
    const line = BAR_EVENTS[barEventIdx % BAR_EVENTS.length];
    barEventIdx = (barEventIdx + 1) % BAR_EVENTS.length;
    return line;
  }

  // Last-call beat — ID bar_lastcall_warn
  const LAST_CALL_WARN = "LAST CALL at Candlelight Tavern. Finish or faceplant.";
  function lastCallWarn() { return LAST_CALL_WARN; }

  /**
   * Patron entity
   * state: approaching | talking | leaving | gone
   */
  function createPatron(W, H, fromLeft) {
    const variant = Math.floor(Math.random() * 4);
    const targetX = 60 + Math.random() * (W - 120);
    return {
      x: fromLeft ? -40 : W + 40,
      y: H * 0.62,
      targetX,
      variant,
      facing: fromLeft ? 1 : -1,
      state: 'approaching',
      speed: 55 + Math.random() * 35,
      line: nextLine(),
      age: 0,
      talkTimer: 0,
      leaveTimer: 0,
      id: Math.random().toString(36).slice(2),
    };
  }

  function updatePatron(p, dt, W) {
    p.age += dt;
    if (p.state === 'approaching') {
      const dir = Math.sign(p.targetX - p.x) || 1;
      p.facing = dir;
      p.x += dir * p.speed * dt;
      if (Math.abs(p.x - p.targetX) < 4) {
        p.x = p.targetX;
        p.state = 'talking';
        p.talkTimer = 0;
      }
    } else if (p.state === 'talking') {
      p.talkTimer += dt;
      // Auto-leave if ignored too long (~8s)
      if (p.talkTimer > 8) {
        p.state = 'leaving';
        p.leaveDir = Math.random() < 0.5 ? -1 : 1;
      }
    } else if (p.state === 'leaving') {
      p.leaveTimer += dt;
      const dir = p.leaveDir || (p.x < W / 2 ? -1 : 1);
      p.facing = dir;
      p.x += dir * p.speed * 1.4 * dt;
      if (p.x < -60 || p.x > W + 60) {
        p.state = 'gone';
      }
    }
  }

  global.Patrons = {
    PICKUP_LINES,
    ASHLEY_IGNORE,
    ASHLEY_FLIRT_UP,
    ASHLEY_FLIRT_DOWN,
    ASHLEY_YELL,
    ASHLEY_RAIL,
    ASHLEY_CRASH,
    BAR_EVENTS,
    nextLine,
    shuffleLines,
    ashleyIgnore,
    ashleyFlirt,
    ashleyYell,
    ashleyRail,
    ashleyCrash,
    nextBarEvent,
    lastCallWarn,
    createPatron,
    updatePatron,
  };
})(typeof window !== 'undefined' ? window : globalThis);

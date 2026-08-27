// ═══════════════════════════════════════════════════════════════
//  SHELTER TYCOON - Configuration & Constants
// ═══════════════════════════════════════════════════════════════

export const TILE_W = 64;
export const TILE_H = 32;
export const WALL_H = 44;
export const MAP_W = 50;
export const MAP_H = 44;

// Starting conditions
export const START_MONEY = 8000;
export const WIN_REVENUE = 10000;
export const BANKRUPTCY_THRESHOLD = -5000;

// ─── Shelter economy ───────────────────────────────────────
export const ADOPTION_DONATION = 200;
export const INTAKE_COST = 25;
export const HIRE_COST = INTAKE_COST;

export const CARE_PLAN_PHASES = ['intake', 'medical', 'socialization', 'ready'];

export const PET_DAILY_UPKEEP = {
  pet_dog:    15,
  pet_cat:    12,
  pet_rabbit: 10,
  pet_other:  12,
};

// ─── Room costs (per day rent) ─────────────────────────────
export const ROOM_COSTS = {
  kennel:    20,
  cattery:   20,
  playyard:  15,
  vetbay:    35,
  lobby:      0,
  breakroom:  8,
  meeting:   12,
};

// ─── Agent salaries (per day) - mirrors PET_DAILY_UPKEEP ───
export const AGENT_SALARY = {
  ceo:        0,
  director:   0,
  pet_dog:    PET_DAILY_UPKEEP.pet_dog,
  pet_cat:    PET_DAILY_UPKEEP.pet_cat,
  pet_rabbit: PET_DAILY_UPKEEP.pet_rabbit,
  pet_other:  PET_DAILY_UPKEEP.pet_other,
};

// ─── Species → role / habitat helpers ──────────────────────
export const SPECIES_TO_ROLE = {
  dog:    'pet_dog',
  cat:    'pet_cat',
  rabbit: 'pet_rabbit',
};

export function getHabitatForSpecies(species) {
  const key = (species || '').toLowerCase();
  switch (key) {
    case 'dog':    return 'kennel';
    case 'cat':    return 'cattery';
    case 'rabbit': return 'playyard';
    default:       return 'kennel';
  }
}

export function getRoleForPet(pet) {
  const species = (pet?.species || '').toLowerCase();
  return SPECIES_TO_ROLE[species] || 'pet_other';
}

// ─── Alignment System ──────────────────────────────────────
export const ALIGNMENT = {
  new_hire_min: 0.10,
  new_hire_max: 0.30,
  decay_per_day: 0.008,
  decay_team_size_factor: 0.002,
  standup_boost: 0.12,
  team_building_boost: 0.15,
  team_building_ticks: 180,
  meeting_efficiency_penalty: 0.0,
  misalignment_waste_threshold: 0.35,
  misalignment_quit_threshold: 0.20,
  efficiency_bonus_max: 0.15,
  efficiency_penalty_max: 0.30,
  quality_bonus_max: 0.10,
};

export const SPEECH_MISALIGNED = [
  'Wait, what are we doing again?',
  'I thought we were doing something else...',
  'Are we all on the same page?',
  'This doesn\'t match what I was told...',
  'I\'m confused about priorities...',
  'Working on... something?',
  'Did the plan change?',
];

export const SPEECH_ALIGNED = [
  'We\'re all rowing in the same direction! 🎯',
  'Team is in sync!',
  'Crystal clear on priorities!',
  'Great alignment, great results!',
  'Everyone knows the plan!',
];

export const SPEECH_TEAM_BUILDING = [
  'Team building time! 🎳',
  'Getting the team aligned!',
  'Let\'s get on the same page!',
  'Vision alignment session!',
  'Trust exercises! 🤝',
];

export const SPEECH_QUIT_MISALIGNED = [
  'I don\'t even know what we\'re doing anymore. I\'m out.',
  'This team has no direction. Bye.',
  'I can\'t work like this. Good luck.',
];

// ─── Agent Seniority Tiers ───────────────────────────────
export const SENIORITY_LEVELS = {
  1: { label: 'Junior',     skillRange: [0.20, 0.40], salaryMult: 0.70, spawnWeight: 30, promoteAt: 0.42 },
  2: { label: 'Regular',    skillRange: [0.35, 0.55], salaryMult: 0.85, spawnWeight: 35, promoteAt: 0.57 },
  3: { label: 'Senior',     skillRange: [0.50, 0.70], salaryMult: 1.00, spawnWeight: 20, promoteAt: 0.72 },
  4: { label: 'Lead',       skillRange: [0.65, 0.85], salaryMult: 1.25, spawnWeight: 10, promoteAt: 0.88 },
  5: { label: 'Principal',  skillRange: [0.80, 0.95], salaryMult: 1.50, spawnWeight: 5,  promoteAt: null },
};

export function seniorityStars(level) {
  return '★'.repeat(level) + '☆'.repeat(5 - level);
}

// ─── Economy parameters ────────────────────────────────────
export const ECONOMY = {
  base_cpc: 2.50,
  base_website_cr: 0.03,
  base_close_rate: 0.18,
  sales_capacity_per_eff: 0.5,
  no_sales_capacity: 0.02,
  marketing_power_divisor: 220,
  delivery_gtm_ratio: 0.5,
  reputation_organic_factor: 2.0,
  starting_reputation: 40,
  grace_period_days: 7,
  content_organic_factor: 20,
  seo_organic_factor: 15,
  design_quality_cr_boost: 1.5,
  content_quality_cr_boost: 1.0,
  meeting_room_close_boost: 1.2,
  day_ticks: 600,
  week_days: 5,
  sales_deal_bonus: 0.15,
  no_sales_flow_rate: 0.30,
  support_rep_decay: 0.3,
  support_rep_gain: 0.1,
  adoption_donation: ADOPTION_DONATION,
  intake_cost: INTAKE_COST,
};

// ─── Cross-office synergy definitions ────────────────────────
export const OFFICE_SYNERGIES = {};

// ─── Office type definitions ───────────────────────────────
export const OFFICE_TYPES = {
  kennel: {
    name: 'Wire Kennels', icon: '🐕', accent: '#d4842a',
    accentRGB: [212, 132, 42], floorBase: [188, 168, 148], wallBase: [210, 188, 165], floorPattern: 'tile',
    size: { w: 7, h: 5 }, cost: 1200,
    furniture: [
      { type: 'crate', lx: 0, ly: 0 },
      { type: 'crate', lx: 0, ly: 1 },
      { type: 'crate', lx: 1, ly: 0 },
      { type: 'desk', lx: 3, ly: 1 },
      { type: 'monitor', lx: 4, ly: 1, screens: 1 },
      { type: 'chair', lx: 3, ly: 2 },
      { type: 'shelf', lx: 5, ly: 0 },
      { type: 'whiteboard', lx: 5, ly: 3 },
      { type: 'plant', lx: 6, ly: 4 },
    ],
    workTiles: [[4, 2], [2, 2], [3, 3]],
  },
  cattery: {
    name: 'Basic Cattery', icon: '🐈', accent: '#5b7fc7',
    accentRGB: [91, 127, 199], floorBase: [175, 185, 210], wallBase: [195, 205, 225], floorPattern: 'carpet',
    size: { w: 7, h: 5 }, cost: 1200,
    furniture: [
      { type: 'crate', lx: 0, ly: 0 },
      { type: 'crate', lx: 0, ly: 2 },
      { type: 'shelf', lx: 1, ly: 0 },
      { type: 'desk', lx: 2, ly: 1 },
      { type: 'monitor', lx: 3, ly: 1, screens: 1 },
      { type: 'chair', lx: 2, ly: 2 },
      { type: 'desk', lx: 5, ly: 2 },
      { type: 'chair', lx: 5, ly: 3 },
      { type: 'plant', lx: 6, ly: 0 },
      { type: 'plant', lx: 6, ly: 4 },
    ],
    workTiles: [[3, 2], [6, 3], [1, 3]],
  },
  playyard: {
    name: 'Fenced Play Yard', icon: '🌳', accent: '#3d9a45',
    accentRGB: [61, 154, 69], floorBase: [130, 178, 108], wallBase: [150, 198, 128], floorPattern: 'concrete',
    size: { w: 7, h: 5 }, cost: 1000,
    furniture: [
      { type: 'table', lx: 2, ly: 1 },
      { type: 'chair', lx: 2, ly: 2 },
      { type: 'chair', lx: 3, ly: 2 },
      { type: 'crate', lx: 0, ly: 0 },
      { type: 'crate', lx: 0, ly: 3 },
      { type: 'shelf', lx: 5, ly: 0 },
      { type: 'plant', lx: 6, ly: 1 },
      { type: 'plant', lx: 6, ly: 4 },
      { type: 'whiteboard', lx: 4, ly: 0 },
    ],
    workTiles: [[3, 2], [1, 2], [5, 2]],
  },
  vetbay: {
    name: 'Veterinary Bay', icon: '🏥', accent: '#2a9db8',
    accentRGB: [42, 157, 184], floorBase: [190, 220, 228], wallBase: [210, 235, 240], floorPattern: 'lab',
    size: { w: 7, h: 5 }, cost: 2000,
    furniture: [
      { type: 'desk', lx: 1, ly: 1 },
      { type: 'monitor', lx: 2, ly: 1, screens: 2 },
      { type: 'chair', lx: 1, ly: 2 },
      { type: 'desk', lx: 4, ly: 1 },
      { type: 'monitor', lx: 4, ly: 1, screens: 1 },
      { type: 'chair', lx: 4, ly: 2 },
      { type: 'shelf', lx: 0, ly: 0 },
      { type: 'whiteboard', lx: 5, ly: 0 },
      { type: 'plant', lx: 6, ly: 4 },
    ],
    workTiles: [[2, 2], [5, 2], [3, 3]],
  },
};

export const COMMON_ROOMS = {
  breakroom: {
    name: 'Volunteer Lounge', icon: '☕', accent: '#d4842a',
    accentRGB: [212, 132, 42], floorBase: [200, 175, 155], wallBase: [220, 195, 175], floorPattern: 'wood',
    size: { w: 7, h: 4 }, cost: 800,
    furniture: [
      { type: 'coffeemachine', lx: 0, ly: 0, interactive: true, configKey: 'coffee_quality', label: 'Coffee Quality' },
      { type: 'table', lx: 2, ly: 1 },
      { type: 'chair', lx: 2, ly: 2 },
      { type: 'chair', lx: 3, ly: 2 },
      { type: 'couch', lx: 4, ly: 0, interactive: true, configKey: 'break_duration', label: 'Break Policy' },
      { type: 'plant', lx: 5, ly: 3 },
      { type: 'plant', lx: 6, ly: 1, interactive: true, configKey: 'perks_package', label: 'Perks Package' },
    ],
    workTiles: [[3, 2], [1, 1], [5, 2]],
  },
  meeting: {
    name: 'Staff Room', icon: '🤝', accent: '#7a8fc7',
    accentRGB: [122, 143, 199], floorBase: [175, 185, 200], wallBase: [195, 205, 220], floorPattern: 'carpet',
    size: { w: 7, h: 4 }, cost: 1000,
    furniture: [
      { type: 'bigtv', lx: 3, ly: 0, interactive: true, configKey: 'meeting_schedule', label: 'Meeting Frequency' },
      { type: 'table', lx: 2, ly: 2 },
      { type: 'chair', lx: 1, ly: 2 },
      { type: 'chair', lx: 3, ly: 3 },
      { type: 'chair', lx: 4, ly: 2 },
      { type: 'whiteboard', lx: 0, ly: 0 },
      { type: 'plant', lx: 5, ly: 0 },
    ],
    workTiles: [[2, 3], [4, 3], [3, 2]],
  },
  lobby: {
    name: 'Adoption Lobby', icon: '🏠', accent: '#c97840',
    accentRGB: [201, 120, 64], floorBase: [210, 195, 175], wallBase: [230, 215, 195], floorPattern: 'tile',
    size: { w: 5, h: 3 }, cost: 0,
    furniture: [
      { type: 'couch', lx: 1, ly: 0, interactive: true, configKey: 'lobby_style', label: 'Lobby Style' },
      { type: 'plant', lx: 4, ly: 0 },
      { type: 'plant', lx: 0, ly: 2, interactive: true, configKey: 'workspace_quality', label: 'Workspace Quality' },
    ],
    workTiles: [[2, 1], [3, 1]],
  },
};

// ─── Agent roles ───────────────────────────────────────────
export const AGENT_ROLES = {
  ceo: {
    title: 'Shelter Director (You)',
    office: 'any',
    color: '#f0c040',
    emoji: '👔',
    accessory: 'glasses',
  },
  pet_dog: {
    title: 'Rescue Dog',
    office: 'kennel',
    color: '#d4842a',
    emoji: '🐕',
    accessory: 'cap',
  },
  pet_cat: {
    title: 'Rescue Cat',
    office: 'cattery',
    color: '#5b7fc7',
    emoji: '🐈',
    accessory: 'beret',
  },
  pet_rabbit: {
    title: 'Rescue Rabbit',
    office: 'playyard',
    color: '#3d9a45',
    emoji: '🐰',
    accessory: 'pen',
  },
  pet_other: {
    title: 'Rescue Pet',
    office: 'playyard',
    color: '#9080c0',
    emoji: '🐾',
    accessory: 'glasses',
  },
};

// ─── Office guide (shelter identity, adoption drivers) ───
export const OFFICE_GUIDE = {
  kennel: {
    role: 'Dog Habitat', impact: 'Houses dogs through their care plan.',
    guide: 'Wire kennels give rescue dogs a safe place to rest while they move through intake, medical checks, socialization, and adoption readiness.',
    howItWorks: 'Dogs assigned here work through care plan phases. Staff and volunteers help them become ready for adopters.',
    tips: 'Build kennels early - dogs need dedicated space. Pair with a Vet Bay for faster medical clearance.',
    projects: 'Dog Care Plan',
  },
  cattery: {
    role: 'Cat Habitat', impact: 'Houses cats through their care plan.',
    guide: 'The cattery provides quiet enclosures and enrichment for rescue cats on their path to a forever home.',
    howItWorks: 'Cats progress through intake, medical, socialization, and ready phases while living here.',
    tips: 'Cats prefer calm spaces. Keep catteries near the lobby so adopters can meet ready cats easily.',
    projects: 'Cat Care Plan',
  },
  playyard: {
    role: 'Exercise & Small Animals', impact: 'Socialization space for rabbits and mixed species.',
    guide: 'The fenced play yard lets pets stretch their legs, burn energy, and show their personality to potential adopters.',
    howItWorks: 'Rabbits and other small animals use this habitat. Active socialization here speeds up the ready phase.',
    tips: 'Great for shy pets - outdoor play builds confidence. Essential for rabbits and exotic intakes.',
    projects: 'Small Animal Care Plan',
  },
  vetbay: {
    role: 'Medical Hub', impact: 'Speeds medical phase and boosts reputation.',
    guide: 'The veterinary bay handles exams, vaccinations, and treatment. Healthy pets adopt faster and donors trust your shelter more.',
    howItWorks: 'Medical staff process health checks and treatments. Reduces time stuck in the medical care phase.',
    tips: 'Expensive to run but worth it once intake volume grows. Keeps reputation high with the community.',
    projects: 'Medical Clearance',
  },
  breakroom: {
    role: 'Volunteer Morale', impact: 'Restores mood and long-term productivity.',
    guide: 'Volunteers and staff recharge here between shifts. Tired caregivers lose efficiency - the lounge keeps everyone going.',
    howItWorks: 'Exhausted agents visit the volunteer lounge to recover energy. Recovery is much faster than passive idle recovery.',
    tips: 'Build this early! One lounge serves your whole team of staff and volunteers.',
    projects: 'None - passive facility',
  },
  meeting: {
    role: 'Staff Coordination', impact: 'Enables collaboration and team alignment.',
    guide: 'The staff room is where your team syncs on intakes, adoptions, and daily operations.',
    howItWorks: 'Staff periodically meet to share updates. Improves collaboration and adoption close rates.',
    tips: 'Cheap to build and maintain. Helps keep everyone aligned on which pets need attention.',
    projects: 'None - passive facility',
  },
  lobby: {
    role: 'Adoption Front Desk', impact: 'Where adopters arrive and pets meet families.',
    guide: 'Your adoption lobby is the first impression for visitors. Adopters check in here and meet pets ready for forever homes.',
    howItWorks: 'Adopters spawn in the lobby. Your director coordinates intake tours and adoption meetings from here.',
    tips: 'You can\'t remove the lobby. Upgrade its style to boost community reputation.',
    projects: 'None - starting facility',
  },
};

// ─── P&L Office categories ─────────────────────────────────
export const OFFICE_CATEGORIES = {
  habitats:   { label: 'Habitats',   icon: '🐾', offices: ['kennel', 'cattery', 'playyard'] },
  facilities: { label: 'Facilities', icon: '🏥', offices: ['vetbay'] },
  common:     { label: 'Common',     icon: '🏠', offices: ['lobby', 'breakroom', 'meeting'] },
};

// ─── Per-company-type office role mappings ────────────────
export const COMPANY_OFFICE_ROLES = {
  animal_shelter: {
    delivery:       ['kennel', 'cattery', 'playyard'],
    growth:         ['lobby'],
    infrastructure: ['vetbay'],
  },
};

// ─── Spawn weight per office role ────────────────────────
export const OFFICE_ROLE_WEIGHTS = { delivery: 1.0, growth: 0.3, infrastructure: 0.15 };

// ─── Diversification config ──────────────────────────────
export const DIVERSIFICATION_CONFIG = {
  baseCost: 5000,
  premiumCost: 10000,
  premiumOffices: ['vetbay'],
  remodelingDays: 3,
  passiveBonusReduction: 0.5,
};

// ─── Project templates (care plans) ────────────────────────
export const PROJECT_TEMPLATES = [
  {
    name: 'Dog Care Plan',
    icon: '🐕',
    basePay: 0,
    office: 'kennel',
    phases: ['intake', 'medical', 'socialization', 'ready'],
    time: 16,
    color: '#c07840',
    isCarePlan: true,
  },
  {
    name: 'Cat Care Plan',
    icon: '🐈',
    basePay: 0,
    office: 'cattery',
    phases: ['intake', 'medical', 'socialization', 'ready'],
    time: 16,
    color: '#8090b0',
    isCarePlan: true,
  },
  {
    name: 'Small Animal Care Plan',
    icon: '🐰',
    basePay: 0,
    office: 'playyard',
    phases: ['intake', 'medical', 'socialization', 'ready'],
    time: 16,
    color: '#70a060',
    isCarePlan: true,
  },
];

// ─── Speech lines ──────────────────────────────────────────
export const SPEECH_WORKING = {
  ceo: [
    'Reviewing intake records...',
    'Checking adoption applications...',
    'Planning tomorrow\'s volunteers...',
    'Calling the vet for supplies...',
    'Updating the donor newsletter...',
    'Coordinating foster homes...',
    'Meeting with the board...',
    'Counting kibble inventory...',
  ],
  pet_dog: [
    'Sniff sniff... 🐕',
    'Tail wagging!',
    'Waiting for belly rubs...',
    'Playing with a squeaky toy!',
    'Learning to sit!',
    'Woof! New friend!',
    'Nap time in the sunbeam...',
    'Chasing my tail!',
  ],
  pet_cat: [
    'Purr purr... 🐈',
    'Staring at a bird outside...',
    'Kneading a soft blanket...',
    'Slow blink of trust...',
    'Hiding in a cardboard box...',
    'Meow! Feed me?',
    'Grooming my whiskers...',
    'Plotting world domination...',
  ],
  pet_rabbit: [
    'Hop hop! 🐰',
    'Nibbling on hay...',
    'Binky time!',
    'Exploring the yard...',
    'Flopping in the grass...',
    'Twitching my nose...',
    'Digging a cozy burrow...',
    'So many veggies!',
  ],
  pet_other: [
    'Exploring my habitat... 🐾',
    'Making new friends!',
    'Curious about everything!',
    'Ready for treats!',
    'Showing off my personality!',
    'Getting comfy...',
    'Waiting for adoption day!',
    'Learning to trust humans...',
  ],
};

export const SPEECH_WORKING_OVERRIDES = {};

export const SPEECH_THINKING = ['Hmm...', 'Let me think...', 'Processing...', 'Analyzing...', 'One moment...', '🤔', 'This is interesting...', 'Bear with me...'];
export const SPEECH_IDLE = ['☕ Coffee time!', 'Ready to go!', 'What\'s next?', '💤 Quiet day...', 'Stretching...', 'Checking the schedule...', 'Anyone need help?', 'Reorganizing my desk'];
export const SPEECH_DONE = ['✅ Done!', 'Shipped it!', 'Task complete!', '🎉 Finished!', 'Nailed it!', 'And that\'s a wrap!'];
export const SPEECH_BREAK = ['Ahh, needed this!', 'Good coffee ☕', 'Recharging...', 'Back in 5!', 'Snack break!', 'Touch grass moment'];
export const SPEECH_EXHAUSTED = ['So tired...', 'Need a break...', 'Running on empty...', 'Can barely focus...', 'Must rest...', 'My brain is mush...', 'Error 503: human unavailable'];
export const SPEECH_COLLAB = ['Great meeting!', 'Good sync!', 'Love this team!', 'Learned something!', 'We should do this more often', 'That was actually useful!'];
export const SPEECH_RAISE = [];
export const SPEECH_QUIT = [];
export const SPEECH_SKILL_CAP = ['I\'ve peaked...', 'Need new challenges', 'Hit my ceiling here', 'Not growing anymore', 'Feeling stagnant...'];
export const SPEECH_PROMOTED = ['Level up!', 'I got promoted!', 'Moving on up!', 'Hard work pays off!', 'New title, who dis?', 'Mom, I made it!'];

// ─── Visitor Dialogue System ────────────────────────────
const ADOPTER_ARRIVAL = [
  'Here to meet a pet!',
  'Looking for a new friend!',
  'We want to adopt!',
  'Is anyone available?',
];

const ADOPTER_QUEUE = [
  'We\'ll wait...',
  'So many cute pets!',
  'Hope we\'re next.',
];

const ADOPTER_DIALOGUES = [
  [
    ['visitor', 'We\'re looking for a dog to adopt.', 45],
    ['agent', 'Tell me about your home and lifestyle.', 40],
    ['visitor', 'We have a fenced yard and lots of love.', 40],
    ['agent', 'Any experience with rescue dogs?', 35],
    ['visitor', 'We\'ve had dogs before.', 40],
    ['agent', 'Perfect - let me introduce you! 🐕', 45],
  ],
  [
    ['visitor', 'Do you have any cats available?', 45],
    ['agent', 'We have several ready for adoption!', 40],
    ['visitor', 'We\'d love a calm indoor cat.', 35],
    ['agent', 'I know just the one.', 40],
    ['visitor', 'Can we meet them?', 35],
    ['agent', 'Follow me to the cattery! 🐈', 45],
  ],
  [
    ['visitor', 'We heard great things about this shelter!', 40],
    ['agent', 'Thank you! What kind of pet are you looking for?', 40],
    ['visitor', 'Something small for our apartment.', 35],
    ['agent', 'We have rabbits and small animals ready.', 40],
    ['visitor', 'That sounds perfect!', 35],
    ['agent', 'Let\'s head to the play yard! 🐰', 40],
  ],
];

export const VISITOR_ARRIVAL_SPEECH = {
  adopter: ADOPTER_ARRIVAL,
  client:  ADOPTER_ARRIVAL,
  candidate: ['I\'m here to volunteer!', 'I have an orientation today.', 'Excited to help!', 'Reporting for my shift.'],
  walkin:    ['Just passing by!', 'Love this shelter!', 'What cute animals!', 'Mind if I look around?'],
  customer:  ['Just browsing!', 'Love this place!', 'Anything I can donate?', 'Looking for a new companion...'],
};

export const VISITOR_QUEUE_SPEECH = {
  adopter: ADOPTER_QUEUE,
  client:  ADOPTER_QUEUE,
  candidate: ['Still waiting...', 'Hope orientation starts soon.', 'Nervous but excited.'],
  walkin:    ['I\'ll come back.', 'Seems busy.', 'No rush.'],
  customer:  ['I\'ll keep looking.', 'Busy in here!', 'No worries.'],
};

export const VISITOR_DIALOGUES = {
  adopter: ADOPTER_DIALOGUES,
  client:  ADOPTER_DIALOGUES,
  candidate: [
    [
      ['agent', 'Welcome! Thanks for volunteering.', 45],
      ['visitor', 'I love animals and want to help.', 40],
      ['agent', 'What shifts work for you?', 40],
      ['visitor', 'Weekends are best.', 40],
      ['agent', 'Great - we\'ll get you started! 🤝', 45],
    ],
  ],
  walkin: [
    [
      ['visitor', 'What a wonderful shelter!', 35],
      ['agent', 'Thanks! Want a tour?', 35],
      ['visitor', 'Sure!', 30],
      ['agent', 'This is where the magic happens. ✨', 40],
    ],
  ],
  customer: [
    [
      ['visitor', 'Can I make a donation?', 40],
      ['agent', 'Absolutely - every bit helps! 💝', 35],
      ['visitor', 'You do amazing work here.', 35],
      ['agent', 'Thank you so much!', 40],
    ],
  ],
};

// ─── IQ Labels ──────────────────────────────────────────
export const IQ_LABELS = [
  { min: 0,    max: 0.7,  label: 'Slow',      emoji: '🧠' },
  { min: 0.7,  max: 1.0,  label: 'Average',   emoji: '🧠' },
  { min: 1.0,  max: 1.3,  label: 'Sharp',     emoji: '🧠' },
  { min: 1.3,  max: 2.0,  label: 'Brilliant', emoji: '🧠' },
];

export function getIQLabel(iq) {
  const tier = IQ_LABELS.find(t => iq >= t.min && iq < t.max) || IQ_LABELS[IQ_LABELS.length - 1];
  return tier;
}

// ─── Energy drain coefficients per role (per ms while working) ───
export const ENERGY_DRAIN = {
  ceo:        0.00012,
  pet_dog:    0.00004,
  pet_cat:    0.00003,
  pet_rabbit: 0.00003,
  pet_other:  0.00004,
};

export const ENERGY_RECOVERY_RATE = 0.0008;
export const ENERGY_PASSIVE_RECOVERY = 0.00005;
export const ENERGY_EXHAUSTION_THRESHOLD = 0.12;
export const ENERGY_LOW_THRESHOLD = 0.35;

export const CHARACTER_NAMES = [
  'Alex', 'Sam', 'Jordan', 'Riley', 'Casey', 'Morgan', 'Quinn', 'Avery', 'Blake', 'Drew',
  'Sage', 'Reese', 'Kai', 'River', 'Rowan', 'Harper', 'Ellis', 'Finley', 'Dakota', 'Emery',
];

// ─── TeamDay character avatars per role ──────────────────
export const TEAMDAY_CHARACTERS = {
  ceo:        [],
  pet_dog:    [],
  pet_cat:    [],
  pet_rabbit: [],
  pet_other:  [],
};

// ─── Analytics visibility levels ───────────────────────────
export const ANALYTICS_LEVELS = {
  0: { name: 'No Data',      description: 'You have no visibility into shelter metrics.' },
  1: { name: 'Basic',        description: 'Rough counts of intakes and adoptions.' },
  2: { name: 'Standard',     description: 'Clear adoption funnel and daily costs.' },
  3: { name: 'Full Insight', description: 'Full shelter analytics with projections.' },
};

// ─── Tutorial hints ────────────────────────────────────────
export const TUTORIAL_HINTS = [
  { trigger: 'start',         text: 'Tan tiles are corridors. Press B → Build a Kennel or Cattery touching those paths, then Intake (H).' },
  { trigger: 'first_room',    text: 'Habitat ready! Open Intake (H) - dogs need Kennels, cats need Cattery.' },
  { trigger: 'first_hire',    text: null },
  { trigger: 'first_intake',  text: 'Pet welcomed! Their care plan runs automatically - watch the Care Plans tab on the right.' },
  { trigger: 'first_project', text: 'Care plan started: Intake → Medical → Socialization → Ready. Speed up time with 2× if you like.' },
  { trigger: 'first_ready',   text: 'A pet is adoption-ready! Adopters will visit the lobby - match them to find a home.' },
  { trigger: 'first_adoption', text: 'First adoption complete! Each match earns a donation and adds to your Adoptédex.' },
  { trigger: 'low_mood',      text: 'Your team looks tired. Build a Volunteer Lounge so staff can recharge!' },
  { trigger: 'low_energy',    text: 'Someone is running low on energy! They\'ll rest soon - a Volunteer Lounge speeds recovery.' },
  { trigger: 'low_motivation', text: 'Motivation is dropping! Set up perks in the Volunteer Lounge to keep staff happy.' },
  { trigger: 'stalled',       text: 'Care plans are stalling! Make sure each habitat has pets assigned and staff to help.' },
  { trigger: 'low_alignment', text: 'Team alignment is low! Use the Staff Room for a team sync with your director.' },
  { trigger: 'analytics',     text: 'Track intakes, adoptions, and costs from the analytics panel as your shelter grows.' },
];

// ─── Equipment configuration options ─────────────────────
export const EQUIPMENT_CONFIGS = {
  lobby_style: {
    label: 'Lobby Style', icon: '🏠',
    options: [
      { key: 'casual',       label: 'Casual',       desc: 'Welcoming atmosphere (+1 rep/week)' },
      { key: 'professional', label: 'Professional', desc: 'Polished adoption center (+2 rep/week)' },
      { key: 'premium',      label: 'Premium',      desc: 'Showcase shelter (+3 rep/week)' },
    ],
    default: 'casual',
  },
  coffee_quality: {
    label: 'Coffee Quality', icon: '☕',
    options: [
      { key: 'instant',  label: 'Instant',  desc: 'Basic coffee (1× mood recovery)' },
      { key: 'drip',     label: 'Drip',     desc: 'Good coffee (1.3× mood recovery)' },
      { key: 'espresso', label: 'Espresso', desc: 'Premium coffee (1.6× mood recovery)' },
    ],
    default: 'instant',
  },
  break_duration: {
    label: 'Break Policy', icon: '🛋️',
    options: [
      { key: 'short',    label: 'Short',    desc: 'Quick breaks, less recovery (0.7× duration)' },
      { key: 'normal',   label: 'Normal',   desc: 'Standard breaks' },
      { key: 'extended', label: 'Extended', desc: 'Long breaks, better recovery (1.5× duration)' },
    ],
    default: 'normal',
  },
  meeting_schedule: {
    label: 'Meeting Frequency', icon: '📅',
    options: [
      { key: 'weekly',   label: 'Weekly',   desc: 'Staff sync every week' },
      { key: 'biweekly', label: 'Biweekly', desc: 'Every 2 weeks' },
    ],
    default: 'weekly',
  },
  perks_package: {
    label: 'Perks Package', icon: '🏋️',
    options: [
      { key: 'none',    label: 'None',    desc: 'No perks (free)' },
      { key: 'basic',   label: 'Basic',   desc: 'Volunteer appreciation - motivation +0.1/day ($15/day)' },
      { key: 'premium', label: 'Premium', desc: 'Full volunteer perks - motivation +0.2/day, mood +0.05/day ($35/day)' },
      { key: 'elite',   label: 'Elite',   desc: 'Top-tier perks - motivation +0.3/day, mood +0.1/day, energy +15% ($60/day)' },
    ],
    default: 'none',
  },
  workspace_quality: {
    label: 'Workspace Quality', icon: '🪑',
    options: [
      { key: 'basic',     label: 'Basic',     desc: 'Standard workspace (free)' },
      { key: 'ergonomic', label: 'Ergonomic', desc: 'Comfortable desks - energy drain -10% ($20/day)' },
      { key: 'premium',   label: 'Premium',   desc: 'Premium workspace - energy drain -15%, motivation decay -20% ($40/day)' },
    ],
    default: 'basic',
  },
};

// ─── Company types ──────────────────────────────────────
export const COMPANY_TYPES = {
  animal_shelter: {
    name: 'Animal Shelter',
    icon: '🐾',
    tagline: 'Rescue, rehabilitate, and rehome pets',
    available: ['kennel', 'cattery', 'playyard', 'vetbay', 'breakroom', 'meeting'],
    startUnlocked: ['lobby', 'kennel', 'cattery'],
    bonuses: { organicMultiplier: 1.0 },
  },
};

// ─── Growth model definitions per company type ────────────
export const GROWTH_MODELS = {
  animal_shelter: { model: 'linear', label: 'Steady Adoptions' },
};

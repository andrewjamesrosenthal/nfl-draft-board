export type TeamSeed = {
  abbr: string;
  name: string;
  city: string;
  conference: "AFC" | "NFC";
  division: "East" | "West" | "North" | "South";
  primaryHex: string;
  secondaryHex: string;
  logoEmoji?: string;
};

export const TEAMS: TeamSeed[] = [
  // AFC East
  { abbr: "BUF", name: "Bills",      city: "Buffalo",      conference: "AFC", division: "East",  primaryHex: "#00338d", secondaryHex: "#c60c30", logoEmoji: "BUF" },
  { abbr: "MIA", name: "Dolphins",   city: "Miami",        conference: "AFC", division: "East",  primaryHex: "#008e97", secondaryHex: "#fc4c02", logoEmoji: "MIA" },
  { abbr: "NE",  name: "Patriots",   city: "New England",  conference: "AFC", division: "East",  primaryHex: "#002244", secondaryHex: "#c60c30", logoEmoji: "NE"  },
  { abbr: "NYJ", name: "Jets",       city: "New York",     conference: "AFC", division: "East",  primaryHex: "#125740", secondaryHex: "#000000", logoEmoji: "NYJ" },

  // AFC North
  { abbr: "BAL", name: "Ravens",     city: "Baltimore",    conference: "AFC", division: "North", primaryHex: "#241773", secondaryHex: "#9e7c0c", logoEmoji: "BAL" },
  { abbr: "CIN", name: "Bengals",    city: "Cincinnati",   conference: "AFC", division: "North", primaryHex: "#fb4f14", secondaryHex: "#000000", logoEmoji: "CIN" },
  { abbr: "CLE", name: "Browns",     city: "Cleveland",    conference: "AFC", division: "North", primaryHex: "#311d00", secondaryHex: "#ff3c00", logoEmoji: "CLE" },
  { abbr: "PIT", name: "Steelers",   city: "Pittsburgh",   conference: "AFC", division: "North", primaryHex: "#ffb612", secondaryHex: "#101820", logoEmoji: "PIT" },

  // AFC South
  { abbr: "HOU", name: "Texans",     city: "Houston",      conference: "AFC", division: "South", primaryHex: "#03202f", secondaryHex: "#a71930", logoEmoji: "HOU" },
  { abbr: "IND", name: "Colts",      city: "Indianapolis", conference: "AFC", division: "South", primaryHex: "#002c5f", secondaryHex: "#a2aaad", logoEmoji: "IND" },
  { abbr: "JAX", name: "Jaguars",    city: "Jacksonville", conference: "AFC", division: "South", primaryHex: "#006778", secondaryHex: "#d7a22a", logoEmoji: "JAX" },
  { abbr: "TEN", name: "Titans",     city: "Tennessee",    conference: "AFC", division: "South", primaryHex: "#0c2340", secondaryHex: "#4b92db", logoEmoji: "TEN" },

  // AFC West
  { abbr: "DEN", name: "Broncos",    city: "Denver",       conference: "AFC", division: "West",  primaryHex: "#fb4f14", secondaryHex: "#002244", logoEmoji: "DEN" },
  { abbr: "KC",  name: "Chiefs",     city: "Kansas City",  conference: "AFC", division: "West",  primaryHex: "#e31837", secondaryHex: "#ffb81c", logoEmoji: "KC"  },
  { abbr: "LV",  name: "Raiders",    city: "Las Vegas",    conference: "AFC", division: "West",  primaryHex: "#000000", secondaryHex: "#a5acaf", logoEmoji: "LV"  },
  { abbr: "LAC", name: "Chargers",   city: "Los Angeles",  conference: "AFC", division: "West",  primaryHex: "#0080c6", secondaryHex: "#ffc20e", logoEmoji: "LAC" },

  // NFC East
  { abbr: "DAL", name: "Cowboys",    city: "Dallas",       conference: "NFC", division: "East",  primaryHex: "#003594", secondaryHex: "#869397", logoEmoji: "DAL" },
  { abbr: "NYG", name: "Giants",     city: "New York",     conference: "NFC", division: "East",  primaryHex: "#0b2265", secondaryHex: "#a71930", logoEmoji: "NYG" },
  { abbr: "PHI", name: "Eagles",     city: "Philadelphia", conference: "NFC", division: "East",  primaryHex: "#004c54", secondaryHex: "#a5acaf", logoEmoji: "PHI" },
  { abbr: "WAS", name: "Commanders", city: "Washington",   conference: "NFC", division: "East",  primaryHex: "#5a1414", secondaryHex: "#ffb612", logoEmoji: "WAS" },

  // NFC North
  { abbr: "CHI", name: "Bears",      city: "Chicago",      conference: "NFC", division: "North", primaryHex: "#0b162a", secondaryHex: "#c83803", logoEmoji: "CHI" },
  { abbr: "DET", name: "Lions",      city: "Detroit",      conference: "NFC", division: "North", primaryHex: "#0076b6", secondaryHex: "#b0b7bc", logoEmoji: "DET" },
  { abbr: "GB",  name: "Packers",    city: "Green Bay",    conference: "NFC", division: "North", primaryHex: "#203731", secondaryHex: "#ffb612", logoEmoji: "GB"  },
  { abbr: "MIN", name: "Vikings",    city: "Minnesota",    conference: "NFC", division: "North", primaryHex: "#4f2683", secondaryHex: "#ffc62f", logoEmoji: "MIN" },

  // NFC South
  { abbr: "ATL", name: "Falcons",    city: "Atlanta",      conference: "NFC", division: "South", primaryHex: "#a71930", secondaryHex: "#000000", logoEmoji: "ATL" },
  { abbr: "CAR", name: "Panthers",   city: "Carolina",     conference: "NFC", division: "South", primaryHex: "#0085ca", secondaryHex: "#101820", logoEmoji: "CAR" },
  { abbr: "NO",  name: "Saints",     city: "New Orleans",  conference: "NFC", division: "South", primaryHex: "#d3bc8d", secondaryHex: "#101820", logoEmoji: "NO"  },
  { abbr: "TB",  name: "Buccaneers", city: "Tampa Bay",    conference: "NFC", division: "South", primaryHex: "#d50a0a", secondaryHex: "#34302b", logoEmoji: "TB"  },

  // NFC West
  { abbr: "ARI", name: "Cardinals",  city: "Arizona",      conference: "NFC", division: "West",  primaryHex: "#97233f", secondaryHex: "#000000", logoEmoji: "ARI" },
  { abbr: "LAR", name: "Rams",       city: "Los Angeles",  conference: "NFC", division: "West",  primaryHex: "#003594", secondaryHex: "#ffa300", logoEmoji: "LAR" },
  { abbr: "SF",  name: "49ers",      city: "San Francisco",conference: "NFC", division: "West",  primaryHex: "#aa0000", secondaryHex: "#b3995d", logoEmoji: "SF"  },
  { abbr: "SEA", name: "Seahawks",   city: "Seattle",      conference: "NFC", division: "West",  primaryHex: "#002244", secondaryHex: "#69be28", logoEmoji: "SEA" },
];

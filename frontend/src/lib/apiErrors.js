import i18n from "@/i18n";

/** The API returns its error messages in English. This maps every message a person can actually
 * see to a translation key, so errors follow the language picked in the app. Anything not listed
 * (e.g. a raw validation message) is shown as received. */
const EXACT = {
  "Not authenticated": "apiErrors.notAuthenticated",
  "Not authenticated as an admin": "apiErrors.notAuthenticated",
  "Not authenticated as an athlete": "apiErrors.notAuthenticated",
  "Invalid session, please log in again": "apiErrors.invalidSession",
  "Session expired, please log in again": "apiErrors.sessionExpired",
  "Incorrect email or password": "apiErrors.incorrectLogin",
  "Account not found": "apiErrors.accountNotFound",
  "Enter a valid email address": "apiErrors.validEmail",
  "Enter your name": "apiErrors.enterName",
  "Enter a team name": "apiErrors.enterTeamName",
  "Enter a player name": "apiErrors.enterPlayerName",
  "Enter a note": "apiErrors.enterNote",
  "Add a note on the advice or treatment given before clearing this flag": "apiErrors.noteBeforeClearing",
  "Password must be at least 6 characters": "apiErrors.passwordShort",
  "An account with this email already exists. Try logging in.": "apiErrors.emailExistsLogin",
  "An account with this email already exists. Try Admin Access instead.": "apiErrors.emailExistsAdmin",
  "That code is invalid or has expired.": "apiErrors.codeInvalid",
  "No team found for that code": "apiErrors.noTeamCode",
  "No team found for that access code": "apiErrors.noTeamAccessCode",
  "No team linked to this account yet. Enter a team access code first.": "apiErrors.noTeamLinked",
  "You don't have access to that team.": "apiErrors.noAccessTeam",
  "You already have a team with that name.": "apiErrors.teamNameTaken",
  "Team not found": "apiErrors.teamNotFound",
  "Player not found": "apiErrors.playerNotFound",
  "Player not found on this team's roster": "apiErrors.playerNotOnRoster",
  "Your team no longer has this player on its roster.": "apiErrors.playerRemoved",
  "Check-in not found": "apiErrors.checkinNotFound",
  "Session not found": "apiErrors.sessionNotFound",
  "Not found": "apiErrors.notFound",
  "You've already submitted a check-in for today.": "apiErrors.alreadyCheckedIn",
  "Could not save your check-in. Please try again.": "apiErrors.saveFailed",
  "Could not generate a unique code, please try again.": "apiErrors.codeGenFailed",
  "Select today's session type": "apiErrors.selectSessionType",
  "Select today's session RPE (1-10)": "apiErrors.selectRpe",
  "Enter today's session duration in minutes": "apiErrors.enterDuration",
  "Attach a file": "apiErrors.attachFile",
  "Invalid date. Use YYYY-MM-DD.": "apiErrors.invalidDate",
  "This team has reached today's login limit. Please try again tomorrow.": "apiErrors.teamLoginLimit",
};

const PATTERNS = [
  [/^One account can have up to (\d+) teams\.$/, "apiErrors.maxTeams", (m) => ({ count: m[1] })],
];

export function translateApiError(message) {
  const key = EXACT[message];
  if (key) return i18n.t(key);
  for (const [re, patternKey, vars] of PATTERNS) {
    const m = re.exec(message);
    if (m) return i18n.t(patternKey, vars(m));
  }
  return message;
}

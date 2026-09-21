// Helpers for the one-tap WhatsApp reminders.
// The app never sends WhatsApp messages by itself: each link opens WhatsApp with the text
// already typed, and a person from the Medical Team taps Send.

export function reminderMessage(name, link) {
  return `Hi ${name}, this is the Medical Team. Please complete today's Load and Recovery Monitoring check-in when you can: ${link}`;
}

// phone = digits only, with country code (e.g. "919876543210")
export function whatsappLink(phone, text) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export function displayPhone(phone) {
  return phone ? `+${phone}` : "";
}

// "Who have I already reminded today?" - remembered in this browser only, one list per day.
const PREFIX = "reminded:";

export function loadReminded(dateKey) {
  try {
    const raw = localStorage.getItem(PREFIX + dateKey);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveReminded(dateKey, ids) {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX) && k !== PREFIX + dateKey)
      .forEach((k) => localStorage.removeItem(k)); // keep only today's list
    localStorage.setItem(PREFIX + dateKey, JSON.stringify(ids));
  } catch {
    /* storage unavailable - the reminder still works, it just isn't remembered */
  }
}

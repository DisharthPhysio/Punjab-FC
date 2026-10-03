// Minimal service worker: required by Chrome/Android for "installable" status
// (the TWA wrapper used to publish on Play Store needs this), kept deliberately
// simple so it never interferes with the app's own data. It does not cache
// anything itself - every request just passes straight through to the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

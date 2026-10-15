/*
 * Default hub configuration for static hosting and local files.
 * server/relay.mjs serves its own version of this file that points relayUrl at
 * its WebSocket relay, so games get cross-device multiplayer automatically.
 * A hosting platform can do the same, or set relayUrl to any compatible relay.
 */
window.HUB_CONFIG = window.HUB_CONFIG || { relayUrl: '' };

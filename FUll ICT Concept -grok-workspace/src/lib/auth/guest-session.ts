const GUEST_SESSION_KEY = "first-payout-guest-session";
const GUEST_INITIALIZED_KEY = "first-payout-guest-initialized";

export function isGuestSession() {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(GUEST_SESSION_KEY) === "true";
  } catch (error) {
    console.error("[auth] could not read guest session:", error);
    return false;
  }
}

export function startGuestSession() {
  window.sessionStorage.setItem(GUEST_SESSION_KEY, "true");
  window.sessionStorage.removeItem(GUEST_INITIALIZED_KEY);
}

export function guestDataWasInitialized() {
  return window.sessionStorage.getItem(GUEST_INITIALIZED_KEY) === "true";
}

export function markGuestDataInitialized() {
  window.sessionStorage.setItem(GUEST_INITIALIZED_KEY, "true");
}

export function clearGuestSession() {
  window.sessionStorage.removeItem(GUEST_SESSION_KEY);
  window.sessionStorage.removeItem(GUEST_INITIALIZED_KEY);
}

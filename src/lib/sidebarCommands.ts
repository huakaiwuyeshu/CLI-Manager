export const SIDEBAR_TOGGLE_REQUEST_EVENT = "cli-manager:sidebar-toggle-request";

export function requestSidebarToggle(): void {
  window.dispatchEvent(new Event(SIDEBAR_TOGGLE_REQUEST_EVENT));
}

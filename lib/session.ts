export const SESSION_USER_ID_KEY = 'golf_pool_user_id';

export function getStoredUserId() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(SESSION_USER_ID_KEY);
}

export function storeUserId(userId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SESSION_USER_ID_KEY, userId);
}

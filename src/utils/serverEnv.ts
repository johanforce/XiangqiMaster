/**
 * Server Environment Manager (Prod vs Staging)
 * Ensures 100% data and connection isolation between Official Production and Testing Staging.
 */

export type ServerEnv = 'prod' | 'staging';

export const SERVER_ENV_CONFIG = {
  prod: {
    id: 'prod' as const,
    name: 'Production',
    label: 'PROD',
    fullName: 'Máy Chủ Chính Thức (Production)',
    badgeColor: 'text-emerald-400 bg-emerald-950/70 border-emerald-500/50',
    indicatorColor: 'bg-emerald-400 shadow-[0_0_8px_#34d399]',
    description: 'Dữ liệu thật, thi đấu xếp hạng chính thức, tính điểm Elo và lịch sử ván cờ vĩnh viễn.',
  },
  staging: {
    id: 'staging' as const,
    name: 'Staging Sandbox',
    label: 'STAGING',
    fullName: 'Máy Chủ Thử Nghiệm (Staging Sandbox)',
    badgeColor: 'text-amber-300 bg-amber-950/80 border-amber-500/60',
    indicatorColor: 'bg-amber-400 shadow-[0_0_8px_#f59e0b] animate-pulse',
    description: 'Dữ liệu thử nghiệm độc lập 100% với Prod. Thoải mái tạo phòng, test nước cờ và tính năng mới mà không sợ ảnh hưởng tới Prod.',
  },
};

const STORAGE_ENV_KEY = 'xq_server_env';
export const STAGING_UNLOCKED_KEY = 'xq_staging_unlocked';
export const DEFAULT_STAGING_PASSWORD = '123456';

export function isStagingUnlocked(): boolean {
  try {
    return localStorage.getItem(STAGING_UNLOCKED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setStagingUnlocked(unlocked: boolean): void {
  try {
    if (unlocked) {
      localStorage.setItem(STAGING_UNLOCKED_KEY, 'true');
    } else {
      localStorage.removeItem(STAGING_UNLOCKED_KEY);
    }
  } catch {
    // Ignore
  }
}

export async function verifyStagingPassword(
  inputPassword: string
): Promise<{ success: boolean; error?: string }> {
  const trimmed = String(inputPassword || '').trim();
  if (!trimmed) {
    return {
      success: false,
      error: 'Vui lòng nhập mật khẩu vào Staging',
    };
  }

  // Fast client-side check if matches default
  if (trimmed === DEFAULT_STAGING_PASSWORD) {
    setStagingUnlocked(true);
    return { success: true };
  }

  // Also query backend in case custom password is set
  try {
    const res = await fetch('/api/staging/verify-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: trimmed }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      setStagingUnlocked(true);
      return { success: true };
    }
    return {
      success: false,
      error: data.error || 'Mật khẩu Staging không chính xác',
    };
  } catch {
    if (trimmed === DEFAULT_STAGING_PASSWORD) {
      setStagingUnlocked(true);
      return { success: true };
    }
    return {
      success: false,
      error: 'Mật khẩu Staging không chính xác',
    };
  }
}

export function getServerEnv(): ServerEnv {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const envParam = urlParams.get('env');
    if (envParam === 'staging') {
      if (isStagingUnlocked()) {
        return 'staging';
      }
      return 'prod';
    }
    if (envParam === 'prod') {
      return 'prod';
    }
    const saved = localStorage.getItem(STORAGE_ENV_KEY);
    if (saved === 'staging') {
      if (isStagingUnlocked()) {
        return 'staging';
      }
      return 'prod';
    }
  } catch {
    // Ignore storage/url errors
  }
  return 'prod';
}

export function setServerEnv(env: ServerEnv): void {
  try {
    localStorage.setItem(STORAGE_ENV_KEY, env);
    if (typeof document !== 'undefined') {
      document.cookie = `xq_server_env=${env}; path=/; max-age=31536000; SameSite=Lax`;
    }
    const url = new URL(window.location.href);
    if (env === 'staging') {
      url.searchParams.set('env', 'staging');
    } else {
      url.searchParams.delete('env');
    }
    window.history.replaceState({}, '', url.toString());
  } catch {
    // Ignore
  }
  window.dispatchEvent(new CustomEvent('app:serverenvchange', { detail: { env } }));
}

export function getStoredUserForEnv(env: ServerEnv): any | null {
  try {
    const raw = localStorage.getItem(`xq_user_${env}`) || (env === 'prod' ? localStorage.getItem('xq_user') : null);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUserForEnv(env: ServerEnv, user: any | null): void {
  try {
    if (user) {
      localStorage.setItem(`xq_user_${env}`, JSON.stringify(user));
      if (env === 'prod') {
        localStorage.setItem('xq_user', JSON.stringify(user));
      }
    } else {
      localStorage.removeItem(`xq_user_${env}`);
      if (env === 'prod') {
        localStorage.removeItem('xq_user');
      }
    }
  } catch {
    // Ignore
  }
}

export function getStoredSessionForEnv(env: ServerEnv): string {
  try {
    return localStorage.getItem(`xq_session_${env}`) || (env === 'prod' ? localStorage.getItem('xq_session') || '' : '');
  } catch {
    return '';
  }
}

export function setStoredSessionForEnv(env: ServerEnv, sessId: string): void {
  try {
    if (sessId) {
      localStorage.setItem(`xq_session_${env}`, sessId);
      if (env === 'prod') {
        localStorage.setItem('xq_session', sessId);
      }
    } else {
      localStorage.removeItem(`xq_session_${env}`);
      if (env === 'prod') {
        localStorage.removeItem('xq_session');
      }
    }
  } catch {
    // Ignore
  }
}

/**
 * Installs transparent global fetch interceptor to attach 'X-Server-Env'
 * to all backend API requests across the entire application.
 * Safely handles environments where window.fetch has only a getter.
 */
let interceptorInstalled = false;
export function initFetchEnvInterceptor(): void {
  if (interceptorInstalled || typeof window === 'undefined') return;
  interceptorInstalled = true;

  // Initialize cookie matching current env so all requests carry it automatically
  try {
    const curEnv = getServerEnv();
    if (typeof document !== 'undefined') {
      document.cookie = `xq_server_env=${curEnv}; path=/; max-age=31536000; SameSite=Lax`;
    }
  } catch {
    // Ignore cookie error
  }

  try {
    const originalFetch = window.fetch;
    if (typeof originalFetch !== 'function') return;

    const wrappedFetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      try {
        const currentEnv = getServerEnv();
        const initObj: RequestInit = init ? { ...init } : {};
        const headers = new Headers(initObj.headers || {});
        if (!headers.has('X-Server-Env')) {
          headers.set('X-Server-Env', currentEnv);
        }
        initObj.headers = headers;
        return originalFetch.call(window, input, initObj);
      } catch {
        return originalFetch.call(window, input, init);
      }
    };

    // Safely attempt to install interceptor without throwing if getter-only
    let installed = false;
    try {
      const desc = Object.getOwnPropertyDescriptor(window, 'fetch');
      if (desc && (desc.writable || desc.configurable)) {
        window.fetch = wrappedFetch;
        installed = true;
      }
    } catch {
      // Direct assignment failed
    }

    if (!installed) {
      try {
        const protoDesc = Window.prototype ? Object.getOwnPropertyDescriptor(Window.prototype, 'fetch') : null;
        if (!protoDesc || protoDesc.writable || protoDesc.configurable) {
          Object.defineProperty(Window.prototype, 'fetch', {
            value: wrappedFetch,
            writable: true,
            configurable: true,
          });
          installed = true;
        }
      } catch {
        // Prototype redefine failed - safe fallback via cookies & query params
      }
    }
  } catch {
    // Suppress interceptor errors completely
  }
}

import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthService, KEYCLOAK, LOGIN_CHECK_TIMEOUT_MS } from './auth.service';

describe('AuthService', () => {
  /** The parts of the Keycloak client that AuthService uses. */
  function createKeycloak() {
    return {
      init: vi.fn(async () => false),
      login: vi.fn(async () => undefined),
      logout: vi.fn(async () => undefined),
      updateToken: vi.fn(async () => true),
      token: undefined as string | undefined,
      tokenParsed: undefined as Record<string, unknown> | undefined,
    };
  }

  function setup(keycloak = createKeycloak()) {
    TestBed.configureTestingModule({ providers: [{ provide: KEYCLOAK, useValue: keycloak }] });
    return { auth: TestBed.inject(AuthService), keycloak };
  }

  it('is loading until Keycloak has answered', () => {
    const { auth } = setup();

    expect(auth.status()).toBe('loading');
    expect(auth.user()).toBeNull();
  });

  it('has no user when the visitor is not logged in', async () => {
    const { auth, keycloak } = setup();

    await auth.init();

    expect(keycloak.init).toHaveBeenCalledWith(
      expect.objectContaining({ onLoad: 'check-sso', pkceMethod: 'S256' }),
    );
    expect(auth.status()).toBe('ready');
    expect(auth.user()).toBeNull();
    expect(auth.isAdmin()).toBe(false);
  });

  it('reads the name and the ShopFlow roles from the token, ignoring Keycloak built-in roles', async () => {
    const keycloak = createKeycloak();
    keycloak.init.mockResolvedValue(true);
    keycloak.tokenParsed = {
      preferred_username: 'admin1',
      realm_access: { roles: ['default-roles-shopflow', 'offline_access', 'admin'] },
    };
    const { auth } = setup(keycloak);

    await auth.init();

    expect(auth.user()).toEqual({ username: 'admin1', roles: ['admin'] });
    expect(auth.isAdmin()).toBe(true);
  });

  it('stays usable, logged out, when Keycloak cannot be reached', async () => {
    const keycloak = createKeycloak();
    keycloak.init.mockRejectedValue(new Error('unreachable'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { auth } = setup(keycloak);

    await auth.init();
    vi.restoreAllMocks();

    expect(auth.status()).toBe('ready');
    expect(auth.user()).toBeNull();
  });

  it('refreshes the token before handing it out', async () => {
    const keycloak = createKeycloak();
    keycloak.init.mockResolvedValue(true);
    keycloak.tokenParsed = { preferred_username: 'customer1', realm_access: { roles: ['customer'] } };
    keycloak.token = 'fresh-token';
    const { auth } = setup(keycloak);
    await auth.init();

    await expect(auth.token()).resolves.toBe('fresh-token');
    expect(keycloak.updateToken).toHaveBeenCalledWith(30);
  });

  it('logs the user out locally when the session can no longer be refreshed', async () => {
    const keycloak = createKeycloak();
    keycloak.init.mockResolvedValue(true);
    keycloak.tokenParsed = { preferred_username: 'customer1', realm_access: { roles: ['customer'] } };
    keycloak.updateToken.mockRejectedValue(new Error('session expired'));
    const { auth } = setup(keycloak);
    await auth.init();

    await expect(auth.token()).resolves.toBeUndefined();
    expect(auth.user()).toBeNull();
  });

  it('gives no token when logged out', async () => {
    const { auth, keycloak } = setup();
    await auth.init();

    await expect(auth.token()).resolves.toBeUndefined();
    expect(keycloak.updateToken).not.toHaveBeenCalled();
  });

  it('answers role questions for the logged-in user', async () => {
    const keycloak = createKeycloak();
    keycloak.init.mockResolvedValue(true);
    keycloak.tokenParsed = { preferred_username: 'wren', realm_access: { roles: ['warehouse'] } };
    const { auth } = setup(keycloak);
    await auth.init();

    expect(auth.hasAnyRole('warehouse', 'admin')).toBe(true);
    expect(auth.hasAnyRole('customer')).toBe(false);
    expect(auth.isStaff()).toBe(true);
    expect(auth.isCustomer()).toBe(false);
    expect(auth.isAdmin()).toBe(false);
  });

  it('lets callers wait for the login check to finish', async () => {
    const { auth } = setup();
    let ready = false;
    void auth.whenReady().then(() => (ready = true));

    await Promise.resolve();
    expect(ready).toBe(false);

    await auth.init();
    await auth.whenReady();
    expect(ready).toBe(true);
  });

  describe('when the login check is slow or never answers', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('stops making others wait after the time limit, says so in the console, and stays logged out', async () => {
      const keycloak = createKeycloak();
      // What happens when Keycloak refuses the hidden check: the promise simply never settles.
      keycloak.init.mockReturnValue(new Promise<boolean>(() => undefined));
      const { auth } = setup(keycloak);

      void auth.init();
      await vi.advanceTimersByTimeAsync(LOGIN_CHECK_TIMEOUT_MS - 1);
      expect(auth.status()).toBe('loading');

      await vi.advanceTimersByTimeAsync(1);
      await auth.whenReady();

      expect(auth.status()).toBe('ready');
      expect(auth.user()).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('has not answered'));
    });

    it('still logs the user in when the answer arrives after the time limit', async () => {
      const keycloak = createKeycloak();
      let answer!: (loggedIn: boolean) => void;
      keycloak.init.mockReturnValue(new Promise<boolean>((resolve) => (answer = resolve)));
      keycloak.tokenParsed = { preferred_username: 'casey', realm_access: { roles: ['customer'] } };
      const { auth } = setup(keycloak);

      const initialising = auth.init();
      await vi.advanceTimersByTimeAsync(LOGIN_CHECK_TIMEOUT_MS);
      expect(auth.status()).toBe('ready');
      expect(auth.user()).toBeNull();

      // For example, a slow exchange of the code Keycloak sent back after logging in.
      answer(true);
      await initialising;

      expect(auth.user()).toEqual({ username: 'casey', roles: ['customer'] });
    });
  });

  it('says in the console why the check failed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const keycloak = createKeycloak();
    const failure = new Error('unreachable');
    keycloak.init.mockRejectedValue(failure);
    const { auth } = setup(keycloak);

    await auth.init();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('login check failed'), failure);
    warn.mockRestore();
  });

  it('opens the login page once the check has found the visitor logged out', async () => {
    const { auth, keycloak } = setup();
    await auth.init();

    await auth.login();

    expect(keycloak.login).toHaveBeenCalledTimes(1);
  });

  it('waits for the check before opening the login page, if Log in is clicked early', async () => {
    const keycloak = createKeycloak();
    let answer!: (loggedIn: boolean) => void;
    keycloak.init.mockReturnValue(new Promise<boolean>((resolve) => (answer = resolve)));
    const { auth } = setup(keycloak);
    const initialising = auth.init();

    const loggingIn = auth.login();
    await Promise.resolve();
    expect(keycloak.login).not.toHaveBeenCalled();

    answer(false);
    await initialising;
    await loggingIn;

    expect(keycloak.login).toHaveBeenCalledTimes(1);
  });

  it('does not start a new login when the check finds the visitor already logged in', async () => {
    const keycloak = createKeycloak();
    let answer!: (loggedIn: boolean) => void;
    keycloak.init.mockReturnValue(new Promise<boolean>((resolve) => (answer = resolve)));
    keycloak.tokenParsed = { preferred_username: 'casey', realm_access: { roles: ['customer'] } };
    const { auth } = setup(keycloak);
    const initialising = auth.init();

    const loggingIn = auth.login();
    answer(true);
    await initialising;
    await loggingIn;

    expect(keycloak.login).not.toHaveBeenCalled();
    expect(auth.user()?.username).toBe('casey');
  });

  it('reports a failure to open the login page instead of passing it on to the button', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const keycloak = createKeycloak();
    const failure = new Error('cannot reach Keycloak');
    keycloak.login.mockRejectedValue(failure);
    const { auth } = setup(keycloak);
    await auth.init();

    await expect(auth.login()).resolves.toBeUndefined();

    expect(keycloak.login).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('could not open the login page'), failure);
    error.mockRestore();
  });
});
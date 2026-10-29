import { mkdirSync, chmodSync, readFileSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const profileFields = ['clientId', 'registrationClientId', 'subject', 'email'];
const tokenFields = ['access_token', 'refresh_token', 'id_token', 'token_type', 'scope', 'expires_in', 'expiresAt'];

// OAuth connections only. Hosted API keys and other browsers' credentials are never
// adopted into a new browser session. Persist an explicit whitelist, not runtime
// state, pending PKCE/code material, provider catalogs or document contents.
export function localOAuthStore({ directory, hostId, origins }) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  const boundary = [...origins].sort();
  const name = createHash('sha256').update(JSON.stringify([hostId, boundary])).digest('hex').slice(0, 24);
  const path = resolve(directory, `oauth-${name}.json`);
  return {
    path,
    load() {
      let source;
      try { source = readFileSync(path, 'utf8'); chmodSync(path, 0o600); }
      catch (error) { if (error.code === 'ENOENT') return new Map(); throw new Error('Cannot read the saved ChatGPT connection.'); }
      try {
        if (source.length > 2_000_000) throw new Error();
        const data = JSON.parse(source);
        if (data.version !== 1 || data.hostId !== hostId || JSON.stringify(data.origins) !== JSON.stringify(boundary) || !Array.isArray(data.sessions)) throw new Error();
        const sessions = new Map();
        for (const session of data.sessions) {
          if (!session || typeof session.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(session.id) ||
            !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) continue;
          const profile = { id: session.id, expiresAt: session.expiresAt };
          for (const field of profileFields) if (typeof session[field] === 'string') profile[field] = session[field];
          if (!profile.clientId && !profile.registrationClientId) continue;
          if (session.tokens?.access_token && Number.isFinite(session.tokens.expiresAt)) {
            profile.tokens = Object.fromEntries(tokenFields.filter(field => session.tokens[field] !== undefined).map(field => [field, session.tokens[field]]));
          }
          sessions.set(profile.id, profile);
        }
        return sessions;
      } catch { throw new Error('The saved ChatGPT connection is invalid. Move its OAuth state file aside before reconnecting.'); }
    },
    save(sessions) {
      const profiles = [];
      for (const session of sessions.values()) {
        if (session.expiresAt <= Date.now() || (!session.clientId && !session.registrationClientId)) continue;
        const profile = { id: session.id, expiresAt: session.expiresAt };
        for (const field of profileFields) if (typeof session[field] === 'string') profile[field] = session[field];
        if (session.tokens) profile.tokens = Object.fromEntries(tokenFields.filter(field => session.tokens[field] !== undefined).map(field => [field, session.tokens[field]]));
        profiles.push(profile);
      }
      const temporary = `${path}.${randomUUID()}.tmp`;
      let fd;
      try {
        fd = openSync(temporary, 'wx', 0o600);
        writeFileSync(fd, JSON.stringify({ version: 1, hostId, origins: boundary, sessions: profiles }));
        fsyncSync(fd); closeSync(fd); fd = undefined;
        renameSync(temporary, path);
      } catch { throw new Error('Cannot save the ChatGPT connection on this device.'); }
      finally { if (fd !== undefined) closeSync(fd); try { unlinkSync(temporary); } catch { /* Renamed or never created. */ } }
    },
  };
}

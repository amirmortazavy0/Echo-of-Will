import React, { createContext, useContext, useEffect, useState } from 'react';
const Identity = createContext({ name: 'Your workspace', setAuthenticatedUsername: (_name: string | null) => {} });
export const useIdentity = () => useContext(Identity);
export function IdentityProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticatedUsername] = useState<string | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const name = authenticated || owner || 'Your workspace';
  useEffect(() => {
    const controller = new AbortController();
    setOwner(null);
    fetch('/auth/branding', { cache: 'no-store', signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (!controller.signal.aborted) setOwner(typeof data?.username === 'string' ? data.username : null); })
      .catch(() => {});
    return () => controller.abort();
  }, [authenticated]);
  useEffect(() => {
    document.title = name;
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', name);
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', name);
    const manifest = document.querySelector('link[rel="manifest"]');
    manifest?.setAttribute('href', '/manifest.webmanifest?identity=' + encodeURIComponent(name));
  }, [name]);
  return <Identity.Provider value={{ name, setAuthenticatedUsername }}>{children}</Identity.Provider>;
}

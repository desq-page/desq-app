// Navigation happens inside the same-origin bootstrap popup. The editor never
// writes a cross-origin WindowProxy.location after OAuth has started.
export function openChatGPTSignInPopup(view = window) {
  const name = `desq-chatgpt-${crypto.randomUUID()}`;
  const channel = new BroadcastChannel(name);
  let ready;
  const initialized = new Promise(resolve => { ready = resolve; });
  channel.onmessage = event => { if (event.data?.type === 'ready') ready(true); };
  const popup = view.open(`/agent-sign-in.html#${name}`, '_blank', 'popup,width=560,height=760');
  if (!popup) { channel.close(); return null; }
  return {
    get closed() { return popup.closed; },
    async navigate(address) {
      const url = new URL(address);
      if (url.origin !== 'https://auth.openai.com') throw new Error('Invalid ChatGPT sign-in address.');
      let timer;
      try {
        const loaded = await Promise.race([initialized, new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('ChatGPT sign-in window did not load. Refresh the editor and retry.')), 15000);
        })]);
        if (!loaded || popup.closed) throw new Error('ChatGPT sign-in window closed. Try again.');
        channel.postMessage({ type: 'navigate', url: url.href });
      } finally { clearTimeout(timer); }
    },
    close() { ready(false); channel.close(); popup.close(); },
  };
}

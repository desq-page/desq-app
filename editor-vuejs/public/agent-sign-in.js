(() => {
  window.opener = null;
  const name = window.location.hash.slice(1);
  if (!/^desq-chatgpt-[a-f0-9-]{36}$/.test(name)) return;
  const channel = new BroadcastChannel(name);
  channel.onmessage = event => {
    if (event.data?.type !== 'navigate') return;
    try {
      const url = new URL(event.data.url);
      if (url.origin !== 'https://auth.openai.com') throw new Error('Invalid ChatGPT sign-in address.');
      channel.close();
      window.location.replace(url.href);
    } catch {
      document.getElementById('status').textContent = 'Unable to open ChatGPT sign-in. Return to the editor and try again.';
    }
  };
  channel.postMessage({ type: 'ready' });
})();

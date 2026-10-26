const channels = new Map();

export function on(name, fn) {
  if (!channels.has(name)) channels.set(name, new Set());
  channels.get(name).add(fn);
  return () => off(name, fn);
}

export function once(name, fn) {
  const dispose = on(name, (payload) => {
    dispose();
    fn(payload);
  });
  return dispose;
}

export function off(name, fn) {
  const set = channels.get(name);
  if (set) set.delete(fn);
}

export function emit(name, payload) {
  const set = channels.get(name);
  if (set) for (const fn of Array.from(set)) {
    try {
      fn(payload);
    } catch (err) {
      console.error('[bus:' + name + ']', err);
    }
  }
  const star = channels.get('*');
  if (star) for (const fn of Array.from(star)) {
    try {
      fn(name, payload);
    } catch (err) {
      console.error('[bus:*]', err);
    }
  }
}

export const bus = { on, once, off, emit };
export const createGaiaStore = (initialState = {}) => {
  let state = Object.freeze({ ...initialState });
  const listeners = new Set();

  return Object.freeze({
    getState: () => state,
    setState(update) {
      const next = typeof update === "function" ? update(state) : update;
      state = Object.freeze({ ...state, ...next });
      listeners.forEach((listener) => listener(state));
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
};

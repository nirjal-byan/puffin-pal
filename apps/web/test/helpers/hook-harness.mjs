import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, join } from "node:path";
import { setImmediate as waitForImmediate } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const webRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const sourceRoot = join(webRoot, "src");
const reactModule = `
const runtime = () => globalThis.__puffinpalHookRuntime;
export const useState = (...args) => runtime().useState(...args);
export const useEffect = (...args) => runtime().useEffect(...args);
export const useCallback = (...args) => runtime().useCallback(...args);
export const useMemo = (...args) => runtime().useMemo(...args);
export const useRef = (...args) => runtime().useRef(...args);
`;
const reactDomModule = `
export const flushSync = (callback) => callback();
`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "react")
      return {
        shortCircuit: true,
        url: `data:text/javascript,${encodeURIComponent(reactModule)}`,
      };
    if (specifier === "react-dom")
      return {
        shortCircuit: true,
        url: `data:text/javascript,${encodeURIComponent(reactDomModule)}`,
      };
    if (specifier.startsWith("@/")) {
      const base = join(sourceRoot, specifier.slice(2));
      const resolved = [base, `${base}.ts`, `${base}.tsx`].find(existsSync);
      if (resolved) return { shortCircuit: true, url: pathToFileURL(resolved).href };
    }
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const base = join(dirname(fileURLToPath(context.parentURL)), specifier);
      const resolved = [base, `${base}.ts`, `${base}.tsx`].find(existsSync);
      if (resolved) return { shortCircuit: true, url: pathToFileURL(resolved).href };
    }
    return nextResolve(specifier, context);
  },
});

const sameDependencies = (left, right) =>
  Boolean(
    left &&
    right &&
    left.length === right.length &&
    left.every((value, index) => Object.is(value, right[index])),
  );

export function createHookHarness(hook, ...arguments_) {
  const slots = [];
  let cursor = 0;
  let pendingEffects = [];

  const runtime = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index])
        slots[index] = {
          kind: "state",
          value: typeof initial === "function" ? initial() : initial,
        };
      return [
        slots[index].value,
        (next) => {
          slots[index].value = typeof next === "function" ? next(slots[index].value) : next;
        },
      ];
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || !sameDependencies(previous.dependencies, dependencies)) {
        pendingEffects.push({ effect, index });
        slots[index] = {
          kind: "effect",
          cleanup: previous?.cleanup,
          dependencies,
        };
      }
    },
    useCallback(callback, dependencies) {
      return runtime.useMemo(() => callback, dependencies);
    },
    useMemo(factory, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (previous && sameDependencies(previous.dependencies, dependencies)) return previous.value;
      const value = factory();
      slots[index] = { kind: "memo", dependencies, value };
      return value;
    },
    useRef(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { kind: "ref", value: { current: initial } };
      return slots[index].value;
    },
  };

  function render() {
    cursor = 0;
    pendingEffects = [];
    globalThis.__puffinpalHookRuntime = runtime;
    const result = hook(...arguments_);
    for (const { effect, index } of pendingEffects) {
      slots[index].cleanup?.();
      slots[index].cleanup = effect();
    }
    return result;
  }

  function unmount() {
    for (const slot of slots) if (slot?.kind === "effect") slot.cleanup?.();
    delete globalThis.__puffinpalHookRuntime;
  }

  return { render, unmount };
}

export async function flushPromises() {
  await Promise.resolve();
  await waitForImmediate();
}

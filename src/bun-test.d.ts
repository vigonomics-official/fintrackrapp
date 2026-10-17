declare module "bun:test" {
  export const describe: (name: string, fn: () => void) => void;
  export const test: (name: string, fn: () => void | Promise<void>) => void;
  export const beforeEach: (fn: () => void) => void;
  export const expect: (value: unknown) => { toBe(v: unknown): void; toEqual(v: unknown): void };
  export const mock: { module(path: string, factory: () => unknown): void };
}

import { beforeEach, describe, expect, test } from "bun:test";
import { ic } from "../src/ic";

type IcFn = typeof ic & {
  enable: () => void;
  disable: () => void;
};

const toggledIc = ic as IcFn;

function stripAnsi(input: string): string {
  return input.replace(/\u001B\[[0-9;]*m/g, "");
}

function captureNextIcLog(): Promise<string> {
  return new Promise((resolve, reject) => {
    const originalLog = console.log;
    const timer = setTimeout(() => {
      console.log = originalLog;
      reject(new Error("Timed out waiting for console.log"));
    }, 500);

    console.log = (...args: any[]) => {
      const message = args.map((arg) => String(arg)).join(" ");
      if (!message.startsWith("ic|")) {
        originalLog(...args);
        return;
      }
      clearTimeout(timer);
      console.log = originalLog;
      resolve(message);
    };
  });
}

describe("ic()", () => {
  beforeEach(() => {
    toggledIc.enable();
  });

  test("prints literal values without stripping them as labels", async () => {
    const logPromise = captureNextIcLog();
    ic("Hello literal");
    const line = stripAnsi(await logPromise);
    expect(line).toBe("ic| 'Hello literal'");
  });

  test("infers names for identifiers and objects", async () => {
    const x = 42;
    const obj = { key: { nested: "value" } };
    let logPromise = captureNextIcLog();
    ic(x);
    const first = stripAnsi(await logPromise);
    expect(first).toBe("ic| x: 42");
    logPromise = captureNextIcLog();
    ic(obj.key.nested);
    const second = stripAnsi(await logPromise);
    expect(second).toBe("ic| obj.key.nested: 'value'");
  });

  test("ic() with no arguments logs location and time", async () => {
    const logPromise = captureNextIcLog();
    function invoke() {
      ic();
    }
    invoke();
    const line = stripAnsi(await logPromise);
    expect(line).toMatch(
      /^ic\| tests\/ic\.test\.ts:\d+ in invoke\(\) at \d{2}:\d{2}:\d{2}\.\d{3}$/
    );
  });

  test("function references and calls are labeled", async () => {
    function sample(a: number) {
      void a;
      return undefined;
    }
    let logPromise = captureNextIcLog();
    ic(sample);
    const refLine = stripAnsi(await logPromise);
    expect(refLine).toBe("ic| sample: [Function: sample]");
    logPromise = captureNextIcLog();
    ic(sample(10));
    const callLine = stripAnsi(await logPromise);
    expect(callLine).toBe("ic| sample(10): undefined");
  });

  test("supports explicit labels for transformed calls", async () => {
    const logPromise = captureNextIcLog();
    ic("custom label", 7);
    const line = stripAnsi(await logPromise);
    expect(line).toBe("ic| custom label: 7");
  });

  test("prints multiple arguments separated by commas with labels", async () => {
    const foo = { a: 1 };
    const bar = [1, 2, 3];
    const logPromise = captureNextIcLog();
    ic(foo, bar);
    const line = stripAnsi(await logPromise);
    expect(line).toBe("ic| foo: { a: 1 }, bar: [ 1, 2, 3 ]");
  });

  test("returns values so it can be embedded into expressions", async () => {
    const a = 6;
    const half = (i: number) => i / 2;

    const logLine1Promise = captureNextIcLog();
    const b = half(ic(a));
    const logLine1 = stripAnsi(await logLine1Promise);
    expect(logLine1).toBe("ic| a: 6");
    expect(b).toBe(3);

    const logLine2Promise = captureNextIcLog();
    ic(b);
    const logLine2 = stripAnsi(await logLine2Promise);
    expect(logLine2).toBe("ic| b: 3");
  });

  test("returns tuples of arguments unchanged", async () => {
    const foo = { foo: 1 };
    const bar = { bar: 2 };

    const logPromise = captureNextIcLog();
    const [first, second] = ic(foo, bar);
    const logLine = stripAnsi(await logPromise);

    expect(first).toBe(foo);
    expect(second).toBe(bar);
    expect(logLine).toBe("ic| foo: { foo: 1 }, bar: { bar: 2 }");
  });

  test("can be disabled to prevent logging", async () => {
    toggledIc.disable();

    let logged = false;
    const originalLog = console.log;
    console.log = () => {
      logged = true;
    };

    const value = ic(123);
    expect(value).toBe(123);

    await new Promise((resolve) => setTimeout(resolve, 20));
    console.log = originalLog;
    toggledIc.enable();

    expect(logged).toBe(false);
  });
});

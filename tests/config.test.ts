import { beforeEach, describe, expect, test } from "bun:test";
import { ic } from "../src/ic";

type IcFn = typeof ic & {
  enable: () => void;
  disable: () => void;
  configureOutput: (options?: {
    prefix?: string | (() => string);
    outputFunction?: (output: string) => void;
    argToStringFunction?: (value: unknown) => string;
    includeContext?: boolean;
    contextAbsPath?: boolean;
  }) => void;
  format: (...args: any[]) => Promise<string>;
};

const configuredIc = ic as IcFn;

function stripAnsi(input: string): string {
  return input.replace(/\u001B\[[0-9;]*m/g, "");
}

function captureNextIcLog(expectedPrefix?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const originalLog = console.log;
    const timer = setTimeout(() => {
      console.log = originalLog;
      reject(new Error("Timed out waiting for console.log"));
    }, 500);

    console.log = (...args: any[]) => {
      const message = args.map((arg) => String(arg)).join(" ");
      // Capture if it looks like ic output (contains typical patterns)
      const isIcOutput =
        message.includes("ic|") ||
        (expectedPrefix && message.includes(expectedPrefix)) ||
        message.includes("|>") ||
        message.includes(">>");
      if (!isIcOutput) {
        originalLog(...args);
        return;
      }
      clearTimeout(timer);
      console.log = originalLog;
      resolve(message);
    };
  });
}

describe("ic.configureOutput()", () => {
  beforeEach(() => {
    configuredIc.enable();
    // Reset configuration to defaults
    configuredIc.configureOutput({
      prefix: "ic| ",
      outputFunction: (s: string) => console.log(s),
      argToStringFunction: undefined, // Use default
      includeContext: false,
      contextAbsPath: false,
    });
  });

  test("custom string prefix", async () => {
    configuredIc.configureOutput({ prefix: "debug >> " });
    const logPromise = captureNextIcLog();
    const x = 42;
    ic(x);
    const line = stripAnsi(await logPromise);
    expect(line).toContain("debug >> x: 42");
  });

  test("custom function prefix with timestamp", async () => {
    let timestamp = 1519185860;
    configuredIc.configureOutput({
      prefix: () => `${timestamp} |> `,
    });
    const logPromise = captureNextIcLog();
    ic("world");
    const line = stripAnsi(await logPromise);
    expect(line).toContain("1519185860 |> 'world'");
  });

  test("custom outputFunction", async () => {
    let captured = "";
    configuredIc.configureOutput({
      outputFunction: (s: string) => {
        captured = s;
      },
    });
    ic("test");
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(stripAnsi(captured)).toContain("ic| 'test'");
  });

  test("custom argToStringFunction", async () => {
    configuredIc.configureOutput({
      argToStringFunction: (obj: unknown) => {
        if (typeof obj === "string") {
          return `[!string '${obj}' with length ${obj.length}!]`;
        }
        return String(obj);
      },
    });
    const logPromise = captureNextIcLog();
    ic(7, "hello");
    const line = stripAnsi(await logPromise);
    // Note: '7' appears without colon since label matches value (redundancy avoidance)
    expect(line).toContain("7");
    expect(line).toContain("'hello': [!string 'hello' with length 5!]");
  });

  test("includeContext adds filename and function info", async () => {
    configuredIc.configureOutput({ includeContext: true });
    const logPromise = captureNextIcLog();
    function foo() {
      const i = 3;
      ic(i);
    }
    foo();
    const line = stripAnsi(await logPromise);
    expect(line).toMatch(/ic\| tests\/config\.test\.ts:\d+ in foo\(\)- i: 3/);
  });

  test("contextAbsPath with includeContext shows absolute paths", async () => {
    configuredIc.configureOutput({
      includeContext: true,
      contextAbsPath: true,
    });
    const logPromise = captureNextIcLog();
    function foo() {
      const i = 3;
      ic(i);
    }
    foo();
    const line = stripAnsi(await logPromise);
    // Should contain absolute path (starts with /)
    expect(line).toMatch(/ic\| \/.*\/tests\/config\.test\.ts:\d+ in foo\(\)- i: 3/);
  });

  test("multiple configuration options at once", async () => {
    let outputs: string[] = [];
    configuredIc.configureOutput({
      prefix: ">>> ",
      outputFunction: (s: string) => {
        outputs.push(s);
      },
      includeContext: true,
    });
    function bar() {
      const x = 10;
      ic(x);
    }
    bar();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(outputs.length).toBe(1);
    const line = stripAnsi(outputs[0] || "");
    expect(line).toMatch(/>>> tests\/config\.test\.ts:\d+ in bar\(\)- x: 10/);
  });
});

describe("ic.format()", () => {
  beforeEach(() => {
    configuredIc.enable();
    configuredIc.configureOutput({
      prefix: "ic| ",
      outputFunction: (s: string) => console.log(s),
      argToStringFunction: undefined,
      includeContext: false,
      contextAbsPath: false,
    });
  });

  test("returns formatted string without logging", async () => {
    let logged = false;
    const originalLog = console.log;
    console.log = () => {
      logged = true;
    };

    const foo = "bar";
    const result = await configuredIc.format(foo);

    console.log = originalLog;

    expect(logged).toBe(false);
    expect(stripAnsi(result)).toContain("ic|");
    expect(stripAnsi(result)).toContain("'bar'");
  });

  test("respects custom prefix in format", async () => {
    configuredIc.configureOutput({ prefix: "DEBUG: " });
    const foo = 123;
    const result = await configuredIc.format(foo);
    expect(stripAnsi(result)).toMatch(/^DEBUG:/);
    expect(stripAnsi(result)).toContain("123");
  });

  test("respects includeContext in format", async () => {
    configuredIc.configureOutput({ includeContext: true });
    async function testFunc() {
      const x = 42;
      return await configuredIc.format(x);
    }
    const result = await testFunc();
    expect(stripAnsi(result)).toMatch(/ic\| tests\/config\.test\.ts:\d+ in testFunc\(\)-/);
    expect(stripAnsi(result)).toContain("42");
  });
});

import { ic } from "../src/ic";

export function example1() {
  ic("Hello from example1");
}

//TODO: doesn't populate aeguments
export function example2(a: number) {
  ic();
}

export function example3() {
  ic(42);
}

example1();
example2(1);
example3();
ic(example1);
ic(example2(10))
ic()
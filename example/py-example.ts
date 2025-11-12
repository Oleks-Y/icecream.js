import { ic } from "../src/ic";

export function example_1() {
  ic("Hello from example 1");
}

export function example_2() {
  const x = 42;
  ic(x);
}

export function example_3() {
  const data = { a: 1, b: 2 };
  ic(data);
}

export function example_4(a: number) {
  void a;
  ic();
}

example_1();
example_2();
example_3();
example_4(5);

ic(example_1);
ic(example_4);
ic(example_4(10));

from icecream import ic


if __name__ == "__main__":

    def example_1():
        ic("Hello from example 1")

    def example_2():
        x = 42
        ic(x)

    def example_3():
        data = {"a": 1, "b": 2}
        ic(data)

    def example_4(a: int):
        ic()

    def example_5():
        try:
            1 / 0
        except Exception as e:
            ic(e)

    example_1()
    example_2()
    example_3()
    example_4(5)
    example_5()
    
    ic(example_1)
    ic(example_4)
    ic(example_4(10))

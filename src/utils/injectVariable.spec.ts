import {describe, it, expect} from "@jest/globals";
import {injectVariables} from "./injectVariables";


describe("injectVariables", () => {
    it.each([
        {
            pattern: "${foo}",
            data: {
                foo: "Var"
            },
            result: "Var"
        },
        {
            pattern: "${foo}",
            data: {
                foo: 1 as unknown as string
            },
            result: "1"
        },
        {
            pattern: "${foo}-${bar}",
            data: {
                foo: "one",
                bar: "two"
            },
            result: "one-two"
        }
    ])("should inject $pattern", ({pattern, data, result}) => {
        expect(injectVariables(pattern, data)).toBe(result);
    });
});

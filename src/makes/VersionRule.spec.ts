import {describe, it, expect} from "@jest/globals";
import {VersionRule} from "./VersionRule";


describe("VersionRule", (): void => {
    it.each([
        {pattern: "x", version: "1.0.1"},
        {pattern: "x.x", version: "1.0.1"},
        {pattern: "x.x.x", version: "1.0.1"},
        {pattern: "1", version: "1.0.1"},
        {pattern: "1.0", version: "1.0.1"},
        {pattern: "1.0.1", version: "1.0.1"},
        {pattern: "1.0.1-beta", version: "1.0.1-beta.1"},
        {pattern: "beta", version: "1.0.1-beta.1"},
        {pattern: "^1.10.0", version: "1.10.1"},
        {pattern: "^1.10.1", version: "1.10.1"},
        {pattern: "^1.10.0", version: "1.18.1"},
        {pattern: "1.x.x", version: "1.10.10"},
        {pattern: "^1.0.7", version: "1.0.8-beta.1", withTag: true}
    ])("$version should match $pattern", ({version, pattern, withTag}): void => {
        expect(VersionRule.parse(pattern).match(version, withTag)).toBeTruthy();
    });

    it.each([
        {pattern: "2", version: "1.0.11"},
        {pattern: "~1", version: "1.1.1"},
        {pattern: ">1.0.11", version: "1.0.11"},
        {pattern: ">=1.0.12", version: "1.0.11"},
        {pattern: "<1.0.12", version: "1.0.12"},
        {pattern: "<=1.0.12", version: "1.0.13"},
        {pattern: "1.0.10-beta", version: "1.0.10"},
        {pattern: "beta", version: "1.0.11"}
    ])("$version shouldn't match $pattern", ({pattern, version}): void => {
        expect(VersionRule.parse(pattern).match(version)).toBeFalsy();
    });
});

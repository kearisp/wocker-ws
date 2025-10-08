import {describe, it, jest, expect} from "@jest/globals";
import {versionMatch} from "./versionMatch";
import Semver from "semver";


describe("versionMatch", (): void => {
    it.each([
        {pattern: "^1.0.0", version: "1.0.0"},
        {pattern: "^1.0.0", version: "1.0.1"},
        {pattern: "^1.0.0", version: "1.1.0"},
        {pattern: "^1.0.0", version: "1.9.9"},
        {pattern: "^1.0.0", version: "1.1.1"},
        {pattern: "^1.0.0-beta", version: "1.0.0-beta.6"},
        {pattern: "^1.0.0-beta.5", version: "1.0.0-beta.6"},
        {pattern: "~1.0.0", version: "1.0.0"},
        {pattern: "~1.0.0", version: "1.0.1"},
        {pattern: "~1.0.0", version: "1.0.9"},
        {pattern: "~1.0.0-beta", version: "1.0.0-beta.1"},
        {pattern: "~1.0.0-beta.0", version: "1.0.0-beta.1"},
        {pattern: "~1.0.0-beta.1", version: "1.0.0-beta.1"},
    ])("should match $pattern $version", ({pattern, version}): void => {
        expect(versionMatch(pattern, version)).toBe(true);
        expect(Semver.satisfies(version, pattern)).toBe(true);
    });

    it.each([
        {pattern: "^1.0.1", version: "1.0.0"},
        {pattern: "^1.0.0-beta.0", version: "1.0.1-beta.1"},
        {pattern: "^1.0.0-beta.7", version: "1.0.0-beta.6"},
        {pattern: "^1.0.0-beta.7", version: "1.0.0-beta.6"},
        {pattern: "^1.0.0-test", version: "1.0.0-beta.0"}
    ])("", ({pattern, version}) => {
        expect(versionMatch(pattern, version)).toBe(false);
    });
});

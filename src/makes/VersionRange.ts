import {VersionRule} from "./VersionRule";


export class VersionRange {
    public constructor(
        protected rules: VersionRule[][]
    ) {}

    public static parse(range: string): VersionRange {
        const rules = range.split("||").map((range) => {
            return range.split(" ").map((rule) => {
                return VersionRule.parse(rule);
            });
        });

        return new VersionRange(rules);
    }
}

import {DI} from "../makes";


export const Injectable = () => {
    return <T extends {new (...rest: any[]): {}}>(Target: T) => {
        // @ts-ignore
        return class extends Target {
            public constructor(di: DI) {
                const types = Reflect.getMetadata("design:paramtypes", Target);

                const params: any[] = types.map((type: any) => {
                    return (di).resolveService(type);
                });

                super(...params);
            }
        }
    };
};

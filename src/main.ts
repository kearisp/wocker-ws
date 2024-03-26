import {Factory} from "@wocker/core";
import {AppModule} from "./AppModule";


export const app = {
    async run(args: string[]) {
        const factory = await Factory.create(AppModule);

        return factory.run(args);
    }
};

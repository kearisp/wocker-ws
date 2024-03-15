// import inquirer from "inquirer";

import {App} from "./App";


const mock = async (params) => {
    const {
        message,
        name,
        choices
    } = params;

    let value = "";

    switch(message) {
        case "Project name: ":
            value = "test";
            break;

        case "Project type: ":
            // value = mapProjectTypes[PROJECT_TYPE_PRESET];
            break;

        case "Project preset: ":
            value = "apache";
            break;

        case "PHP_VERSION: ":
            value = choices[0];
            break;

        default:
            console.log(message, value);
            break;
    }

    return {
        [name]: value
    };
};

// jest.spyOn(inquirer, "prompt").mockImplementation(mock);

describe("App", () => {
    const app = new App();

    // it("init", async () => {
        // const res = await app.run(["init"]);
        //
        // expect(res).toBe("created");
    // });

    // it("config:set", async () => {
    //     await app.run(["config:set", "APP_NAME=test"]);
    //
    //     const project = Project.byId("test");
    //
    //     expect(project).not.toBe(null);
    //     expect(project.env["APP_NAME"]).toBe("test");
    // });

    // it("config", async () => {
    //     const res = await app.run(["config"]);
    //
    //     expect(typeof res).toBe("string");
    // });
});

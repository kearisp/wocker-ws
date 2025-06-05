import {describe, it, expect, beforeEach} from "@jest/globals";
import {vol} from "memfs";
import {AppConfigProperties} from "@wocker/core";
import {AppConfigService} from "./AppConfigService";
import {WOCKER_VERSION, DATA_DIR} from "../env";


describe("AppConfigService", () => {
    beforeEach(() => {
        vol.reset();
    });

    it("should return correct application version from WOCKER_VERSION constant", () => {
        const appConfigService = new AppConfigService();

        expect(appConfigService.version).toBe(WOCKER_VERSION);
    });

    it("should successfully parse projects configuration from wocker.config.js file", () => {
        const config: AppConfigProperties = {
            logLevel: "info",
            projects: [
                {
                    name: "project1",
                    path: "/home/wocker-test/projects/project1"
                }
            ]
        };
        const configString = JSON.stringify(config);

        vol.fromJSON({
            "wocker.config.js": `exports.config = ${configString};`
        }, DATA_DIR);

        const appConfigService = new AppConfigService();

        expect(appConfigService.config.logLevel).toBe("info");
        expect(appConfigService.config.projects).toEqual([
            {
                name: "project1",
                path: "/home/wocker-test/projects/project1"
            }
        ]);
    });

    it("should fallback to wocker.config.json when wocker.config.js throws an error", () => {
        const config = {
            projects: [
                {
                    name: "test-exception-project",
                    path: "/home/wocker-test/projects/project1"
                }
            ]
        };
        const configString = JSON.stringify(config);

        vol.fromJSON({
            "wocker.config.js": "throw new Error('Error')",
            "wocker.config.json": JSON.stringify(configString)
        }, DATA_DIR);

        const appConfigService = new AppConfigService();

        expect(appConfigService.config.projects).toEqual([
            {
                name: "test-exception-project",
                path: "/home/wocker-test/projects/project1"
            }
        ]);
    });

    it("should successfully parse config from wocker.config.json file", () => {
        vol.fromJSON({
            "wocker.config.json": JSON.stringify({
                logLevel: "info",
                projects: [
                    {
                        name: "test",
                        path: "/home/wocker-test/projects/project1"
                    }
                ]
            })
        }, DATA_DIR);

        const appConfigService = new AppConfigService();

        expect(appConfigService.config.logLevel).toBe("info");
        expect(appConfigService.config.projects).toEqual([
            {
                name: "test",
                path: "/home/wocker-test/projects/project1"
            }
        ]);
    });

    it("should successfully parse config from wocker.json file", () => {
        vol.fromJSON({
            "wocker.json": JSON.stringify(
                JSON.stringify({
                    logLevel: "info",
                    projects: [
                        {
                            name: "test",
                            path: "/home/wocker-test/projects/project1"
                        }
                    ]
                })
            )
        }, DATA_DIR);

        const appConfigService = new AppConfigService();

        expect(appConfigService.config.logLevel).toBe("info");
        expect(appConfigService.config.projects).toEqual([
            {
                name: "test",
                path: "/home/wocker-test/projects/project1"
            }
        ]);
    });

    it("should successfully parse config from data.json file", () => {
        vol.fromJSON({
            "data.json": JSON.stringify({
                logLevel: "info",
                projects: [
                    {
                        id: "test",
                        src: "/home/wocker-test/projects/project1"
                    }
                ]
            })
        }, DATA_DIR);

        const appConfigService = new AppConfigService();

        expect(appConfigService.config.logLevel).toBe("info");
        expect(appConfigService.config.projects).toEqual([
            {
                name: "test",
                path: "/home/wocker-test/projects/project1"
            }
        ]);
    });

    it("should set and return correct working directory", () => {
        const projectDir = "/home/wocker-test/projects/test-project";

        const appConfigService = new AppConfigService();

        appConfigService.setPWD(projectDir);

        expect(appConfigService.pwd()).toBe(projectDir);
    });

    it("should create wocker.config.js and save project configuration when adding new project", () => {
        const appConfigService = new AppConfigService();

        expect(appConfigService.fs.exists("wocker.config.js")).toBeFalsy();

        appConfigService.addProject("project1", "project1", "/home/wocker-test/projects/project1");
        appConfigService.save();

        expect(appConfigService.fs.exists("wocker.config.js")).toBeTruthy();

        const jsConfig = appConfigService.fs.readFile("wocker.config.js").toString();

        expect(jsConfig).toContain(`"name": "project1"`);
        expect(jsConfig).toContain(`"path": "/home/wocker-test/projects/project1"`);
    });

    it("should cleanup legacy config files (wocker.json and data.json) when saving new configuration", () => {
        const config = {
            projects: [
                {
                    name: "project1",
                    path: "/home/wocker-test/projects/project1"
                }
            ]
        };
        const configString = JSON.stringify(config);

        vol.fromJSON({
            "wocker.config.js": `exports.config = ${configString};`,
            "wocker.json": JSON.stringify(configString),
            "data.json": configString
        }, DATA_DIR);

        const appConfigService = new AppConfigService();

        appConfigService.config.addProject("project2", "project2", "/home/wocker-test/projects/project2");
        appConfigService.save();

        expect(appConfigService.fs.exists("wocker.config.js")).toBeTruthy();
        expect(appConfigService.fs.exists("wocker.config.json")).toBeTruthy();
        expect(appConfigService.fs.exists("wocker.json")).toBeFalsy();
        expect(appConfigService.fs.exists("data.json")).toBeFalsy();
    });

    it("should recreate config directory on saving", () => {
        const config = {
            projects: [
                {
                    name: "project1",
                    path: "/home/wocker-test/projects/project1"
                }
            ]
        };
        const configString = JSON.stringify(config);

        vol.fromJSON({
            "wocker.config.js": `exports.config = ${configString};`
        }, DATA_DIR);

        const appConfigService = new AppConfigService();

        expect(appConfigService.config.projects).toEqual([
            {
                name: "project1",
                path: "/home/wocker-test/projects/project1"
            }
        ]);

        vol.reset();

        expect(appConfigService.fs.exists("wocker.config.js")).toBeFalsy();
        expect(appConfigService.fs.exists("wocker.config.json")).toBeFalsy();

        appConfigService.save();

        expect(appConfigService.fs.exists("wocker.config.js")).toBeTruthy();
        expect(appConfigService.fs.exists("wocker.config.json")).toBeTruthy();

        const jsConfig = appConfigService.fs.readFile("wocker.config.js").toString();

        expect(jsConfig).toContain(`"name": "project1"`);
        expect(jsConfig).toContain(`"path": "/home/wocker-test/projects/project1"`);
    });
});

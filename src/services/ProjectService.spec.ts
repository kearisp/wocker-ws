import {describe, it, expect, beforeAll} from "@jest/globals";
import {vol} from "memfs";
import {Test} from "@wocker/testing";
import {PROJECT_TYPE_IMAGE, PROJECT_TYPE_DOCKERFILE} from "@wocker/core";
import {AppConfigService} from "./AppConfigService";
import {AppEventsService} from "./AppEventsService";
import {LogService} from "./LogService";
import {ProjectService} from "./ProjectService";
import {
    DockerService,
    ModemService,
    KeystoreService
} from "../modules";
import {DATA_DIR} from "../env";


describe("ProjectService", () => {
    const PROJECT_1_NAME = "project-1",
          PROJECT_1_PATH = `/home/wocker-test/projects/${PROJECT_1_NAME}`,
          PROJECT_2_NAME = "project-2",
          PROJECT_2_PATH = `/home/wocker-test/projects/${PROJECT_2_NAME}`,
          PROJECT_3_NAME = "project-3",
          PROJECT_3_PATH = `/home/wocker-test/projects/${PROJECT_3_NAME}`;

    beforeAll(() => {
        vol.reset();

        vol.fromJSON({
            [`projects/${PROJECT_1_NAME}/config.json`]: JSON.stringify({
                id: PROJECT_1_NAME,
                name: PROJECT_1_NAME,
                type: PROJECT_TYPE_IMAGE,
                image: "node:latest"
            }),
            [`projects/${PROJECT_2_NAME}/config.json`]: JSON.stringify({
                id: PROJECT_2_NAME,
                name: PROJECT_2_NAME,
                type: PROJECT_TYPE_DOCKERFILE,
                dockerfile: "./Dockerfile"
            }),
            [`projects/${PROJECT_3_NAME}/config.json`]: JSON.stringify({
                id: PROJECT_3_NAME,
                name: PROJECT_3_NAME,
                type: PROJECT_TYPE_DOCKERFILE,
                dockerfile: "./Dockerfile"
            }),
            "wocker.config.json": JSON.stringify({
                projects: [
                    {
                        id: PROJECT_1_NAME,
                        name: PROJECT_1_NAME,
                        src: PROJECT_1_PATH
                    },
                    {
                        id: PROJECT_2_NAME,
                        name: PROJECT_2_NAME,
                        path: PROJECT_2_PATH
                    },
                    {
                        id: PROJECT_3_NAME,
                        name: PROJECT_3_NAME,
                        path: PROJECT_3_PATH
                    }
                ]
            })
        }, DATA_DIR);

        vol.fromJSON({
            [`${PROJECT_2_PATH}/Dockerfile`]: "FROM node:latest\n",
            [`${PROJECT_3_PATH}/Dockerfile`]: "FROM node:latest\n"
        });

        vol.mkdirSync(PROJECT_1_PATH, {
            recursive: true
        });
    });

    const getContext = async () => {
        return Test.createTestingModule({
            providers: [
                AppConfigService,
                AppEventsService,
                ProjectService,
                KeystoreService,
                DockerService,
                ModemService,
                LogService
            ]
        });
    };

    it("should get project by name", async () => {
        const context = await getContext();

        const projectService = context.get(ProjectService);

        const project1 = projectService.get(PROJECT_1_NAME);

        expect(project1).not.toBeNull();
        expect(project1.id).toBe(PROJECT_1_NAME);
        expect(project1.name).toBe(PROJECT_1_NAME);
        expect(project1.path).toBe(PROJECT_1_PATH);
        expect(project1.type).toBe(PROJECT_TYPE_IMAGE);
    });

    it("should get project from dir", async () => {
        const context = await getContext();

        const appConfigService = context.get(AppConfigService),
              projectService = context.get(ProjectService);

        appConfigService.setPWD(PROJECT_2_PATH);

        const project2 = projectService.get();

        expect(project2).not.toBeNull();
        expect(project2.id).toBe(PROJECT_2_NAME);
        expect(project2.name).toBe(PROJECT_2_NAME);
        expect(project2.path).toBe(PROJECT_2_PATH);
        expect(project2.type).toBe(PROJECT_TYPE_DOCKERFILE);
    });

    it("should move to project dir", async () => {
        const context = await getContext();

        const appConfigService = context.get(AppConfigService),
              projectService = context.get(ProjectService);

        projectService.cdProject(PROJECT_2_NAME);

        expect(appConfigService.pwd()).toBe(PROJECT_2_PATH);
    });

    it("should throw error when project not found", async () => {
        const context = await getContext();

        const appConfigService = context.get(AppConfigService),
              projectService = context.get(ProjectService);

        appConfigService.setPWD("/tmp/not-a-project-dir");

        expect(() => projectService.get()).toThrow("Project not found");
        expect(() => projectService.cdProject("not-found-project-name")).toThrow("Project not found");
    });
});

import {describe, it, jest, expect} from "@jest/globals";
import {AppEventHandle} from "@wocker/core";
import {AppEventsService} from "./AppEventsService";


describe("AppEventsService", () => {
    it("should emit event and call listener", () => {
        const appEventsService = new AppEventsService();

        const listener = jest.fn();

        appEventsService.on("test", listener as AppEventHandle);
        appEventsService.emit("test", 1, 2, 3);

        expect(listener).toHaveBeenCalled();
        expect(listener).toBeCalledWith(1, 2, 3);
    });

    it("", () => {
        const appEventsService = new AppEventsService();

        const listener1 = jest.fn(),
              listener2 = jest.fn();

        const cancel1 = appEventsService.on("test", listener1 as AppEventHandle);
        appEventsService.on("test", listener2 as AppEventHandle);

        cancel1();
        appEventsService.off("test", listener2 as AppEventHandle);

        appEventsService.emit("test");

        expect(listener1).not.toBeCalled();
        expect(listener2).not.toBeCalled();
    });
});

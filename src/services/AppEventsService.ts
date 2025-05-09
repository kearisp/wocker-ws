import {
    AppEventsService as CoreAppEventsService,
    AppEventHandle,
    Injectable
} from "@wocker/core";


@Injectable("APP_EVENTS_SERVICE")
export class AppEventsService extends CoreAppEventsService {
    protected handles: {
        [event: string]: Set<AppEventHandle>;
    } = {};

    public on(event: string, handle: AppEventHandle): (() => void) {
        if(!this.handles[event]) {
            this.handles[event] = new Set();
        }

        this.handles[event].add(handle);

        return (): void => {
            this.off(event, handle);
        };
    }

    public off(event: string, handle: AppEventHandle): void {
        if(!this.handles[event]) {
            return;
        }

        this.handles[event].delete(handle);
    }

    public async emit(event: string, ...args: any[]) {
        if(!this.handles[event]) {
            return;
        }

        for(const handle of this.handles[event].values()) {
            await handle(...args);
        }
    }
}

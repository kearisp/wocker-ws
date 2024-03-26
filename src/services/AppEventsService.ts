import {
    AppEventsService as CoreAppEventsService,
    AppEventHandle,
    Injectable
} from "@wocker/core";


@Injectable("APP_EVENTS_SERVICE")
export class AppEventsService extends CoreAppEventsService {
    protected handles: ({
        [event: string]: AppEventHandle[];
    }) = {};

    public on(event: string, handle: AppEventHandle) {
        this.handles[event] = [
            ...this.handles[event] || [],
            handle
        ];

        return () => {
            this.handles[event] = this.handles[event].filter((filterHandle) => {
                return filterHandle !== handle;
            });
        };
    }

    public off(event: string, handle: AppEventHandle) {
        //
    }

    public async emit(event: string, ...args: any[]) {
        const handles = this.handles[event] || [];

        for(const i in handles) {
            await handles[i](...args);
        }
    }


}

import {EventEmitter} from "events";


type EventHandle = (...args: any[]) => Promise<void>|void;

class AppEventsService {
    protected emitter = new EventEmitter();
    protected handles: ({
        [event: string]: EventHandle[];
    }) = {};

    public on(event: string, handle: EventHandle) {
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

    public off(event: string, handle: EventHandle) {
        //
    }

    public async emit(event: string, ...args: any[]) {
        const handles = this.handles[event] || [];

        for(const i in handles) {
            await handles[i](...args);
        }
    }


}


export {AppEventsService};

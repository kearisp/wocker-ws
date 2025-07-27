export type ComposeConfig = {
    services: {
        [name: string]: {
            networks?: string[];
        };
    };
    networks?: {
        [name: string]: {
            external?: boolean;
        };
    };
};

import "reflect-metadata";


class DI {
    private services: Map<any, any> = new Map();

    public resolveService<T>(key: any): T {
        let res = this.services.get(key);

        if(!res) {
            const types = Reflect.getMetadata("design:paramtypes", key);

            if(types && types.length > 0) {
                types.forEach((type: any) => {
                    this.resolveService(type);
                });
            }

            res = new key(this);

            this.services.set(key, res);
        }

        return res;
    }

    public registerService(key: any, service: any) {
        this.services.set(key, service);
    }
}


export {DI}

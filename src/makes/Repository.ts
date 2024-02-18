type Entity = {
    id: number | string;
};

export class Repository<E extends Entity> {
    public async create(data: Partial<E>): Promise<E> {
        return null;
    }

    public async update(id: E["id"], record: Partial<E>): Promise<E> {
        return null;
    }

    public async byId(id: E["id"]): Promise<E> {
        return null;
    }

    public async search(params?: any): Promise<E[]> {
        return [];
    }

    public async searchOne(params?: any): Promise<E> {
        const [item] = await this.search(params);

        return item;
    }
}

// import {createConnection} from "mysql";


export class MySQL {
    protected connection;
    protected options: MySQL.ConstructorOptions;

    constructor(options: MySQL.ConstructorOptions) {
        // this.connection = createConnection(options);
    }

    async query(sql: string) {
        // this.connection.connect();
        //
        // const res = await new Promise((resolve, reject) => {
        //     this.connection.query(sql, (err, res) => {
        //         if(err) {
        //             return reject(err);
        //         }
        //
        //         return resolve(res);
        //     });
        // });
        //
        // this.connection.end();
        //
        // return res;
    }
}

export namespace MySQL {
    export type ConstructorOptions = string | {
        ssl?: boolean;
        host?: string;
        port?: number;
        user?: string;
        password?: string;
        database?: string;
    };
}

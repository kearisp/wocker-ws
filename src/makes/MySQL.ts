// import {createConnection} from "mysql";


type Options = string | {
    ssl?: boolean;
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
};

export class MySQL {
    protected connection;
    protected options: Options;

    constructor(options: Options) {
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

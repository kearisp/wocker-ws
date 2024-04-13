import axios, {AxiosHeaders, AxiosResponse} from "axios";


type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export class Http {
    protected headers: AxiosHeaders;

    private constructor(
        public readonly method: HttpMethod = "GET",
        public readonly url: string,
        public body?: any,
    ) {
        this.headers = new AxiosHeaders();
    }

    public withHeader(name: string, value: string): Http {
        this.headers.set(name, value);

        return this;
    }

    public withBody(body: any): Http {
        this.body = body;

        return this;
    }

    public async send(path: string): Promise<AxiosResponse> {
        return axios.create({
            method: this.method,
            baseURL: this.url,
            headers: this.headers.toJSON(),
            validateStatus() {
                return true;
            }
        }).request({
            url: path,
            data: this.body
        });
    }

    public static get(url: string): Http {
        return new Http("GET", url);
    }

    public static post(url: string): Http {
        return new Http("POST", url);
    }

    public static put(url: string): Http {
        return new Http("PUT", url);
    }

    public static patch(url: string): Http {
        return new Http("PATCH", url);
    }

    public static delete(url: string): Http {
        return new Http("DELETE", url);
    }
}

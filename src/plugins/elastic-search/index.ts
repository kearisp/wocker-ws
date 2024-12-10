import {Plugin} from "@wocker/core";

import {ElasticSearchController} from "./controllers/ElasticSearchController";


@Plugin({
    name: "elastic-search",
    controllers: [
        ElasticSearchController
    ]
})
export class ElasticSearchPlugin {}

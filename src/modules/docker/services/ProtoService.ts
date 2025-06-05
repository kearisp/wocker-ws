import {loadSync, Type, Root} from "protobufjs";
import {ROOT_DIR} from "../../../env";


export class ProtoService {
    protected _root?: Root;

    public get root(): Root {
        if(!this._root) {
            this._root = loadSync([
                `${ROOT_DIR}/proto/solver/pb/ops.proto`,
                `${ROOT_DIR}/proto/buildkit.proto`
            ]);
        }

        return this._root;
    }

    public lookupType(path: string): Type {
        return this.root.lookupType(path);
    }
}

import {
    Injectable,
    ProjectRepository as CoreProjectRepository
} from "@wocker/core";


@Injectable()
export class ProjectRepository extends CoreProjectRepository {}

export namespace ProjectRepository {
    export type SearchParams = CoreProjectRepository.SearchParams;
}

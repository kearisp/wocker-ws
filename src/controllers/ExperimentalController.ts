import {
    Description,
    Controller,
    Completion,
    Command,
    Param,
    UsageException,
    AppConfigService
} from "@wocker/core";


@Controller()
@Description("Manage experimental features")
export class ExperimentalController {
    public constructor(
        protected readonly appService: AppConfigService
    ) {}

    @Command("experimental:enable [feature]")
    @Description("Enable experimental features")
    public enable(
        @Param("feature")
        @Description("Name of the feature to enable")
        feature?: string
    ): void {
        if(!feature) {
            throw new UsageException("Feature name is required. Usage: wocker experimental:enable <feature-name>\n");
        }

        if(!this.appService.experimentalFeatures.includes(feature)) {
            const availableFeatures = this.appService.experimentalFeatures.join(", ");
            throw new UsageException(
                `Unknown experimental feature: "${feature}"\nAvailable features: ${availableFeatures}`
            );
        }

        this.appService.setMeta(`experimental.${feature}`, "enabled");
        this.appService.save();
    }

    @Command("experimental:disable [feature]")
    @Description("Disable experimental features")
    public disable(
        @Param("feature")
        @Description("Name of the feature to disable")
        feature?: string
    ): void {
        if(!feature) {
            throw new UsageException("Feature name is required. Usage: wocker experimental:disable <feature-name>\n");
        }

        if(!this.appService.experimentalFeatures.includes(feature)) {
            const availableFeatures = this.appService.experimentalFeatures.join(", ");
            throw new UsageException(
                `Unknown experimental feature: "${feature}"\nAvailable features: ${availableFeatures}`
            );
        }

        this.appService.unsetMeta(`experimental.${feature}`);
        this.appService.save();
    }

    @Completion("feature")
    public getFeatures(): string[] {
        return this.appService.experimentalFeatures;
    }
}

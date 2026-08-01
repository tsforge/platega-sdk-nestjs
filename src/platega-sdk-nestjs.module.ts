import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { MODULE_NAME } from './common/constants';
import { createPlategaSdkFactory } from './common/utils';
import {
    ASYNC_OPTIONS_TYPE,
    ConfigurableModuleClass,
    MODULE_OPTIONS_TOKEN,
    OPTIONS_TYPE,
} from './platega-sdk-nestjs.builder';
import { ModuleRef } from '@nestjs/core';
import { Platega } from '@tsforge7/platega-sdk';
import { IPlategaModuleOptions } from './interfaces';

@Global()
@Module({})
export class PlategaNestjsModule extends ConfigurableModuleClass {
    constructor(private readonly moduleRef: ModuleRef) {
        super();
    }

    public static forRoot(options: typeof OPTIONS_TYPE): DynamicModule {
        const PlategaApiProvider: Provider = {
            provide: MODULE_NAME,
            useFactory: (): Platega => createPlategaSdkFactory(options),
        };

        const { providers, exports, ...rest } = super.forRoot(options);

        return {
            providers: [...(providers ?? []), PlategaApiProvider],
            exports: [...(exports ?? []), PlategaApiProvider],
            ...rest,
        };
    }

    public static forRootAsync(options: typeof ASYNC_OPTIONS_TYPE): DynamicModule {
        const PlategaApiProvider: Provider = {
            provide: MODULE_NAME,
            useFactory: (options: IPlategaModuleOptions): Platega =>
                createPlategaSdkFactory(options),
            inject: [MODULE_OPTIONS_TOKEN],
        };

        const { providers, exports, ...rest } = super.forRootAsync(options);

        return {
            providers: [...(providers ?? []), PlategaApiProvider],
            exports: [...(exports ?? []), PlategaApiProvider],
            ...rest,
        };
    }
}

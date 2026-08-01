import { ConfigurableModuleBuilder } from '@nestjs/common';
import { IPlategaModuleOptions } from './interfaces';

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE, ASYNC_OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<IPlategaModuleOptions>()
        .setFactoryMethodName('forRootAsync')
        .setClassMethodName('forRoot')
        .build();

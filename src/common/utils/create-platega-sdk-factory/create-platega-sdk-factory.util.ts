import { Platega } from '@tsforge7/platega-sdk';
import { Logger } from '@nestjs/common';
import { IPlategaConfig } from './interfaces';
const logger = new Logger('platega-sdk-nestjs');

export function createPlategaSdkFactory(moduleOptions: IPlategaConfig): Platega {
    const plategaApi = new Platega(moduleOptions);
    logger.log(`PlategaApi initialized`);
    return plategaApi;
}

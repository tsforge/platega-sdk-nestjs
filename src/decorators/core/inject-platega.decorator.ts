import { Inject } from '@nestjs/common';
import { MODULE_NAME } from '../../common/constants';

export function InjectPlatega(): ParameterDecorator {
    return Inject(MODULE_NAME);
}

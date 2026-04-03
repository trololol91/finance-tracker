import {Injectable} from '@nestjs/common';
import {AuthGuard} from '@nestjs/passport';

@Injectable()
export class FlexibleAuthGuard extends AuthGuard(['jwt', 'api-key']) {}

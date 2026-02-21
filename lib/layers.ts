import { Layer } from 'effect';
import { Db } from './services/db/live-layer';
import { Auth } from './services/auth/live-layer';
import { AI } from './services/anthropic/live-layer';
import { Email } from './services/email/live-layer';

// Combined app layer
export const AppLayer = Layer.mergeAll(Auth.Live, Db.Live, AI.Live, Email.Live);

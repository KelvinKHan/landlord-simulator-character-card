import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';
import { Schema } from '../../src/schema/landlord-schema.js';

const schemaRegistrationKey = '__landlordMvuSchemaVersion';

export function activate(context) {
  if (context.host[schemaRegistrationKey] !== '2.0') {
    registerMvuSchema(Schema);
    context.host[schemaRegistrationKey] = '2.0';
  }

  const service = Object.freeze({
    version: '2.0',
    parseRoot(value) {
      return Schema.parse(value);
    },
    parseState(value) {
      return Schema.parse({ 房东系统: value }).房东系统;
    },
    safeParseState(value) {
      const result = Schema.safeParse({ 房东系统: value });
      return result.success ? { success: true, data: result.data.房东系统 } : result;
    },
  });

  context.services.register('landlord.schema', service);
}

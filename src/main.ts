import { logger } from '@papi/backend';

export async function activate() {
  logger.debug('Sneeze Board is activating!');
}

export async function deactivate() {
  logger.debug('Sneeze Board is deactivating!');
  return true;
}

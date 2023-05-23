import type IDataProvider from 'shared/models/data-provider.interface';

export type SerializedSneeze = { userId: string; date: string; comment?: string };
export type Sneeze = SerializedSneeze & { sneezeId: number };
export type User = { userId: string; name: string; color: string };

/**
 * Selector: '*' will select all sneezes, 'users' will select all users, a string userId will
 * return all the sneezes from the user with the entered userId, a number sneezeId will return the
 * sneeze with that id, and a date will return all sneezes that occurred on
 * that date (eventually)
 * GetData: the same provider can either return sneezes or users based on the selector (see above)
 * SetData: string type is userId and will set a new sneeze,
 *  number type is sneezeId and will update an existing sneeze
 */
export interface AchYouDataProvider
  extends IDataProvider<string | number | Date, Sneeze[] | User[], Sneeze | User> {}

import papi from 'papi-backend';
import type IDataProviderEngine from 'shared/models/data-provider-engine.model';
import { AchYouDataTypes } from 'paranext-extension-sneeze-board';
import sneezeBoardWebView from './sneeze-board.web-view?inline';
import styles from './sneeze-board.web-view.scss?inline';
import type { IWebViewProvider } from 'shared/models/web-view-provider.model';
import type { SavedWebViewDefinition, WebViewDefinition } from 'shared/data/web-view.model';
// TODO: Update the json file with the latest date from Darren (xml that needs to be run through a
// json converter online and have accessors renamed to userId, date, and comment)
import blessYouData from './sneeze-board.data.json';

const {
  logger,
  dataProvider: { DataProviderEngine },
} = papi;

logger.info('Sneeze Board is importing!');

// TODO: Change date to have a Date type once JSON gets parsed to a Date type
export type SerializedSneeze = { userId: string; date: string; comment?: string };
export type Sneeze = SerializedSneeze & { sneezeId: number };
export type User = { userId: string; name: string; color: string };

class AchYouDataProviderEngine
  extends DataProviderEngine<AchYouDataTypes>
  implements IDataProviderEngine<AchYouDataTypes>
{
  sneezes: Sneeze[];
  startOfCountdown: number;
  users: User[];
  constructor() {
    super();

    this.startOfCountdown = +blessYouData.CountdownStart;
    this.sneezes = blessYouData.Sneezes.map((s, i) => {
      return { sneezeId: this.startOfCountdown - i, ...s };
    });
    this.users = blessYouData.Users;
  }

  /**
   * @param selector string userId of user who just sneezed a new sneeze or
   *  number sneezeId of sneeze that needs editing
   * @param sneeze date and any comments associated with the sneeze
   */
  // Note: this method gets layered over so that you can run `this.set` in the data provider engine,
  // and it will notify update afterward.
  async setSneeze(selector: string | number | Date, sneeze: Sneeze) {
    // Note: a sneeze can be gotten by date but not set by date so we don't have a case for that
    // Setting a sneeze by userId means that user just sneezed a new sneeze so add it to the data
    if (typeof selector === 'string') this.sneezes.push(sneeze);
    // Selecting a sneeze by sneezeId means you are updating an existing sneeze, right now you can
    // only update a sneeze comment. No rewriting history by changing dates :)
    if (typeof selector === 'number') {
      this.sneezes = this.sneezes.map((s) =>
        s.sneezeId === selector ? { ...s, comment: sneeze.comment } : s,
      );
    }

    return true;
  }

  /**
   * @param selector id of existing user or generic NEWUSER string for adding a new user
   * @param user user id, name, and color of user to add/modify
   */
  // Note: this method gets layered over so that you can run `this.set` in the data provider engine,
  // and it will notify update afterward.
  async setUser(selector: string, user: User) {
    if (selector === 'NEWUSER') {
      logger.log('About to push new user');
      logger.log(`data.name: ${user.name}`);
      this.users.push(user);
    } else if (selector && selector.trim()) {
      this.users = this.users.map((u) => (u.userId === selector ? { ...u, color: user.color } : u));
    } else return false;

    return true;
  }

  /**
   * @param selector string user id or number sneezeId or Date date
   */
  getSneeze = async (selector: string | number | Date) => {
    // logger.log('Sneeze get');
    if (!selector) return [];
    if (selector === '*') return this.sneezes;
    if (typeof selector === 'string')
      // Handle all string selectors so it can be assumed the following selectors are of type
      //  SneezeBoardData
      return this.sneezes.filter((sneeze) => {
        return selector === sneeze.userId;
      });

    // TODO: Come back and parse Json date into the date type instead of type string and make this
    // sortable by day, month, year etc.
    // if (selector.date && typeOf date === 'Date')
    //   return this.sneezes.filter((sneeze) => {
    //     return selector.date === sneeze.date;
    //   });
    if (typeof selector === 'number') {
      return this.sneezes.filter((sneeze) => {
        return selector === sneeze.sneezeId;
      });
    }
    return [];
  };

  /**
   * @param selector string user id or general selector
   */
  getUser = async (selector: string) => {
    if (!selector) return [];
    else if (selector === '*') return this.users;
    else if (typeof selector === 'string') {
      return this.users.filter((user) => {
        return selector === user.userId;
      });
    }
    return [];
  };
}

const sneezeBoardWebViewType = 'sneezeBoard.react';

/**
 * Simple web view provider that provides Sneeze Board web views when papi requests them
 */
const sneezeBoardWebViewProvider: IWebViewProvider = {
  async getWebView(savedWebView: SavedWebViewDefinition): Promise<WebViewDefinition | undefined> {
    if (savedWebView.webViewType !== sneezeBoardWebViewType)
      throw new Error(
        `${sneezeBoardWebViewType} provider received request to provide a ${savedWebView.webViewType} web view`,
      );
    return {
      ...savedWebView,
      title: 'Sneeze Board',
      content: sneezeBoardWebView,
      styles,
    };
  },
};

export async function activate() {
  logger.info('Sneeze Board is activating!');

  const sneezeDataProvider = await papi.dataProvider.registerEngine(
    'sneezeBoard.sneezes',
    new AchYouDataProviderEngine(),
  );

  const sneezeBoardWebViewProviderPromise = papi.webViewProviders.register(
    sneezeBoardWebViewType,
    sneezeBoardWebViewProvider,
  );

  const unsubPromises = [
    papi.commands.registerCommand('sneezeBoard.getSneezes', () => {
      return sneezeDataProvider.getSneeze('*');
    }),
  ];

  // Create a webview or get an existing webview if one already exists for this type
  // Note: here, we are using `existingId: '?'` to indicate we do not want to create a new webview
  // if one already exists. The webview that already exists could have been created by anyone
  // anywhere; it just has to match `webViewType`.
  papi.webViews.getWebView(sneezeBoardWebViewType, undefined, { existingId: '?' });

  if (sneezeDataProvider) {
    // Test subscribing to a data provider
    const unsubGreetings = await sneezeDataProvider.subscribeSneeze(
      'c897cd73-9100-4e6a-8a32-fe237f1e9928',
      (timSneeze: Sneeze[]) =>
        logger.info(`Tim sneezed the ${timSneeze[timSneeze.length - 1].sneezeId} sneeze`),
    );
    unsubscribers.push(unsubGreetings);
  }

  // For now, let's just make things easy and await the registration promises at the end so we don't
  // hold everything else up
  const sneezeBoardWebViewProviderResolved = await sneezeBoardWebViewProviderPromise;

  logger.info('The Sneeze Board is finished activating!');
}

export async function deactivate() {
  return Promise.all(unsubscribers.map((unsubscriber) => unsubscriber()));
}

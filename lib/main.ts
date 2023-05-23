import papi from "papi";
import IDataProviderEngine from "shared/models/data-provider-engine.model";
// @ts-expect-error ts(1192) this file has no default export; the text is exported by rollup
import extensionTemplateReact from "./extension-template.web-view";
import extensionTemplateReactStyles from "./extension-template.web-view.scss?inline";
// @ts-expect-error ts(1192) this file has no default export; the text is exported by rollup
import extensionTemplateHtml from "./extension-template-html.web-view.ejs";
import type { WebViewContentType } from "shared/data/web-view.model";

const { logger } = papi;

console.log(import.meta.env.PROD);

logger.info("Extension template is importing!");

const unsubscribers = [];

type QuickVerseSetData = string | { text: string; isHeresy: boolean };

class QuickVerseDataProviderEngine
  implements IDataProviderEngine<string, string | undefined, QuickVerseSetData>
{
  /**
   * Verses stored by the Data Provider.
   * Keys are Scripture References.
   * Values are { text: '<verse_text>', isChanged?: boolean }
   */
  verses: { [scrRef: string]: { text: string; isChanged?: boolean } } = {};

  /** Latest updated verse reference */
  latestVerseRef = "john 11:35";

  // Note: this method does not have to be provided here for it to work properly because it is layered over on the papi.
  // But because we provide it here, we must return `true` to notify like in the set method.
  // The contents of this method run before the update is emitted.
  // TODO: What will actually happen if we run this in `get`? Stack overflow?
  notifyUpdate() {
    logger.info(
      `Quick verse notifyUpdate! latestVerseRef = ${this.latestVerseRef}`
    );
    return true;
  }

  /**
   * @param selector Scripture reference
   * @param data { text: '<verse_text>', isHeresy: true } Must inform us that you are a heretic
   */
  // Note: this method gets layered over so that you can run `this.set` in the data provider engine, and it will notify update afterward.
  async set(selector: string, data: QuickVerseSetData) {
    // Just get notifications of updates with the 'notify' selector. Nothing to change
    if (selector === "notify") return false;

    // You can't change scripture from just a string. You have to tell us you're a heretic
    if (typeof data === "string" || data instanceof String) return false;

    // Only heretics change Scripture, so you have to tell us you're a heretic
    if (!data.isHeresy) return false;

    // If there is no change in the verse text, don't update
    if (data.text === this.verses[this.#getSelector(selector)].text)
      return false;

    // Update the verse text, track the latest change, and send an update
    this.verses[this.#getSelector(selector)] = {
      text: data.text,
      isChanged: true,
    };
    if (selector !== "latest")
      this.latestVerseRef = this.#getSelector(selector);
    return true;
  }

  /**
   * Example of layering over set inside a data provider. This updates the verse text and sends an update event
   * @param verseRef verse reference to change
   * @param verseText text to update the verse to, you heretic
   */
  async setHeresy(verseRef: string, verseText: string) {
    return this.set(verseRef, { text: verseText, isHeresy: true });
  }

  /**
   * @param selector
   */
  get = async (selector: string) => {
    // Just get notifications of updates with the 'notify' selector
    if (selector === "notify") return undefined;

    let responseVerse = this.verses[this.#getSelector(selector)];

    // If we don't already have the verse cached, cache it
    if (!responseVerse) {
      // Fetch the verse, cache it, and return it
      try {
        const verseResponse = await papi.fetch(
          `https://bible-api.com/${encodeURIComponent(
            this.#getSelector(selector)
          )}`
        );
        const verseData = await verseResponse.json();
        const text = verseData.text.replaceAll("\n", "");
        responseVerse = { text };
        this.verses[this.#getSelector(selector)] = responseVerse;
        // Cache the verse text, track the latest cached verse, and send an update
        if (selector !== "latest")
          this.latestVerseRef = this.#getSelector(selector);
        this.notifyUpdate();
      } catch (e) {
        responseVerse = {
          text: `Failed to fetch ${selector} from bible-api! Reason: ${e}`,
        };
      }
    }

    return responseVerse.text;
  };

  /**
   * Valid selectors:
   * - `'notify'` - informs the listener of any changes in quick verse text but does not carry data
   * - `'latest'` - the latest-updated quick verse text including pulling a verse from the server and a heretic changing the verse
   * - Scripture Reference strings. Ex: `'Romans 1:16'`
   * @param selector selector provided by user
   * @returns selector for use internally
   */
  #getSelector(selector: string) {
    const selectorL = selector.toLowerCase();
    return selectorL === "latest" ? this.latestVerseRef : selectorL;
  }
}

export async function activate() {
  logger.info("Extension template is activating!");

  const quickVerseDataProviderInfoPromise = papi.dataProvider.registerEngine(
    "paranext-extension-template.quick-verse",
    new QuickVerseDataProviderEngine()
  );

  const unsubPromises = [
    papi.commands.registerCommand(
      "extension-template.do-stuff",
      (message: string) => {
        return `The template did stuff! ${message}`;
      }
    ),
  ];

  papi.webViews.addWebView({
    id: 'Extension template WebView React',
    content: extensionTemplateReact,
    styles: extensionTemplateReactStyles,
  });
  
  papi.webViews.addWebView({
    id: 'Extension template WebView HTML',
    contentType: 'html' as WebViewContentType.HTML,
    content: extensionTemplateHtml,
  });

  // For now, let's just make things easy and await the data provider promise at the end so we don't hold everything else up
  const quickVerseDataProviderInfo = await quickVerseDataProviderInfoPromise;

  return Promise.all(
    unsubPromises.map((unsubPromise) => unsubPromise.promise)
  ).then(() => {
    logger.info("Extension template is finished activating!");
    return papi.util.aggregateUnsubscriberAsyncs(
      unsubPromises
        .map((unsubPromise) => unsubPromise.unsubscriber)
        .concat([quickVerseDataProviderInfo.dispose])
    );
  });
}

export async function deactivate() {
  logger.info("Extension template is deactivating!");
}

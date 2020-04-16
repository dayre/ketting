import { BaseState, StateFactory } from '../state';
import { parseLink } from '../http/util';

/**
 * Represents a resource state for text responses, such as text/plain, text/csv.
 * text/html, text/csv.
 */
export class TextState extends BaseState<string> {

  serializeBody(): string {

    return this.body;

  }

}

/**
 * Turns a HTTP response into a TextState
 */
export const factory: StateFactory<string> = async (response: Response): Promise<TextState> => {

  return new TextState(
    await response.text(),
    response.headers,
    parseLink(response.headers.get('Link')),
  );

}

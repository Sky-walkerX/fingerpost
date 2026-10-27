import type { AsrFactory } from '../../session/controller.ts';

/** MODEL_MODE=mock: every utterance transcribes to `phrase` once audio.end arrives. */
export const mockAsr = (phrase = 'start'): AsrFactory => (_o, sink) => ({
  push() {},
  end() { setTimeout(() => { sink.partial(phrase.split(' ')[0]!); sink.final(phrase); }, 5); },
  close() {},
});

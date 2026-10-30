import type { AsrFactory } from '../../session/controller.ts';

/** Synthetic endpointing: the phone waits for a final before sending audio.end, just as in live mode. */
export const mockAsr = (phrase = 'start'): AsrFactory => (_o, sink) => {
  let finished = false, timer: ReturnType<typeof setTimeout> | undefined;
  const endpoint = () => {
    if (finished || timer !== undefined) return;
    timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      sink.partial(phrase.split(' ')[0]!);
      sink.final(phrase);
    }, 5);
  };
  return {
    push(chunk) { if (chunk.length) endpoint(); },
    end: endpoint,
    close() { finished = true; clearTimeout(timer); },
  };
};

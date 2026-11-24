# Dialogue experiment status

The initial 32-unit character RNN lowered next-character loss but generated malformed sentences and essentially ignored different prompts. Its low loss was not conversational competence.

The next experiment (`conditioned-rnn.mjs`) uses a 48-unit word-level recurrent generator. A learned context projection receives a prompt embedding at **every generated word**, so the context is not lost after a few recurrent steps. Prompt embeddings, recurrent weights, context weights and output weights are all updated through backpropagation. Runtime generation does not import the teacher corpus or choose a stored answer.

The CC0 teacher curriculum has 48 prompt/reply examples across eight task-dialogue families. Vocabulary is derived from training data only; unseen input tokens become `<unk>`. Eight held-out prompts rearrange known words; one contains an unknown word. In the recorded 250-epoch experiment, all eight met their coarse keyword checks and the generated samples were grammatical task replies. This tiny test does **not** prove open-ended conversation, negation handling, reliable factual grounding or understanding arbitrary language.

`DialogueSession` restores two separate models from the same initial checkpoint. Corrections change only the selected model. The UI preserves two checkpoints on explicit save and shows unknown-input rates. There is no shared hidden state between the two models. However, each response currently uses only the latest utterance; visible history is not yet a learned long-context memory.

Letting the two models exchange their own outputs exposes a real limitation: they can settle into repeating “mình sẽ chờ kết quả của bạn”. The UI detects repeated turns and stops. This is reported as failure to progress, rather than masked by scripted variation or claimed as cooperation.

Reproduce:

```
npm run train:dialogue
npm run chat
node scripts/dialogue-smoke.mjs
```

Next work must add context-grounded, multi-turn teaching and stronger held-out relevance/contradiction tests. Cooperation requires separate task observations and evidence that disabling or corrupting communication reduces actual task success. That result is not achieved yet.

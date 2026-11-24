# Order-sensitive language candidates

Stress tests of the first mean-context model exposed incorrect responses to negation ("lưu nhưng đừng sao chép") and state changes ("đã gửi" versus "chưa gửi"). Thus the eight simple held-out prompts were insufficient evidence of conversation.

Two candidate encoders were implemented without replacing the current UI checkpoint:

1. A recurrent prompt encoder with backpropagation through its full token sequence. In the 300-epoch run, it collapsed to one common reply: 1/5 contrast tests and 1/8 basic tests. It is **rejected**, despite apparently low training loss.
2. A learned adjacent-word feature encoder, using mechanically generated bigram identities in addition to words. Prompt-only bigram tokens are masked from generated text. The 150-epoch run passed 5/5 negation/state/cancel contrast prompts and 7/8 original basic prompts. It still regressed on waiting versus stopping and is **not automatically promoted**.

The expanded CC0 synthetic corpus includes contrasting instructions and previous-turn distractors. Tests remain a small bounded benchmark, not an open-language assessment. Test wording is not used as training labels. The candidate checkpoints and reports are local ignored artifacts.

`TurnMemory` stores a bounded transcript per agent, containing only that agent's observed utterances and its own replies. Non-mean candidates can receive that context. This is explicit adapter memory, not a claim that neural weights have acquired long-term episodic recall. It is currently session-only; saved model pairs do not persist the transcript.

Reproduce candidate training with `npm run train:context -- 150 ngram` or `npm run train:context -- 300 sequence`. Inspect generated samples and regressions before adopting a checkpoint. The public default UI continues loading `conditioned-model.json`, not the candidate `context-model.json`.

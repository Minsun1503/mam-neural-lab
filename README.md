# Mầm Neural Lab

An independent visual classroom for small neural agents, extracted from pokemon-companion. Runs locally on CPU; no pretrained language model or cloud API is included.

## Run

Node.js 22.12+ and npm are required.

```
npm ci
npm start
npm test
npm run train
npm run test:ui
```

The classroom trains a 64 → 64 → 20 neural policy from demonstrations, then evaluates twenty structured computer tasks. It persists checkpoints separately from pokemon-companion. Target strings and structured observations come from an adapter. It does not yet understand free-form Vietnamese or independently read arbitrary application interfaces.

## Roadmap

1. Standalone visual classroom and public source repository.
2. Learned Vietnamese generation and comprehension with honest held-out conversation evaluation.
3. Two independent brains, explicit communication, and cooperative tasks tested against communication-disabled baselines.

Stage 2 has both an initial character-level experiment and a context-conditioned word-level generator in `language/`. The latter generates token by token from learned weights and currently covers eight bounded task-dialogue families. Run `npm run train:dialogue`, then `npm run chat` to open the experimental conversation window. It creates two independent weight instances, allows individual supervised corrections, and can feed their generated messages to each other. Repetition detection stops unproductive loops. No training checkpoint or private dialogues are committed.

The eight held-out prompts are a small compositional test, not a conversational benchmark. The production model still lacks broad Vietnamese comprehension. Order-sensitive language candidates and bounded per-agent episode memory are research experiments; they are not automatically promoted over a better existing model.

A first **bounded cooperation experiment** now teaches separate neural tool policies and word decoders to exchange file contents and verify the result. Run `npm run test:cooperation` or use the cooperation panel in `npm run chat`. It passes forty normal held-out file transfers and fails appropriately when messages, payloads or data-message wording are corrupted. Parameter copying/quote parsing are explicit adapters. This is one protocol, not general collaboration; see [details](docs/cooperation-experiment.md). Fixed dialogue templates must not be presented as learned language.

For broader language research, [the optional CPU training branch](docs/public-language.md) trains a subword attention-GRU from random weights on pinned public Vietnamese corpora. It includes a standalone JavaScript inference kernel and numerical checks against Python. The initial small-corpus run still produced irrelevant/repetitive replies and was not promoted; a larger multi-turn experiment is separate from the live classroom. Training data, virtual environments and working outputs are ignored. A public-data research checkpoint is attached to GitHub Releases with a pinned checksum for moving between machines. Lower loss is not treated as proof of conversational competence.

**Continuing on another computer:** follow [docs/HANDOFF.md](docs/HANDOFF.md) to restore the checkpoint, try the JavaScript candidate, resume CPU training and see unfinished milestones.

## Attribution and data

Extracted classroom code is derived from Minsun1503/pokemon-companion (MIT); see LICENSE and NOTICE.md. No Pokémon graphics, browser sessions, credentials, private checkpoints or personal conversation logs are bundled. `outputs/` contains only locally generated artifacts and is ignored by Git.

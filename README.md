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

Stages 2 and 3 are not implemented yet. Fixed dialogue templates must not be presented as learned language.

## Attribution and data

Extracted classroom code is derived from Minsun1503/pokemon-companion (MIT); see LICENSE and NOTICE.md. No Pokémon graphics, browser sessions, credentials, private checkpoints or personal conversation logs are bundled. `outputs/` contains only locally generated artifacts and is ignored by Git.

# Vietnamese language and cooperation: acceptance plan

This is the next phase, not an implemented capability.

The existing policy only consumes structured feature vectors. A second copy does not acquire language merely by exchanging strings. Vietnamese generation needs a learned token model and comprehension needs testing against unseen utterances, rather than selecting prewritten reply templates.

## Language experiment

- Keep the desktop policy and language learner separate so generation cost, RAM and mistakes are measurable.
- Start with a trainable small byte/token language model and an explicitly sourced, redistributable Vietnamese dialogue corpus. Preserve dataset licenses, provenance and train/validation/test partitions.
- Teach turn-taking, referring to observed state, asking for missing information, reporting failed actions and correcting misunderstandings. Never use private chat/browser history as public training data.
- Evaluate generated held-out turns for relevance, grammaticality and grounding. Low token loss alone does not demonstrate conversation. Include human review of new prompts.
- Compare a small locally trained model with an optional local pretrained language adapter. A pretrained adapter must be labeled as such, with its resource cost and inherited knowledge; it cannot silently replace the custom brain.
- Do not claim open-ended Vietnamese conversation from a small fixed synthetic command vocabulary. If training only produces bounded task dialogue, report that limitation.

## Two learners

- Separate weights, optimizer state, memory, checkpoints and identities for Mầm A and Mầm B.
- Give them partial observations so neither can solve the task alone; exchange messages only through a visible logged channel.
- Separate generated language from tool execution. One holder at a time controls a shared desktop resource.
- Teach request / clarify / propose / acknowledge / execute / verify sequences, then swap roles and randomize assignments.
- Test unseen tasks and partners, communication disabled, messages shuffled, and a scripted-protocol baseline. Improvement without reading hidden shared state is required evidence of cooperation.
- Preserve independent action and message traces, exact outcomes and uncertainty. Render explanations as explanations, not recovered private thoughts of neurons.

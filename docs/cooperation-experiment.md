# First cooperative file task — bounded evidence

Two independently trained neural policies and independently instantiated neural word decoders execute a small read/send/write/verify/acknowledge protocol. Each policy sees only its own role, local operation receipts and the text delivered through its channel. The writer does not receive the reader's source contents as an observation. The only payload path is the actual message string.

The teacher balances reachable protocol phases rather than assigning random contradictory state flags. Each agent's tool action is an argmax from its own learned weights. The decoder predicts Vietnamese words from learned intent conditioning. Quoting and copying a source payload, parsing quoted text, binding filesystem paths and round-robin scheduling are explicit adapters, not skills claimed to be discovered by the neural models.

In forty held-out synthetic file tasks with alternating reader/writer identities:

| Channel | Completed tasks |
|---|---:|
| Normal | 40/40 |
| Muted | 0/40 |
| Payload changed | 0/40 |
| All wording replaced with a waiting message | 0/40 |
| Only data-message wording replaced, quoted payload preserved | 0/40 |

The final condition tests whether the recipient can simply grab any quoted string while ignoring the surrounding message. These models do not pass that shortcut. The grader independently compares the actual destination file with the original source string, not merely with what the writer believes it received. Policy weights are frozen throughout evaluation. No personal files are used.

This is one structured protocol, not general cooperation or natural conversation. The three decoder outputs are learned from three teacher utterances and do not establish open-ended language competence. The protocol experiment trains separate research agents; it does not overwrite the A/B conversational corrections saved in the UI.

Reproduce with `node scripts/cooperation-experiment.mjs`. Detailed actual messages, tool actions, outcomes and checkpoints are written under ignored `outputs/cooperation/`.

# Broader Vietnamese generation: CPU research branch

The tiny dialogue corpus was insufficient for ordinary Vietnamese conversation. This branch trains an attention-based bidirectional encoder / GRU decoder from **random weights**, rather than downloading a pretrained language model. PyTorch is used for CPU training; inference has an independent JavaScript implementation, so running the model does not require a Python/PyTorch process.

From-scratch initialization does not imply the trained model remains knowledge-free: public dialogue corpora include factual statements and persona text. This language experiment is separate from the custom action policies. It must not silently replace the project's original goal of efficient learning or claim general understanding.

## Data and partitioning

Only public upstream datasets are downloaded, to ignored `data/external/`. No private user conversations, browser sessions or personal checkpoints enter this pipeline. Source revisions and SHA-256 digests are pinned in `training/public_data.py`.

- [hoanghai2110/vietnamese-dataset](https://huggingface.co/datasets/hoanghai2110/vietnamese-dataset): upstream card declares Apache-2.0. The pinned source contains 2,009 rows and 1,720 unique dialogues. The deterministic grouped split is 1,386 / 171 / 163 dialogues.
- [5CD-AI/Vietnamese-Multi-turn-Chat-Alpaca](https://huggingface.co/datasets/5CD-AI/Vietnamese-Multi-turn-Chat-Alpaca): upstream card declares Apache-2.0. The pinned source contains 12,697 dialogues, split into 10,096 / 1,296 / 1,305 dialogues. Generated/translated answers can be wrong; the upstream license declaration does not certify quality or facts.

Conversations sharing an exact normalized user question are linked before splitting. No exact user question crosses train/validation/test boundaries. This does not prove absence of semantic paraphrase leakage. SentencePiece BPE vocabulary is learned only from the training partition; byte fallback handles unseen Unicode without a pretrained tokenizer.

The initial small-source experiment used clipped 127-token replies and remains a baseline only. The larger-source run instead excludes replies over 256 tokens rather than inventing an end marker mid-sentence. Its retained pair counts are 23,629 / 3,105 / 2,999. Prompts are bounded to the last 192 subword tokens, so neither run proves long-context recall or performance on long answers. The larger corpus includes instruction-following and factual QA as well as dialogue; it is not a pure conversational ground-truth corpus.

## Reproduce (Windows CPU)

Python 3.13 was used locally; training is optional and independent of `npm ci`.

```powershell
python -m venv .venv-train
.venv-train/Scripts/python.exe -m pip install torch==2.15.0+cpu --index-url https://download.pytorch.org/whl/cpu
.venv-train/Scripts/python.exe -m pip install -r training/requirements-cpu.txt
.venv-train/Scripts/python.exe training/train_public.py --epochs 25 --threads 3
.venv-train/Scripts/python.exe training/export_public.py
node scripts/public-gru-parity.mjs
.venv-train/Scripts/python.exe training/train_public.py --source multiturn --epochs 12 --threads 3
```

The final command is a substantially longer CPU experiment. Length buckets reduce padded output positions by about 51% for the measured training partition. `latest.pt` and `progress.json` are saved every 50 batches and at completed epochs under `outputs/public-language-multiturn/`; `best.pt` is selected only after validation. Resume with the same options plus `--resume`. The checkpoint retains optimizer, random order, batch cursor, partial loss and token counts. A two-batch interruption/resume test matched the weights from four continuous batches exactly on CPU with one thread.

For a bounded run add `--stop-after-batches 50`. To stop a running trainer safely, create `outputs/public-language-multiturn/stop-request`; it saves after the current batch. Remove that file before resuming. Do not treat a quiet operation as failure or automatically replay/restart training.

Run `training/export_public.py --source multiturn` and `node scripts/public-gru-parity.mjs multiturn` to export and verify that candidate after a checkpoint exists. Never load arbitrary downloaded pickle checkpoints; the exporter uses `weights_only=True` on this pipeline's locally produced files.

## Current evidence and acceptance

The initial 25-epoch small-source run finished in about six minutes on an i5-8500T using three CPU threads. Best validation NLL was about 3.72; held-out test NLL was about 3.65. Generated samples remained irrelevant or repetitive and sometimes repeated the source dataset's persona name. This model is **not conversationally certified and is not the live dialogue default**.

The JavaScript implementation matched the Python tokenizer on 56 reference cases (including Unicode byte fallbacks) and first-step logits on four inference cases to roughly 0.000002 absolute error. Full short greedy continuations matched on those cases. This proves numerical export fidelity, not language competence or a general tokenizer implementation: only the configured identity-normalized BPE format is supported.

The larger-source run must be evaluated on held-out relevance, grammaticality, state grounding and multi-turn consistency. Lower training/validation loss, finished epochs, or a few fluent sentences are insufficient to mark the user objective achieved. Working outputs remain ignored. A deliberately selected public-data checkpoint is attached to GitHub Releases; its pinned URL, checksum, provenance and artifact licensing live in `checkpoints/`. See [the handoff](HANDOFF.md). No private A/B corrections are included.

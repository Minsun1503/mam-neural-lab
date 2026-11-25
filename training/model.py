"""Small attention GRU, randomly initialized; no pretrained language weights."""
import torch
from torch import nn
from torch.nn.utils.rnn import pack_padded_sequence, pad_packed_sequence

class DialogueGRU(nn.Module):
    def __init__(self, vocab, embedding=96, hidden=96):
        super().__init__()
        self.config = {'vocab': vocab, 'embedding': embedding, 'hidden': hidden}
        self.embedding = nn.Embedding(vocab, embedding, padding_idx=0)
        self.encoder = nn.GRU(embedding, hidden, batch_first=True, bidirectional=True)
        self.decoder = nn.GRU(embedding, hidden*2, batch_first=True)
        self.output = nn.Linear(hidden*4, vocab)

    def encode(self, source):
        mask = source.ne(0)
        packed = pack_padded_sequence(self.embedding(source), mask.sum(1).cpu(), batch_first=True, enforce_sorted=False)
        encoded, hidden = self.encoder(packed)
        encoded, _ = pad_packed_sequence(encoded, batch_first=True, total_length=source.size(1))
        initial = torch.cat((hidden[0], hidden[1]), dim=-1).unsqueeze(0)
        return encoded, initial, mask

    def decode(self, tokens, hidden, encoded, mask):
        decoded, hidden = self.decoder(self.embedding(tokens), hidden)
        scores = torch.bmm(decoded, encoded.transpose(1,2)) / (encoded.size(-1)**.5)
        scores = scores.masked_fill(~mask.unsqueeze(1), -1e9)
        context = torch.bmm(scores.softmax(-1), encoded)
        return self.output(torch.cat((decoded, context), dim=-1)), hidden

    def forward(self, source, target):
        encoded, hidden, mask = self.encode(source)
        return self.decode(target, hidden, encoded, mask)[0]

    @torch.no_grad()
    def generate(self, source, maximum=96):
        self.eval()
        encoded, hidden, mask = self.encode(source)
        token = torch.tensor([[1]], dtype=torch.long)
        result = []
        for _ in range(maximum):
            logits, hidden = self.decode(token, hidden, encoded, mask)
            token = logits[:, -1].argmax(-1).view(1,1)
            value = token.item()
            if value == 2:
                break
            result.append(value)
        return result

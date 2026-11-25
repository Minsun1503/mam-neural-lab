import unittest
import torch
from model import DialogueGRU

class ModelTests(unittest.TestCase):
    def setUp(self):
        torch.manual_seed(7)
        torch.set_num_threads(1)
    def test_padding_and_real_gradient_learning(self):
        model=DialogueGRU(16,8,8)
        source=torch.tensor([[4,5,6,0],[4,7,8,9]])
        target=torch.tensor([[1,10,11,2],[1,12,13,2]])
        encoded,_,mask=model.encode(source)
        self.assertEqual(encoded.shape,(2,4,16))
        self.assertEqual(mask[0].tolist(),[True,True,True,False])
        optimizer=torch.optim.Adam(model.parameters(),lr=.03)
        loss_fn=torch.nn.CrossEntropyLoss()
        def loss():return loss_fn(model(source,target[:,:-1]).reshape(-1,16),target[:,1:].reshape(-1))
        original=model.encoder.weight_ih_l0.detach().clone()
        before=loss().item()
        for _ in range(60):
            optimizer.zero_grad();value=loss();value.backward();optimizer.step()
        self.assertLess(loss().item(),before*.2)
        self.assertFalse(torch.equal(original,model.encoder.weight_ih_l0))
        checkpoint=model.state_dict();restored=DialogueGRU(**model.config);restored.load_state_dict(checkpoint)
        self.assertEqual(model.generate(source[:1],10),restored.generate(source[:1],10))
        self.assertEqual(restored.generate(source[:1],10),[10,11])

if __name__=='__main__':unittest.main()

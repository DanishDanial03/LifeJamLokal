"""Thesis FR18–21: normalization, SBERT embeddings, cosine ranking."""
import os
os.environ.setdefault('HF_HOME', '/workspace/.cache/huggingface')
from functools import lru_cache
import re
import unicodedata
from contextlib import asynccontextmanager
from fastapi import FastAPI
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer
import numpy as np
import torch
torch.set_num_threads(int(os.environ.get("TORCH_NUM_THREADS", "2")))

MODEL = 'sentence-transformers/all-MiniLM-L6-v2'
model = None

def preprocess(text: str) -> str:
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFKC', text).lower()).strip()

@asynccontextmanager
async def lifespan(app):
    global model
    model = SentenceTransformer(MODEL, device='cpu')
    yield

app = FastAPI(title='LifeJamLokal semantic recommendations', lifespan=lifespan)

class Profile(BaseModel):
    id: int
    text: str = Field(max_length=12000)

class RankRequest(BaseModel):
    query: str = Field(min_length=1, max_length=1000)
    profiles: list[Profile] = Field(max_length=10000)

@lru_cache(maxsize=4096)
def embed(text):
    return model.encode(preprocess(text), normalize_embeddings=True).tolist()

@app.get('/health')
def health():
    return {'ready': model is not None, 'model': MODEL, 'dimensions': 384}

@app.post('/rank')
def rank(body: RankRequest):
    query = np.array(embed(body.query))
    embeddings = [{'id': p.id, 'vector': embed(p.text)} for p in body.profiles]
    # Normalized vectors make their dot product equal to cosine similarity.
    results = sorted([{'id': e['id'], 'score': round(float(np.dot(query, e['vector'])), 6)} for e in embeddings], key=lambda x: x['score'], reverse=True)
    return {'model': MODEL, 'results': results, 'embeddings': embeddings}

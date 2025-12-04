"""
Embedding service using Modal endpoint
Supports Modal API (default), local model, and HuggingFace Inference API
"""
import os
from typing import List, Optional
import httpx

# Configuration: Modal endpoint (default and recommended)
MODAL_EMBEDDING_URL = os.getenv(
    'MODAL_EMBEDDING_URL',
    'https://farahalmashad75--optimized-colab-embedding-api-embedder--3d91ab.modal.run'
)

# Fallback options (only used if Modal is not available)
USE_LOCAL_MODEL = os.getenv('USE_LOCAL_EMBEDDING_MODEL', 'false').lower() == 'true'
HUGGINGFACE_API_KEY = os.getenv('HUGGINGFACE_API_KEY', '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')
MODEL_NAME = 'Supabase/gte-small'  # 384D model

# For local model (only loaded if USE_LOCAL_MODEL is true)
_model = None
_tokenizer = None

def load_model():
    """Load the model and tokenizer (lazy loading) - CPU compatible"""
    global _model, _tokenizer
    if _model is None or _tokenizer is None:
        try:
            import torch
            from transformers import AutoModel, AutoTokenizer
            
            print(f"🔄 Loading model {MODEL_NAME} on CPU...")
            print("⚠️ Note: CPU inference may be slower. Consider using HuggingFace API for faster results.")
            
            _tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
            _model = AutoModel.from_pretrained(MODEL_NAME)
            _model.eval()  # Set to evaluation mode
            
            # Explicitly move to CPU (no GPU needed)
            if torch.cuda.is_available():
                print("✅ GPU detected, but using CPU for compatibility")
            else:
                print("✅ Using CPU (no GPU detected)")
            
            print(f"✅ Model {MODEL_NAME} loaded successfully")
        except ImportError:
            raise ImportError("PyTorch and transformers not installed. Run: pip install torch transformers")
    return _model, _tokenizer

async def get_embedding_huggingface_api(text: str, target_dimensions: int = 384) -> List[float]:
    """Generate embedding using HuggingFace Inference API (no local model needed)"""
    text = text[:8000]  # Character limit
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://api-inference.huggingface.co/pipeline/feature-extraction/{MODEL_NAME}",
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {HUGGINGFACE_API_KEY}',
                },
                json={
                    'inputs': text,
                    'options': {'wait_for_model': True}
                },
                timeout=60.0
            )
            
            if not response.is_success:
                error_text = response.text
                raise Exception(f"HuggingFace API failed ({response.status_code}): {error_text}")
            
            embedding = response.json()
            
            # Handle different response formats
            if isinstance(embedding, list) and isinstance(embedding[0], list):
                embedding_vector = embedding[0]
            elif isinstance(embedding, list):
                embedding_vector = embedding
            else:
                raise Exception(f"Unexpected response format: {type(embedding)}")
            
            # Ensure correct dimensions
            if len(embedding_vector) != target_dimensions:
                if len(embedding_vector) > target_dimensions:
                    embedding_vector = embedding_vector[:target_dimensions]
                else:
                    embedding_vector = embedding_vector + [0.0] * (target_dimensions - len(embedding_vector))
            
            print(f"✅ Generated {len(embedding_vector)}D embedding via HuggingFace API")
            return embedding_vector
            
    except Exception as e:
        print(f"❌ Error with HuggingFace API: {e}")
        raise

def get_embedding_local(text: str, target_dimensions: int = 384) -> List[float]:
    """
    Generate embedding using local Supabase/gte-small model (CPU compatible)
    Returns a 384-dimensional vector
    """
    import torch
    
    # Truncate text if too long (model has token limits)
    max_length = 512  # Typical limit for these models
    text = text[:8000]  # Character limit
    
    try:
        model, tokenizer = load_model()
        
        # Tokenize input
        encoded_input = tokenizer(
            text,
            padding=True,
            truncation=True,
            max_length=max_length,
            return_tensors='pt'
        )
        
        # Generate embeddings (forward pass) - CPU compatible
        with torch.no_grad():
            model_output = model(**encoded_input)
        
        # Apply mean pooling and normalization (same as user's Python code)
        token_embeddings = model_output.last_hidden_state
        
        # Calculate attention mask to find non-padding tokens
        input_mask_expanded = encoded_input['attention_mask'].unsqueeze(-1).expand(
            token_embeddings.size()
        ).float()
        
        # Sum the token embeddings, ignoring padding
        sum_embeddings = torch.sum(token_embeddings * input_mask_expanded, 1)
        
        # Divide by the number of non-padding tokens
        sum_mask = torch.clamp(input_mask_expanded.sum(1), min=1e-9)
        mean_pooled_embedding = sum_embeddings / sum_mask
        
        # Normalize the vector
        embedding_vector = torch.nn.functional.normalize(
            mean_pooled_embedding, p=2, dim=1
        ).squeeze().tolist()
        
        # Ensure correct dimensions
        if len(embedding_vector) != target_dimensions:
            if len(embedding_vector) > target_dimensions:
                embedding_vector = embedding_vector[:target_dimensions]
            else:
                # Pad with zeros (shouldn't happen with gte-small, but just in case)
                embedding_vector = embedding_vector + [0.0] * (target_dimensions - len(embedding_vector))
        
        print(f"✅ Generated {len(embedding_vector)}D embedding (local CPU)")
        return embedding_vector
        
    except Exception as e:
        print(f"❌ Error generating embedding locally: {e}")
        raise

async def get_embedding_modal(text: str, target_dimensions: int = 384) -> List[float]:
    """
    Generate embedding using Modal endpoint (default and recommended)
    Follows the same pattern as the working example
    """
    text = text[:8000]  # Character limit
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                MODAL_EMBEDDING_URL,
                json={"text": text},
                headers={"Content-Type": "application/json"},
                timeout=30.0
            )
            
            print(f"Modal Embedding Status Code: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                embedding = result.get('embedding')
                
                if embedding is None:
                    raise Exception("Modal API returned 200 but no 'embedding' field in response")
                
                # Ensure correct dimensions
                if len(embedding) != target_dimensions:
                    if len(embedding) > target_dimensions:
                        embedding = embedding[:target_dimensions]
                    else:
                        embedding = embedding + [0.0] * (target_dimensions - len(embedding))
                
                print(f"✅ Generated {len(embedding)}D embedding via Modal API")
                return embedding
            else:
                error_text = response.text
                print(f"❌ Modal API Error Response: {error_text}")
                raise Exception(f"Modal API failed ({response.status_code}): {error_text}")
                
    except Exception as e:
        print(f"❌ Error with Modal API: {e}")
        raise

async def get_embedding(text: str, target_dimensions: int = 384) -> List[float]:
    """
    Generate embedding - uses Modal API by default (recommended)
    Falls back to HuggingFace API or local model if Modal fails
    """
    # Try Modal first (default)
    try:
        return await get_embedding_modal(text, target_dimensions)
    except Exception as modal_error:
        print(f"⚠️ Modal embedding failed: {modal_error}")
        print("🔄 Falling back to alternative embedding method...")
        
        # Fallback to HuggingFace or local model
        if USE_LOCAL_MODEL:
            return get_embedding_local(text, target_dimensions)
        else:
            return await get_embedding_huggingface_api(text, target_dimensions)


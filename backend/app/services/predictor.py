import numpy as np
import time
import os
from backend.app.constants import CONFIDENCE_THRESHOLD
from langchain_core.messages import HumanMessage


def predict_ticket(subject, body, manager):
    
    start_time = time.time()

    combined_text = f"Subject: {subject} | Body: {body}"

    vector = manager.embedder.encode([combined_text])

    probabilities = manager.router_model.predict_proba(vector)[0]

    confidence = float(np.max(probabilities))

    predicted_cluster = int(np.argmax(probabilities))

    latency = round((time.time() - start_time) * 1000, 2)

    if confidence >= CONFIDENCE_THRESHOLD:
        return {
            "routing": {
                "engine": "Machine Learning",
                "cluster_id": predicted_cluster,
                "queue": manager.category_map[predicted_cluster],
                "confidence": round(confidence, 4)
            },
            "metrics": {
                "latency_ms": latency,
                "llm_used": False,
                "cost_usd": 0.0,
                "tokens_used": 0
            }
        }
    
    valid_queues = list(manager.category_map.values())

    prompt = f"""
    You are an expert IT Support Dispatcher.
    Classify this ticket into EXACTLY ONE of these queues:
    {valid_queues}
    
    Ticket Subject: {subject}
    Ticket Body: {body}
    
    Return ONLY the exact queue name from the list provided. Do not include markdown, extra text, or punctuation.
    """
    
    response = manager.llm.invoke([HumanMessage(content=prompt)])

    if isinstance(response.content, list):
        raw_queue = response.content[0]["text"]
    else:
        raw_queue = response.content

    # --- TEXT SANITIZATION GUARD ---
    # Strip whitespace, quotes, backticks, and common markdown wrappers
    assigned_queue = raw_queue.strip().strip('"').strip("'").strip("`").strip()
    
    # If Gemini wrapped it in a label like "Queue: Hardware", isolate just the queue name
    if ":" in assigned_queue:
        assigned_queue = assigned_queue.split(":")[-1].strip()

    # Fallback to make sure it matches one of your valid queues if Gemini hallucinated a new name
    matched_queue = next((q for q in valid_queues if q.lower() in assigned_queue.lower()), assigned_queue)

    # Check if usage_metadata exists and grab total_tokens directly
    if hasattr(response, 'usage_metadata') and response.usage_metadata:
        tokens = response.usage_metadata.get('total_tokens', 0)
    else:
        tokens = 0

    total_latency = round((time.time() - start_time) * 1000, 2)

    cost_per_million = float(os.getenv("GEMINI_FLASH_COST_PER_1M", 0.15))
    calculated_cost = (tokens / 1_000_000) * cost_per_million
    
    return {
        "routing": {
            # Shortened to ensure it fits strict VARCHAR database constraints
            "engine": "LLM Fallback", 
            "queue": matched_queue,
            "confidence": round(confidence, 4)
        },
        "metrics": {
            "latency_ms": total_latency,
            "llm_used": True,
            "cost_usd": round(calculated_cost, 6),
            "tokens_used": tokens
        }
    }
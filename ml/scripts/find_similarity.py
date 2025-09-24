"""
Find the most similar known error for a given input using pgvector similarity.

Reads JSON from stdin: {"error_text": "..."}
Writes JSON of the best match to stdout.
"""

import sys
import json
import os
from transformers import pipeline
import psycopg2
import numpy as np
from dotenv import load_dotenv
load_dotenv()

# Same embedder as used for seeding to keep vector space consistent.
embedder = pipeline("feature-extraction", model="sentence-transformers/all-MiniLM-L6-v2")

def get_embedding(text):
    """Generates a 384-dimension vector embedding for the given text."""
    result = embedder(text)
    # The model output is nested; extract the primary vector.
    return result[0][0]

def main():
    input_data = sys.stdin.read()
    data = json.loads(input_data)
    error_text = data.get("error_text")

    if not error_text:
        print(json.dumps({"error": "No error_text provided"}))
        return

    query_embedding = get_embedding(error_text)
    # pgvector expects the vector as a string representation of a list.
    query_embedding_str = str(query_embedding)

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print(json.dumps({"error": "DATABASE_URL not set in environment"}))
        return
    
    conn = psycopg2.connect(database_url)
    cur = conn.cursor()

    # Use the cosine distance operator (<=>) from pgvector for efficient similarity search.
    # `1 - distance` converts distance to similarity (0=dissimilar, 1=identical).
    cur.execute(
        """
        SELECT 
            id, 
            "errorText", 
            solution, 
            category, 
            1 - ("errorEmbedding" <=> %s) as similarity
        FROM "KnownError"
        ORDER BY "errorEmbedding" <=> %s
        LIMIT 1
        """,
        (query_embedding_str, query_embedding_str)
    )
    
    best_match_row = cur.fetchone()

    cur.close()
    conn.close()

    if best_match_row:
        id_, error_text_db, solution, category, similarity = best_match_row
        best_match = {
            "id": id_,
            "errorText": error_text_db,
            "solution": solution,
            "category": category,
            "similarity": similarity
        }
        print(json.dumps(best_match))
    else:
        print(json.dumps({"error": "No matches found"}))

if __name__ == "__main__":
    main()
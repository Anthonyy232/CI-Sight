"""
Seed known error examples into the database.

This script generates embeddings using a sentence-transformer and inserts
rows into the KnownError table. It expects DATABASE_URL in the environment.
"""

import sys
import json
import os
from transformers import pipeline
import psycopg2
from dotenv import load_dotenv
load_dotenv()

# Lightweight sentence embedding model used for semantic similarity.
embedder = pipeline("feature-extraction", model="sentence-transformers/all-MiniLM-L6-v2")

# Sample known errors
known_errors = [
    {
        "errorText": "npm ERR! ERESOLVE unable to resolve dependency tree",
        "solution": "Check package.json for conflicting dependencies. Try npm install --legacy-peer-deps or update conflicting packages.",
        "category": "Dependency Error"
    },
    {
        "errorText": "Module not found: Can't resolve 'react'",
        "solution": "Install React: npm install react react-dom",
        "category": "Dependency Error"
    },
    {
        "errorText": "SyntaxError: Unexpected token",
        "solution": "Check for syntax errors in your code, such as missing semicolons or brackets.",
        "category": "Syntax Error"
    },
    {
        "errorText": "TypeError: Cannot read property 'x' of undefined",
        "solution": "Add null checks or use optional chaining: obj?.x",
        "category": "Runtime Error"
    },
    {
        "errorText": "FAIL src/App.test.js",
        "solution": "Check your test file for failing assertions. Run npm test to see detailed output.",
        "category": "Test Failure"
    }
]

def get_embedding(text):
    result = embedder(text)
    # The model outputs a nested list, get the actual vector
    return result[0][0]

def main():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL not set in environment")
        return
    
    conn = psycopg2.connect(database_url)
    cur = conn.cursor()

    # Clear the table before seeding to avoid duplicates on re-runs
    cur.execute('TRUNCATE TABLE "KnownError" RESTART IDENTITY;')
    print("Cleared existing known errors.")

    for error in known_errors:
        embedding = get_embedding(error["errorText"])
        
        # Convert list to string format pgvector expects: '[1.2, 3.4, ...]'
        embedding_str = str(embedding)

        cur.execute(
            'INSERT INTO "KnownError" ("errorText", "errorEmbedding", "solution", "category") VALUES (%s, %s, %s, %s)',
            (error["errorText"], embedding_str, error["solution"], error["category"])
        )

    conn.commit()
    cur.close()
    conn.close()
    print(f"Seeded {len(known_errors)} known errors.")

if __name__ == "__main__":
    main()
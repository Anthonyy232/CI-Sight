"""
Classify a log snippet into one of provided labels using zero-shot classification.

Input: JSON on stdin: {"log_text": "...", "labels": ["...", "..."]}
Output: JSON on stdout: {"category": "...", "confidence": 0.9}

The script truncates the log to the last 2048 characters because the end of the
log typically contains the most relevant error information and to respect model
token limits.
"""

import sys
import json
from transformers import pipeline

classifier = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")

def main():
    input_data = sys.stdin.read()
    data = json.loads(input_data)

    log_text = data.get("log_text")
    candidate_labels = data.get("labels")

    # Truncate log text to respect the model's token limit.
    # The end of the log is usually the most relevant for errors.
    truncated_log = log_text[-2048:]

    result = classifier(truncated_log, candidate_labels)

    # Simplify the verbose output from the pipeline to a clean JSON object.
    best_guess = {
        "category": result["labels"][0],
        "confidence": result["scores"][0]
    }

    print(json.dumps(best_guess))

if __name__ == "__main__":
    main()

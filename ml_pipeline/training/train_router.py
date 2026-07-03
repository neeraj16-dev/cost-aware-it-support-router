import time
import pandas as pd
import joblib
import json
import numpy as np
# from sklearn.linear_model import LogisticRegression
# from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier
from sklearn.utils.class_weight import compute_sample_weight
from sklearn.metrics import accuracy_score, f1_score, classification_report
from ml_pipeline.config import MODELS_DIR, ARTIFACTS_DIR

print("Loading embeddings from the disk...")
X = joblib.load(ARTIFACTS_DIR / "embeddings.joblib")
y_raw = joblib.load(ARTIFACTS_DIR / "real_labels.joblib")

unique_queues = sorted(list(set(y_raw)))
queue_to_id = {queue: idx for idx, queue in enumerate(unique_queues)}
id_to_queue = {idx: queue for idx, queue in enumerate(unique_queues)}

y = np.array([queue_to_id[label] for label in y_raw])

print("\nSaving the production Category Map...")
with open(ARTIFACTS_DIR / "category_map.json", "w", encoding="utf-8") as f:
    json.dump({str(k): v for k, v in id_to_queue.items()}, f, indent=4)
print("Saved category_map.json")

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

# models = {
#     "Logistic Regression": LogisticRegression(max_iter=1000, random_state=42),
#     "Random Forest": RandomForestClassifier(n_estimators=150, random_state=42, n_jobs=-1),
#     "XGBoost": XGBClassifier(use_label_encoder=False, eval_metric='mlogloss', random_state=42)
# }

# results = []

# print("\nTraining and Evaluating the models...")

# for name, model in models.items():
#     start_train = time.time()
#     model.fit(X_train, y_train)
#     train_time = time.time() - start_train

#     start_infer =time.time()
#     y_pred = model.predict(X_test)
#     infer_time = time.time() - start_infer

#     per_ticket_ms = (infer_time/len(X_test)) * 100

#     acc = accuracy_score(y_test, y_pred)
#     f1 = f1_score(y_test, y_pred, average='weighted')

#     results.append({
#         "Model": name,
#         "Accuracy": round(acc,4),
#         "F1 Score": round(f1,4),
#         "Train Time (s)": round(train_time,2),
#         "Inference per ticket (ms)": round(per_ticket_ms, 3) 
#     })


# results_df = pd.DataFrame(results)
# results_df = results_df.sort_values(by="F1 Score", ascending=False).reset_index(drop=True)

# print("\nBAKE-OFF results:-")
# print(results_df.to_string())

# winner_name = results_df.iloc[0]['Model']
# winning_model = models[winner_name]

# print(f"\nAnalyzing Confidence Thresholds for the Winner: {winner_name}")
# probabilities = winning_model.predict_proba(X_test)
# max_confidences = probabilities.max(axis=1)

# above_80 = (max_confidences >= 0.80).sum()
# percent_above_80 = (above_80 / len(max_confidences)) * 100

# print(f"Tickets dynamically routed by ML (Cost = $0): {percent_above_80:.1f}%")
# print(f"Tickets sent to LLM for deep analysis: {100 - percent_above_80:.1f}%")

print("\nCalculating Class Weights to handle dataset imbalance...")
sample_weights = compute_sample_weight(class_weight='balanced', y = y_train)

print("\nTraining XGBoost...")

model = XGBClassifier(
    objective = 'multi:softprob',
    eval_metric = 'mlogloss',
    random_state = 42,
    n_estimators = 200,
    learning_rate = 0.1
)

start_train = time.time()

model.fit(X_train, y_train, sample_weight=sample_weights)
print(f"Training completed in {round(time.time() - start_train, 2)} seconds.")

print("\n--- DEEP DIVE: PRODUCTION CLASSIFICATION REPORT ---")
y_pred = model.predict(X_test)
print(classification_report(y_test, y_pred, target_names=unique_queues))

# Check Confidence Threshold Routing Metrics
probabilities = model.predict_proba(X_test)
max_confidences = probabilities.max(axis=1)
above_80 = (max_confidences >= 0.80).sum()
percent_above_80 = (above_80 / len(max_confidences)) * 100

print(f"\nTickets dynamically routed by ML (Cost = $0): {percent_above_80:.1f}%")
print(f"Tickets sent to LLM for deep analysis: {100 - percent_above_80:.1f}%")

print("\nSaving production model...")
joblib.dump(model, MODELS_DIR / "fast_router_model.joblib")
print("Done! Restart your FastAPI server to test the new logic.")
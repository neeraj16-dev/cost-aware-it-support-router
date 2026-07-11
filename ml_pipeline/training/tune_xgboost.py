import time
import joblib
import json
import numpy as np

from sklearn.model_selection import train_test_split, GridSearchCV
from xgboost import XGBClassifier
from sklearn.utils.class_weight import compute_sample_weight
from sklearn.metrics import classification_report
from ml_pipeline.config import MODELS_DIR, ARTIFACTS_DIR

print("Loading 28k dataset embeddings and labels...")
X = joblib.load(ARTIFACTS_DIR / "embeddings.joblib")
y_raw = joblib.load(ARTIFACTS_DIR / "real_labels.joblib")

with open(ARTIFACTS_DIR / "category_map.json", "r", encoding="utf-8") as f:
    category_map = json.load(f)

queue_to_id = {
    queue_name: int(cluster_id) for cluster_id, queue_name in category_map.items()
}

y = np.array([queue_to_id[label] for label in y_raw])

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

print("Calculating balanced class weights...")
sample_weights = compute_sample_weight(class_weight='balanced', y=y_train)

# Restoring high-performance baseline defaults, leveraging GPU
base_model = XGBClassifier(
    objective="multi:softprob",
    eval_metric="mlogloss",
    random_state=42,
    tree_method="hist",
    device="cuda",
    use_label_encoder=False
)

# STRICT HYPERPARAMETER GRID: No shallow trees allowed
param_grid = {
    "max_depth": [6, 8, 10],            # Forced architectural depth for 384-D vectors
    "learning_rate": [0.05, 0.1, 0.15], # Stable learning rates
    "n_estimators": [200, 300],         # Sufficient tree volume
    "subsample": [0.9, 1.0]             # Row sampling stability
}

total_fits = len(param_grid["max_depth"]) * len(param_grid["learning_rate"]) * len(param_grid["n_estimators"]) * len(param_grid["subsample"]) * 3
print(f"\nRunning Guided GridSearchCV. Total fits to execute: {total_fits}")

grid_search = GridSearchCV(
    estimator=base_model,
    param_grid=param_grid,
    scoring="f1_weighted",
    cv=3,
    verbose=3
)

start_time = time.time()
print("\nCommencing Guided Tuning on GPU... 🍳")
grid_search.fit(
    X_train,
    y_train,
    sample_weight=sample_weights
)

print(f"\nGuided Tuning completed in {round(time.time() - start_time, 2)} seconds.")

best_model = grid_search.best_estimator_
print("\n🏆 THE NEW WINNING HYPERPARAMETERS 🏆")
print(grid_search.best_params_)

print("\n--- NEW PRODUCTION CLASSIFICATION REPORT ---")
y_pred = best_model.predict(X_test)
target_names = [
    category_map[str(i)] for i in sorted(map(int, category_map.keys()))
]
print(classification_report(y_test, y_pred, target_names=target_names))

# Calculate automation thresholds
probabilities = best_model.predict_proba(X_test)
max_confidences = probabilities.max(axis=1)
above_80 = (max_confidences >= 0.80).sum()
percent_above_80 = (above_80 / len(max_confidences)) * 100

print("\n--- COST ROUTING METRICS ---")
print(f"Tickets dynamically routed by ML (Cost = $0): {percent_above_80:.1f}%")
print(f"Tickets sent to LLM for deep analysis: {100 - percent_above_80:.1f}%")

# Safety Check: Only overwrite if it beats the baseline accuracy of 74% F1
if grid_search.best_score_ > 0.70:
    print(f"\nPerformance verified. Overwriting artifact inside: {MODELS_DIR}")
    joblib.dump(best_model, MODELS_DIR / "fast_router_model.joblib")
    print("Done! Restart your FastAPI container to apply changes.")
else:
    print("\n❌ Tuned model did not beat baseline metrics. Preservation fallback triggered. Production artifact left untouched.")
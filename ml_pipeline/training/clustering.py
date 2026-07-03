import pandas as pd
from sentence_transformers import SentenceTransformer
from sklearn.cluster import KMeans
import joblib
from ml_pipeline.config import DATA_DIR, ARTIFACTS_DIR

df = pd.read_csv(DATA_DIR / "aa_dataset-tickets-multi-lang-5-2-50-version.csv")

df['combined_text'] = "Subject: " + df['subject'].astype(str) + " | Body: " + df['body'].astype(str)

df = df.dropna(subset=['combined_text', 'queue'])

print("Initializing local HuggingFace embedding model on GPU...")
embedding_model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')

df_sample = df.copy()
print("Generating semantic embeddings for 5000 rows...")
embeddings = embedding_model.encode(df_sample['combined_text'].tolist(), show_progress_bar=True, batch_size=64)
print(f"Embedding Matrix Shape: {embeddings.shape}")

QUEUE_MAPPING = {
    "Technical Support": "Tech & IT Support",
    "IT Support": "Tech & IT Support",
    "Product Support": "Tech & IT Support",
    
    "Customer Service": "Customer Ops & Sales",
    "Returns and Exchanges": "Customer Ops & Sales",
    "Sales and Pre-Sales": "Customer Ops & Sales",
    "General Inquiry": "Customer Ops & Sales",
    
    "Billing and Payments": "Billing & Finance",
    "Service Outages and Maintenance": "Outages & Infrastructure",
    "Human Resources": "Internal & HR"
}

df_sample['macro_queue'] = df_sample['queue'].map(QUEUE_MAPPING)

print("\nSaving data artifacts for the supervised training pipeline...")
joblib.dump(embeddings, ARTIFACTS_DIR / "embeddings.joblib")
joblib.dump(df_sample["macro_queue"].values,
            ARTIFACTS_DIR / "real_labels.joblib")
print("Saved artifacts successfully!")
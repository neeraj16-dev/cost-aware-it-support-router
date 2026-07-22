import logging
import pandas as pd
import numpy as np
import joblib
from sqlmodel import Session, select
from sentence_transformers import SentenceTransformer
from xgboost import XGBClassifier
from sklearn.preprocessing import LabelEncoder

from backend.app.db.database import engine
from backend.app.db.models import TicketLog

logger = logging.getLogger(__name__)

def run_active_learning_pipeline(manager):
    """
    Background task: Harvests corrected tickets, merges with base CSV, retrains XGBoost, and hot-reloads.
    """
    logger.info("BACKGROUND TASK STARTED: Initiating Active Learning Pipeline...")
    
    try:
        # 1. Harvest corrected tickets from PostgreSQL
        with Session(engine) as db:
            statement = select(TicketLog).where(TicketLog.is_reassigned == True)
            corrected_tickets = db.exec(statement).all()

        if not corrected_tickets:
            logger.info("No corrected tickets found in DB. Skipping retraining.")
            return

        logger.info(f"Harvested {len(corrected_tickets)} corrected tickets. Merging with base data...")

        new_data = []
        for t in corrected_tickets:
            new_data.append({
                "Subject": t.subject,
                "Body": t.body,
                "Queue": t.corrected_queue
            })
        df_new = pd.DataFrame(new_data)
        df_new["combined_text"] = df_new["Subject"] + " - " + df_new["Body"]

        # 2. Load the original CSV dataset
        csv_path = "ml_pipeline/data/it_support_tickets.csv"
        try:
            df_base = pd.read_csv(csv_path)
            df_base["combined_text"] = df_base["Subject"] + " - " + df_base["Body"]
        except Exception as e:
            logger.error(f"Could not load base CSV at {csv_path}: {e}")
            return

        # Combine datasets to prevent catastrophic forgetting
        df_combined = pd.concat([df_base, df_new], ignore_index=True)

        # 3. Generate Embeddings for everything
        logger.info("Generating embeddings for the updated dataset...")
        # We reuse the embedder already loaded in the manager to save RAM!
        embedder = manager.embedder 
        X_text = df_combined["combined_text"].tolist()
        X_embeddings = embedder.encode(X_text, show_progress_bar=False)

        # 4. Encode labels
        le = LabelEncoder()
        y_encoded = le.fit_transform(df_combined["Queue"])

        # 5. Train XGBoost
        logger.info("Training new XGBoost model...")
        model = XGBClassifier(
            n_estimators=100,
            max_depth=6,
            learning_rate=0.1,
            random_state=42
        )
        model.fit(X_embeddings, y_encoded)

        # 6. Save Model & Encoders
        model_path = "ml_pipeline/models/fast_router_model.joblib"
        joblib.dump({
            'model': model,
            'label_encoder': le,
            'category_map': dict(zip(le.transform(le.classes_), le.classes_))
        }, model_path)
        
        logger.info("Model saved successfully. Hot-reloading into API memory...")

        # 7. Hot-Swap the model in the live API
        manager.reload_model()
        
        logger.info("BACKGROUND TASK COMPLETE: System is now using the newly trained brain!")

    except Exception as e:
        logger.error(f"BACKGROUND TASK FAILED: {str(e)}")

class ModelManager:

    def __init__(self):
        self.embedder = None
        self.router_model = None
        self.category_map = None
        self.llm = None

    def reload_model(self):
        """Hot-swaps the new XGBoost model into RAM without restarting FastAPI"""
        import joblib
        import logging
        logger = logging.getLogger(__name__)
        
        try:
            data = joblib.load("ml_pipeline/models/fast_router_model.joblib")
            self.router_model = data['model']
            self.category_map = data['category_map']
            logger.info("Successfully hot-reloaded the new XGBoost model into memory!")
        except Exception as e:
            logger.error(f"Failed to reload model: {e}")

manager = ModelManager()
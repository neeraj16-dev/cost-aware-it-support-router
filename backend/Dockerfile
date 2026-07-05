FROM python:3.12-slim

WORKDIR /app

# Pull from backend/ requirements
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend and ml_pipeline into the container
COPY backend/ backend/
COPY ml_pipeline/ ml_pipeline/

EXPOSE 8000

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
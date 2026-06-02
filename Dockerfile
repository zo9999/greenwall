FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ backend/

CMD gunicorn --chdir backend app:app --bind 0.0.0.0:${PORT:-5000}

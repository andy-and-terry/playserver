FROM python:3.11-slim

WORKDIR /app

# Install dependencies using the top-level requirements.txt
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy server source
COPY server/ ./

# Pre-create data subdirectories
RUN mkdir -p /app/data/uploads /app/data/outputs

ENV DATA_DIR=/app/data
ENV HOST=0.0.0.0
ENV PORT=8000

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

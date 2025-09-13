FROM python:3.11-slim
WORKDIR /app
COPY src/demo/main.py /app/
COPY data/data.json /app/
RUN pip install fastapi uvicorn
ENV DATA_PATH=/app/data.json
CMD ["uvicorn","main:app","--host","0.0.0.0","--port","8080"]
